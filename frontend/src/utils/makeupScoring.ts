import type { MakeupOccurrence, MakeupClassMeta, ScoredCandidate } from '../types/makeup';

// Weights (total up to 100)
const W_BASE = 30;        // same lesson content (prerequisite)
const W_TYPE = 25;        // same class type
const W_GRADE = 18;       // same grade
const W_CAMPUS = 10;      // same campus
const W_TEACHER = 7;      // same primary teacher
const W_WEEK = 5;         // same week label
const W_BRIDGE = 3;       // teacher continuity across weekday/weekend
const W_ENROLL_MAX = 2;   // low enrollment bonus

function sameWeekLabel(a: MakeupOccurrence, b: MakeupOccurrence): boolean {
  return a.week_label === b.week_label;
}

function samePrimaryTeacher(origin: MakeupOccurrence, candidate: MakeupOccurrence): boolean {
  return !!origin.teacher && origin.teacher === candidate.teacher;
}

function sameTeacherBridge(originMeta: MakeupClassMeta | undefined, candidate: MakeupOccurrence): boolean {
  if (!originMeta) return false;
  const otherTeacher = candidate.mode === '周中' ? originMeta.weekend.teacher : originMeta.weekday.teacher;
  return !!otherTeacher && otherTeacher === candidate.teacher;
}

export function calcScore(
  originOcc: MakeupOccurrence,
  candidate: MakeupOccurrence,
  slotOrder: number,
  classesByCode: Map<string, MakeupClassMeta>,
): ScoredCandidate {
  const originMeta = classesByCode.get(originOcc.class_code);
  const reasons: ScoredCandidate['reasons'] = [{ text: '进度相同', good: true }];
  let pct = W_BASE;

  if (originOcc.type && originOcc.type === candidate.type) {
    pct += W_TYPE;
    reasons.push({ text: '同类型', good: true });
  } else {
    reasons.push({ text: `跨类型：${candidate.type || '未知'}`, good: false });
  }

  if (sameWeekLabel(originOcc, candidate)) {
    pct += W_WEEK;
    reasons.push({ text: '同一周次', good: true });
  } else {
    reasons.push({ text: `候选周次：${candidate.week_label}`, good: false });
  }

  if (originOcc.grade && originOcc.grade === candidate.grade) {
    pct += W_GRADE;
    reasons.push({ text: '同年级', good: true });
  }

  if (originOcc.campus && originOcc.campus === candidate.campus) {
    pct += W_CAMPUS;
    reasons.push({ text: '同校区', good: true });
  }

  if (samePrimaryTeacher(originOcc, candidate)) {
    pct += W_TEACHER;
    reasons.push({ text: '同教师', good: true });
  }

  if (sameTeacherBridge(originMeta, candidate)) {
    pct += W_BRIDGE;
    reasons.push({ text: '教师衔接优先', good: true });
  }

  const count = parseInt(candidate.student_count, 10);
  if (!Number.isNaN(count)) {
    const enrollBonus = Math.max(0, Math.round(W_ENROLL_MAX * (1 - count / 25)));
    if (enrollBonus > 0) {
      pct += enrollBonus;
      reasons.push({ text: `人数少(${count}人)`, good: true });
    } else {
      reasons.push({ text: `${count}人`, good: false });
    }
  }

  pct = Math.min(100, Math.max(0, pct));
  const sortKey = (10 - slotOrder) * 10000 + pct * 100;
  return { candidate, pct, sortKey, reasons };
}
