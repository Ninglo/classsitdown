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

export async function parseXlsxImport(file: File, stageOverride?: StageKey): Promise<MakeupDataset> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const detectedStage = stageOverride ?? detectStageFromName(file.name);

  const sheetName = wb.SheetNames.find((n) => n.includes('进度表'));
  if (!sheetName) throw new Error('找不到"进度表"工作表');
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
  if (rows.length < 2) throw new Error('进度表为空');

  const headers = (rows[0] as unknown[]).map((v) => normalizeSpace(v).replace(/\n/g, ' '));

  // Find W-prefixed week columns
  const weekCols: [number, string][] = [];
  const invalidWeekLabels: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].startsWith('W')) {
      weekCols.push([i, headers[i]]);
      const mode = modeFromWeekLabel(headers[i]);
      const hasDateRange = /[\[【]\d{1,2}\.\d{1,2}\s*-\s*\d{1,2}\.\d{1,2}[\]】]/.test(headers[i]);
      if (!mode || !hasDateRange) {
        if (!invalidWeekLabels.includes(headers[i])) invalidWeekLabels.push(headers[i]);
      }
    }
  }

  const classes: Record<string, MakeupClassMeta> = {};
  const occurrences: MakeupOccurrence[] = [];
  const slotOrder: Record<string, MakeupSlot> = {};

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const classCode = normalizeSpace(row[0]).toUpperCase();
    if (!classCode) continue;

    const weekdayCampus = normalizeSpace(row[9]);
    const weekendRoom = normalizeSpace(row[13]);

    const meta: MakeupClassMeta = {
      class_code: classCode,
      batch: normalizeSpace(row[1]),
      type: normalizeSpace(row[2]),
      head_teacher: normalizeSpace(row[3]),
      grade: normalizeSpace(row[4]),
      student_count: normalizeSpace(row[5]),
      weekday: {
        day: normalizeDay(row[6]),
        time: normalizeTime(row[7]),
        teacher: normalizeSpace(row[8]),
        campus: weekdayCampus,
        room: normalizeSpace(row[10]),
      },
      weekend: {
        day: normalizeDay(row[11]),
        time: normalizeTime(row[12]),
        teacher: normalizeSpace(row[14]),
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

    for (const [colIdx, weekLabel] of weekCols) {
      const lesson = normalizeLesson(row[colIdx]);
      if (!lesson || lesson === '/') continue;
      const mode = modeFromWeekLabel(weekLabel);
      if (!mode) continue;
      const schedule = mode === '周中' ? meta.weekday : meta.weekend;
      occurrences.push({
        id: `${classCode}__${weekLabel}`,
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

  const DAY_SORT: Record<string, number> = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7 };
  const slots = Object.values(slotOrder).sort((a, b) => (DAY_SORT[a.day] ?? 9) - (DAY_SORT[b.day] ?? 9) || a.time.localeCompare(b.time));
  const classList = Object.values(classes).sort((a, b) => a.class_code.localeCompare(b.class_code));

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
