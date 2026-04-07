export interface MakeupScheduleDetail {
  day: string;
  time: string;
  teacher: string;
  campus: string;
  room: string;
}

export interface MakeupClassMeta {
  class_code: string;
  batch: string;
  type: string;
  head_teacher: string;
  grade: string;
  student_count: string;
  weekday: MakeupScheduleDetail;
  weekend: MakeupScheduleDetail;
}

export interface MakeupOccurrence {
  id: string;
  class_code: string;
  week_label: string;
  week_col: number;
  mode: '周中' | '周末';
  lesson: string;
  day: string;
  time: string;
  teacher: string;
  campus: string;
  room: string;
  grade: string;
  type: string;
  head_teacher: string;
  student_count: string;
}

export interface MakeupSlot {
  day: string;
  time: string;
}

export interface StageMeta {
  key: string;
  label: string;
  enabled: boolean;
  status: string;
  weekday_count: number;
  weekend_count: number;
  entry_count: number;
  note: string;
  class_count?: number;
  lesson_count?: number;
}

export interface MakeupDataset {
  classes: MakeupClassMeta[];
  occurrences: MakeupOccurrence[];
  slots: MakeupSlot[];
  meta: {
    active_stage: string;
    supported_stages: StageMeta[];
    source_name: string;
    imported_at: string;
    invalid_week_labels: string[];
  };
}

export interface ScoredCandidate {
  candidate: MakeupOccurrence;
  pct: number;
  sortKey: number;
  reasons: { text: string; good: boolean }[];
}

export interface QuickParseResult {
  classCode: string | null;
  missedDay: string | null;
  missedOccId: string | null;
  makeupPairs: { day: string; time: string }[];
  makeupDaysOnly: string[];
  weekTag: string | null;
  weekSource: string | null;
  feedbackLines: string[];
  selectionError: string | null;
}

export interface WeekContext {
  currentWeek: string | null;
  currentWeekMode: '周中' | '周末';
  weekDateMap: Map<string, { start: Date; end: Date }>;
  invalidWeekLabels: string[];
}
