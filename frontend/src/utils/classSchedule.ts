import type { ClassInfo, DayOfWeek } from '../types';

export type WeeklySchedule = Partial<Record<DayOfWeek, string[]>>;

const STORAGE_KEY = 'amber_weekly_schedule';
const SEATING_STORAGE_KEY = 'classSeatingData';

export const ALL_DAYS: DayOfWeek[] = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const DAY_ORDER: Record<DayOfWeek, number> = {
  '周一': 1, '周二': 2, '周三': 3, '周四': 4,
  '周五': 5, '周六': 6, '周日': 7,
};

export function loadWeeklySchedule(): WeeklySchedule {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as WeeklySchedule;
  } catch {
    return {};
  }
}

export function saveWeeklySchedule(schedule: WeeklySchedule): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
}

function normalizeDayToken(token: string): DayOfWeek | null {
  const normalized = token.replace(/\s+/g, '');
  const map: Record<string, DayOfWeek> = {
    '周一': '周一',
    '星期一': '周一',
    '周二': '周二',
    '星期二': '周二',
    '周三': '周三',
    '星期三': '周三',
    '周四': '周四',
    '星期四': '周四',
    '周五': '周五',
    '星期五': '周五',
    '周六': '周六',
    '星期六': '周六',
    '周日': '周日',
    '星期日': '周日',
    '星期天': '周日',
    '周天': '周日'
  };
  return map[normalized] ?? null;
}

function extractDaysFromClassTime(classTime: string): DayOfWeek[] {
  const matches = classTime.match(/(?:星期|周)\s*[一二三四五六日天]/g) ?? [];
  const days = matches
    .map((item) => normalizeDayToken(item))
    .filter((item): item is DayOfWeek => Boolean(item));
  return [...new Set(days)];
}

function loadSeatingSchedule(): WeeklySchedule {
  try {
    const raw = localStorage.getItem(SEATING_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, {
      weekday?: { locationInfo?: { weekday?: string; time?: string } };
      weekend?: { locationInfo?: { weekday?: string; time?: string } };
    }>;

    const schedule: WeeklySchedule = {};
    for (const day of ALL_DAYS) {
      schedule[day] = [];
    }

    for (const [classCode, config] of Object.entries(parsed ?? {})) {
      const inferredDays = [
        ...(config?.weekday?.locationInfo?.weekday ? extractDaysFromClassTime(config.weekday.locationInfo.weekday) : []),
        ...extractDaysFromClassTime(
          [
            config?.weekday?.locationInfo?.weekday ?? '',
            config?.weekday?.locationInfo?.time ?? '',
            config?.weekend?.locationInfo?.weekday ?? '',
            config?.weekend?.locationInfo?.time ?? ''
          ].join(' ')
        )
      ];

      for (const day of [...new Set(inferredDays)]) {
        const current = schedule[day] ?? [];
        if (!current.includes(classCode)) {
          current.push(classCode);
          schedule[day] = current;
        }
      }
    }

    return schedule;
  } catch {
    return {};
  }
}

export function getResolvedSchedule(classCodes: string[]): WeeklySchedule {
  const seating = loadSeatingSchedule();
  const manual = loadWeeklySchedule();
  const resolved: WeeklySchedule = {};

  for (const day of ALL_DAYS) {
    const seatingList = (seating[day] ?? []).filter((code) => classCodes.includes(code));
    const manualList = (manual[day] ?? []).filter((code) => classCodes.includes(code) && !seatingList.includes(code));
    resolved[day] = [...seatingList, ...manualList];
  }

  return resolved;
}

export function getClassDays(classCode: string): DayOfWeek[] {
  const sched = getResolvedSchedule([classCode]);
  return ALL_DAYS.filter((d) => (sched[d] ?? []).includes(classCode));
}

export function sortClassesBySchedule(classes: ClassInfo[]): ClassInfo[] {
  const sched = getResolvedSchedule(classes.map((item) => item.name));
  return [...classes].sort((a, b) => {
    const daysA = ALL_DAYS.filter((d) => (sched[d] ?? []).includes(a.name));
    const daysB = ALL_DAYS.filter((d) => (sched[d] ?? []).includes(b.name));
    const minA = daysA.length ? Math.min(...daysA.map((d) => DAY_ORDER[d])) : 8;
    const minB = daysB.length ? Math.min(...daysB.map((d) => DAY_ORDER[d])) : 8;
    if (minA !== minB) return minA - minB;
    if (minA < 8) {
      const bestDayA = ALL_DAYS.find((d) => DAY_ORDER[d] === minA)!;
      const bestDayB = ALL_DAYS.find((d) => DAY_ORDER[d] === minB)!;
      const posA = (sched[bestDayA] ?? []).indexOf(a.name);
      const posB = (sched[bestDayB] ?? []).indexOf(b.name);
      if (posA !== posB) return posA - posB;
    }
    return a.name.localeCompare(b.name);
  });
}
