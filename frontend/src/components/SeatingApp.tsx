import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent } from 'react';
import './SeatingApp.css';
import {
  MAX_STUDENTS,
  changeLayoutMode,
  clearSeat,
  createClassroom,
  getActiveGroupIndices,
  getAssignedCount,
  getGroupCountBySize,
  getLayoutMetrics,
  getRotationMapping,
  getStudentMap,
  getThreeRowsColorOrder,
  getUnassignedStudents,
  parseStudentNames,
  placeStudentInSeat,
  randomizeSeats,
  replaceStudents,
  rotateSeatsOnce,
  swapSeatAssignments,
} from '../utils/seating/classroom';
import { formatBackupFilename, loadState, parseBackup, saveState } from '../utils/seating/storage';
import type { AppState, Classroom, LayoutMode, TimeMode, TimeModeConfig } from '../types/seating';

interface Props {
  classCode: string;
  onBack: () => void;
}

const LAYOUT_OPTIONS: Array<{ mode: LayoutMode; label: string; hint: string }> = [
  { mode: 'GROUPS', label: '小组布局', hint: '自动使用 3-6 组，每组最多 6 人。' },
  { mode: 'THREE_ROWS', label: '三大横排', hint: '三排轮换，排内左右分组独立轮转。' },
  { mode: 'ARC', label: '圆弧布局', hint: '两排弧形，每排最多 18 人，居中排列。' },
];

const GROUP_COLORS = ['#f8e998', '#98c8f4', '#f6bc54', '#a6d8f4', '#b9e2be', '#f3c4d4'];

const GROUP_ROW_LAYOUT: Record<number, number[][]> = {
  3: [[0, 1, 2]],
  4: [[0, 1, 2], [4]],
  5: [[0, 1, 2], [3, 4]],
  6: [[0, 1, 2], [3, 4, 5]],
};

const ARC_COLS = 18;

function formatDatetime(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function getGroupRows(groupCount: number): number[][] {
  return GROUP_ROW_LAYOUT[groupCount] ?? GROUP_ROW_LAYOUT[6];
}

export default function SeatingApp({ classCode, onBack }: Props) {
  const [state, setState] = useState<AppState>(() => {
    const loaded = loadState();
    // Auto-select or create classroom for classCode
    const existing = loaded.classrooms.find((c) => c.name === classCode);
    if (existing) {
      return { ...loaded, activeClassroomId: existing.id };
    }
    if (classCode && classCode !== '手动输入') {
      const newRoom = createClassroom(classCode);
      return {
        ...loaded,
        classrooms: [...loaded.classrooms, newRoom],
        activeClassroomId: newRoom.id,
      };
    }
    return loaded;
  });

  const [newClassName, setNewClassName] = useState('');
  const [layoutDraftByClassroomId, setLayoutDraftByClassroomId] = useState<Record<string, LayoutMode>>({});
  const [importText, setImportText] = useState('');
  const [importLayout, setImportLayout] = useState<LayoutMode>('GROUPS');
  const [importHint, setImportHint] = useState('');
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchImportText, setBatchImportText] = useState('');
  const [batchImportHint, setBatchImportHint] = useState('');

  const studentFileInputRef = useRef<HTMLInputElement | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  const activeTimeMode = state.activeTimeMode;

  const activeClassroom = useMemo(
    () => state.classrooms.find((c) => c.id === state.activeClassroomId) ?? null,
    [state.activeClassroomId, state.classrooms],
  );

  const activeConfig: TimeModeConfig | null = useMemo(() => {
    if (!activeClassroom) return null;
    return activeClassroom[activeTimeMode];
  }, [activeClassroom, activeTimeMode]);

  const studentMap = useMemo(() => {
    if (!activeClassroom) return new Map();
    return getStudentMap(activeClassroom);
  }, [activeClassroom]);

  const unassignedStudents = useMemo(() => {
    if (!activeClassroom) return [];
    return getUnassignedStudents(activeClassroom, activeTimeMode);
  }, [activeClassroom, activeTimeMode]);

  const assignedCount = activeConfig ? getAssignedCount(activeConfig) : 0;
  const capacity = activeConfig ? activeConfig.seats.length : 0;
  const layoutDraft: LayoutMode = activeClassroom
    ? layoutDraftByClassroomId[activeClassroom.id] ?? activeConfig?.layoutMode ?? 'GROUPS'
    : 'GROUPS';

  useEffect(() => { saveState(state); }, [state]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); setControlsVisible((v) => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function setActiveTimeMode(mode: TimeMode) {
    setState((prev) => ({ ...prev, activeTimeMode: mode }));
    setSelectedSeatIndex(null);
    setSelectedStudentId(null);
  }

  function updateClassroom(classroomId: string, updater: (c: Classroom) => Classroom) {
    setState((prev) => ({
      ...prev,
      classrooms: prev.classrooms.map((c) => c.id === classroomId ? updater(c) : c),
    }));
  }

  function handleCreateClassroom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newClassName.trim();
    if (!name) return;
    const classroom = createClassroom(name);
    setState((prev) => ({
      ...prev,
      classrooms: [...prev.classrooms, classroom],
      activeClassroomId: classroom.id,
    }));
    setLayoutDraftByClassroomId((prev) => ({ ...prev, [classroom.id]: classroom.weekday.layoutMode }));
    setNewClassName('');
    setImportHint('');
    setSelectedSeatIndex(null);
    setSelectedStudentId(null);
  }

  function handleDeleteClassroom(classroomId: string) {
    const target = state.classrooms.find((c) => c.id === classroomId);
    if (!target) return;
    if (!window.confirm(`确认删除班级「${target.name}」？`)) return;
    setState((prev) => {
      const classrooms = prev.classrooms.filter((c) => c.id !== classroomId);
      const nextId = prev.activeClassroomId === classroomId ? classrooms[0]?.id ?? null : prev.activeClassroomId;
      return { ...prev, classrooms, activeClassroomId: nextId };
    });
    setLayoutDraftByClassroomId((prev) => { const n = { ...prev }; delete n[classroomId]; return n; });
    setSelectedSeatIndex(null);
    setSelectedStudentId(null);
  }

  function importStudentsFromText(rawText: string) {
    if (!activeClassroom) return;
    const names = parseStudentNames(rawText);
    if (names.length === 0) { setImportHint('没有识别到学生姓名。'); return; }
    const trimmed = names.slice(0, MAX_STUDENTS);
    updateClassroom(activeClassroom.id, (c) => changeLayoutMode(replaceStudents(c, trimmed, activeTimeMode), importLayout, activeTimeMode));
    setSelectedSeatIndex(null);
    setSelectedStudentId(null);
    if (names.length > MAX_STUDENTS) {
      setImportHint(`导入 ${MAX_STUDENTS} 人（${renderLayoutName(importLayout)}），超出 ${names.length - MAX_STUDENTS} 人已忽略。`);
    } else {
      setImportHint(`导入成功，共 ${trimmed.length} 人（${renderLayoutName(importLayout)}）。`);
    }
  }

  async function handleStudentFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    importStudentsFromText(text);
    event.target.value = '';
  }

  async function handleBackupFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseBackup(text);
    if (!parsed) { setImportHint('备份文件格式不正确。'); event.target.value = ''; return; }
    setState(parsed);
    setLayoutDraftByClassroomId({});
    setSelectedSeatIndex(null);
    setSelectedStudentId(null);
    setImportHint('备份已恢复。');
    event.target.value = '';
  }

  function handleSeatClick(seatIndex: number) {
    if (!activeClassroom || isEditMode) return;
    if (selectedStudentId) {
      updateClassroom(activeClassroom.id, (c) => placeStudentInSeat(c, selectedStudentId, seatIndex, activeTimeMode));
      setSelectedStudentId(null);
      setSelectedSeatIndex(null);
      return;
    }
    if (selectedSeatIndex === null) { setSelectedSeatIndex(seatIndex); return; }
    if (selectedSeatIndex === seatIndex) { setSelectedSeatIndex(null); return; }
    updateClassroom(activeClassroom.id, (c) => swapSeatAssignments(c, selectedSeatIndex, seatIndex, activeTimeMode));
    setSelectedSeatIndex(null);
  }

  function handleEditSeatName(seatIndex: number, newName: string) {
    if (!activeClassroom || !activeConfig) return;
    const studentId = activeConfig.seats[seatIndex];
    if (!studentId) return;
    updateClassroom(activeClassroom.id, (c) => ({
      ...c,
      students: c.students.map((s) => s.id === studentId ? { ...s, name: newName } : s),
      updatedAt: new Date().toISOString(),
    }));
  }

  function handleApplyLayout() {
    if (!activeClassroom) return;
    updateClassroom(activeClassroom.id, (c) => changeLayoutMode(c, layoutDraft, activeTimeMode));
    setSelectedSeatIndex(null);
    setSelectedStudentId(null);
    setImportHint('布局已更新。');
  }

  function handleExportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = formatBackupFilename();
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleMetaChange(field: 'campus' | 'building' | 'room' | 'sideNotes', value: string) {
    if (!activeClassroom) return;
    updateClassroom(activeClassroom.id, (c) => ({ ...c, [field]: value, updatedAt: new Date().toISOString() }));
  }

  function handleConfigMetaChange(field: 'weekLabel' | 'classTime', value: string) {
    if (!activeClassroom || !activeConfig) return;
    updateClassroom(activeClassroom.id, (c) => ({
      ...c,
      [activeTimeMode]: { ...c[activeTimeMode], [field]: value },
      updatedAt: new Date().toISOString(),
    }));
  }

  function handleNameChange(newName: string) {
    if (!activeClassroom) return;
    updateClassroom(activeClassroom.id, (c) => ({ ...c, name: newName, updatedAt: new Date().toISOString() }));
  }

  function resetCurrentSelection() { setSelectedSeatIndex(null); setSelectedStudentId(null); }

  function handleBatchImport() {
    const classes = batchImportText.split('!').filter((c) => c.trim());
    if (classes.length === 0) { setBatchImportHint('未检测到班级数据。'); return; }

    let successCount = 0;
    const errors: string[] = [];
    const newClassrooms: Classroom[] = [];

    for (const classText of classes) {
      try {
        const lines = classText.split('\n').map((l) => l.trim()).filter((l) => l);
        let className = '';
        let campus = '';
        let building = '';
        let room = '';
        let currentTimeMode: 'weekday' | 'weekend' | '' = '';
        const timeModes: Record<'weekday' | 'weekend', { layout: LayoutMode; classTime: string; names: string[]; hasConfig: boolean }> = {
          weekday: { layout: 'GROUPS', classTime: '', names: [], hasConfig: false },
          weekend: { layout: 'GROUPS', classTime: '', names: [], hasConfig: false },
        };

        for (const line of lines) {
          if (line.startsWith('班级名称:') || line.startsWith('班级名称：')) {
            className = line.substring(line.indexOf(':') + 1).trim() || line.substring(line.indexOf('：') + 1).trim();
          } else if (line.startsWith('校区:') || line.startsWith('校区：')) {
            campus = line.substring(line.indexOf(':') + 1).trim() || line.substring(line.indexOf('：') + 1).trim();
          } else if (line.startsWith('楼层:') || line.startsWith('楼层：')) {
            building = line.substring(line.indexOf(':') + 1).trim() || line.substring(line.indexOf('：') + 1).trim();
          } else if (line.startsWith('教室:') || line.startsWith('教室：')) {
            room = line.substring(line.indexOf(':') + 1).trim() || line.substring(line.indexOf('：') + 1).trim();
          } else if (line.startsWith('周中布局:') || line.startsWith('周中布局：')) {
            const s = line.substring(line.indexOf(':') + 1).trim() || line.substring(line.indexOf('：') + 1).trim();
            timeModes.weekday.layout = s === '三排' ? 'THREE_ROWS' : s === '圆弧' ? 'ARC' : 'GROUPS';
            timeModes.weekday.hasConfig = true;
            currentTimeMode = 'weekday';
          } else if (line.startsWith('周末布局:') || line.startsWith('周末布局：')) {
            const s = line.substring(line.indexOf(':') + 1).trim() || line.substring(line.indexOf('：') + 1).trim();
            timeModes.weekend.layout = s === '三排' ? 'THREE_ROWS' : s === '圆弧' ? 'ARC' : 'GROUPS';
            timeModes.weekend.hasConfig = true;
            currentTimeMode = 'weekend';
          } else if (line.startsWith('时间:') || line.startsWith('时间：')) {
            if (currentTimeMode) timeModes[currentTimeMode].classTime = line.substring(line.indexOf(':') + 1).trim();
          } else if (currentTimeMode && line.match(/^Group\s+\d+/i)) {
            const studentsStr = line.substring(line.indexOf(':') + 1);
            timeModes[currentTimeMode].names.push(...studentsStr.split(',').map((s) => s.trim()).filter((s) => s));
          }
        }

        if (!className) throw new Error('缺少班级名称');
        if (!timeModes.weekday.hasConfig && !timeModes.weekend.hasConfig) throw new Error('至少需要一个布局配置');

        const allNames = [...new Set([...timeModes.weekday.names, ...timeModes.weekend.names])];
        let updated: Classroom = { ...createClassroom(className), campus, building, room };

        if (timeModes.weekday.hasConfig && allNames.length > 0) {
          updated = replaceStudents(updated, allNames, 'weekday');
          updated = changeLayoutMode(updated, timeModes.weekday.layout, 'weekday');
          updated = { ...updated, weekday: { ...updated.weekday, classTime: timeModes.weekday.classTime } };
        }
        if (timeModes.weekend.hasConfig && allNames.length > 0) {
          updated = changeLayoutMode(updated, timeModes.weekend.layout, 'weekend');
          const studentIds = updated.students.map((s) => s.id);
          const metrics = getLayoutMetrics(timeModes.weekend.layout, studentIds.length);
          const seats = Array.from({ length: metrics.capacity }, (_, i) => i < studentIds.length ? studentIds[i] : null);
          updated = { ...updated, weekend: { ...updated.weekend, seats, classTime: timeModes.weekend.classTime } };
        } else if (!timeModes.weekend.hasConfig && allNames.length > 0) {
          updated = replaceStudents(updated, allNames, 'weekend');
        }

        newClassrooms.push(updated);
        successCount++;
      } catch (e) {
        const name = classText.split('\n')[0]?.split(':')[1]?.trim() || '未知';
        errors.push(`${name}: ${e instanceof Error ? e.message : '未知错误'}`);
      }
    }

    if (newClassrooms.length > 0) {
      setState((prev) => ({
        ...prev,
        classrooms: [...prev.classrooms, ...newClassrooms],
        activeClassroomId: newClassrooms[0].id,
      }));
    }
    if (errors.length > 0) {
      setBatchImportHint(`成功 ${successCount}，失败 ${errors.length}：${errors.join('；')}`);
    } else {
      setBatchImportHint(`成功导入 ${successCount} 个班级！`);
      setTimeout(() => setShowBatchImport(false), 1500);
    }
  }

  function renderSeat(seatIndex: number, label: string, fontSize?: number) {
    if (!activeClassroom || !activeConfig) return null;
    const studentId = activeConfig.seats[seatIndex];
    const studentName = studentId ? studentMap.get(studentId)?.name ?? '未知' : '空位';

    if (isEditMode && studentId) {
      return (
        <div key={`${activeClassroom.id}-seat-${seatIndex}`} className="seat-card filled editing">
          <span className="seat-card-label">{label}</span>
          <input className="seat-edit-input" type="text" value={studentName}
            onChange={(e) => handleEditSeatName(seatIndex, e.target.value)}
            style={fontSize ? { fontSize: `${fontSize}px` } : undefined} />
        </div>
      );
    }

    return (
      <button key={`${activeClassroom.id}-seat-${seatIndex}`} type="button"
        className={`seat-card ${studentId ? 'filled' : 'empty'} ${selectedSeatIndex === seatIndex ? 'selected' : ''}`}
        onClick={() => handleSeatClick(seatIndex)}>
        <span className="seat-card-label">{label}</span>
        <span className="seat-card-name" style={fontSize ? { fontSize: `${fontSize}px` } : undefined}>{studentName}</span>
      </button>
    );
  }

  function renderThreeRowsLayout(classroom: Classroom) {
    const config = classroom[activeTimeMode];
    const metrics = getLayoutMetrics('THREE_ROWS', classroom.students.length);
    const cols = metrics.cols;
    const leftSize = Math.ceil(cols / 2);
    const rightSize = cols - leftSize;
    const colorOrder = getThreeRowsColorOrder(config.rotationCount);
    const rowNames = ['第一排', '第二排', '第三排'];

    return (
      <div className="three-rows-layout">
        {[0, 1, 2].map((row) => {
          const leftBg = GROUP_COLORS[(colorOrder[row * 2] - 1) % GROUP_COLORS.length];
          const rightBg = GROUP_COLORS[(colorOrder[row * 2 + 1] - 1) % GROUP_COLORS.length];
          let maxLen = 1;
          for (let c = 0; c < cols; c++) {
            const sid = config.seats[row * cols + c];
            if (sid) { const n = studentMap.get(sid)?.name ?? ''; if (n.length > maxLen) maxLen = n.length; }
          }
          const fs = Math.min(16, Math.max(10, Math.floor(140 / maxLen)));

          return (
            <section key={`${classroom.id}-row-${row}`} className="row-strip">
              <div className="row-strip-inner">
                <div className="row-label-vertical">{rowNames[row]}</div>
                <div className="row-strip-table">
                  <div className="row-half" style={{ '--half-bg': leftBg } as CSSProperties}>
                    <div className="row-half-header">
                      {Array.from({ length: leftSize }, (_, i) => <span key={`lh-${i}`}>左{i + 1}</span>)}
                    </div>
                    <div className="row-half-seats" style={{ gridTemplateColumns: `repeat(${leftSize}, minmax(60px, 1fr))` }}>
                      {Array.from({ length: leftSize }, (_, c) => renderSeat(row * cols + c, `左${c + 1}`, fs))}
                    </div>
                  </div>
                  <div className="row-gap" />
                  <div className="row-half" style={{ '--half-bg': rightBg } as CSSProperties}>
                    <div className="row-half-header">
                      {Array.from({ length: rightSize }, (_, i) => <span key={`rh-${i}`}>右{rightSize - i}</span>)}
                    </div>
                    <div className="row-half-seats" style={{ gridTemplateColumns: `repeat(${rightSize}, minmax(60px, 1fr))` }}>
                      {Array.from({ length: rightSize }, (_, i) => {
                        const c = leftSize + (rightSize - 1 - i);
                        return renderSeat(row * cols + c, `右${rightSize - i}`, fs);
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  function renderGroupLayout(classroom: Classroom) {
    const config = classroom[activeTimeMode];
    const metrics = getLayoutMetrics('GROUPS', classroom.students.length);
    const mapping = getRotationMapping(metrics.groupCount, config.rotationCount);

    return (
      <div className="group-layout">
        {getGroupRows(metrics.groupCount).map((row, rowIndex) => (
          <div key={`${classroom.id}-g-row-${rowIndex}`} className="group-row-grid">
            {row.map((tableIndex) => {
              const groupIndex = mapping[tableIndex];
              let maxLen = 1;
              for (let s = 0; s < 6; s++) {
                const sid = config.seats[groupIndex * 6 + s];
                if (sid) { const n = studentMap.get(sid)?.name ?? ''; if (n.length > maxLen) maxLen = n.length; }
              }
              const fs = Math.min(16, Math.max(10, Math.floor(140 / maxLen)));
              const style: CSSProperties = {
                '--group-color': GROUP_COLORS[groupIndex % GROUP_COLORS.length],
                ...(row.length === 1 ? { gridColumn: '2 / span 1' } : null),
              } as CSSProperties;

              return (
                <section key={`${classroom.id}-group-${tableIndex}`} className="group-card" style={style}>
                  <h3>Group {tableIndex + 1}</h3>
                  <div className="group-seat-grid">
                    {Array.from({ length: 6 }, (_, si) => {
                      const seatIndex = groupIndex * 6 + si;
                      return renderSeat(seatIndex, `R${Math.floor(si / 2) + 1}-${(si % 2) + 1}`, fs);
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  function renderArcLayout(classroom: Classroom) {
    const config = classroom[activeTimeMode];
    const arcColors = ['#f8e998', '#98c8f4'];

    return (
      <div className="arc-layout">
        {[0, 1].map((rowIdx) => {
          const start = rowIdx * ARC_COLS;
          const center = (ARC_COLS - 1) / 2;
          const maxOffset = 20;
          let maxLen = 1;
          for (let i = 0; i < ARC_COLS; i++) {
            const sid = config.seats[start + i];
            if (sid) { const n = studentMap.get(sid)?.name ?? ''; if (n.length > maxLen) maxLen = n.length; }
          }
          const fs = Math.min(16, Math.max(12, Math.floor(140 / maxLen)));

          return (
            <div key={`${classroom.id}-arc-${rowIdx}`} className="arc-row" style={{ background: arcColors[rowIdx % arcColors.length] }}>
              <div className="arc-seats">
                {Array.from({ length: ARC_COLS }, (_, i) => {
                  const seatIndex = start + i;
                  const distance = Math.abs(i - center);
                  const upward = distance <= center ? Math.round(Math.sqrt(center * center - distance * distance) * (maxOffset / center)) : 0;
                  return (
                    <div key={`arc-seat-${seatIndex}`} className="arc-seat-wrapper" style={{ marginBottom: `${upward}px` }}>
                      {renderSeat(seatIndex, `${i + 1}`, fs)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderLayoutName(mode: LayoutMode): string {
    if (mode === 'GROUPS') return '小组布局';
    if (mode === 'THREE_ROWS') return '三大横排';
    return '圆弧布局';
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" className="back-btn" onClick={onBack} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'inherit' }}>
            ← 返回
          </button>
          <div>
            <h1>班级座位表</h1>
            <p>多班级独立管理，一键轮换后可直接打印或发给家长与学生。</p>
          </div>
        </div>
        <div className="header-actions no-print" style={controlsVisible ? undefined : { display: 'none' }}>
          <button type="button" className="btn-secondary" onClick={() => setShowBatchImport(true)}>批量导入</button>
          <button type="button" className="btn-secondary" onClick={handleExportBackup}>导出备份</button>
          <button type="button" className="btn-secondary" onClick={() => backupFileInputRef.current?.click()}>导入备份</button>
          <input ref={backupFileInputRef} type="file" accept="application/json" className="hidden-input" onChange={handleBackupFileChange} />
        </div>
      </header>

      <main className="workspace-grid">
        <aside className="control-panel card no-print" style={controlsVisible ? undefined : { display: 'none' }}>
          <section>
            <h2>班级管理</h2>
            <form className="create-form" onSubmit={handleCreateClassroom}>
              <input type="text" placeholder="例如：J328 班" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} maxLength={30} required />
              <button type="submit" className="btn-primary">新建班级</button>
            </form>
          </section>

          <section>
            <h3>已创建班级</h3>
            {state.classrooms.length === 0 ? (
              <p className="empty-tip">还没有班级。</p>
            ) : (
              <ul className="class-list">
                {state.classrooms.map((c) => (
                  <li key={c.id} className={c.id === state.activeClassroomId ? 'active' : ''}>
                    <button type="button" className="class-select" onClick={() => { setState((p) => ({ ...p, activeClassroomId: c.id })); setSelectedSeatIndex(null); setSelectedStudentId(null); }}>
                      <span>{c.name}</span>
                      <small>{c.students.length} 人 / {c[activeTimeMode].seats.length} 座</small>
                    </button>
                    <button type="button" className="danger-link" onClick={() => handleDeleteClassroom(c.id)}>删除</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3>时间模式</h3>
            <div className="time-toggle">
              <button type="button" className={`toggle-btn ${activeTimeMode === 'weekday' ? 'active' : ''}`} onClick={() => setActiveTimeMode('weekday')}>周中</button>
              <button type="button" className={`toggle-btn ${activeTimeMode === 'weekend' ? 'active' : ''}`} onClick={() => setActiveTimeMode('weekend')}>周末</button>
            </div>
          </section>

          <section>
            <h3>导入学生名单</h3>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'支持粘贴 CSV 或每行一个姓名\n例：\nName\nAlice\nBob'} rows={8} />
            <div className="import-layout-picker">
              <span>导入布局：</span>
              {LAYOUT_OPTIONS.map((o) => (
                <label key={`import-${o.mode}`} className="import-layout-radio">
                  <input type="radio" name="import-layout" value={o.mode} checked={importLayout === o.mode} onChange={() => setImportLayout(o.mode)} />
                  {o.label}
                </label>
              ))}
            </div>
            <div className="inline-actions">
              <button type="button" className="btn-primary" onClick={() => importStudentsFromText(importText)} disabled={!activeClassroom}>覆盖导入</button>
              <button type="button" className="btn-secondary" onClick={() => studentFileInputRef.current?.click()} disabled={!activeClassroom}>读取文件</button>
              <input ref={studentFileInputRef} type="file" accept=".csv,.txt" className="hidden-input" onChange={handleStudentFileChange} />
            </div>
            {importHint ? <p className="status-tip">{importHint}</p> : null}
          </section>

          <section>
            <h3>布局模式</h3>
            <div className="layout-picker">
              {LAYOUT_OPTIONS.map((o) => (
                <label key={o.mode} className="layout-option">
                  <input type="radio" name="layout-mode" value={o.mode} checked={layoutDraft === o.mode}
                    onChange={() => { if (!activeClassroom) return; setLayoutDraftByClassroomId((p) => ({ ...p, [activeClassroom.id]: o.mode })); }}
                    disabled={!activeClassroom} />
                  <div><strong>{o.label}</strong><small>{o.hint}</small></div>
                </label>
              ))}
            </div>
            <button type="button" className="btn-secondary" onClick={handleApplyLayout} disabled={!activeClassroom}>应用布局</button>
            <p className="rule-tip">小组布局人数规则：1-18 人 3 组，19-24 人 4 组（1,2,3,5），25-30 人 5 组，31-36 人 6 组。</p>
          </section>
        </aside>

        <section className="worksheet card">
          {!activeClassroom || !activeConfig ? (
            <div className="board-empty">
              <h2>先创建班级再开始排座</h2>
              <p>创建后导入学生名单，选择布局并点击下一次轮换。</p>
            </div>
          ) : (
            <>
              <div className="worksheet-header">
                <div>
                  <h2>
                    <input className="header-name-input" type="text" value={activeClassroom.name} onChange={(e) => handleNameChange(e.target.value)} />
                    班座位表
                  </h2>
                  <p>上次更新：{formatDatetime(activeClassroom.updatedAt)}</p>
                </div>
                <div className="board-stats">
                  <span>学生 {activeClassroom.students.length}</span>
                  <span>已入座 {assignedCount}</span>
                  <span>容量 {capacity}</span>
                  <span>轮换 {activeConfig.rotationCount}</span>
                  <span>{activeTimeMode === 'weekday' ? '周中' : '周末'}</span>
                </div>
              </div>

              <div className="meta-grid">
                <label><span>周次</span><input value={activeConfig.weekLabel} onChange={(e) => handleConfigMetaChange('weekLabel', e.target.value)} placeholder="例如：第 6 周" /></label>
                <label><span>上课时间</span><input value={activeConfig.classTime} onChange={(e) => handleConfigMetaChange('classTime', e.target.value)} placeholder="例如：周三 19:00-21:00" /></label>
                <label><span>校区</span>
                  <select value={activeClassroom.campus} onChange={(e) => handleMetaChange('campus', e.target.value)}>
                    <option value="">选择校区</option>
                    <option value="C86校区">C86校区</option>
                    <option value="七彩校区">七彩校区</option>
                  </select>
                </label>
                <label><span>楼栋</span><input value={activeClassroom.building} onChange={(e) => handleMetaChange('building', e.target.value)} placeholder="例如：1 楼" /></label>
                <label><span>教室</span><input value={activeClassroom.room} onChange={(e) => handleMetaChange('room', e.target.value)} placeholder="例如：205" /></label>
                <label><span>布局</span><input value={renderLayoutName(activeConfig.layoutMode)} readOnly /></label>
              </div>

              <div className="screen-banner">屏幕 & 白板</div>

              <div className="worksheet-main">
                <div className="seat-stage">
                  {activeConfig.layoutMode === 'GROUPS' ? renderGroupLayout(activeClassroom)
                    : activeConfig.layoutMode === 'ARC' ? renderArcLayout(activeClassroom)
                    : renderThreeRowsLayout(activeClassroom)}
                </div>

                <aside className="notes-panel">
                  <h3>课堂备注</h3>
                  <textarea value={activeClassroom.sideNotes} onChange={(e) => handleMetaChange('sideNotes', e.target.value)}
                    placeholder="可填写课堂目标、作业提醒、家长须知等。" rows={14} />
                  <section className="unassigned-box">
                    <h4>未入座学生 ({unassignedStudents.length})</h4>
                    {unassignedStudents.length === 0 ? (
                      <p className="empty-tip">全部已入座</p>
                    ) : (
                      <div className="student-tags">
                        {unassignedStudents.map((s) => (
                          <button key={s.id} type="button"
                            className={selectedStudentId === s.id ? 'tag selected' : 'tag'}
                            onClick={() => { setSelectedSeatIndex(null); setSelectedStudentId((c) => c === s.id ? null : s.id); }}>
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </aside>
              </div>

              <div className="worksheet-actions no-print" style={controlsVisible ? undefined : { display: 'none' }}>
                <button type="button" className="btn-primary" onClick={() => updateClassroom(activeClassroom.id, (c) => rotateSeatsOnce(c, activeTimeMode))} disabled={assignedCount <= 1}>下一次轮换</button>
                <button type="button" className="btn-secondary" onClick={() => updateClassroom(activeClassroom.id, (c) => randomizeSeats(c, activeTimeMode))}>随机排座</button>
                <button type="button" className={`btn-secondary ${isEditMode ? 'btn-danger' : ''}`} onClick={() => { setIsEditMode((v) => !v); resetCurrentSelection(); }}>{isEditMode ? '退出编辑' : '编辑模式'}</button>
                <button type="button" className="btn-secondary" onClick={resetCurrentSelection}>取消选择</button>
                <button type="button" className="btn-secondary" onClick={() => { if (selectedSeatIndex === null) return; updateClassroom(activeClassroom.id, (c) => clearSeat(c, selectedSeatIndex, activeTimeMode)); setSelectedSeatIndex(null); }} disabled={selectedSeatIndex === null}>清空选中座位</button>
                <button type="button" className="btn-secondary" onClick={() => window.print()}>打印分享版</button>
              </div>

              <p className="f2-hint no-print" style={controlsVisible ? undefined : { display: 'none' }}>按 F2 键隐藏/显示控件</p>
            </>
          )}
        </section>
      </main>

      {showBatchImport && (
        <div className="modal-overlay" onClick={() => setShowBatchImport(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>批量导入班级配置</h2>
            <p className="modal-hint">按以下格式输入，使用 <code>!</code> 分隔多个班级：</p>
            <pre className="format-example">{`班级名称: J328\n校区: C86校区\n楼层: 1\n教室: 101\n周中布局: 圆桌\n时间: 周三 19:00-21:00\nGroup 1: Alice, Bob, Carol\n!\n班级名称: J329\n周中布局: 三排\nGroup 1: Grace, Heidi, Ivan`}</pre>
            <textarea className="batch-textarea" value={batchImportText} onChange={(e) => setBatchImportText(e.target.value)} placeholder="在此输入数据..." rows={12} />
            {batchImportHint && <p className="status-tip">{batchImportHint}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowBatchImport(false)}>取消</button>
              <button type="button" className="btn-primary" onClick={handleBatchImport}>确认导入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
