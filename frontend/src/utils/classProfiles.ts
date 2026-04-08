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

function collectNamesFromGroups(groups: unknown): string[] {
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((group) =>
    Array.isArray(group)
      ? group.map((name) => String(name ?? '').trim()).filter(Boolean)
      : [],
  );
}

function collectNamesFromRowGroups(rowGroups: unknown): string[] {
  if (!rowGroups || typeof rowGroups !== 'object') return [];
  const rows = (rowGroups as { rows?: Array<{ left?: unknown[]; right?: unknown[] }> }).rows;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => [
    ...((Array.isArray(row.left) ? row.left : []).map((name) => String(name ?? '').trim()).filter(Boolean)),
    ...((Array.isArray(row.right) ? row.right : []).map((name) => String(name ?? '').trim()).filter(Boolean)),
  ]);
}

function collectNamesFromArcGroups(arcGroups: unknown): string[] {
  if (!arcGroups || typeof arcGroups !== 'object') return [];
  const rows = (arcGroups as { rows?: unknown[] }).rows;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => collectNamesFromGroups(row));
}

export function getStudentsFromSeating(classCode: string): StudentInfo[] {
  try {
    const raw = localStorage.getItem('classSeatingData');
    if (!raw) return [];
    const data = JSON.parse(raw) as Record<string, {
      weekday?: { groups?: unknown; rowGroups?: unknown; arcGroups?: unknown };
      weekend?: { groups?: unknown; rowGroups?: unknown; arcGroups?: unknown };
    }>;
    const matchedKey = resolveSeatingKey(classCode);
    if (!matchedKey) return [];

    const config = data[matchedKey];
    const names = [
      ...collectNamesFromGroups(config?.weekday?.groups),
      ...collectNamesFromGroups(config?.weekend?.groups),
      ...collectNamesFromRowGroups(config?.weekday?.rowGroups),
      ...collectNamesFromRowGroups(config?.weekend?.rowGroups),
      ...collectNamesFromArcGroups(config?.weekday?.arcGroups),
      ...collectNamesFromArcGroups(config?.weekend?.arcGroups),
    ];

    const uniqueNames = [...new Set(names)];
    return uniqueNames.map((name, index) => ({
      id: `seat_${matchedKey}_${index}_${name}`,
      chineseName: name,
    }));
  } catch {
    return [];
  }
}

export function getResolvedStudents(classCode: string): StudentInfo[] {
  const profileStudents = getClassProfile(classCode)?.students ?? [];
  const mergedNames = new Map(profileStudents.map((student) => [student.chineseName, student]));

  for (const student of getStudentsFromSeating(classCode)) {
    if (!mergedNames.has(student.chineseName)) mergedNames.set(student.chineseName, student);
  }
  for (const student of getStudentsFromSeatingData(classCode)) {
    if (!mergedNames.has(student.chineseName)) mergedNames.set(student.chineseName, student);
  }

  const merged = [...mergedNames.values()];
  if (merged.length === 0) return [];

  mergeStudents(classCode, merged);
  return getClassProfile(classCode)?.students ?? merged;
}

export function importStudentNames(classCode: string, names: string[]): StudentInfo[] {
  const cleaned = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (cleaned.length === 0) return getResolvedStudents(classCode);

  const incoming: StudentInfo[] = cleaned.map((name, index) => ({
    id: `manual_${classCode}_${Date.now()}_${index}`,
    chineseName: name,
  }));

  mergeStudents(classCode, incoming);
  return getResolvedStudents(classCode);
}

function normalizeStudentName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[\d.、)\]-]+\s*/, '')
    .trim();
}

function createStudentRecord(classCode: string, chineseName: string): StudentInfo {
  return {
    id: `${classCode}_${chineseName}`.replace(/\s+/g, '_'),
    chineseName,
  };
}

function collectNamesFromValue(value: unknown, names: Set<string>): void {
  if (typeof value === 'string') {
    const normalized = normalizeStudentName(value);
    if (normalized) names.add(normalized);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectNamesFromValue(item, names);
    return;
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectNamesFromValue(nested, names);
    }
  }
}

export function getStudentsFromSeatingData(classCode: string): StudentInfo[] {
  try {
    const raw = localStorage.getItem('classSeatingData');
    if (!raw) return [];
    const all = JSON.parse(raw) as Record<string, unknown>;
    const resolvedKey = Object.keys(all).find((key) => key.toUpperCase() === classCode.toUpperCase());
    if (!resolvedKey) return [];

    const names = new Set<string>();
    const payload = all[resolvedKey];
    collectNamesFromValue(payload, names);

    return [...names]
      .filter((name) => name.length > 0 && name.length <= 32)
      .map((name) => createStudentRecord(classCode, name));
  } catch {
    return [];
  }
}

export function getAvailableStudents(classCode: string): StudentInfo[] {
  const profileStudents = getClassProfile(classCode)?.students ?? [];
  if (profileStudents.length > 0) return profileStudents;
  return getStudentsFromSeatingData(classCode);
}

export function saveStudentList(classCode: string, studentNames: string[]): ClassProfile {
  const uniqueNames = [...new Set(studentNames.map((name) => normalizeStudentName(name)).filter(Boolean))];
  return updateClassProfile(classCode, {
    students: uniqueNames.map((name) => createStudentRecord(classCode, name)),
  });
}

export function hasSeatingData(classCode: string): boolean {
  try {
    const raw = localStorage.getItem('classSeatingData');
    if (!raw) return false;
    const data = JSON.parse(raw) as Record<string, unknown>;
    // Case-insensitive match: scraper uppercases class codes, but seating app
    // may store them in original case from user input
    const upper = classCode.toUpperCase();
    return Object.keys(data).some((key) => key.toUpperCase() === upper);
  } catch {
    return false;
  }
}

/** Find the actual key used in classSeatingData for a given class code (case-insensitive) */
export function resolveSeatingKey(classCode: string): string | null {
  try {
    const raw = localStorage.getItem('classSeatingData');
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    const upper = classCode.toUpperCase();
    return Object.keys(data).find((key) => key.toUpperCase() === upper) ?? null;
  } catch {
    return null;
  }
}
