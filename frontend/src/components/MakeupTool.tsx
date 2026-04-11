import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { MakeupDataset, MakeupOccurrence, MakeupClassMeta, ScoredCandidate, StageKey } from '../types/makeup';
import { ALL_STAGES } from '../types/makeup';
import { loadMultiStageStore, saveStageData, clearStageData, loadStageData, getLoadedStages, parseJsonImport, parseXlsxImport } from '../utils/makeupData';
import { calcScore, evaluateLessonMatch } from '../utils/makeupScoring';
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

const DAY_ORDER = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const MAKEUP_TOOL_VERSION = '时间矩阵版 2026-04-08 16:15';

function timeToMinutes(value: string): number | null {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function normalizeSlotBucketTime(value: string): string {
  const minutes = timeToMinutes(value);
  if (minutes == null) return value;
  const rounded = Math.round(minutes / 10) * 10;
  const hour = Math.floor(rounded / 60) % 24;
  const minute = rounded % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function isWithinFuzzyWindow(baseTime: string, targetTime: string, tolerance = 5): boolean {
  const baseMinutes = timeToMinutes(baseTime);
  const targetMinutes = timeToMinutes(targetTime);
  if (baseMinutes == null || targetMinutes == null) return false;
  return Math.abs(baseMinutes - targetMinutes) <= tolerance;
}

const SLOT_BOUNDARY_TOLERANCE_MINUTES = 15;

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
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
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
    if (!originOcc || !dataset || selectedSlots.length === 0) return new Map<string, ScoredCandidate[]>();
    const bySlot = new Map<string, ScoredCandidate[]>();

    for (const candidate of dataset.occurrences) {
      if (candidate.class_code === originOcc.class_code) continue;
      if (!evaluateLessonMatch(originOcc, candidate).matched) continue;
      const matchedSlot = selectedSlots.find((slotKey) => {
        const [day, time] = slotKey.split('|');
        return day === candidate.day && isWithinFuzzyWindow(time, candidate.time);
      });
      if (!matchedSlot) continue;
      const scored = calcScore(originOcc, candidate, selectedSlots.indexOf(matchedSlot), classesByCode);
      if (!bySlot.has(matchedSlot)) bySlot.set(matchedSlot, []);
      bySlot.get(matchedSlot)!.push(scored);
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
    setSelectedSlots([]);
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
    setSelectedSlots((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]);
    setActiveCandidate(null);
  }

  function applyRequestedSlot(
    day: string,
    time: string,
    mode: 'exact' | 'after' | 'before' | 'range',
    availableKeys: string[],
    endTime?: string,
  ): string[] {
    const dayKeys = availableKeys.filter((slotKey) => slotKey.startsWith(`${day}|`));
    const targetMinutes = timeToMinutes(time);
    if (targetMinutes == null) return [];
    if (mode === 'range') {
      const endMinutes = timeToMinutes(endTime || '');
      if (endMinutes == null) return [];
      const minMinutes = Math.min(targetMinutes, endMinutes) - SLOT_BOUNDARY_TOLERANCE_MINUTES;
      const maxMinutes = Math.max(targetMinutes, endMinutes) + SLOT_BOUNDARY_TOLERANCE_MINUTES;
      return dayKeys.filter((slotKey) => {
        const slotMinutes = timeToMinutes(slotKey.split('|')[1]);
        return slotMinutes != null && slotMinutes >= minMinutes && slotMinutes <= maxMinutes;
      });
    }
    if (mode === 'after') {
      return dayKeys.filter((slotKey) => (timeToMinutes(slotKey.split('|')[1]) ?? -1) >= targetMinutes - SLOT_BOUNDARY_TOLERANCE_MINUTES);
    }
    if (mode === 'before') {
      return dayKeys.filter((slotKey) => (timeToMinutes(slotKey.split('|')[1]) ?? 9999) <= targetMinutes + SLOT_BOUNDARY_TOLERANCE_MINUTES);
    }
    const exact = dayKeys.find((slotKey) => slotKey.endsWith(`|${time}`));
    if (exact) return [exact];
    const sorted = dayKeys
      .map((slotKey) => ({ slotKey, diff: Math.abs((timeToMinutes(slotKey.split('|')[1]) ?? 0) - targetMinutes) }))
      .sort((a, b) => a.diff - b.diff);
    return sorted[0] ? [sorted[0].slotKey] : [];
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

    const availableSlotKeys = dataset.slots.map((slot) => `${slot.day}|${normalizeSlotBucketTime(slot.time)}`);
    const orderedSlots: string[] = [];
    const pushSlot = (slotKey: string) => {
      if (!orderedSlots.includes(slotKey)) orderedSlots.push(slotKey);
    };
    for (const req of result.makeupRequests) {
      for (const slotKey of applyRequestedSlot(req.day, req.time, req.mode, availableSlotKeys, req.endTime)) {
        pushSlot(slotKey);
      }
    }
    if (result.makeupDaysOnly.length && dataset) {
      for (const slot of dataset.slots) {
        if (result.makeupDaysOnly.includes(slot.day)) {
          pushSlot(`${slot.day}|${normalizeSlotBucketTime(slot.time)}`);
        }
      }
    }
    setSelectedSlots(orderedSlots);
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

  const slotMatrix = useMemo(() => {
    if (!dataset) return { times: [] as string[], slotKeys: new Set<string>() };
    const slotKeys = new Set(dataset.slots.map((slot) => `${slot.day}|${normalizeSlotBucketTime(slot.time)}`));
    const rowStats = new Map<string, { weekdayCount: number; weekendCount: number }>();
    for (const slot of dataset.slots) {
      const bucket = normalizeSlotBucketTime(slot.time);
      const current = rowStats.get(bucket) || { weekdayCount: 0, weekendCount: 0 };
      if (slot.day === '周六' || slot.day === '周日') current.weekendCount += 1;
      else current.weekdayCount += 1;
      rowStats.set(bucket, current);
    }
    const times = [...new Set(dataset.slots.map((slot) => normalizeSlotBucketTime(slot.time)))].sort((a, b) => {
      const aStats = rowStats.get(a) || { weekdayCount: 0, weekendCount: 0 };
      const bStats = rowStats.get(b) || { weekdayCount: 0, weekendCount: 0 };
      const aPriority = aStats.weekdayCount > 0 ? 0 : 1;
      const bPriority = bStats.weekdayCount > 0 ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.localeCompare(b, 'zh-CN');
    });
    return { times, slotKeys };
  }, [dataset]);

  // ── Render ──

  return (
    <div className="makeup-wrap fade-in">
      <div className="makeup-topbar">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <h2 className="makeup-title">补课助手</h2>
        <span className="makeup-version-badge">{MAKEUP_TOOL_VERSION}</span>
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
                  <div className="makeup-slot-matrix">
                    <div className="makeup-slot-corner" />
                    {DAY_ORDER.map((day) => (
                      <div key={day} className="makeup-slot-day-head">{day}</div>
                    ))}
                    {slotMatrix.times.map((time) => (
                      <Fragment key={time}>
                        <div className="makeup-slot-time-head">{time}</div>
                        {DAY_ORDER.map((day) => {
                          const key = `${day}|${time}`;
                          const exists = slotMatrix.slotKeys.has(key);
                          if (!exists) return <div key={key} className="makeup-slot-cell empty" />;
                          return (
                            <div key={key} className="makeup-slot-cell">
                              <label className={`makeup-slot-toggle ${selectedSlots.includes(key) ? 'selected' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={selectedSlots.includes(key)}
                                  onChange={() => toggleSlot(key)}
                                />
                                <span>{time}</span>
                              </label>
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
                <p className="makeup-helper">可多选。系统会按勾选顺序展示，再按推荐优先级排序；前后 5 分钟视为同一时间档。</p>
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
                  <span className="pill">{selectedSlots.length ? `已选时间：${selectedSlots.length}个` : '还没选补课时间'}</span>
                  {totalMatches > 0 && <span className="pill">候选班：{totalMatches}个</span>}
                </div>
              )}

              {/* Candidates */}
              {!originOcc ? (
                <div className="makeup-empty">先选原班级、请假课次，再勾选备选时间。</div>
              ) : selectedSlots.length === 0 ? (
                <div className="makeup-empty">请先勾选家长能接受的补课时间。</div>
              ) : totalMatches === 0 ? (
                <div className="makeup-empty">这些时间里没有找到进度相同的候选班。</div>
              ) : (
                <div className="makeup-results">
                  {selectedSlots.map((slotKey) => {
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
                                  <span>时间：{row.candidate.day} {row.candidate.time}</span>
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
