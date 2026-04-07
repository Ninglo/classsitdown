import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ClassInfo } from '../types';
import type {
  ChallengeItem,
  CustomBlock,
  ListeningFontOption,
  ListeningMaterialItem,
  MediaAnnotation,
  MediaItem,
  OverviewContent,
  PhaseChallengeRow,
} from '../types/overview';
import { getClassProfile } from '../utils/classProfiles';
import { ALL_DAYS, getOrderedChallengeDays } from '../utils/classSchedule';
import {
  addCommunicationRecord,
  createChallengeItem,
  createCustomBlock,
  createEmptyContent,
  createListeningItem,
  createMediaAnnotation,
  getCommunicationStats,
  loadDraft,
  rememberReusableContent,
  saveDraft,
  syncPhaseChallenges,
  syncWeeklyChallengeDays,
} from '../utils/overviewData';
import { buildListeningMaterials, extractEnglishWords } from '../utils/wordTranslation';
import { getWeekRange, getCurrentWeek, formatDateShort } from '../utils/weekNumber';
import './OverviewApp.css';

interface Props {
  classInfo: ClassInfo;
  onBack: () => void;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatHistoryDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function orderDaysFromStart(startDay: string): string[] {
  const startIndex = ALL_DAYS.indexOf(startDay as typeof ALL_DAYS[number]);
  if (startIndex === -1) return [...ALL_DAYS];
  return [...ALL_DAYS.slice(startIndex), ...ALL_DAYS.slice(0, startIndex)];
}

function StudentPicker({
  studentNames,
  selected,
  onToggle,
}: {
  studentNames: string[];
  selected: string[];
  onToggle: (name: string) => void;
}) {
  if (studentNames.length === 0) {
    return <p className="ov-empty-hint">当前班级还没有导入学生名单。</p>;
  }

  return (
    <div className="ov-student-grid">
      {studentNames.map((name) => (
        <label key={name} className={`ov-student-chip${selected.includes(name) ? ' active' : ''}`}>
          <input
            type="checkbox"
            checked={selected.includes(name)}
            onChange={() => onToggle(name)}
          />
          <span>{name}</span>
        </label>
      ))}
    </div>
  );
}

function MediaEditor({
  items,
  onChange,
}: {
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
}) {
  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const uploaded: MediaItem[] = [];
    for (const file of Array.from(files)) {
      const src = await fileToDataUrl(file);
      uploaded.push({
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        src,
        name: file.name,
        caption: '',
        annotations: [],
      });
    }
    onChange([...items, ...uploaded]);
  }

  function updateItem(id: string, updater: (item: MediaItem) => MediaItem) {
    onChange(items.map((item) => (item.id === id ? updater(item) : item)));
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function updateAnnotation(itemId: string, annotationId: string, field: keyof MediaAnnotation, value: string | number) {
    updateItem(itemId, (item) => ({
      ...item,
      annotations: item.annotations.map((annotation) =>
        annotation.id === annotationId ? { ...annotation, [field]: value } : annotation,
      ),
    }));
  }

  function addAnnotation(itemId: string, type: MediaAnnotation['type']) {
    updateItem(itemId, (item) => ({
      ...item,
      annotations: [...item.annotations, createMediaAnnotation(type)],
    }));
  }

  function removeAnnotation(itemId: string, annotationId: string) {
    updateItem(itemId, (item) => ({
      ...item,
      annotations: item.annotations.filter((annotation) => annotation.id !== annotationId),
    }));
  }

  return (
    <div className="ov-media-editor">
      <label className="btn btn-ghost btn-sm ov-upload-btn">
        上传图片
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void handleUpload(event.target.files);
            event.target.value = '';
          }}
        />
      </label>

      {items.length === 0 && <p className="ov-empty-hint">支持多图上传，也可以给图片加框选和文字标注。</p>}

      {items.map((item) => (
        <div key={item.id} className="ov-media-card">
          <div className="ov-media-preview">
            <img src={item.src} alt={item.name || '上传图片'} />
            {item.annotations.map((annotation) => (
              <div
                key={annotation.id}
                className={`ov-media-annotation ov-media-annotation-${annotation.type}`}
                style={{
                  left: `${annotation.x}%`,
                  top: `${annotation.y}%`,
                  width: `${annotation.width}%`,
                  height: `${annotation.height}%`,
                  borderColor: annotation.color,
                  color: annotation.color,
                }}
              >
                {annotation.type === 'text' && <span>{annotation.text || '文字'}</span>}
              </div>
            ))}
          </div>

          <div className="ov-media-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => addAnnotation(item.id, 'box')}>+ 框选</button>
            <button className="btn btn-ghost btn-sm" onClick={() => addAnnotation(item.id, 'text')}>+ 文字</button>
            <button className="btn btn-ghost btn-sm" onClick={() => removeItem(item.id)}>删除图片</button>
          </div>

          <input
            className="input-field"
            placeholder="图片说明"
            value={item.caption}
            onChange={(event) => updateItem(item.id, (current) => ({ ...current, caption: event.target.value }))}
          />

          {item.annotations.map((annotation) => (
            <div key={annotation.id} className="ov-annotation-editor">
              <div className="ov-annotation-head">
                <strong>{annotation.type === 'box' ? '框选' : '文字标注'}</strong>
                <button className="btn btn-ghost btn-sm" onClick={() => removeAnnotation(item.id, annotation.id)}>删除</button>
              </div>
              {annotation.type === 'text' && (
                <input
                  className="input-field"
                  placeholder="标注文字"
                  value={annotation.text}
                  onChange={(event) => updateAnnotation(item.id, annotation.id, 'text', event.target.value)}
                />
              )}
              <div className="ov-slider-grid">
                {[
                  ['x', '横向'],
                  ['y', '纵向'],
                  ['width', '宽度'],
                  ['height', '高度'],
                ].map(([field, label]) => (
                  <label key={field}>
                    <span>{label}</span>
                    <input
                      type="range"
                      min={0}
                      max={field === 'width' || field === 'height' ? 100 : 95}
                      value={annotation[field as keyof MediaAnnotation] as number}
                      onChange={(event) =>
                        updateAnnotation(item.id, annotation.id, field as keyof MediaAnnotation, Number(event.target.value))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function CustomTableEditor({
  block,
  onChange,
}: {
  block: CustomBlock;
  onChange: (block: CustomBlock) => void;
}) {
  function updateColumn(index: number, value: string) {
    onChange({
      ...block,
      table: {
        ...block.table,
        columns: block.table.columns.map((column, columnIndex) => (columnIndex === index ? value : column)),
      },
    });
  }

  function updateCell(rowIndex: number, cellIndex: number, value: string) {
    onChange({
      ...block,
      table: {
        ...block.table,
        rows: block.table.rows.map((row, currentRowIndex) =>
          currentRowIndex === rowIndex
            ? row.map((cell, currentCellIndex) => (currentCellIndex === cellIndex ? value : cell))
            : row,
        ),
      },
    });
  }

  function addRow() {
    onChange({
      ...block,
      table: {
        ...block.table,
        rows: [...block.table.rows, block.table.columns.map(() => '')],
      },
    });
  }

  function addColumn() {
    onChange({
      ...block,
      table: {
        columns: [...block.table.columns, `列${block.table.columns.length + 1}`],
        rows: block.table.rows.map((row) => [...row, '']),
      },
    });
  }

  return (
    <div className="ov-custom-table-editor">
      <div className="ov-table-grid" style={{ gridTemplateColumns: `repeat(${block.table.columns.length}, minmax(120px, 1fr))` }}>
        {block.table.columns.map((column, index) => (
          <input
            key={`head_${index}`}
            className="input-field ov-table-head-input"
            value={column}
            onChange={(event) => updateColumn(index, event.target.value)}
          />
        ))}
        {block.table.rows.map((row, rowIndex) =>
          row.map((cell, cellIndex) => (
            <input
              key={`${rowIndex}_${cellIndex}`}
              className="input-field"
              value={cell}
              onChange={(event) => updateCell(rowIndex, cellIndex, event.target.value)}
            />
          )),
        )}
      </div>
      <div className="ov-inline-actions">
        <button className="btn btn-ghost btn-sm" onClick={addRow}>+ 增加一行</button>
        <button className="btn btn-ghost btn-sm" onClick={addColumn}>+ 增加一列</button>
      </div>
    </div>
  );
}

export default function OverviewApp({ classInfo, onBack }: Props) {
  const classCode = classInfo.name;
  const profile = useMemo(() => getClassProfile(classCode), [classCode]);
  const studentNames = useMemo(
    () => profile?.students.map((student) => student.chineseName) ?? [],
    [profile],
  );
  const orderedDays = useMemo(() => getOrderedChallengeDays(classCode), [classCode]);
  const [week, setWeek] = useState(() => getCurrentWeek());
  const [content, setContent] = useState<OverviewContent>(() =>
    loadDraft(classCode, getCurrentWeek()) ?? createEmptyContent(classCode, getCurrentWeek(), { orderedDays, studentNames }),
  );
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [listeningBatchInput, setListeningBatchInput] = useState('');
  const [translating, setTranslating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(content);
      rememberReusableContent(content, studentNames);
    }, 400);
    return () => clearTimeout(timer);
  }, [content, studentNames]);

  useEffect(() => {
    setContent((current) => {
      const nextChallenges = syncWeeklyChallengeDays(current.weeklyChallenges, orderedDays);
      const nextPhases = syncPhaseChallenges(current.phaseChallenges, studentNames);
      const nextSelected = current.communicationPlan.selectedStudents.filter((name) => studentNames.includes(name));

      const challengesChanged = nextChallenges.length !== current.weeklyChallenges.length ||
        nextChallenges.some((item, i) => item.day !== current.weeklyChallenges[i]?.day);
      const phasesChanged = nextPhases.some((row, i) =>
        row.selectedStudents.length !== current.phaseChallenges[i]?.selectedStudents.length,
      );
      const selectedChanged = nextSelected.length !== current.communicationPlan.selectedStudents.length;

      if (!challengesChanged && !phasesChanged && !selectedChanged) return current;

      return {
        ...current,
        challengeStartDay: current.challengeStartDay || orderedDays[0] || '周一',
        weeklyChallenges: nextChallenges,
        phaseChallenges: nextPhases,
        communicationPlan: { ...current.communicationPlan, selectedStudents: nextSelected },
      };
    });
  }, [orderedDays, studentNames]);

  function updateContent(updater: (current: OverviewContent) => OverviewContent) {
    setContent((current) => ({ ...updater(current), classCode, week }));
  }

  function handleWeekChange(nextWeek: number) {
    setWeek(nextWeek);
    const draft = loadDraft(classCode, nextWeek);
    setContent(draft ?? createEmptyContent(classCode, nextWeek, { orderedDays, studentNames }));
  }

  async function handleListeningBatchImport() {
    const words = extractEnglishWords(listeningBatchInput);
    if (words.length === 0) {
      setNotice('先把英文单词整段贴进来。');
      return;
    }

    setTranslating(true);
    try {
      const materials = await buildListeningMaterials(listeningBatchInput);
      updateContent((current) => ({
        ...current,
        listeningMaterials: materials,
      }));
      setNotice(`已识别 ${materials.length} 个单词，中文可以继续手动改。`);
    } finally {
      setTranslating(false);
    }
  }

  function toggleName(list: string[], name: string): string[] {
    return list.includes(name) ? list.filter((item) => item !== name) : [...list, name];
  }

  async function handleExport() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `${classCode}_W${week}_课程概览.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  }

  function logCommunication() {
    if (content.communicationPlan.selectedStudents.length === 0) {
      setNotice('先勾选交流学生。');
      return;
    }

    addCommunicationRecord(classCode, {
      week,
      studentNames: content.communicationPlan.selectedStudents,
      teacherName: content.communicationPlan.teacherName,
      scheduleText: content.communicationPlan.scheduleText,
      note: content.communicationPlan.note,
    });

    setNotice('交流名单已记忆，下次会继续提醒哪些学生已交流。');
  }

  const communicationStats = useMemo(
    () => getCommunicationStats(classCode, studentNames),
    [classCode, studentNames, content.communicationPlan.selectedStudents],
  );
  const weekRange = getWeekRange(week);
  const orderedChallengeDays = useMemo(
    () => orderDaysFromStart(content.challengeStartDay || orderedDays[0] || '周一'),
    [content.challengeStartDay, orderedDays],
  );
  const weeklyChallengeRows = useMemo(
    () => orderedChallengeDays.map((day) => content.weeklyChallenges.find((item) => item.day === day) ?? { day, task: '' }),
    [content.weeklyChallenges, orderedChallengeDays],
  );

  return (
    <div className="ov-shell fade-in">
      <div className="ov-toolbar">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <div className="ov-toolbar-center">
          <strong>{classCode}</strong>
          <span>{formatDateShort(weekRange.start)} - {formatDateShort(weekRange.end)}</span>
        </div>
        <div className="ov-toolbar-actions">
          <select value={week} onChange={(event) => handleWeekChange(Number(event.target.value))}>
            {Array.from({ length: 52 }, (_, index) => index + 1).map((item) => (
              <option key={item} value={item}>W{item}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting ? '导出中...' : '导出图片'}
          </button>
        </div>
      </div>

      {notice && <div className="ov-notice">{notice}</div>}

      <div className="ov-layout">
        <div className="ov-editor card">
          <section className="ov-editor-section">
            <div className="ov-section-head">
              <h3>① 本周挑战</h3>
              <p>横排表格展示，第一天也可以手动切换。</p>
            </div>
            <div className="ov-inline-actions ov-inline-actions-start">
              <span className="ov-field-caption">第一天</span>
              <select
                value={content.challengeStartDay || orderedDays[0]}
                onChange={(event) =>
                  updateContent((current) => ({
                    ...current,
                    challengeStartDay: event.target.value as OverviewContent['challengeStartDay'],
                  }))
                }
              >
                {ALL_DAYS.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            <div className="ov-week-table-wrap">
              <div className="ov-week-table" style={{ gridTemplateColumns: `repeat(${weeklyChallengeRows.length}, minmax(180px, 1fr))` }}>
                {weeklyChallengeRows.map((item) => (
                  <div key={`${item.day}_head`} className="ov-week-head">{item.day}</div>
                ))}
                {weeklyChallengeRows.map((item) => (
                  <textarea
                    key={item.day}
                    rows={4}
                    placeholder="这一天的具体任务"
                    value={item.task}
                    onChange={(event) =>
                      updateContent((current) => ({
                        ...current,
                        weeklyChallenges: current.weeklyChallenges.map((currentItem) =>
                          currentItem.day === item.day ? { ...currentItem, task: event.target.value } : currentItem,
                        ),
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="ov-editor-section">
            <div className="ov-section-head">
              <h3>② 分阶段挑战</h3>
              <p>学生勾选、挑战内容、达成途径都会自动记住，后面还能继续改。</p>
            </div>
            <div className="ov-phase-table">
              <div className="ov-phase-header">阶段</div>
              <div className="ov-phase-header">学生名单</div>
              <div className="ov-phase-header">具体挑战内容</div>
              <div className="ov-phase-header">达成途径</div>
              {content.phaseChallenges.map((row) => (
                <Fragment key={row.id}>
                  <div key={`${row.id}_label`} className="ov-phase-label">{row.label}</div>
                  <div key={`${row.id}_students`} className="ov-phase-cell">
                    <StudentPicker
                      studentNames={studentNames}
                      selected={row.selectedStudents}
                      onToggle={(name) =>
                        updateContent((current) => ({
                          ...current,
                          phaseChallenges: current.phaseChallenges.map((phase) =>
                            phase.id === row.id ? { ...phase, selectedStudents: toggleName(phase.selectedStudents, name) } : phase,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div key={`${row.id}_challenge`} className="ov-phase-cell">
                    <textarea
                      rows={4}
                      value={row.challengeContent}
                      placeholder="比如：固定跟读、句型复述、单词滚动复盘"
                      onChange={(event) =>
                        updateContent((current) => ({
                          ...current,
                          phaseChallenges: current.phaseChallenges.map((phase) =>
                            phase.id === row.id ? { ...phase, challengeContent: event.target.value } : phase,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div key={`${row.id}_method`} className="ov-phase-cell">
                    <textarea
                      rows={4}
                      value={row.method}
                      placeholder="比如：每天 10 分钟 + 课堂抽查"
                      onChange={(event) =>
                        updateContent((current) => ({
                          ...current,
                          phaseChallenges: current.phaseChallenges.map((phase) =>
                            phase.id === row.id ? { ...phase, method: event.target.value } : phase,
                          ),
                        }))
                      }
                    />
                  </div>
                </Fragment>
              ))}
            </div>
          </section>

          <section className="ov-editor-section">
            <div className="ov-section-head">
              <h3>③ 本周挑战内容</h3>
              <p>支持多个任务，每个任务都可以配文字和图片。</p>
            </div>
            <div className="ov-inline-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => updateContent((current) => ({
                ...current,
                challengeItems: [...current.challengeItems, createChallengeItem()],
              }))}>
                + 添加挑战
              </button>
            </div>
            {content.challengeItems.length === 0 && <p className="ov-empty-hint">还没有挑战内容。</p>}
            {content.challengeItems.map((item: ChallengeItem) => (
              <div key={item.id} className="ov-block-card">
                <div className="ov-inline-actions">
                  <input
                    className="input-field"
                    placeholder="挑战标题"
                    value={item.title}
                    onChange={(event) =>
                      updateContent((current) => ({
                        ...current,
                        challengeItems: current.challengeItems.map((challenge) =>
                          challenge.id === item.id ? { ...challenge, title: event.target.value } : challenge,
                        ),
                      }))
                    }
                  />
                  <button className="btn btn-ghost btn-sm" onClick={() =>
                    updateContent((current) => ({
                      ...current,
                      challengeItems: current.challengeItems.filter((challenge) => challenge.id !== item.id),
                    }))
                  }>
                    删除
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="挑战要求"
                  value={item.detail}
                  onChange={(event) =>
                    updateContent((current) => ({
                      ...current,
                      challengeItems: current.challengeItems.map((challenge) =>
                        challenge.id === item.id ? { ...challenge, detail: event.target.value } : challenge,
                      ),
                    }))
                  }
                />
                <MediaEditor
                  items={item.media}
                  onChange={(media) =>
                    updateContent((current) => ({
                      ...current,
                      challengeItems: current.challengeItems.map((challenge) =>
                        challenge.id === item.id ? { ...challenge, media } : challenge,
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </section>

          <section className="ov-editor-section">
            <div className="ov-section-head">
              <h3>④ 下周听读语料</h3>
              <p>整段粘贴英文后自动拆词补中文，中文仍保留手动修改权限。</p>
            </div>
            <textarea
              rows={4}
              placeholder="直接粘贴一整段单词或英文短语，例如: apple, banana, pear"
              value={listeningBatchInput}
              onChange={(event) => setListeningBatchInput(event.target.value)}
            />
            <div className="ov-inline-actions">
              <select
                value={content.listeningFont}
                onChange={(event) =>
                  updateContent((current) => ({ ...current, listeningFont: event.target.value as ListeningFontOption }))
                }
              >
                <option value="guide">四线三格</option>
                <option value="print">标准印刷</option>
                <option value="rounded">圆润手写</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={() => void handleListeningBatchImport()} disabled={translating}>
                {translating ? '识别中...' : '识别英文并补中文'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => updateContent((current) => ({
                ...current,
                listeningMaterials: [...current.listeningMaterials, createListeningItem()],
              }))}>
                + 手动补一条
              </button>
            </div>
            <div className="ov-listening-table">
              <div className="ov-listening-head">英文</div>
              <div className="ov-listening-head">中文释义</div>
              {content.listeningMaterials.map((item: ListeningMaterialItem) => (
                <Fragment key={item.id}>
                  <input
                    className="input-field"
                    placeholder="English"
                    value={item.english}
                    onChange={(event) =>
                      updateContent((current) => ({
                        ...current,
                        listeningMaterials: current.listeningMaterials.map((material) =>
                          material.id === item.id ? { ...material, english: event.target.value } : material,
                        ),
                      }))
                    }
                  />
                  <div className="ov-listening-cell">
                    <input
                      className="input-field"
                      placeholder="中文释义"
                      value={item.chinese}
                      onChange={(event) =>
                        updateContent((current) => ({
                          ...current,
                          listeningMaterials: current.listeningMaterials.map((material) =>
                            material.id === item.id ? { ...material, chinese: event.target.value } : material,
                          ),
                        }))
                      }
                    />
                    <button className="btn btn-ghost btn-sm" onClick={() =>
                      updateContent((current) => ({
                        ...current,
                        listeningMaterials: current.listeningMaterials.filter((material) => material.id !== item.id),
                      }))
                    }>
                      删除
                    </button>
                  </div>
                </Fragment>
              ))}
            </div>
          </section>

          <section className="ov-editor-section">
            <div className="ov-section-head">
              <h3>⑤ 交流名单</h3>
              <p>会记录哪些学生交流过，也会记住常用交流人、时间和地点。</p>
            </div>
            <div className="ov-summary-strip">
              <span className="chip">已交流 {communicationStats.contacted.length} 人</span>
              <span className="chip">待交流 {communicationStats.pending.length} 人</span>
            </div>
            <StudentPicker
              studentNames={studentNames}
              selected={content.communicationPlan.selectedStudents}
              onToggle={(name) =>
                updateContent((current) => ({
                  ...current,
                  communicationPlan: {
                    ...current.communicationPlan,
                    selectedStudents: toggleName(current.communicationPlan.selectedStudents, name),
                  },
                }))
              }
            />
            <div className="ov-three-cols">
              <input
                className="input-field"
                placeholder="交流人"
                value={content.communicationPlan.teacherName}
                onChange={(event) =>
                  updateContent((current) => ({
                    ...current,
                    communicationPlan: { ...current.communicationPlan, teacherName: event.target.value },
                  }))
                }
              />
              <input
                className="input-field"
                placeholder="交流时间 & 地点"
                value={content.communicationPlan.scheduleText}
                onChange={(event) =>
                  updateContent((current) => ({
                    ...current,
                    communicationPlan: { ...current.communicationPlan, scheduleText: event.target.value },
                  }))
                }
              />
              <button className="btn btn-primary btn-sm" onClick={logCommunication}>记为已交流</button>
            </div>
            <textarea
              rows={3}
              placeholder="交流补充说明"
              value={content.communicationPlan.note}
              onChange={(event) =>
                updateContent((current) => ({
                  ...current,
                  communicationPlan: { ...current.communicationPlan, note: event.target.value },
                }))
              }
            />
            {communicationStats.contacted.length > 0 && (
              <div className="ov-history-list">
                {communicationStats.contacted.map((name) => {
                  const record = communicationStats.latestByStudent[name];
                  return (
                    <div key={name} className="ov-history-item">
                      <strong>{name}</strong>
                      <span>{record.teacherName || '未写交流人'} · {record.scheduleText || '未写时间地点'} · {formatHistoryDate(record.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="ov-editor-section">
            <div className="ov-section-head">
              <h3>⑥ 自定义补充区</h3>
              <p>区域名可改，内容可以是文字、表格或者图片。</p>
            </div>
            <div className="ov-inline-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => updateContent((current) => ({
                ...current,
                customBlocks: [...current.customBlocks, createCustomBlock()],
              }))}>
                + 添加区域
              </button>
            </div>
            {content.customBlocks.map((block) => (
              <div key={block.id} className="ov-block-card">
                <div className="ov-inline-actions">
                  <input
                    className="input-field"
                    value={block.title}
                    onChange={(event) =>
                      updateContent((current) => ({
                        ...current,
                        customBlocks: current.customBlocks.map((item) =>
                          item.id === block.id ? { ...item, title: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <select
                    value={block.mode}
                    onChange={(event) =>
                      updateContent((current) => ({
                        ...current,
                        customBlocks: current.customBlocks.map((item) =>
                          item.id === block.id ? { ...item, mode: event.target.value as CustomBlock['mode'] } : item,
                        ),
                      }))
                    }
                  >
                    <option value="text">文字</option>
                    <option value="table">表格</option>
                    <option value="image">图片</option>
                  </select>
                  <button className="btn btn-ghost btn-sm" onClick={() =>
                    updateContent((current) => ({
                      ...current,
                      customBlocks: current.customBlocks.filter((item) => item.id !== block.id),
                    }))
                  }>
                    删除
                  </button>
                </div>
                {block.mode === 'text' && (
                  <textarea
                    rows={4}
                    value={block.text}
                    onChange={(event) =>
                      updateContent((current) => ({
                        ...current,
                        customBlocks: current.customBlocks.map((item) =>
                          item.id === block.id ? { ...item, text: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                )}
                {block.mode === 'table' && (
                  <CustomTableEditor
                    block={block}
                    onChange={(nextBlock) =>
                      updateContent((current) => ({
                        ...current,
                        customBlocks: current.customBlocks.map((item) => (item.id === block.id ? nextBlock : item)),
                      }))
                    }
                  />
                )}
                {block.mode === 'image' && (
                  <MediaEditor
                    items={block.media}
                    onChange={(media) =>
                      updateContent((current) => ({
                        ...current,
                        customBlocks: current.customBlocks.map((item) =>
                          item.id === block.id ? { ...item, media } : item,
                        ),
                      }))
                    }
                  />
                )}
              </div>
            ))}
          </section>
        </div>

        <div className="ov-preview">
          <div className="ov-preview-paper" ref={cardRef}>
            <header className="ov-paper-header">
              <div>
                <p className="ov-paper-eyebrow">课程概览</p>
                <h2>{classCode}</h2>
              </div>
              <div className="ov-paper-week">
                <strong>Week {week}</strong>
                <span>{formatDateShort(weekRange.start)} - {formatDateShort(weekRange.end)}</span>
              </div>
            </header>

            <section className="ov-paper-section">
              <div className="ov-paper-title">① 本周挑战</div>
              <div className="ov-paper-week-axis">
                <span>第一天：{content.challengeStartDay || orderedDays[0]}</span>
              </div>
              <div className="ov-paper-week-table" style={{ gridTemplateColumns: `repeat(${weeklyChallengeRows.length}, minmax(180px, 1fr))` }}>
                {weeklyChallengeRows.map((item) => (
                  <div key={`${item.day}_preview_head`} className="ov-paper-week-head">{item.day}</div>
                ))}
                {weeklyChallengeRows.map((item) => (
                  <div key={`${item.day}_preview_body`} className="ov-paper-week-cell">{item.task || '待补充'}</div>
                ))}
              </div>
            </section>

            <section className="ov-paper-section">
              <div className="ov-paper-title">② 分阶段挑战</div>
              <div className="ov-paper-phase-table">
                <div className="ov-paper-phase-head">阶段</div>
                <div className="ov-paper-phase-head">学生名单</div>
                <div className="ov-paper-phase-head">具体挑战内容</div>
                <div className="ov-paper-phase-head">达成途径</div>
                {content.phaseChallenges.map((row: PhaseChallengeRow) => (
                  <Fragment key={row.id}>
                    <div key={`${row.id}_stage`} className="ov-paper-phase-stage">{row.label}</div>
                    <div key={`${row.id}_students`} className="ov-paper-phase-cell">{row.selectedStudents.join('、') || '待勾选'}</div>
                    <div key={`${row.id}_content`} className="ov-paper-phase-cell">{row.challengeContent || '待补充'}</div>
                    <div key={`${row.id}_method`} className="ov-paper-phase-cell">{row.method || '待补充'}</div>
                  </Fragment>
                ))}
              </div>
            </section>

            <section className="ov-paper-section">
              <div className="ov-paper-title">③ 本周挑战内容</div>
              <div className="ov-paper-stack">
                {content.challengeItems.length === 0 && <p className="ov-paper-empty">暂未填写挑战内容</p>}
                {content.challengeItems.map((item: ChallengeItem, index) => (
                  <article key={item.id} className="ov-paper-task">
                    <div className="ov-paper-task-index">挑战 {index + 1}</div>
                    <h4>{item.title || '未命名挑战'}</h4>
                    <p>{item.detail || '待补充'}</p>
                    {item.media.length > 0 && (
                      <div className="ov-paper-media-grid">
                        {item.media.map((media) => (
                          <figure key={media.id} className="ov-paper-figure">
                            <img src={media.src} alt={media.name || item.title || '挑战图片'} />
                            {media.caption && <figcaption>{media.caption}</figcaption>}
                          </figure>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="ov-paper-section">
              <div className="ov-paper-title">④ 下周听读语料</div>
              <div className={`ov-paper-listening ov-paper-listening-${content.listeningFont}`}>
                {content.listeningMaterials.length === 0 && <p className="ov-paper-empty">暂未填写语料</p>}
                {content.listeningMaterials.map((item: ListeningMaterialItem) => (
                  <div key={item.id} className="ov-paper-listening-row">
                    <span className="ov-paper-word">{item.english || 'English'}</span>
                    <span className="ov-paper-meaning">{item.chinese || '待补充中文释义'}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="ov-paper-section">
              <div className="ov-paper-title">⑤ 交流名单</div>
              <div className="ov-paper-comm-meta">
                <span>交流人：{content.communicationPlan.teacherName || '待填写'}</span>
                <span>时间地点：{content.communicationPlan.scheduleText || '待填写'}</span>
              </div>
              <div className="ov-paper-comm-students">
                {content.communicationPlan.selectedStudents.length > 0
                  ? content.communicationPlan.selectedStudents.join('、')
                  : '待勾选交流学生'}
              </div>
              {content.communicationPlan.note && <p className="ov-paper-comm-note">{content.communicationPlan.note}</p>}
            </section>

            {content.customBlocks.map((block) => (
              <section key={block.id} className="ov-paper-section">
                <div className="ov-paper-title">⑥ {block.title}</div>
                {block.mode === 'text' && <p className="ov-paper-paragraph">{block.text || '待补充'}</p>}
                {block.mode === 'table' && (
                  <div className="ov-paper-custom-table" style={{ gridTemplateColumns: `repeat(${block.table.columns.length}, minmax(0, 1fr))` }}>
                    {block.table.columns.map((column, index) => (
                      <div key={`column_${index}`} className="ov-paper-custom-head">{column}</div>
                    ))}
                    {block.table.rows.flatMap((row, rowIndex) =>
                      row.map((cell, cellIndex) => (
                        <div key={`${rowIndex}_${cellIndex}`} className="ov-paper-custom-cell">{cell || ' '}</div>
                      )),
                    )}
                  </div>
                )}
                {block.mode === 'image' && (
                  <div className="ov-paper-media-grid">
                    {block.media.map((media) => (
                      <figure key={media.id} className="ov-paper-figure">
                        <img src={media.src} alt={media.name || block.title} />
                        {media.caption && <figcaption>{media.caption}</figcaption>}
                      </figure>
                    ))}
                    {block.media.length === 0 && <p className="ov-paper-empty">暂未上传图片</p>}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
