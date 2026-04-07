import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { MakeupDataset, MakeupOccurrence, MakeupClassMeta, ScoredCandidate, StageKey } from '../types/makeup';
import { ALL_STAGES } from '../types/makeup';
import { loadMultiStageStore, saveStageData, clearStageData, loadStageData, getLoadedStages, parseJsonImport, parseXlsxImport } from '../utils/makeupData';
import { calcScore } from '../utils/makeupScoring';
import { generateParentMessage, generateTeacherMessage } from '../utils/makeupMessages';
import { initWeekDetection, parseQuickInput, getSortedWeekLabels } from '../utils/makeupParser';
import './MakeupTool.css';

interface Props {
  onBack: () => void;
}

function compareOccByWeek(a: MakeupOccurrence, b: MakeupOccurrence): number {
  const colA = Number.isFinite(a.week_col) ? a.week_col : Number.MAX_SAFE_INTEGER;
  const colB = Number.isFinite(b.week_col) ? b.week_col : Number.MAX_SAFE_INTEGER;
  if (colA !== colB) return colA - colB;
  return a.week_label.localeCompare(b.week_label);
}

export default function MakeupTool({ onBack }: Props) {
  // Multi-stage
  const [activeStage, setActiveStage] = useState<StageKey>(() => loadMultiStageStore().activeStage);
  const [stageInfo, setStageInfo] = useState(() => getLoadedStages());

  // Data
  const [dataset, setDataset] = useState<MakeupDataset | null>(null);
  const [importStatus, setImportStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Form
  const [originClass, setOriginClass] = useState('');
  const [missedLessonId, setMissedLessonId] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [studentName, setStudentName] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const [quickFeedback, setQuickFeedback] = useState('');

  // Interaction
  const [activeCandidate, setActiveCandidate] = useState<{ origin: MakeupOccurrence; candidate: MakeupOccurrence } | null>(null);

  // Load on mount & stage switch
  useEffect(() => {
    const saved = loadStageData(activeStage);
    setDataset(saved);
    resetForm();
    setImportStatus('');
  }, [activeStage]);

  // ── Derived data ──

  const classesByCode = useMemo(() => {
    if (!dataset) return new Map<string, MakeupClassMeta>();
    return new Map(dataset.classes.map((c) => [c.class_code, c]));
  }, [dataset]);

  const occByClass = useMemo(() => {
    if (!dataset) return new Map<string, MakeupOccurrence[]>();
    const m = new Map<string, MakeupOccurrence[]>();
    for (const occ of dataset.occurrences) {
      if (!m.has(occ.class_code)) m.set(occ.class_code, []);
      m.get(occ.class_code)!.push(occ);
    }
    return m;
  }, [dataset]);

  const weekCtx = useMemo(() => {
    if (!dataset) return null;
    return initWeekDetection(dataset.occurrences);
  }, [dataset]);

  const lessonOptions = useMemo(() => {
    if (!originClass) return [];
    return (occByClass.get(originClass) || []).slice().sort(compareOccByWeek);
  }, [originClass, occByClass]);

  const lessonMeta = useMemo(() => {
    if (!originClass) return '';
    const labels = getSortedWeekLabels(lessonOptions);
    return labels.length
      ? `已识别 ${lessonOptions.length} 节课，覆盖 ${labels.length} 个周次`
      : '当前班级在底表里还没有可用课次';
  }, [originClass, lessonOptions]);

  const originOcc = useMemo(() => {
    if (!missedLessonId || !dataset) return null;
    return dataset.occurrences.find((o) => o.id === missedLessonId) || null;
  }, [missedLessonId, dataset]);

  // ── Results ──

  const resultsBySlot = useMemo(() => {
    if (!originOcc || !dataset || selectedSlots.size === 0) return new Map<string, ScoredCandidate[]>();
    const slotArr = [...selectedSlots];
    const slotIndex = new Map(slotArr.map((k, i) => [k, i]));
    const bySlot = new Map<string, ScoredCandidate[]>();

    for (const candidate of dataset.occurrences) {
      if (candidate.class_code === originOcc.class_code) continue;
      if (candidate.lesson !== originOcc.lesson) continue;
      const slotKey = `${candidate.day}|${candidate.time}`;
      if (!slotIndex.has(slotKey)) continue;
      const scored = calcScore(originOcc, candidate, slotIndex.get(slotKey)!, classesByCode);
      if (!bySlot.has(slotKey)) bySlot.set(slotKey, []);
      bySlot.get(slotKey)!.push(scored);
    }

    for (const arr of bySlot.values()) {
      arr.sort((a, b) => b.sortKey - a.sortKey);
    }
    return bySlot;
  }, [originOcc, dataset, selectedSlots, classesByCode]);

  const totalMatches = useMemo(() => {
    let n = 0;
    for (const arr of resultsBySlot.values()) n += arr.length;
    return n;
  }, [resultsBySlot]);

  // ── Messages ──

  const parentMsg = useMemo(() => {
    if (!activeCandidate) return '';
    return generateParentMessage(activeCandidate.origin, activeCandidate.candidate, studentName);
  }, [activeCandidate, studentName]);

  const teacherMsg = useMemo(() => {
    if (!activeCandidate) return '';
    return generateTeacherMessage(activeCandidate.origin, activeCandidate.candidate, studentName);
  }, [activeCandidate, studentName]);

  // ── Handlers ──

  const handleImport = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setImportStatus('请先选择文件'); return; }
    setImportStatus(`正在导入 ${file.name}...`);
    try {
      let data: MakeupDataset;
      if (file.name.endsWith('.json')) {
        data = await parseJsonImport(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        data = await parseXlsxImport(file, activeStage);
      } else {
        throw new Error('只支持 .json 或 .xlsx 文件');
      }
      data.meta.active_stage = activeStage;
      saveStageData(activeStage, data);
      setDataset(data);
      setStageInfo(getLoadedStages());
      setImportStatus(`已导入 ${data.classes.length} 个班级，${data.occurrences.length} 条课次`);
      resetForm();
    } catch (err) {
      setImportStatus('导入失败：' + (err instanceof Error ? err.message : String(err)));
    }
  }, [activeStage]);

  function resetForm() {
    setOriginClass('');
    setMissedLessonId('');
    setSelectedSlots(new Set());
    setActiveCandidate(null);
    setQuickFeedback('');
  }

  function handleStageSwitch(stage: StageKey) {
    setActiveStage(stage);
  }

  function handleClassChange(code: string) {
    setOriginClass(code);
    setMissedLessonId('');
    setActiveCandidate(null);
  }

  function handleLessonChange(id: string) {
    setMissedLessonId(id);
    setActiveCandidate(null);
  }

  function toggleSlot(key: string) {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setActiveCandidate(null);
  }

  function handleQuickParse() {
    if (!dataset || !weekCtx) return;
    const result = parseQuickInput(quickInput, classesByCode, occByClass, weekCtx);

    if (result.classCode) {
      setOriginClass(result.classCode);
    }
    if (result.missedOccId) {
      setMissedLessonId(result.missedOccId);
    }

    const newSlots = new Set<string>();
    for (const p of result.makeupPairs) {
      newSlots.add(`${p.day}|${p.time}`);
    }
    if (result.makeupDaysOnly.length && dataset) {
      for (const slot of dataset.slots) {
        if (result.makeupDaysOnly.includes(slot.day)) {
          newSlots.add(`${slot.day}|${slot.time}`);
        }
      }
    }
    setSelectedSlots(newSlots);
    setActiveCandidate(null);
    setQuickFeedback(result.feedbackLines.length ? '✓ ' + result.feedbackLines.join(' ｜ ') : '');
  }

  function handleClearData() {
    clearStageData(activeStage);
    setDataset(null);
    setStageInfo(getLoadedStages());
    resetForm();
    setImportStatus('数据已清除');
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // ── Display helpers ──
  const DOW_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const today = new Date();
  const todayStr = `${today.getMonth() + 1}月${today.getDate()}日 ${DOW_NAMES[today.getDay()]}`;

  const loadedSet = new Set(stageInfo.map((s) => s.stage));

  // Group slots by day for display
  const slotsByDay = useMemo(() => {
    if (!dataset) return [];
    const groups: { day: string; slots: typeof dataset.slots }[] = [];
    let currentDay = '';
    let currentGroup: typeof dataset.slots = [];
    for (const slot of dataset.slots) {
      if (slot.day !== currentDay) {
        if (currentGroup.length) groups.push({ day: currentDay, slots: currentGroup });
        currentDay = slot.day;
        currentGroup = [];
      }
      currentGroup.push(slot);
    }
    if (currentGroup.length) groups.push({ day: currentDay, slots: currentGroup });
    return groups;
  }, [dataset]);

  // ── Render ──

  return (
    <div className="makeup-wrap fade-in">
      <div className="makeup-topbar">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <h2 className="makeup-title">补课助手</h2>
        {dataset && (
          <span className="makeup-meta-badge">
            {activeStage} · {dataset.classes.length} 班 · {dataset.occurrences.length} 课次
          </span>
        )}
      </div>

      {/* Stage tabs + Import section */}
      <section className="makeup-section card">
        <h3 className="makeup-section-title">进度表数据</h3>
        <div className="makeup-stage-tabs">
          {ALL_STAGES.map((s) => (
            <button
              key={s}
              className={`makeup-stage-tab${s === activeStage ? ' active' : ''}${loadedSet.has(s) ? ' loaded' : ''}`}
              onClick={() => handleStageSwitch(s)}
            >
              {s}
              {loadedSet.has(s) && <span className="makeup-stage-dot" />}
            </button>
          ))}
        </div>

        {dataset ? (
          <div className="makeup-data-loaded">
            <div className="makeup-data-pills">
              <span className="pill">底表：{dataset.meta.source_name}</span>
              <span className="pill">导入时间：{dataset.meta.imported_at.replace('T', ' ')}</span>
              <span className="pill">{dataset.classes.length} 个班级</span>
              {weekCtx?.currentWeek && <span className="pill">当前：{weekCtx.currentWeek}</span>}
            </div>
            <div className="makeup-data-actions">
              <input ref={fileRef} type="file" accept=".json,.xlsx,.xls" style={{ flex: 1 }} />
              <button className="btn btn-ghost btn-sm" onClick={handleImport}>更新数据</button>
              <button className="btn btn-ghost btn-sm" onClick={handleClearData}>清除</button>
            </div>
            {importStatus && <p className="makeup-status">{importStatus}</p>}
          </div>
        ) : (
          <div className="makeup-data-empty">
            <p>当前学段 <strong>{activeStage}</strong> 尚未导入进度表</p>
            <div className="makeup-data-actions">
              <input ref={fileRef} type="file" accept=".json,.xlsx,.xls" style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={handleImport}>导入 {activeStage} 进度表</button>
            </div>
            {importStatus && <p className="makeup-status">{importStatus}</p>}
          </div>
        )}
      </section>

      {dataset && (
        <>
          {/* Quick input */}
          <section className="makeup-section card">
            <h3 className="makeup-section-title">快捷输入</h3>
            <div className="makeup-quick-row">
              <textarea
                className="input-field"
                placeholder="例如：J420有个孩子下周五请假，想在周四补课"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickParse(); } }}
                rows={2}
              />
              <button className="btn btn-primary" onClick={handleQuickParse}>识别填入</button>
            </div>
            <p className="makeup-helper">
              今天 {todayStr}，{weekCtx?.currentWeek ? `当前 ${weekCtx.currentWeek}（${weekCtx.currentWeekMode}）` : '周次未知'}。
              输入班号和日期即可自动识别。
            </p>
            {quickFeedback && <div className="makeup-feedback">{quickFeedback}</div>}
          </section>

          {/* Main layout */}
          <div className="makeup-layout">
            {/* Left: form */}
            <section className="makeup-panel card">
              <h3 className="makeup-section-title">补课条件</h3>

              <div className="makeup-field">
                <label>学生姓名</label>
                <input
                  className="input-field"
                  placeholder="选填，用于生成通知话术"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
              </div>

              <div className="makeup-field">
                <label>原班级</label>
                <select className="input-field" value={originClass} onChange={(e) => handleClassChange(e.target.value)}>
                  <option value="">请选择原班级</option>
                  {dataset.classes.map((c) => (
                    <option key={c.class_code} value={c.class_code}>
                      {c.class_code}｜{c.grade}｜{c.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="makeup-field">
                <label>请假的那节课</label>
                <select
                  className="input-field"
                  value={missedLessonId}
                  onChange={(e) => handleLessonChange(e.target.value)}
                  disabled={!originClass}
                >
                  <option value="">{originClass ? '请选择请假课次' : '先选原班级'}</option>
                  {lessonOptions.map((occ) => (
                    <option key={occ.id} value={occ.id}>
                      {occ.week_label}｜{occ.lesson}｜{occ.day} {occ.time}
                    </option>
                  ))}
                </select>
                {originClass && <p className="makeup-helper">{lessonMeta}</p>}
              </div>

              <div className="makeup-field">
                <label>家长可接受的补课时间</label>
                <div className="makeup-slot-grid">
                  {slotsByDay.map(({ day, slots }) => (
                    <div key={day} className="makeup-slot-day-group">
                      <div className="makeup-slot-day-label">{day}</div>
                      {slots.map((slot) => {
                        const key = `${slot.day}|${slot.time}`;
                        return (
                          <label key={key} className={`makeup-slot-chip ${selectedSlots.has(key) ? 'selected' : ''}`}>
                            <input
                              type="checkbox"
                              checked={selectedSlots.has(key)}
                              onChange={() => toggleSlot(key)}
                            />
                            <span>{slot.time}</span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <p className="makeup-helper">可多选。系统会按勾选顺序展示，再按推荐优先级排序。</p>
              </div>
            </section>

            {/* Right: results */}
            <section className="makeup-panel card">
              {/* Summary */}
              {originOcc && (
                <div className="makeup-summary">
                  <span className="pill">原班级：{originOcc.class_code}</span>
                  <span className="pill">课次：{originOcc.lesson}</span>
                  <span className="pill">原时间：{originOcc.day} {originOcc.time}</span>
                  <span className="pill">{selectedSlots.size ? `已选时间：${selectedSlots.size}个` : '还没选补课时间'}</span>
                  {totalMatches > 0 && <span className="pill">候选班：{totalMatches}个</span>}
                </div>
              )}

              {/* Candidates */}
              {!originOcc ? (
                <div className="makeup-empty">先选原班级、请假课次，再勾选备选时间。</div>
              ) : selectedSlots.size === 0 ? (
                <div className="makeup-empty">请先勾选家长能接受的补课时间。</div>
              ) : totalMatches === 0 ? (
                <div className="makeup-empty">这些时间里没有找到进度相同的候选班。</div>
              ) : (
                <div className="makeup-results">
                  {[...selectedSlots].map((slotKey) => {
                    const rows = resultsBySlot.get(slotKey);
                    if (!rows || !rows.length) return null;
                    const [day, time] = slotKey.split('|');
                    return (
                      <div key={slotKey} className="makeup-slot-block">
                        <div className="makeup-slot-head">
                          <h4>{day} {time}</h4>
                          <span className="makeup-helper">{rows.length} 个候选</span>
                        </div>
                        {rows.map((row, idx) => (
                          <div
                            key={row.candidate.id}
                            className={`makeup-candidate ${activeCandidate?.candidate.id === row.candidate.id ? 'active' : ''}`}
                            onClick={() => setActiveCandidate({ origin: originOcc!, candidate: row.candidate })}
                          >
                            <div className="makeup-candidate-top">
                              <div>
                                <strong>{idx + 1}. {row.candidate.class_code}｜{row.candidate.grade}</strong>
                                <div className="makeup-candidate-meta">
                                  <span>{row.candidate.week_label}</span>
                                  <span>{row.candidate.lesson}</span>
                                  <span>班主任：{row.candidate.head_teacher || '未知'}</span>
                                  <span>老师：{row.candidate.teacher || '未知'}</span>
                                  <span>{row.candidate.campus || '校区待确认'}</span>
                                  {row.candidate.student_count && <span>{row.candidate.student_count}人</span>}
                                </div>
                              </div>
                              <div className="makeup-score">推荐度 {row.pct}%</div>
                            </div>
                            <div className="makeup-reasons">
                              {row.reasons.map((r, ri) => (
                                <span key={ri} className={`makeup-reason ${r.good ? 'good' : ''}`}>{r.text}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Messages */}
              <div className="makeup-messages">
                <div className="makeup-msg-box card">
                  <div className="makeup-msg-header">
                    <h4>转发给家长</h4>
                    {parentMsg && <button className="btn btn-ghost btn-sm" onClick={() => copyToClipboard(parentMsg)}>复制</button>}
                  </div>
                  <pre className="makeup-msg-text">{parentMsg || '选中一个候选补课班后，这里会自动生成话术。'}</pre>
                </div>
                <div className="makeup-msg-box card">
                  <div className="makeup-msg-header">
                    <h4>发给补课班班主任</h4>
                    {teacherMsg && <button className="btn btn-ghost btn-sm" onClick={() => copyToClipboard(teacherMsg)}>复制</button>}
                  </div>
                  <pre className="makeup-msg-text">{teacherMsg || '选中一个候选补课班后，这里会自动生成话术。'}</pre>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
