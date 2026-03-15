const WEEK1_START = new Date(2026, 2, 2); // March 2, 2026

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
