import type { AppScreen, ClassInfo } from '../types';

const STATE_KEY = 'amber_app_state';

interface PersistedState {
  screen: AppScreen;
  teacherName: string;
  classes: ClassInfo[];
  selectedClass: ClassInfo | null;
}

export function saveAppState(state: PersistedState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function loadAppState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.screen || !parsed.teacherName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAppState(): void {
  localStorage.removeItem(STATE_KEY);
}
