import type { MakeupOccurrence, WeekContext, QuickParseResult } from '../types/makeup';

const DAY_CHAR_MAP: Record<string, string> = {
  '一': '周一', '二': '周二', '三': '周三', '四': '周四',
  '五': '周五', '六': '周六', '日': '周日', '天': '周日',
};

const MISSED_KEYWORDS = ['请假', '缺课', '缺了', '请了假', '缺'];

// ── Week helpers ──

export function getWeekNumber(val: string | null): number | null {
  if (!val) return null;
  const m = val.match(/^W(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

export function getWeekTag(val: string | null): string | null {
  const n = getWeekNumber(val);
  return n !== null ? `W${n}` : null;
}

export function sameWeekTag(a: string, b: string): boolean {
  return !!a && !!b && getWeekTag(a) === getWeekTag(b);
}

// ── Week detection ──

export function initWeekDetection(occurrences: MakeupOccurrence[]): WeekContext {
  const weekDateMap = new Map<string, { start: Date; end: Date }>();
  const invalidWeekLabels: string[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const thisYear = today.getFullYear();

  for (const occ of occurrences) {
    const wm = occ.week_label.match(/^(W\d+)/);
    const dm = occ.week_label.match(/[\[【](\d{1,2})\.(\d{1,2})\s*-\s*(\d{1,2})\.(\d{1,2})[\]】]/);
    if (!wm || !dm) continue;
    const weekNum = wm[1];
    const s = new Date(thisYear, parseInt(dm[1], 10) - 1, parseInt(dm[2], 10));
    const e = new Date(thisYear, parseInt(dm[3], 10) - 1, parseInt(dm[4], 10), 23, 59, 59);
    if (!weekDateMap.has(weekNum)) {
      weekDateMap.set(weekNum, { start: s, end: e });
    } else {
      const entry = weekDateMap.get(weekNum)!;
      if (s < entry.start) entry.start = s;
      if (e > entry.end) entry.end = e;
    }
  }

  let currentWeek: string | null = null;
  for (const [wk, range] of weekDateMap) {
    if (today >= range.start && today <= range.end) {
      currentWeek = wk;
      break;
    }
  }
  if (!currentWeek) {
    let bestDist = Infinity;
    for (const [wk, range] of weekDateMap) {
      const dist = Math.min(
        Math.abs(today.getTime() - range.start.getTime()),
        Math.abs(today.getTime() - range.end.getTime()),
      );
      if (dist < bestDist) { bestDist = dist; currentWeek = wk; }
    }
  }

  const dow = today.getDay();
  const currentWeekMode: '周中' | '周末' = (dow === 0 || dow === 6) ? '周末' : '周中';

  return { currentWeek, currentWeekMode, weekDateMap, invalidWeekLabels };
}

// ── Resolve requested week ──

function resolveRequestedWeek(text: string, currentWeek: string | null): { weekTag: string; source: string } | null {
  const norm = text.replace(/\s+/g, '');
  const explicitPatterns = [
    /(?:^|[^\d])W(\d{1,2})(?:$|[^\d])/i,
    /(?:^|[^\d])WK(\d{1,2})(?:$|[^\d])/i,
    /(?:^|[^\d])WEEK(\d{1,2})(?:$|[^\d])/i,
    /第?(\d{1,2})周/,
  ];
  for (const pat of explicitPatterns) {
    const m = norm.match(pat);
    if (m) return { weekTag: `W${parseInt(m[1], 10)}`, source: `明确周次 W${parseInt(m[1], 10)}` };
  }
  const cwn = getWeekNumber(currentWeek);
  if (!cwn) return null;

  const relativeRules: { pattern: RegExp; offset: number; label: string }[] = [
    { pattern: /下下下周|下下下星期|下下下礼拜/, offset: 3, label: '下下下周' },
    { pattern: /下下周|下下星期|下下礼拜/, offset: 2, label: '下下周' },
    { pattern: /下周|下星期|下礼拜/, offset: 1, label: '下周' },
    { pattern: /这周|本周|这星期|本星期|这礼拜|本礼拜/, offset: 0, label: '本周' },
    { pattern: /上周|上星期|上礼拜/, offset: -1, label: '上周' },
  ];
  for (const rule of relativeRules) {
    if (rule.pattern.test(norm)) {
      const target = cwn + rule.offset;
      if (target > 0) return { weekTag: `W${target}`, source: `${rule.label} -> W${target}` };
    }
  }
  return null;
}

// ── Compare occurrences by week ──

function compareOccByWeek(a: MakeupOccurrence, b: MakeupOccurrence): number {
  const colA = Number.isFinite(a.week_col) ? a.week_col : Number.MAX_SAFE_INTEGER;
  const colB = Number.isFinite(b.week_col) ? b.week_col : Number.MAX_SAFE_INTEGER;
  if (colA !== colB) return colA - colB;
  const weekA = getWeekNumber(a.week_label) ?? Number.MAX_SAFE_INTEGER;
  const weekB = getWeekNumber(b.week_label) ?? Number.MAX_SAFE_INTEGER;
  if (weekA !== weekB) return weekA - weekB;
  if (a.mode !== b.mode) return a.mode === '周中' ? -1 : 1;
  if (a.day !== b.day) return a.day.localeCompare(b.day, 'zh-CN');
  return a.time.localeCompare(b.time, 'zh-CN');
}

export function getSortedWeekLabels(occs: MakeupOccurrence[]): string[] {
  const labels: string[] = [];
  for (const occ of occs.slice().sort(compareOccByWeek)) {
    if (occ.week_label && !labels.includes(occ.week_label)) labels.push(occ.week_label);
  }
  return labels;
}

function getSortedWeekTags(occs: MakeupOccurrence[]): string[] {
  return [...new Set(occs.map((o) => getWeekTag(o.week_label)).filter(Boolean) as string[])]
    .sort((a, b) => (getWeekNumber(a) ?? Infinity) - (getWeekNumber(b) ?? Infinity));
}

// ── Select missed lesson occurrence ──

export function selectMissedLesson(
  classCode: string,
  missedDay: string,
  preferredWeekTag: string | null,
  occByClass: Map<string, MakeupOccurrence[]>,
): {
  selected: MakeupOccurrence | null;
  matchedExactly: boolean;
  error: string | null;
  availableWeekLabels: string[];
} {
  if (!classCode || !missedDay) {
    return { selected: null, matchedExactly: false, error: null, availableWeekLabels: [] };
  }
  const missedMode = (missedDay === '周六' || missedDay === '周日') ? '周末' : '周中';
  const dayMatches = (occByClass.get(classCode) || []).filter((o) => o.day === missedDay);
  if (!dayMatches.length) {
    return { selected: null, matchedExactly: false, error: `该班级没有 ${missedDay} 的课次数据`, availableWeekLabels: [] };
  }
  const modeMatches = dayMatches.filter((o) => o.mode === missedMode);
  const pool = modeMatches.length ? modeMatches : dayMatches;
  const availableWeekLabels = getSortedWeekLabels(pool);

  if (preferredWeekTag) {
    const exact = pool.find((o) => sameWeekTag(o.week_label, preferredWeekTag));
    if (exact) return { selected: exact, matchedExactly: true, error: null, availableWeekLabels };
    const prefNum = getWeekNumber(preferredWeekTag);
    if (prefNum !== null) {
      const avail = availableWeekLabels.length ? `，当前只找到 ${availableWeekLabels.join(' / ')}` : '';
      return { selected: null, matchedExactly: false, error: `目标周次 ${preferredWeekTag} 没有对应课次${avail}`, availableWeekLabels };
    }
  }
  const fallback = pool.slice().sort(compareOccByWeek);
  return { selected: fallback[0] || null, matchedExactly: false, error: null, availableWeekLabels };
}

// ── Quick input parser ──

export function parseQuickInput(
  text: string,
  classesByCode: Map<string, unknown>,
  occByClass: Map<string, MakeupOccurrence[]>,
  weekCtx: WeekContext,
): QuickParseResult {
  const result: QuickParseResult = {
    classCode: null, missedDay: null, missedOccId: null,
    makeupPairs: [], makeupDaysOnly: [],
    weekTag: null, weekSource: null, feedbackLines: [], selectionError: null,
  };
  if (!text.trim()) return result;

  // 1. Class code
  const classMatch = text.match(/[A-Za-z]\d{2,4}/);
  if (classMatch) {
    const code = classMatch[0].toUpperCase();
    if (classesByCode.has(code)) result.classCode = code;
  }

  // 2. Day+time pairs
  const pairs: { day: string; time: string; pos: number }[] = [];
  const pairRe = /(?:周|星期)([一二三四五六日天])\s*(\d{1,2})[:：](\d{2})/g;
  let pm: RegExpExecArray | null;
  while ((pm = pairRe.exec(text)) !== null) {
    const day = DAY_CHAR_MAP[pm[1]] || `周${pm[1]}`;
    const time = pm[2].padStart(2, '0') + ':' + pm[3];
    pairs.push({ day, time, pos: pm.index });
  }

  // 3. Day-only references
  const allDays: { day: string; pos: number; paired: boolean }[] = [];
  const dayRe = /(?:周|星期)([一二三四五六日天])/g;
  let dm: RegExpExecArray | null;
  while ((dm = dayRe.exec(text)) !== null) {
    const day = DAY_CHAR_MAP[dm[1]] || `周${dm[1]}`;
    const paired = pairs.some((p) => Math.abs(p.pos - dm!.index) < 3);
    allDays.push({ day, pos: dm.index, paired });
  }

  // 4. Detect missed keyword
  let missedPos = -1;
  for (const kw of MISSED_KEYWORDS) {
    const idx = text.indexOf(kw);
    if (idx >= 0) { missedPos = idx; break; }
  }

  // 5. Interpret
  let missedDay: string | null = null;
  const makeupPairs: { day: string; time: string }[] = [];
  const makeupDaysOnly: string[] = [];

  if (missedPos >= 0) {
    const unpaired = allDays.filter((d) => !d.paired);
    const closest = unpaired.reduce<{ day: string; dist: number } | null>((best, d) => {
      const dist = Math.abs(d.pos - missedPos);
      return (!best || dist < best.dist) ? { day: d.day, dist } : best;
    }, null);
    if (closest && closest.dist < 20) missedDay = closest.day;
    if (!missedDay && pairs.length > 0) {
      const cp = pairs.reduce<{ ref: typeof pairs[0]; dist: number } | null>((best, p) => {
        const dist = Math.abs(p.pos - missedPos);
        return (!best || dist < best.dist) ? { ref: p, dist } : best;
      }, null);
      if (cp && cp.dist < 20) {
        missedDay = cp.ref.day;
        pairs.splice(pairs.indexOf(cp.ref), 1);
      }
    }
    for (const p of pairs) makeupPairs.push({ day: p.day, time: p.time });
    for (const d of allDays) {
      if (d.paired) continue;
      if (d.day === missedDay && Math.abs(d.pos - missedPos) < 20) continue;
      if (!makeupDaysOnly.includes(d.day)) makeupDaysOnly.push(d.day);
    }
  } else if (pairs.length >= 2) {
    missedDay = pairs[0].day;
    for (let i = 1; i < pairs.length; i++) makeupPairs.push({ day: pairs[i].day, time: pairs[i].time });
  } else if (pairs.length === 1) {
    makeupPairs.push({ day: pairs[0].day, time: pairs[0].time });
  } else {
    const unpaired = allDays.filter((d) => !d.paired);
    if (unpaired.length >= 2) {
      missedDay = unpaired[0].day;
      for (let i = 1; i < unpaired.length; i++) {
        if (!makeupDaysOnly.includes(unpaired[i].day)) makeupDaysOnly.push(unpaired[i].day);
      }
    }
  }

  // 6. Week resolution
  const reqWeek = resolveRequestedWeek(text, weekCtx.currentWeek);
  const targetWeekTag = reqWeek?.weekTag || weekCtx.currentWeek;
  result.weekTag = targetWeekTag;
  result.weekSource = reqWeek?.source || null;

  // 7. Select missed lesson
  if (missedDay && result.classCode) {
    const sel = selectMissedLesson(result.classCode, missedDay, targetWeekTag, occByClass);
    if (sel.selected) result.missedOccId = sel.selected.id;
    result.selectionError = sel.error;
  }

  result.missedDay = missedDay;
  result.makeupPairs = makeupPairs;
  result.makeupDaysOnly = makeupDaysOnly;

  // 8. Feedback
  const fb: string[] = [];
  if (result.classCode) fb.push('班级：' + result.classCode);
  if (reqWeek) fb.push('识别周次：' + reqWeek.source);
  if (missedDay) fb.push('缺课日：' + missedDay + (targetWeekTag ? `（${targetWeekTag}）` : ''));
  if (result.missedOccId) {
    const occ = (occByClass.get(result.classCode!) || []).find((o) => o.id === result.missedOccId);
    if (occ) fb.push('缺课内容：' + occ.lesson + '｜' + occ.week_label);
  } else if (result.selectionError) {
    fb.push('缺课内容：' + result.selectionError);
  }
  if (makeupPairs.length) fb.push('补课时间：' + makeupPairs.map((p) => p.day + ' ' + p.time).join('、'));
  if (makeupDaysOnly.length) fb.push('补课时间：' + makeupDaysOnly.join('、') + '（全部时段）');
  result.feedbackLines = fb;

  return result;
}
