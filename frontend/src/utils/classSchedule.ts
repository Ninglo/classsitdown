import type { ClassInfo, DayOfWeek } from '../types';

export type WeeklySchedule = Partial<Record<DayOfWeek, string[]>>;

const STORAGE_KEY = 'amber_weekly_schedule';

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

export function getClassDays(classCode: string): DayOfWeek[] {
  const sched = loadWeeklySchedule();
  return ALL_DAYS.filter((d) => (sched[d] ?? []).includes(classCode));
}

export function sortClassesBySchedule(classes: ClassInfo[]): ClassInfo[] {
  const sched = loadWeeklySchedule();
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
