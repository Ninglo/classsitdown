import * as XLSX from 'xlsx';
import type { MakeupDataset, MakeupClassMeta, MakeupOccurrence, MakeupSlot, StageKey, MultiStageStore } from '../types/makeup';
import { ALL_STAGES } from '../types/makeup';

const STORAGE_KEY = 'amber_makeup_data'; // legacy single-stage key
const MULTI_STAGE_KEY = 'amber_makeup_stages';

// ── Multi-stage localStorage persistence ──

export function loadMultiStageStore(): MultiStageStore {
  try {
    const raw = localStorage.getItem(MULTI_STAGE_KEY);
    if (raw) return JSON.parse(raw) as MultiStageStore;
  } catch { /* fall through */ }

  // Migrate legacy single-stage data
  try {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const data = JSON.parse(legacy) as MakeupDataset;
      const stage = (data.meta?.active_stage || 'L2') as StageKey;
      const store: MultiStageStore = { stages: { [stage]: data }, activeStage: stage };
      localStorage.setItem(MULTI_STAGE_KEY, JSON.stringify(store));
      localStorage.removeItem(STORAGE_KEY);
      return store;
    }
  } catch { /* fall through */ }

  return { stages: {}, activeStage: 'L2' };
}

export function saveMultiStageStore(store: MultiStageStore): void {
  localStorage.setItem(MULTI_STAGE_KEY, JSON.stringify(store));
}

export function loadStageData(stage: StageKey): MakeupDataset | null {
  const store = loadMultiStageStore();
  return store.stages[stage] ?? null;
}

export function saveStageData(stage: StageKey, data: MakeupDataset): void {
  const store = loadMultiStageStore();
  store.stages[stage] = data;
  store.activeStage = stage;
  saveMultiStageStore(store);
}

export function clearStageData(stage: StageKey): void {
  const store = loadMultiStageStore();
  delete store.stages[stage];
  saveMultiStageStore(store);
}

export function getLoadedStages(): { stage: StageKey; classCount: number; occCount: number }[] {
  const store = loadMultiStageStore();
  const result: { stage: StageKey; classCount: number; occCount: number }[] = [];
  for (const s of ALL_STAGES) {
    const d = store.stages[s];
    if (d) result.push({ stage: s, classCount: d.classes.length, occCount: d.occurrences.length });
  }
  return result;
}

// Legacy compat — returns any loaded data (first available stage)
export function loadMakeupData(): MakeupDataset | null {
  const store = loadMultiStageStore();
  return store.stages[store.activeStage] ?? Object.values(store.stages)[0] ?? null;
}

export function saveMakeupData(data: MakeupDataset): void {
  const stage = (data.meta?.active_stage || 'L2') as StageKey;
  saveStageData(stage, data);
}

export function clearMakeupData(): void {
  const store = loadMultiStageStore();
  delete store.stages[store.activeStage];
  saveMultiStageStore(store);
}

// ── JSON import ──

export async function parseJsonImport(file: File): Promise<MakeupDataset> {
  const text = await file.text();
  const data = JSON.parse(text) as MakeupDataset;
  if (!Array.isArray(data.classes) || !Array.isArray(data.occurrences)) {
    throw new Error('JSON 格式不正确：缺少 classes 或 occurrences');
  }
  return data;
}

// ── XLSX import ──

const DAY_MAP: Record<string, string> = {
  '星期一': '周一', '星期二': '周二', '星期三': '周三', '星期四': '周四',
  '星期五': '周五', '星期六': '周六', '星期日': '周日',
  '周一': '周一', '周二': '周二', '周三': '周三', '周四': '周四',
  '周五': '周五', '周六': '周六', '周日': '周日', '周天': '周日',
};

const DAY_SORT: Record<string, number> = {
  '周一': 1,
  '周二': 2,
  '周三': 3,
  '周四': 4,
  '周五': 5,
  '周六': 6,
  '周日': 7,
};

function normalizeSpace(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = String(val);
  if (typeof val === 'number' && Number.isInteger(val)) s = String(val);
  return s.replace(/\r/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeDay(val: unknown): string {
  const s = normalizeSpace(val);
  return DAY_MAP[s] || s;
}

function normalizeTime(val: unknown): string {
  const s = normalizeSpace(val);
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s;
}

function normalizeLesson(val: unknown): string {
  return normalizeSpace(String(val ?? '').replace(/\n/g, ' '));
}

function inferCampus(room: string): string {
  room = normalizeSpace(room);
  if (!room) return '';
  if (room.startsWith('七彩')) return '七彩';
  if (room.startsWith('C86')) return 'C86';
  const m = room.match(/^([A-Za-z0-9+]+校区|[A-Za-z0-9+]+)/);
  return m ? m[1] : room;
}

function modeFromWeekLabel(label: string): '周中' | '周末' | '' {
  const s = normalizeSpace(label);
  if (s.includes('周中')) return '周中';
  if (s.includes('周末')) return '周末';
  return '';
}

function detectStageFromName(name: string): StageKey {
  const m = name.match(/L(\d)/i);
  if (m) {
    const key = `L${m[1]}` as StageKey;
    if (ALL_STAGES.includes(key)) return key;
  }
  return 'L2'; // default
}

function indexOfNth(headers: string[], label: string, nth = 1): number {
  let count = 0;
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] !== label) continue;
    count += 1;
    if (count === nth) return i;
  }
  return -1;
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] as unknown[]).map((v) => normalizeSpace(v).replace(/\n/g, ' '));
    if (!cells.includes('班级')) continue;
    const weekdayHits = cells.filter((v) => v === '周内时间').length;
    const weekendHits = cells.filter((v) => v === '周末时间').length;
    if (weekdayHits >= 1 && weekendHits >= 1) return i;
  }
  return 0;
}

function isDateLikeHeader(label: string): boolean {
  const s = normalizeSpace(label);
  return /^W\d+/i.test(s) || /(?:\d{1,2}\.\d{1,2})(?:\s*[-—]\s*\d{1,2}\.\d{1,2})?/.test(s);
}

function parseDateParts(label: string): { sm: number; sd: number; em: number; ed: number } | null {
  const s = normalizeSpace(label).replace(/\s+/g, '');
  const range = s.match(/(\d{1,2})\.(\d{1,2})(?:[-—](\d{1,2})\.(\d{1,2}))?/);
  if (!range) return null;
  const sm = parseInt(range[1], 10);
  const sd = parseInt(range[2], 10);
  const em = range[3] ? parseInt(range[3], 10) : sm;
  const ed = range[4] ? parseInt(range[4], 10) : sd;
  return { sm, sd, em, ed };
}

function getSchoolYears(sourceName: string): { startYear: number; endYear: number } {
  const explicit = sourceName.match(/20\d{2}/);
  if (explicit) {
    const endYear = parseInt(explicit[0], 10);
    return { startYear: endYear - 1, endYear };
  }
  const now = new Date();
  const endYear = now.getMonth() + 1 >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  return { startYear: endYear - 1, endYear };
}

function toSchoolDate(month: number, day: number, years: { startYear: number; endYear: number }): Date {
  const year = month >= 7 ? years.startYear : years.endYear;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatRange(parts: { sm: number; sd: number; em: number; ed: number }): string {
  return `${parts.sm}.${parts.sd}-${parts.em}.${parts.ed}`;
}

function mondayKey(date: Date): string {
  const monday = new Date(date);
  const weekday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - weekday);
  return monday.toISOString().slice(0, 10);
}

function inferModes(rawLabel: string, helperText: string, parts: { sm: number; sd: number; em: number; ed: number } | null): Array<'周中' | '周末'> {
  const combined = `${helperText} ${rawLabel}`.replace(/\s+/g, '');
  const hasWeekday = /周内|周中|补周[一二三四五]/.test(combined);
  const hasWeekend = /周末|周六|周天|周日/.test(combined);
  if (hasWeekday && !hasWeekend) return ['周中'];
  if (hasWeekend && !hasWeekday) return ['周末'];
  if (hasWeekday && hasWeekend) return ['周中', '周末'];
  if (!parts) return [];
  const start = new Date(2024, parts.sm - 1, parts.sd);
  const end = new Date(2024, parts.em - 1, parts.ed);
  const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  return spanDays <= 2 ? ['周末'] : ['周中'];
}

function shouldSkipLesson(lesson: string): boolean {
  const normalized = normalizeLesson(lesson).replace(/[／]/g, '/');
  if (!normalized) return true;
  if (['/', '\\', '放假', '假期', '不上课'].includes(normalized)) return true;
  return false;
}

export async function parseXlsxImport(file: File, stageOverride?: StageKey): Promise<MakeupDataset> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const detectedStage = stageOverride ?? detectStageFromName(file.name);

  const sheetName = wb.SheetNames.find((n) => n.includes('进度表'));
  if (!sheetName) throw new Error('找不到"进度表"工作表');
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
  if (rows.length < 2) throw new Error('进度表为空');

  const headerRowIndex = findHeaderRow(rows);
  const helperRows = rows.slice(0, headerRowIndex);
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const headerRow = rows[headerRowIndex] as unknown[];
  const headers = Array.from({ length: columnCount }, (_, idx) => normalizeSpace(headerRow[idx]).replace(/\n/g, ' '));
  const years = getSchoolYears(file.name);

  const classIdx = indexOfNth(headers, '班级', 1);
  const batchIdx = indexOfNth(headers, '开班批次', 1);
  const weekdayDayIdx = indexOfNth(headers, '周内时间', 1);
  const weekendDayIdx = indexOfNth(headers, '周末时间', 1);
  const weekdayTeacherIdx = indexOfNth(headers, '周内教师', 1);
  const weekendTeacherIdx = indexOfNth(headers, '周末教师', 1);
  const headTeacherIdx = indexOfNth(headers, '周内班主任', 1);
  const weekdayTimeIdx = indexOfNth(headers, '周内时间', 2);
  const weekendTimeIdx = indexOfNth(headers, '周末时间', 2);
  const weekdayRoomIdx = indexOfNth(headers, '周内教室', 1);
  const weekendRoomIdx = indexOfNth(headers, '周末教室', 1);
  const lessonStartIdx = Math.max(
    headers.findIndex((h) => isDateLikeHeader(h)),
    headers.findIndex((h) => h.includes('开学第一节')),
    headers.findIndex((h) => h.includes('上学期常规课')),
  );
  if (classIdx < 0 || lessonStartIdx < 0) {
    throw new Error('进度表表头结构无法识别，请确认是否仍为总表原始格式');
  }

  const weekCols: Array<{ colIdx: number; labels: Array<{ mode: '周中' | '周末'; weekLabel: string }> }> = [];
  const weekOrder = new Map<string, number>();
  const invalidWeekLabels: string[] = [];
  for (let i = lessonStartIdx; i < headers.length; i++) {
    const rawLabel = headers[i];
    const helperText = helperRows.map((row) => normalizeSpace((row as unknown[])[i])).filter(Boolean).join(' ');
    if (!rawLabel && !helperText) continue;

    const parts = parseDateParts(rawLabel);
    const modes = inferModes(rawLabel, helperText, parts);
    if (!parts || modes.length === 0) {
      if (rawLabel && !invalidWeekLabels.includes(rawLabel)) invalidWeekLabels.push(rawLabel);
      continue;
    }

    const weekBaseKey = mondayKey(toSchoolDate(parts.sm, parts.sd, years));
    if (!weekOrder.has(weekBaseKey)) weekOrder.set(weekBaseKey, weekOrder.size + 1);
    const weekNum = weekOrder.get(weekBaseKey)!;
    weekCols.push({
      colIdx: i,
      labels: modes.map((mode) => ({
        mode,
        weekLabel: `W${weekNum} ${mode} [${formatRange(parts)}]`,
      })),
    });
  }

  const classes: Record<string, MakeupClassMeta> = {};
  const occurrences: MakeupOccurrence[] = [];
  const slotOrder: Record<string, MakeupSlot> = {};

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const classCode = normalizeSpace(row[classIdx]).toUpperCase();
    if (!classCode) continue;

    const weekdayRoom = weekdayRoomIdx >= 0 ? normalizeSpace(row[weekdayRoomIdx]) : '';
    const weekendRoom = weekendRoomIdx >= 0 ? normalizeSpace(row[weekendRoomIdx]) : '';

    const meta: MakeupClassMeta = {
      class_code: classCode,
      batch: batchIdx >= 0 ? normalizeSpace(row[batchIdx]) : '',
      type: '',
      head_teacher: headTeacherIdx >= 0 ? normalizeSpace(row[headTeacherIdx]) : '',
      grade: '',
      student_count: '',
      weekday: {
        day: weekdayDayIdx >= 0 ? normalizeDay(row[weekdayDayIdx]) : '',
        time: weekdayTimeIdx >= 0 ? normalizeTime(row[weekdayTimeIdx]) : '',
        teacher: weekdayTeacherIdx >= 0 ? normalizeSpace(row[weekdayTeacherIdx]) : '',
        campus: inferCampus(weekdayRoom),
        room: weekdayRoom,
      },
      weekend: {
        day: weekendDayIdx >= 0 ? normalizeDay(row[weekendDayIdx]) : '',
        time: weekendTimeIdx >= 0 ? normalizeTime(row[weekendTimeIdx]) : '',
        teacher: weekendTeacherIdx >= 0 ? normalizeSpace(row[weekendTeacherIdx]) : '',
        campus: inferCampus(weekendRoom),
        room: weekendRoom,
      },
    };
    classes[classCode] = meta;

    for (const schedule of [meta.weekday, meta.weekend]) {
      if (schedule.day && schedule.time) {
        const key = `${schedule.day} ${schedule.time}`;
        slotOrder[key] ??= { day: schedule.day, time: schedule.time };
      }
    }

    for (const { colIdx, labels } of weekCols) {
      const lesson = normalizeLesson(row[colIdx]);
      if (shouldSkipLesson(lesson)) continue;
      for (const { mode, weekLabel } of labels) {
        const schedule = mode === '周中' ? meta.weekday : meta.weekend;
        if (!schedule.day || !schedule.time) continue;
        occurrences.push({
          id: `${classCode}__${weekLabel}__${mode}`,
          class_code: classCode,
          week_label: weekLabel,
          week_col: colIdx + 1,
          mode,
          lesson,
          day: schedule.day,
          time: schedule.time,
          teacher: schedule.teacher,
          campus: schedule.campus,
          room: schedule.room,
          grade: meta.grade,
          type: meta.type,
          head_teacher: meta.head_teacher,
          student_count: meta.student_count,
        });
      }
    }
  }

  const slots = Object.values(slotOrder).sort((a, b) => (DAY_SORT[a.day] ?? 9) - (DAY_SORT[b.day] ?? 9) || a.time.localeCompare(b.time));
  const classList = Object.values(classes).sort((a, b) => a.class_code.localeCompare(b.class_code));
  if (!classList.length) throw new Error('没有识别到任何班级，请确认班级列是否存在');
  if (!occurrences.length) throw new Error('没有识别到任何课次，请确认总表仍包含日期列和进度内容');

  // Extract stage catalog from other sheets
  const supportedStages = extractStageCatalog(wb, classList.length, occurrences.length);

  return {
    classes: classList,
    occurrences,
    slots,
    meta: {
      active_stage: detectedStage,
      supported_stages: supportedStages,
      source_name: file.name,
      imported_at: new Date().toISOString().replace(/\.\d+Z$/, ''),
      invalid_week_labels: invalidWeekLabels,
    },
  };
}

function extractStageCatalog(
  wb: XLSX.WorkBook,
  classCount: number,
  lessonCount: number,
): MakeupDataset['meta']['supported_stages'] {
  const counts: Record<string, Record<string, number>> = { weekday: {}, weekend: {} };
  for (const [sheetName, bucket] of [['周中', 'weekday'], ['周末', 'weekend']] as const) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    for (let r = 1; r < rows.length; r++) {
      const family = normalizeStageFamily(normalizeSpace((rows[r] as unknown[])[1]));
      if (family) counts[bucket][family] = (counts[bucket][family] || 0) + 1;
    }
  }

  const allKeys = new Set([...Object.keys(counts.weekday), ...Object.keys(counts.weekend)]);
  const sorted = [...allKeys].sort((a, b) => (a === 'L2' ? -1 : b === 'L2' ? 1 : a.localeCompare(b)));

  const stages = sorted.map((key) => ({
    key,
    label: key,
    enabled: key === 'L2',
    status: key === 'L2' ? '已接入' : '预留中',
    weekday_count: counts.weekday[key] || 0,
    weekend_count: counts.weekend[key] || 0,
    entry_count: (counts.weekday[key] || 0) + (counts.weekend[key] || 0),
    note: key === 'L2' ? '当前可直接补课匹配' : '已预留学段位，后续补进度映射即可启用',
    ...(key === 'L2' ? { class_count: classCount, lesson_count: lessonCount } : {}),
  }));

  if (!stages.some((s) => s.key === 'L2')) {
    stages.unshift({
      key: 'L2', label: 'L2', enabled: true, status: '已接入',
      weekday_count: 0, weekend_count: 0, entry_count: 0,
      note: '当前可直接补课匹配', class_count: classCount, lesson_count: lessonCount,
    });
  }
  return stages;
}

function normalizeStageFamily(val: string): string {
  if (!val) return '';
  const patterns: [RegExp, string][] = [
    [/L0/i, 'L0'], [/L1/i, 'L1'], [/L2/i, 'L2'], [/L3/i, 'L3'],
    [/L4/i, 'L4'], [/L5/i, 'L5'], [/L6/i, 'L6'],
    [/PreA\+/i, 'PreA+'], [/S班/, 'S班'], [/二段/, '二段'], [/中文/, '中文'],
  ];
  for (const [re, family] of patterns) {
    if (re.test(val)) return family;
  }
  return val;
}
