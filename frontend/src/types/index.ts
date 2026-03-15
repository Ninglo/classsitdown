export interface ClassInfo {
  id: string;
  name: string;
  squadId?: string;
}

export interface StudentRecord {
  studentId: string;
  chineseName: string;
  englishName: string;
  classCode: string;
}

export interface ResourceEntry {
  resourceName: string;
  resourceType: string;
  columns: Record<string, string | number | null>;
}

export interface StudentData extends StudentRecord {
  resources: ResourceEntry[];
  dailyCheckIns: number;
  classParticipation: number;
  bonusItems: BonusItem[];
}

export interface BonusItem {
  name: string;
  amount: number;
  studentIds: string[];
}

export interface MPBreakdown {
  studentId: string;
  chineseName: string;
  englishName: string;
  基础落实: number;
  每日开口: number;
  课堂参与: number;
  个性化奖励: number;
  total: number;
}

export type SchemeId = 'scheme1' | 'scheme2' | 'custom';

export interface CustomRuleEntry {
  resourceType: string;
  field: string;
  condition: string;
  amount: number;
}

export interface SchemeConfig {
  id: SchemeId;
  name: string;
  description: string;
  customRules?: CustomRuleEntry[];
}

export type Module = '基础落实' | '每日开口' | '课堂参与' | '个性化奖励';

export type AppScreen = 'login' | 'welcome' | 'flow';

export interface AppState {
  screen: AppScreen;
  teacherName: string;
  classes: ClassInfo[];
  selectedClass: ClassInfo | null;
}
