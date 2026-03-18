import type { RuleTemplate, SchemeRuleConfig, SavedCustomScheme, StudentData } from '../types';
import { parsePercent } from './parseExcel';

export const RULE_TEMPLATES: RuleTemplate[] = [
  { id: 'all_done',           label: '全勤奖励 · 所有任务全部完成', group: '全局',         hasThreshold: false, defaultAmount: 0.5, defaultThreshold: 0 },
  { id: 'audio_done',         label: '音频 · 完成',                  group: '音频',         hasThreshold: false, defaultAmount: 0.1, defaultThreshold: 0 },
  { id: 'theme_done',         label: '主题表达积累 · 完成',           group: '主题表达积累', hasThreshold: false, defaultAmount: 0.1, defaultThreshold: 0 },
  { id: 'theme_wordking',     label: '主题表达积累 · 成为词王',       group: '主题表达积累', hasThreshold: false, defaultAmount: 0.2, defaultThreshold: 0 },
  { id: 'theme_wordking_acc', label: '主题表达积累 · 词王准确率 ≥ 阈值', group: '主题表达积累', hasThreshold: true, defaultAmount: 0.2, defaultThreshold: 0.75 },
  { id: 'challenge_done',     label: '小挑战 · 完成',                 group: '小挑战',       hasThreshold: false, defaultAmount: 0.1, defaultThreshold: 0 },
  { id: 'ai_done',            label: 'AI语音 · 完成',                 group: 'AI语音',       hasThreshold: false, defaultAmount: 0.1, defaultThreshold: 0 },
  { id: 'ai_score',           label: 'AI语音 · 平均分 ≥ 阈值',        group: 'AI语音',       hasThreshold: true,  defaultAmount: 0.2, defaultThreshold: 0.75 },
  { id: 'test_done',          label: '测试 · 完成',                   group: '测试',         hasThreshold: false, defaultAmount: 0.1, defaultThreshold: 0 },
  { id: 'test_score',         label: '测试 · 得分率 ≥ 阈值',          group: '测试',         hasThreshold: true,  defaultAmount: 0.2, defaultThreshold: 0.75 },
  { id: 'composite_done',     label: '复合资源 · 完成',               group: '复合资源',     hasThreshold: false, defaultAmount: 0.1, defaultThreshold: 0 },
  { id: 'video_done',         label: '视频 · 完成',                   group: '视频',         hasThreshold: false, defaultAmount: 0.1, defaultThreshold: 0 },
  { id: 'interactive_done',   label: '互动视频 · 完成',               group: '互动视频',     hasThreshold: false, defaultAmount: 0.1, defaultThreshold: 0 },
  { id: 'reading_done',       label: '高阶阅读 · 完成',               group: '高阶阅读',     hasThreshold: false, defaultAmount: 0.1, defaultThreshold: 0 },
];

const STORAGE_KEY = 'amber_custom_schemes';

export function loadSavedSchemes(): SavedCustomScheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedCustomScheme[];
  } catch {
    return [];
  }
}

export function saveScheme(scheme: SavedCustomScheme): void {
  const list = loadSavedSchemes().filter((s) => s.id !== scheme.id);
  list.push(scheme);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function deleteScheme(id: string): void {
  const list = loadSavedSchemes().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function defaultRuleConfigs(): SchemeRuleConfig[] {
  return RULE_TEMPLATES.map((t) => ({
    templateId: t.id,
    enabled: false,
    amount: t.defaultAmount,
    threshold: t.defaultThreshold,
  }));
}

function isCompleted(val: unknown): boolean {
  return String(val ?? '').trim() === '已完成';
}

function isWordKing(val: unknown): boolean {
  return val !== null && val !== undefined && String(val).trim() === '是';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcCustomScheme(student: StudentData, scheme: SavedCustomScheme): number {
  const getRule = (id: string) => scheme.rules.find((r) => r.templateId === id);
  let mp = 0;

  const allDoneRule = getRule('all_done');
  if (allDoneRule?.enabled) {
    const allDone = student.resources.every((res) => isCompleted(res.columns['是否完成']));
    if (allDone) mp += allDoneRule.amount;
  }

  for (const res of student.resources) {
    const c = res.columns;
    const type = res.resourceType;

    if (type === '音频') {
      const r = getRule('audio_done');
      if (r?.enabled && isCompleted(c['是否完成'])) mp += r.amount;
    } else if (type === '主题表达积累') {
      const doneR = getRule('theme_done');
      if (doneR?.enabled && isCompleted(c['是否完成'])) mp += doneR.amount;
      if (isWordKing(c['是否达到词王'])) {
        const wkR = getRule('theme_wordking');
        if (wkR?.enabled) mp += wkR.amount;
        const accR = getRule('theme_wordking_acc');
        if (accR?.enabled) {
          const acc = parsePercent(c['词王平均正确率']);
          if (acc !== null && acc >= accR.threshold) mp += accR.amount;
        }
      }
    } else if (type === '小挑战') {
      const r = getRule('challenge_done');
      if (r?.enabled && isCompleted(c['是否完成'])) mp += r.amount;
    } else if (type === 'AI语音') {
      const doneR = getRule('ai_done');
      if (doneR?.enabled && isCompleted(c['是否完成'])) mp += doneR.amount;
      const scoreR = getRule('ai_score');
      if (scoreR?.enabled) {
        const avg = parsePercent(c['平均分']);
        if (avg !== null && avg >= scoreR.threshold) mp += scoreR.amount;
      }
    } else if (type === '测试') {
      const doneR = getRule('test_done');
      if (doneR?.enabled && isCompleted(c['是否完成'])) mp += doneR.amount;
      const scoreR = getRule('test_score');
      if (scoreR?.enabled) {
        const score = c['分数(15)'];
        if (score !== null && Number(score) / 15 >= scoreR.threshold) mp += scoreR.amount;
      }
    } else if (type === '复合资源') {
      const r = getRule('composite_done');
      if (r?.enabled && isCompleted(c['是否完成'])) mp += r.amount;
    } else if (type === '视频') {
      const r = getRule('video_done');
      if (r?.enabled && isCompleted(c['是否完成'])) mp += r.amount;
    } else if (type === '互动视频') {
      const r = getRule('interactive_done');
      if (r?.enabled && isCompleted(c['是否完成'])) mp += r.amount;
    } else if (type === '高阶阅读') {
      const r = getRule('reading_done');
      if (r?.enabled && isCompleted(c['是否完成'])) mp += r.amount;
    }
  }

  return round2(mp);
}
