import type {
  AppState,
  ArcGroups,
  ClassData,
  LayoutType,
  RotationConfig,
  LocationInfo,
  RowGroups,
  ReminderMeta,
  ThemeName,
  TimeModeData,
  UserProfile
} from './types';

export const CIRCULAR_GROUP_SIZE = 6;
export const ROW_GROUP_SIZE = 6;
export const ARC_ROW_SIZE = 18;

export const makeEmptyCircularGroups = (): string[][] =>
  Array.from({ length: 6 }, () => Array(CIRCULAR_GROUP_SIZE).fill(''));

export const makeEmptyRowGroups = (): RowGroups => ({
  rows: Array.from({ length: 3 }, () => ({
    left: Array(ROW_GROUP_SIZE).fill(''),
    right: Array(ROW_GROUP_SIZE).fill('')
  }))
});

export const makeEmptyArcGroups = (): ArcGroups => ({
  rows: [Array(ARC_ROW_SIZE).fill(''), Array(ARC_ROW_SIZE).fill('')]
});

export const makeEmptyLocationInfo = (): LocationInfo => ({
  date: '',
  day: '',
  weekday: '',
  time: '',
  campus: '',
  floor: '',
  room: '',
  notes: '',
  fullDate: ''
});

export const makeModeData = (layout: LayoutType = 'circular'): TimeModeData => ({
  layout,
  groups: null,
  groupOrder: null,
  rowGroups: null,
  arcGroups: null,
  currentArrangement: 0,
  locationInfo: makeEmptyLocationInfo()
});

export const makeClassShell = (layout: LayoutType = 'circular', theme: ThemeName = 'paper') => ({
  theme,
  weekday: makeModeData(layout),
  weekend: makeModeData(layout),
  previousWeek: null,
  cnf: null,
  todoNotes: []
});

export const makeDefaultProfile = (): UserProfile => ({
  username: '',
  theme: 'paper' as ThemeName
});

export const makeDefaultReminderMeta = (): ReminderMeta => ({
  enabled: false,
  panelCollapsed: false,
  weeklyConfirmedWeek: 0,
  weeklyConfirmedAt: '',
  lastAlertDate: ''
});

export const createInitialState = (): AppState => ({
  isEditMode: false,
  currentArrangement: 0,
  currentTimeMode: 'weekday',
  currentLayout: 'circular',
  currentView: 'home',
  groups: makeEmptyCircularGroups(),
  currentGroupOrder: [1, 2, 3, 4, 5, 6],
  rowGroups: makeEmptyRowGroups(),
  arcGroups: makeEmptyArcGroups(),
  classData: {} as ClassData,
  userProfile: makeDefaultProfile(),
  rotationConfig: { groupRotation: 'clockwise', internalRotation: 'right2' }
});
