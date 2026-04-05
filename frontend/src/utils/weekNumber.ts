const DEFAULT_WEEK1_START = '2026-03-02';

function resolveWeek1Start(): Date {
  const raw = import.meta.env.VITE_WEEK1_START || DEFAULT_WEEK1_START;
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date(`${DEFAULT_WEEK1_START}T00:00:00`) : date;
}

const WEEK1_START = resolveWeek1Start();

export function getCurrentWeek(): number {
  const now = new Date();
  const diff = now.getTime() - WEEK1_START.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(days / 7) + 1);
}

export function getWeekRange(week: number): { start: Date; end: Date } {
  const start = new Date(WEEK1_START);
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function formatDateShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
