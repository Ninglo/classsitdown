import type { StudentData, MPBreakdown, SchemeId, Module } from '../types';
import { parsePercent } from './parseExcel';

function isCompleted(val: unknown): boolean {
  return String(val ?? '').trim() === '已完成';
}

function isWordKing(val: unknown): boolean {
  return val !== null && val !== undefined && String(val).trim() === '是';
}

function calcScheme1(student: StudentData): number {
  let mp = 0;
  for (const res of student.resources) {
    const c = res.columns;
    const type = res.resourceType;
    if (type === '音频') {
      if (isCompleted(c['是否完成'])) mp += 0.1;
    } else if (type === '主题表达积累') {
      if (isCompleted(c['是否完成'])) mp += 0.1;
      if (isWordKing(c['是否达到词王'])) {
        mp += 0.2;
        const acc = parsePercent(c['词王平均正确率']);
        if (acc !== null && acc >= 0.75) mp += 0.2;
      }
    } else if (type === '小挑战') {
      if (isCompleted(c['是否完成'])) mp += 0.1;
    } else if (type === 'AI语音') {
      if (isCompleted(c['是否完成'])) mp += 0.1;
      const avg = parsePercent(c['平均分']);
      if (avg !== null && avg >= 0.75) mp += 0.2;
    } else if (type === '测试') {
      if (isCompleted(c['是否完成'])) mp += 0.1;
      const score = c['分数(15)'];
      if (score !== null && Number(score) / 15 >= 0.75) mp += 0.2;
    } else if (type === '复合资源') {
      if (isCompleted(c['是否完成'])) mp += 0.1;
    }
  }
  return round2(mp);
}

function calcScheme2(student: StudentData): number {
  const allDone = student.resources.every((res) => isCompleted(res.columns['是否完成']));
  let mp = allDone ? 0.5 : 0;
  for (const res of student.resources) {
    const c = res.columns;
    const type = res.resourceType;
    if (type === '主题表达积累') {
      if (isWordKing(c['是否达到词王'])) {
        mp += 0.2;
        const acc = parsePercent(c['词王平均正确率']);
        if (acc !== null && acc >= 0.75) mp += 0.2;
      }
    } else if (type === 'AI语音') {
      const avg = parsePercent(c['平均分']);
      if (avg !== null && avg >= 0.75) mp += 0.2;
    } else if (type === '测试') {
      const score = c['分数(15)'];
      if (score !== null && Number(score) / 15 >= 0.75) mp += 0.2;
    }
  }
  return round2(mp);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateMP(
  students: StudentData[],
  scheme: SchemeId,
  dailyCheckInRate: number,
  modules: Set<Module>
): MPBreakdown[] {
  return students.map((s) => {
    const 基础落实 = scheme === 'scheme1' ? calcScheme1(s) : calcScheme2(s);
    const 每日开口 = modules.has('每日开口') ? round2(s.dailyCheckIns * dailyCheckInRate) : 0;
    const 课堂参与 = modules.has('课堂参与') ? round2(s.classParticipation) : 0;
    const 个性化奖励 = modules.has('个性化奖励')
      ? round2(s.bonusItems.reduce((acc, b) => acc + b.amount, 0))
      : 0;
    const total = round2(基础落实 + 每日开口 + 课堂参与 + 个性化奖励);
    return {
      studentId: s.studentId,
      chineseName: s.chineseName,
      englishName: s.englishName,
      基础落实,
      每日开口,
      课堂参与,
      个性化奖励,
      total,
    };
  });
}

export const SCHEMES = [
  {
    id: 'scheme1' as SchemeId,
    name: '方案一',
    description: '逐项累计：每完成一个任务得 0.1 MP，成为词王额外 +0.2，词王准确率 ≥75% 再 +0.2，AI语音平均分 ≥75% 额外 +0.2，测试得分率 ≥75% 额外 +0.2',
  },
  {
    id: 'scheme2' as SchemeId,
    name: '方案二',
    description: '全勤奖励：所有任务全部完成才拿 0.5 MP 基础分；词王、准确率奖励照样叠加在基础分上',
  },
];
