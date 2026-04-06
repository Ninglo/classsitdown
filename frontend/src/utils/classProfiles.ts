import type { ClassProfile, StudentInfo } from '../types';

const STORAGE_KEY = 'amber_class_profiles';

export function loadClassProfiles(): ClassProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ClassProfile[];
  } catch {
    return [];
  }
}

function saveAll(profiles: ClassProfile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function getClassProfile(classCode: string): ClassProfile | null {
  return loadClassProfiles().find((p) => p.classCode === classCode) ?? null;
}

export function saveClassProfile(profile: ClassProfile): void {
  const all = loadClassProfiles();
  const idx = all.findIndex((p) => p.classCode === profile.classCode);
  if (idx >= 0) all[idx] = profile;
  else all.push(profile);
  saveAll(all);
}

export function updateClassProfile(classCode: string, updates: Partial<Omit<ClassProfile, 'classCode'>>): ClassProfile {
  const existing = getClassProfile(classCode) ?? {
    classCode,
    schedule: [],
    students: [],
    updatedAt: Date.now(),
  };
  const updated = { ...existing, ...updates, updatedAt: Date.now() };
  saveClassProfile(updated);
  return updated;
}

/**
 * Merge new students into existing list. Returns added students for notification.
 * Does NOT auto-remove — discrepancy alerts are UI-level, not data-level.
 */
export function mergeStudents(
  classCode: string,
  incoming: StudentInfo[],
): { profile: ClassProfile; added: StudentInfo[] } {
  const profile = getClassProfile(classCode) ?? {
    classCode,
    schedule: [],
    students: [],
    updatedAt: Date.now(),
  };

  const existingNames = new Set(profile.students.map((s) => s.chineseName));
  const added: StudentInfo[] = [];

  for (const s of incoming) {
    if (!existingNames.has(s.chineseName)) {
      profile.students.push(s);
      existingNames.add(s.chineseName);
      added.push(s);
    }
  }

  if (added.length > 0) {
    profile.updatedAt = Date.now();
    saveClassProfile(profile);
  }

  return { profile, added };
}

export function getStudentCount(classCode: string): number {
  return getClassProfile(classCode)?.students.length ?? 0;
}
