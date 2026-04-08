import type { DayOfWeek } from '../types';
import type {
  ChallengeItem,
  CommunicationGroup,
  CommunicationPlan,
  CommunicationRecord,
  CustomBlock,
  ListeningMaterialItem,
  MediaAnnotation,
  MediaItem,
  OverviewClassMemory,
  OverviewContent,
  OverviewDraft,
  PhaseChallengeKey,
  PhaseChallengeRow,
} from '../types/overview';
import { sortStudentNames } from './classProfiles';

const DRAFT_STORAGE_KEY = 'amber_overview_drafts_v2';
const MEMORY_STORAGE_KEY = 'amber_overview_memory_v2';

const PHASE_KEYS: PhaseChallengeKey[] = ['夯实基础', '维稳达标', '突破拔高'];

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createMediaAnnotation(type: MediaAnnotation['type']): MediaAnnotation {
  return {
    id: uid(type),
    type,
    x: type === 'text' ? 8 : 18,
    y: type === 'text' ? 8 : 18,
    width: type === 'text' ? 28 : 34,
    height: type === 'text' ? 12 : 24,
    text: type === 'text' ? '标注文字' : '',
    color: type === 'text' ? '#7ba862' : '#e58a4b',
  };
}

export function createMediaItem(name = ''): MediaItem {
  return {
    id: uid('media'),
    src: '',
    name,
    caption: '',
    displayWidth: 140,
    annotations: [],
  };
}

export function createChallengeItem(): ChallengeItem {
  return {
    id: uid('challenge'),
    title: '',
    detail: '',
    media: [],
  };
}

export function createListeningItem(): ListeningMaterialItem {
  return {
    id: uid('listen'),
    english: '',
    chinese: '',
  };
}

function createCommunicationGroup(memory?: OverviewClassMemory): CommunicationGroup {
  return {
    id: uid('comm_group'),
    label: '第1组',
    selectedStudents: [],
    teacherName: memory?.preferredCommunicationTeacher ?? '',
    scheduleText: memory?.preferredCommunicationSchedule ?? '',
    note: '',
  };
}

function cloneCommunicationGroup(group: CommunicationGroup): CommunicationGroup {
  return {
    ...group,
    selectedStudents: sortStudentNames(group.selectedStudents),
  };
}

export function normalizeCommunicationPlan(plan: CommunicationPlan): CommunicationPlan {
  const groups = plan.groups.length > 0 ? plan.groups.map(cloneCommunicationGroup) : [createCommunicationGroup()];
  return {
    groups,
    selectedStudents: sortStudentNames(groups.flatMap((group) => group.selectedStudents)),
    teacherName: String(plan.teacherName || ''),
    scheduleText: String(plan.scheduleText || ''),
    note: String(plan.note || ''),
  };
}

function normalizeStoredCommunicationPlan(raw: unknown): CommunicationPlan {
  const plan = raw && typeof raw === 'object' ? (raw as Partial<CommunicationPlan>) : {};
  const groups = Array.isArray(plan.groups) && plan.groups.length > 0
    ? plan.groups
        .filter((group): group is CommunicationGroup => Boolean(group && typeof group === 'object'))
        .map((group, index) => cloneCommunicationGroup({
          id: String(group.id || uid('comm_group')),
          label: String(group.label || `第${index + 1}组`),
          selectedStudents: Array.isArray(group.selectedStudents) ? group.selectedStudents.map((name) => String(name || '').trim()).filter(Boolean) : [],
          teacherName: String(group.teacherName || ''),
          scheduleText: String(group.scheduleText || ''),
          note: String(group.note || ''),
        }))
    : [{
        id: uid('comm_group'),
        label: '第1组',
        selectedStudents: sortStudentNames(Array.isArray(plan.selectedStudents) ? plan.selectedStudents.map((name) => String(name || '').trim()).filter(Boolean) : []),
        teacherName: String(plan.teacherName || ''),
        scheduleText: String(plan.scheduleText || ''),
        note: String(plan.note || ''),
      }];

  return normalizeCommunicationPlan({
    groups,
    selectedStudents: Array.isArray(plan.selectedStudents) ? plan.selectedStudents.map((name) => String(name || '').trim()).filter(Boolean) : [],
    teacherName: String(plan.teacherName || ''),
    scheduleText: String(plan.scheduleText || ''),
    note: String(plan.note || ''),
  });
}

export function createCustomBlock(): CustomBlock {
  return {
    id: uid('custom'),
    title: '补充内容',
    mode: 'text',
    text: '',
    table: {
      columns: ['项目', '内容'],
      rows: [['', '']],
    },
    media: [],
  };
}

function createCommunicationPlan(memory?: OverviewClassMemory): CommunicationPlan {
  const groups = memory?.communicationGroups?.length
    ? memory.communicationGroups.map(cloneCommunicationGroup)
    : [createCommunicationGroup(memory)];
  return normalizeCommunicationPlan({
    groups,
    selectedStudents: [],
    teacherName: memory?.preferredCommunicationTeacher ?? '',
    scheduleText: memory?.preferredCommunicationSchedule ?? '',
    note: '',
  });
}

function clonePhaseChallenge(row: PhaseChallengeRow): PhaseChallengeRow {
  return {
    ...row,
    selectedStudents: [...row.selectedStudents],
  };
}

function createDefaultPhaseChallenges(studentNames: string[], memory?: OverviewClassMemory): PhaseChallengeRow[] {
  const remembered = memory?.phaseChallenges?.length
    ? memory.phaseChallenges.map(clonePhaseChallenge)
    : PHASE_KEYS.map((key) => ({
        id: uid('phase'),
        key,
        label: key,
        selectedStudents: [],
        challengeContent: '',
        method: '',
      }));

  const validNames = new Set(studentNames);
  return remembered.map((row) => ({
    ...row,
    selectedStudents: sortStudentNames(row.selectedStudents.filter((name) => validNames.has(name))),
  }));
}

function cloneCustomBlock(block: CustomBlock): CustomBlock {
  return {
    ...block,
    table: {
      columns: [...block.table.columns],
      rows: block.table.rows.map((row) => [...row]),
    },
    media: block.media.map((item) => ({
      ...item,
      displayWidth: item.displayWidth ?? 140,
      annotations: item.annotations.map((annotation) => ({ ...annotation })),
    })),
  };
}

function createWeeklyChallenges(orderedDays: DayOfWeek[]): OverviewContent['weeklyChallenges'] {
  return orderedDays.map((day) => ({ day, task: '' }));
}

export function loadDraft(classCode: string, week: number): OverviewContent | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const drafts = JSON.parse(raw) as Record<string, OverviewDraft>;
    const content = drafts[`${classCode}_W${week}`]?.content ?? null;
    if (!content) return null;
    return {
      ...content,
      communicationPlan: normalizeStoredCommunicationPlan((content as OverviewContent).communicationPlan),
    };
  } catch {
    return null;
  }
}

function saveDraftMap(drafts: Record<string, OverviewDraft>): void {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

export function saveDraft(content: OverviewContent): void {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    const drafts = raw ? (JSON.parse(raw) as Record<string, OverviewDraft>) : {};
    drafts[`${content.classCode}_W${content.week}`] = {
      content: {
        ...content,
        communicationPlan: normalizeCommunicationPlan(content.communicationPlan),
      },
      updatedAt: Date.now(),
    };
    saveDraftMap(drafts);
  } catch {
    // ignore localStorage failures
  }
}

export function loadClassMemory(classCode: string): OverviewClassMemory | null {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, OverviewClassMemory>;
    return all[classCode] ?? null;
  } catch {
    return null;
  }
}

function saveClassMemory(memory: OverviewClassMemory): void {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, OverviewClassMemory>) : {};
    all[memory.classCode] = memory;
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore localStorage failures
  }
}

export function createEmptyContent(
  classCode: string,
  week: number,
  options?: { orderedDays?: DayOfWeek[]; studentNames?: string[] },
): OverviewContent {
  const orderedDays = options?.orderedDays?.length
    ? options.orderedDays
    : (['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as DayOfWeek[]);
  const studentNames = options?.studentNames ?? [];
  const memory = loadClassMemory(classCode);

  return {
    classCode,
    week,
    theme: 'green',
    challengeStartDay: orderedDays[0] ?? '周一',
    weeklyChallenges: createWeeklyChallenges(orderedDays),
    phaseChallenges: createDefaultPhaseChallenges(studentNames, memory ?? undefined),
    challengeItems: [],
    listeningMaterials: [],
    listeningFont: 'guide',
    communicationPlan: createCommunicationPlan(memory ?? undefined),
    customBlocks: memory?.customBlocks?.length
      ? memory.customBlocks.map(cloneCustomBlock)
      : [createCustomBlock()],
  };
}

export function syncWeeklyChallengeDays(
  current: OverviewContent['weeklyChallenges'],
  orderedDays: DayOfWeek[],
): OverviewContent['weeklyChallenges'] {
  return orderedDays.map((day) => ({
    day,
    task: current.find((item) => item.day === day)?.task ?? '',
  }));
}

export function syncPhaseChallenges(
  phaseChallenges: PhaseChallengeRow[],
  studentNames: string[],
): PhaseChallengeRow[] {
  const valid = new Set(studentNames);
  return phaseChallenges.map((row) => ({
    ...row,
    selectedStudents: sortStudentNames(row.selectedStudents.filter((name) => valid.has(name))),
  }));
}

export function rememberReusableContent(content: OverviewContent, studentNames: string[]): void {
  const memory = loadClassMemory(content.classCode) ?? {
    classCode: content.classCode,
    preferredCommunicationTeacher: '',
    preferredCommunicationSchedule: '',
    communicationGroups: [],
    phaseChallenges: [],
    customBlocks: [],
    communicationHistory: [],
    updatedAt: 0,
  };

  const validNames = new Set(studentNames);
  const communicationPlan = normalizeCommunicationPlan(content.communicationPlan);
  const nextMemory: OverviewClassMemory = {
    ...memory,
    preferredCommunicationTeacher: communicationPlan.teacherName.trim(),
    preferredCommunicationSchedule: communicationPlan.groups[0]?.scheduleText.trim() ?? '',
    communicationGroups: communicationPlan.groups.map((group) => ({
      ...cloneCommunicationGroup(group),
      selectedStudents: sortStudentNames(group.selectedStudents.filter((name) => validNames.has(name))),
    })),
    phaseChallenges: content.phaseChallenges.map((row) => ({
      ...row,
      selectedStudents: sortStudentNames(row.selectedStudents.filter((name) => validNames.has(name))),
    })),
    customBlocks: content.customBlocks.map(cloneCustomBlock),
    updatedAt: Date.now(),
  };

  saveClassMemory(nextMemory);
}

export function addCommunicationRecord(
  classCode: string,
  record: Omit<CommunicationRecord, 'id' | 'createdAt'>,
): CommunicationRecord {
  const memory = loadClassMemory(classCode) ?? {
    classCode,
    preferredCommunicationTeacher: '',
    preferredCommunicationSchedule: '',
    communicationGroups: [],
    phaseChallenges: [],
    customBlocks: [],
    communicationHistory: [],
    updatedAt: 0,
  };

  const nextRecord: CommunicationRecord = {
    ...record,
    id: uid('comm'),
    createdAt: Date.now(),
  };

  memory.communicationHistory = [nextRecord, ...memory.communicationHistory].slice(0, 80);
  memory.preferredCommunicationTeacher = record.teacherName.trim();
  memory.preferredCommunicationSchedule = record.scheduleText.trim();
  memory.updatedAt = Date.now();
  saveClassMemory(memory);
  return nextRecord;
}

export function getCommunicationStats(classCode: string, studentNames: string[]): {
  contacted: string[];
  pending: string[];
  latestByStudent: Record<string, CommunicationRecord>;
} {
  const memory = loadClassMemory(classCode);
  const latestByStudent: Record<string, CommunicationRecord> = {};

  for (const record of memory?.communicationHistory ?? []) {
    for (const name of record.studentNames) {
      if (!latestByStudent[name]) {
        latestByStudent[name] = record;
      }
    }
  }

  const contacted = studentNames.filter((name) => Boolean(latestByStudent[name]));
  const pending = studentNames.filter((name) => !latestByStudent[name]);

  return {
    contacted: sortStudentNames(contacted),
    pending: sortStudentNames(pending),
    latestByStudent,
  };
}
