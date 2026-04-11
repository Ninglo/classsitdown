export type TimeMode = 'weekday' | 'weekend';
export type LayoutType = 'circular' | 'rows' | 'arc';
export type ThemeName = 'paper' | 'classic' | 'mint' | 'rose' | 'apricot' | 'golden' | 'plum';
export type OcrEngineMode = 'hybrid' | 'tencent' | 'local';
export type TencentOcrAction = 'Auto' | 'ExtractDocMulti' | 'GeneralAccurateOCR' | 'GeneralBasicOCR';

export interface LocationInfo {
  date: string;
  day: string;
  weekday: string;
  time: string;
  campus: string;
  floor: string;
  room: string;
  notes: string;
  fullDate: string;
}

export interface RowGroup {
  left: string[];
  right: string[];
}

export interface RowGroups {
  rows: RowGroup[];
}

export interface ArcGroups {
  rows: string[][];
}

export interface TimeModeData {
  layout: LayoutType;
  groups: string[][] | null;
  groupOrder: number[] | null;
  rowGroups: RowGroups | null;
  arcGroups: ArcGroups | null;
  currentArrangement: number;
  locationInfo: LocationInfo;
}

export interface ClassSnapshot {
  theme: ThemeName;
  weekday: TimeModeData;
  weekend: TimeModeData;
}

export interface ReminderNote {
  id: string;
  text: string;
  dueDate: string;
  source: 'manual' | 'weekly';
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface CnfBinding {
  squadId: string;
  squadType: 'offline' | 'online';
  sessionToken: string;
  loginUsername: string;
  lastSyncedAt: string;
}

export interface ClassConfig extends ClassSnapshot {
  previousWeek: ClassSnapshot | null;
  cnf: CnfBinding | null;
  todoNotes: ReminderNote[];
}

export type ClassData = Record<string, ClassConfig>;

export interface UserProfile {
  username: string;
  theme: ThemeName;
}

export interface ReminderMeta {
  enabled: boolean;
  panelCollapsed: boolean;
  weeklyConfirmedWeek: number;
  weeklyConfirmedAt: string;
  lastAlertDate: string;
}

export interface OCRSettings {
  engine: OcrEngineMode;
  allowLocalFallback: boolean;
  tencentEndpoint: string;
  tencentRegion: string;
  tencentAction: TencentOcrAction;
}

export interface AppState {
  isEditMode: boolean;
  currentArrangement: number;
  currentTimeMode: TimeMode;
  currentLayout: LayoutType;
  currentView: 'home' | 'editor';
  groups: string[][];
  currentGroupOrder: number[];
  rowGroups: RowGroups;
  arcGroups: ArcGroups;
  classData: ClassData;
  userProfile: UserProfile;
}
