import { useEffect, useState } from 'react';
import type { AppScreen, ClassInfo, DayOfWeek } from '../types';
import { getClassDays } from '../utils/classSchedule';
import { getCurrentWeek } from '../utils/weekNumber';

type TodoTarget = Extract<AppScreen, 'hub' | 'seating' | 'overview' | 'flow'>;

interface ReminderNote {
  id: string;
  text: string;
  dueDate: string;
  source: 'manual' | 'weekly';
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
}

interface TodoMetaState {
  enabled: boolean;
  weeklyConfirmedWeek: number;
  weeklyConfirmedAt: string;
  completedByDate: Record<string, string[]>;
}

interface TodoAction {
  classCode: string;
  target: TodoTarget;
  label: string;
}

interface TodoItem {
  key: string;
  title: string;
  detail?: string;
  kind: 'auto' | 'manual';
  done: boolean;
  actions: TodoAction[];
}

interface Props {
  classes: ClassInfo[];
  onOpenTask: (classInfo: ClassInfo, target: TodoTarget) => void;
}

const TODO_META_KEY = 'amber_welcome_todo_meta_v1';
const SEATING_STORAGE_KEYS = ['superamberClassData', 'classSeatingData'] as const;
const DAY_LABELS: DayOfWeek[] = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const DEFAULT_META: TodoMetaState = {
  enabled: false,
  weeklyConfirmedWeek: 0,
  weeklyConfirmedAt: '',
  completedByDate: {},
};

function toDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${DAY_LABELS[date.getDay()]}`;
}

function normalizeReminderNotes(notes: unknown): ReminderNote[] {
  if (!Array.isArray(notes)) {
    return [];
  }

  return notes.reduce<ReminderNote[]>((list, item) => {
    if (!item || typeof item !== 'object') {
      return list;
    }

    const note = item as Partial<ReminderNote>;
    const text = String(note.text || '').trim();
    const dueDate = String(note.dueDate || '').trim();
    if (!text || !dueDate) {
      return list;
    }

    list.push({
      id: String(note.id || `todo-${Math.random().toString(36).slice(2, 8)}`),
      text,
      dueDate,
      source: note.source === 'weekly' ? 'weekly' : 'manual',
      completed: note.completed === true,
      createdAt: String(note.createdAt || new Date().toISOString()),
      completedAt: typeof note.completedAt === 'string' ? note.completedAt : null,
    });
    return list;
  }, []).sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.createdAt.localeCompare(right.createdAt));
}

function loadTodoMeta(): TodoMetaState {
  try {
    const raw = localStorage.getItem(TODO_META_KEY);
    if (!raw) {
      return DEFAULT_META;
    }
    const parsed = JSON.parse(raw) as Partial<TodoMetaState>;
    return {
      enabled: parsed.enabled === true,
      weeklyConfirmedWeek: Number.isFinite(parsed.weeklyConfirmedWeek) ? Number(parsed.weeklyConfirmedWeek) : 0,
      weeklyConfirmedAt: typeof parsed.weeklyConfirmedAt === 'string' ? parsed.weeklyConfirmedAt : '',
      completedByDate: parsed.completedByDate && typeof parsed.completedByDate === 'object'
        ? parsed.completedByDate
        : {},
    };
  } catch {
    return DEFAULT_META;
  }
}

function saveTodoMeta(meta: TodoMetaState): void {
  localStorage.setItem(TODO_META_KEY, JSON.stringify(meta));
}

function loadMergedSeatingData(): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const key of [...SEATING_STORAGE_KEYS].reverse()) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      Object.assign(merged, parsed);
    } catch {
      // ignore invalid payloads
    }
  }
  return merged;
}

function saveSeatingTodoNote(classCode: string, text: string, dueDate: string, source: ReminderNote['source']): void {
  const merged = loadMergedSeatingData() as Record<string, { todoNotes?: ReminderNote[] }>;
  const normalizedClass = classCode.trim().toUpperCase();
  const current = merged[normalizedClass] || {};
  const note: ReminderNote = {
    id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    dueDate,
    source,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  current.todoNotes = normalizeReminderNotes([...(current.todoNotes || []), note]);
  merged[normalizedClass] = current;
  localStorage.setItem(SEATING_STORAGE_KEYS[0], JSON.stringify(merged));
}

function loadSeatingNotesByClass(): Record<string, ReminderNote[]> {
  const merged = loadMergedSeatingData() as Record<string, { todoNotes?: unknown }>;
  const result: Record<string, ReminderNote[]> = {};
  Object.entries(merged).forEach(([classCode, value]) => {
    result[classCode.toUpperCase()] = normalizeReminderNotes(value?.todoNotes);
  });
  return result;
}

function getNextDateForClass(classCode: string, from = new Date()): string {
  const days = getClassDays(classCode);
  if (days.length === 0) {
    return toDateKey(from);
  }

  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addDays(from, offset);
    const dayLabel = DAY_LABELS[candidate.getDay()];
    if (days.includes(dayLabel)) {
      return toDateKey(candidate);
    }
  }

  return toDateKey(from);
}

function isWeekendDay(day: DayOfWeek): boolean {
  return day === '周六' || day === '周日';
}

function previousDay(day: DayOfWeek): DayOfWeek {
  const order: DayOfWeek[] = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const index = order.indexOf(day);
  return order[(index + order.length - 1) % order.length];
}

function targetForAutoAction(action: string): TodoTarget {
  if (action.includes('积分') || action.includes('minipin')) {
    return 'flow';
  }
  if (action.includes('公示') || action.includes('课后资料')) {
    return 'overview';
  }
  return 'seating';
}

function headlineForAction(action: string, classCodes: string[]): string {
  if (action === '发座位表') return `发 ${classCodes.join(' & ')} 座位表`;
  if (action === '发班级公示') return `发 ${classCodes.join(' & ')} 班级公示`;
  if (action === '发课后资料【板书+课件+概览】') return `发 ${classCodes.join(' & ')} 课后资料【板书+课件+概览】`;
  if (action === '发本周积分 / minipin') return `发 ${classCodes.join(' & ')} 本周积分 / minipin`;
  if (action === '物资确认') return `${classCodes.join(' & ')} 物资确认`;
  return `${action}：${classCodes.join(' & ')}`;
}

function buttonLabel(action: TodoAction, single: boolean): string {
  if (!single) {
    return `${action.classCode} →`;
  }

  if (action.target === 'seating') return '去座位表';
  if (action.target === 'overview') return '去概览';
  if (action.target === 'flow') return '去积分';
  return '去班级';
}

function buildTodoItems(classes: ClassInfo[], meta: TodoMetaState, notesByClass: Record<string, ReminderNote[]>): TodoItem[] {
  const today = new Date();
  const todayKey = toDateKey(today);
  const todayDay = DAY_LABELS[today.getDay()];
  const completedToday = new Set(meta.completedByDate[todayKey] || []);
  const autoMap = new Map<string, { action: string; classCodes: string[]; details: string[] }>();
  const manualItems: TodoItem[] = [];

  const addAuto = (action: string, classCode: string, detail?: string) => {
    const entry = autoMap.get(action) || { action, classCodes: [], details: [] };
    if (!entry.classCodes.includes(classCode)) {
      entry.classCodes.push(classCode);
    }
    if (detail) {
      entry.details.push(`${classCode}：${detail}`);
    }
    autoMap.set(action, entry);
  };

  classes.forEach((cls) => {
    const classCode = cls.name.toUpperCase();
    const days = getClassDays(classCode);
    const hasWeekday = days.some((day) => !isWeekendDay(day));
    const isPureWeekend = days.length > 0 && days.every((day) => isWeekendDay(day));
    const notes = (notesByClass[classCode] || []).filter((note) => !note.completed);
    const dueNotes = notes.filter((note) => note.dueDate <= todayKey);

    dueNotes.forEach((note) => {
      const target: TodoTarget = /积分|minipin/i.test(note.text)
        ? 'flow'
        : /公示|概览|课后资料|板书|课件/i.test(note.text)
          ? 'overview'
          : /座位/i.test(note.text)
            ? 'seating'
            : 'hub';
      manualItems.push({
        key: `manual:${classCode}:${note.id}`,
        title: `${classCode} · ${note.text}`,
        detail: `DDL：${formatDateLabel(note.dueDate)}`,
        kind: 'manual',
        done: completedToday.has(`manual:${classCode}:${note.id}`),
        actions: [{ classCode, target, label: target === 'hub' ? '去班级' : '去处理' }],
      });
    });

    days.forEach((day) => {
      if (!isWeekendDay(day)) {
        if (previousDay(day) === todayDay) {
          addAuto('发座位表', classCode);
          addAuto('发班级公示', classCode);
        }
        if (day === todayDay) {
          if (dueNotes.length > 0) {
            addAuto('物资确认', classCode, dueNotes.map((note) => note.text).join('、'));
          }
          addAuto('发课后资料【板书+课件+概览】', classCode);
          addAuto('发本周积分 / minipin', classCode);
        }
        return;
      }

      if (isPureWeekend) {
        if (previousDay(day) === todayDay) {
          addAuto('发座位表', classCode);
          addAuto('发班级公示', classCode);
        }
        if (day === todayDay) {
          if (dueNotes.length > 0) {
            addAuto('物资确认', classCode, dueNotes.map((note) => note.text).join('、'));
          }
          addAuto('发课后资料【板书+课件+概览】', classCode);
          addAuto('发本周积分 / minipin', classCode);
        }
        return;
      }

      if (!hasWeekday && day === todayDay) {
        addAuto('发课后资料【板书+课件+概览】', classCode);
      } else if (hasWeekday && day === todayDay) {
        addAuto('发课后资料【板书+课件+概览】', classCode);
      }
    });
  });

  const autoItems = Array.from(autoMap.values()).map((entry) => {
    const sortedCodes = [...entry.classCodes].sort();
    const key = `auto:${todayKey}:${entry.action}:${sortedCodes.join('|')}`;
    return {
      key,
      title: headlineForAction(entry.action, sortedCodes),
      detail: entry.details.length > 0 ? entry.details.join('；') : undefined,
      kind: 'auto' as const,
      done: completedToday.has(key),
      actions: sortedCodes.map((classCode) => ({
        classCode,
        target: targetForAutoAction(entry.action),
        label: classCode,
      })),
    };
  });

  return [...autoItems, ...manualItems].sort((left, right) => {
    if (left.done !== right.done) return left.done ? 1 : -1;
    if (left.kind !== right.kind) return left.kind === 'auto' ? -1 : 1;
    return left.title.localeCompare(right.title, 'zh-Hans-CN');
  });
}

export default function WelcomeTodoPanel({ classes, onOpenTask }: Props) {
  const [meta, setMeta] = useState<TodoMetaState>(() => loadTodoMeta());
  const [notesVersion, setNotesVersion] = useState(0);
  const [weeklyClass, setWeeklyClass] = useState('');
  const [weeklyNote, setWeeklyNote] = useState('');

  useEffect(() => {
    saveTodoMeta(meta);
  }, [meta]);

  const notesByClass = loadSeatingNotesByClass();
  const items = buildTodoItems(classes, meta, notesByClass);
  const currentWeek = getCurrentWeek();
  const weeklyDone = meta.weeklyConfirmedWeek === currentWeek;
  const todayKey = toDateKey();

  function toggleDone(item: TodoItem) {
    setMeta((current) => {
      const completed = new Set(current.completedByDate[todayKey] || []);
      if (completed.has(item.key)) completed.delete(item.key);
      else completed.add(item.key);
      return {
        ...current,
        completedByDate: {
          ...current.completedByDate,
          [todayKey]: Array.from(completed),
        },
      };
    });
  }

  function handleWeeklyConfirm() {
    if (weeklyClass && weeklyNote.trim()) {
      saveSeatingTodoNote(weeklyClass, weeklyNote.trim(), getNextDateForClass(weeklyClass), 'weekly');
      setWeeklyNote('');
      setWeeklyClass('');
      setNotesVersion((value) => value + 1);
    }

    setMeta((current) => ({
      ...current,
      weeklyConfirmedWeek: currentWeek,
      weeklyConfirmedAt: new Date().toISOString(),
    }));
  }

  return (
    <aside className="welcome-todo-panel card" key={notesVersion}>
      <div className="welcome-todo-header">
        <div>
          <div className="welcome-todo-kicker">Today To Do</div>
          <h2>主站待办</h2>
        </div>
        <label className="welcome-todo-switch">
          <input
            type="checkbox"
            checked={meta.enabled}
            onChange={(event) => setMeta((current) => ({ ...current, enabled: event.target.checked }))}
          />
          <span>{meta.enabled ? '已开启' : '未开启'}</span>
        </label>
      </div>

      {!meta.enabled ? (
        <div className="welcome-todo-empty">打开后，这里会按今天的班级安排生成真正可勾选的 To do。</div>
      ) : (
        <>
          <div className="welcome-todo-weekly">
            <div className="welcome-todo-block-title">
              <strong>本周额外提醒</strong>
              <span>{weeklyDone ? '本周已确认' : '本周首次登录必看'}</span>
            </div>
            <p className="welcome-todo-weekly-copy">学段资料包都查看了吗？确认后可以顺手挂到某个班，上课当天会再次进入 To do。</p>
            <select value={weeklyClass} onChange={(event) => setWeeklyClass(event.target.value)}>
              <option value="">选择班级（可不选）</option>
              {classes.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
            <textarea
              value={weeklyNote}
              onChange={(event) => setWeeklyNote(event.target.value)}
              placeholder="例如：J413 发书；K218 发资料要领讲义"
            />
            <button className="btn btn-primary btn-sm" onClick={handleWeeklyConfirm}>
              {weeklyDone ? '更新本周提醒' : '确认并记录'}
            </button>
          </div>

          <div className="welcome-todo-list-wrap">
            <div className="welcome-todo-block-title">
              <strong>今天待办</strong>
              <span>{items.filter((item) => !item.done).length} 条未完成</span>
            </div>

            {items.length === 0 ? (
              <div className="welcome-todo-empty">今天没有自动待办；你仍然可以在本周提醒里给某个班挂事项。</div>
            ) : (
              <div className="welcome-todo-list">
                {items.map((item) => (
                  <article key={item.key} className={`welcome-todo-item${item.done ? ' is-done' : ''}`}>
                    <div className="welcome-todo-item-top">
                      <div>
                        <div className="welcome-todo-item-title">{item.title}</div>
                        {item.detail && <div className="welcome-todo-item-detail">{item.detail}</div>}
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleDone(item)}>
                        {item.done ? '取消完成' : '完成'}
                      </button>
                    </div>
                    <div className="welcome-todo-actions">
                      {item.actions.map((action) => {
                        const classInfo = classes.find((entry) => entry.name === action.classCode || entry.name.toUpperCase() === action.classCode);
                        if (!classInfo) {
                          return null;
                        }
                        return (
                          <button
                            key={`${item.key}:${action.classCode}:${action.target}`}
                            className="btn btn-ghost btn-sm"
                            onClick={() => onOpenTask(classInfo, action.target)}
                          >
                            {buttonLabel(action, item.actions.length === 1)}
                          </button>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
