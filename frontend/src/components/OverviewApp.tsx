import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ClassInfo } from '../types';
import type {
  ChallengeItem,
  CustomBlock,
  CommunicationGroup,
  ListeningFontOption,
  ListeningMaterialItem,
  MediaAnnotation,
  MediaItem,
  OverviewContent,
  OverviewThemeOption,
  PhaseChallengeRow,
} from '../types/overview';
import { getResolvedStudents, importStudentNames, updateClassProfile } from '../utils/classProfiles';
import type { StudentInfo } from '../types';
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
  normalizeCommunicationPlan,
  rememberReusableContent,
  saveDraft,
  syncPhaseChallenges,
  syncWeeklyChallengeDays,
} from '../utils/overviewData';
import { buildListeningMaterials, extractListeningPairs } from '../utils/wordTranslation';
import { sortStudentNames } from '../utils/classProfiles';
import { getWeekRange, getCurrentWeek, formatDateShort } from '../utils/weekNumber';
import './OverviewApp.css';

interface Props {
  classInfo: ClassInfo;
  classes?: ClassInfo[];
  onBack: () => void;
  onBackToHome?: () => void;
  onSwitchClass?: (name: string) => void;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function filesToMediaItems(files: File[]): Promise<MediaItem[]> {
  const uploaded: MediaItem[] = [];
  for (const file of files) {
    const src = await fileToDataUrl(file);
    uploaded.push({
      id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      src,
      name: file.name,
      caption: '',
      displayWidth: 160,
      annotations: [],
    });
  }
  return uploaded;
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

function hasWeeklyChallenges(content: OverviewContent): boolean {
  return content.weeklyChallenges.some((item) => item.task.trim());
}

function hasPhaseChallenges(content: OverviewContent): boolean {
  return content.phaseChallenges.some((item) =>
    item.selectedStudents.length > 0 || item.challengeContent.trim() || item.method.trim(),
  );
}

function hasChallengeItems(content: OverviewContent): boolean {
  return content.challengeItems.some((item) =>
    item.title.trim() || item.detail.trim() || item.media.length > 0,
  );
}

function hasListeningMaterials(content: OverviewContent): boolean {
  return content.listeningMaterials.some((item) => item.english.trim() || item.chinese.trim());
}

function hasCommunicationPlan(content: OverviewContent): boolean {
  return content.communicationPlan.groups.some((group) =>
    group.selectedStudents.length > 0 ||
    group.teacherName.trim() ||
    group.scheduleText.trim() ||
    group.note.trim(),
  );
}

function parseStudentNames(raw: string): string[] {
  return sortStudentNames(
    raw
      .split(/[\n,，、;；]+/)
      .map((item) => item.replace(/^[\d.、)\]-]+\s*/, '').trim())
      .filter(Boolean),
  );
}

const OVERVIEW_THEME_OPTIONS: Array<{ value: OverviewThemeOption; label: string }> = [
  { value: 'green', label: '森林绿' },
  { value: 'amber', label: '琥珀金' },
  { value: 'blue', label: '海盐蓝' },
  { value: 'rose', label: '玫瑰粉' },
  { value: 'graphite', label: '石墨灰' },
];

type StudentPickerTone = 'neutral' | 'foundation' | 'steady' | 'boost';

function getPhaseTone(key: PhaseChallengeRow['key']): StudentPickerTone {
  if (key === '突破拔高') return 'boost';
  if (key === '维稳达标') return 'steady';
  return 'foundation';
}

const PHASE_TIER_ORDER: PhaseChallengeRow['key'][] = ['突破拔高', '维稳达标', '夯实基础'];

function StudentPicker({
  studentNames,
  selected,
  onToggle,
  tone = 'neutral',
  nameMap,
}: {
  studentNames: string[];
  selected: string[];
  onToggle: (name: string) => void;
  tone?: StudentPickerTone;
  nameMap?: Map<string, string>;
}) {
  if (studentNames.length === 0) {
    return <p className="ov-empty-hint">当前班级还没有导入学生名单。</p>;
  }

  const sorted = nameMap
    ? [...studentNames].sort((a, b) => (nameMap.get(a) || a).localeCompare(nameMap.get(b) || b, 'en', { sensitivity: 'base' }))
    : sortStudentNames(studentNames);

  return (
    <div className="ov-student-grid">
      {sorted.map((name) => (
        <label
          key={name}
          className={`ov-student-chip ov-student-chip-tone-${tone}${selected.includes(name) ? ' active' : ''}`}
        >
          <input
            type="checkbox"
            checked={selected.includes(name)}
            onChange={() => onToggle(name)}
          />
          <span>{nameMap?.get(name) || name}</span>
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
  function getEditorPreviewWidth(displayWidth?: number): string {
    const width = Math.max(320, Math.min(900, Math.round((displayWidth ?? 160) * 4)));
    return `min(100%, ${width}px)`;
  }

  async function appendFiles(files: File[]) {
    if (files.length === 0) return;
    const uploaded = await filesToMediaItems(files);
    onChange([...items, ...uploaded]);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    await appendFiles(Array.from(files));
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
    <div
      className="ov-media-editor"
      onPaste={(event) => {
        const pastedFiles = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
        if (pastedFiles.length === 0) return;
        event.preventDefault();
        void appendFiles(pastedFiles);
      }}
    >
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
      <p className="ov-empty-hint">也支持直接 `Ctrl+V` / 粘贴图片。</p>

      {items.map((item) => (
        <div key={item.id} className="ov-media-card">
          <div className="ov-media-preview" style={{ width: getEditorPreviewWidth(item.displayWidth) }}>
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

          <div className="ov-slider-grid ov-media-size-grid">
            <label>
              <span>图片宽度</span>
              <input
                type="range"
                min={100}
                max={220}
                value={item.displayWidth ?? 160}
                onChange={(event) => updateItem(item.id, (current) => ({
                  ...current,
                  displayWidth: Number(event.target.value),
                }))}
              />
            </label>
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

function createCommunicationGroup(overrides: Partial<CommunicationGroup> = {}): CommunicationGroup {
  return {
    id: `comm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: '第1组',
    selectedStudents: [],
    teacherName: '',
    scheduleText: '',
    note: '',
    ...overrides,
  };
}

function normalizeCommunicationGroups(groups: CommunicationGroup[]): CommunicationGroup[] {
  return (groups.length > 0 ? groups : [createCommunicationGroup()]).map((group) => ({
    ...group,
    selectedStudents: sortStudentNames(group.selectedStudents),
  }));
}

function syncCommunicationPlan(groups: CommunicationGroup[]): OverviewContent['communicationPlan'] {
  const normalizedGroups = normalizeCommunicationGroups(groups);
  return normalizeCommunicationPlan({
    groups: normalizedGroups,
    selectedStudents: normalizedGroups.flatMap((group) => group.selectedStudents),
    teacherName: normalizedGroups[0]?.teacherName ?? '',
    scheduleText: normalizedGroups[0]?.scheduleText ?? '',
    note: normalizedGroups[0]?.note ?? '',
  });
}

function shouldShowCustomBlock(block: CustomBlock): boolean {
  if (block.mode === 'text') {
    return Boolean(block.text.trim() || (block.title.trim() && block.title.trim() !== '补充内容'));
  }

  if (block.mode === 'table') {
    return block.table.rows.some((row) => row.some((cell) => cell.trim()))
      || Boolean(block.title.trim() && block.title.trim() !== '补充内容');
  }

  return block.media.length > 0 || Boolean(block.title.trim() && block.title.trim() !== '补充内容');
}

export default function OverviewApp({ classInfo, classes, onBack, onBackToHome, onSwitchClass }: Props) {
  function getPaperMediaWidth(displayWidth?: number): string {
    const width = Math.max(360, Math.min(820, Math.round((displayWidth ?? 160) * 5)));
    return `min(100%, ${width}px)`;
  }

  const classCode = classInfo.name;
  const [studentNames, setStudentNames] = useState<string[]>(() =>
    sortStudentNames(getResolvedStudents(classCode).map((student) => student.chineseName)),
  );
  const [resolvedStudents, setResolvedStudents] = useState<StudentInfo[]>(() => getResolvedStudents(classCode));
  const [editingChineseName, setEditingChineseName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const orderedDays = useMemo(() => getOrderedChallengeDays(classCode), [classCode]);
  const [week, setWeek] = useState(() => getCurrentWeek());
  const [content, setContent] = useState<OverviewContent>(() =>
    loadDraft(classCode, getCurrentWeek()) ?? createEmptyContent(classCode, getCurrentWeek(), { orderedDays, studentNames }),
  );
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [listeningBatchInput, setListeningBatchInput] = useState('');
  const [translating, setTranslating] = useState(false);
  const [studentImportInput, setStudentImportInput] = useState('');
  const [studentListCollapsed, setStudentListCollapsed] = useState(false);
  const [phaseTierCollapsed, setPhaseTierCollapsed] = useState(false);
  const [activePhaseTier, setActivePhaseTier] = useState<PhaseChallengeRow['key']>('维稳达标');
  const cardRef = useRef<HTMLDivElement>(null);

  // Map Chinese name → English name for display throughout the overview
  const englishNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of resolvedStudents) {
      if (s.englishName) map.set(s.chineseName, s.englishName);
    }
    return map;
  }, [resolvedStudents]);

  /** Translate a Chinese name to its English display name (falls back to Chinese). */
  function displayName(chineseName: string): string {
    return englishNameMap.get(chineseName) || chineseName;
  }

  /** Translate an array of Chinese names to English display names, sorted by English name and joined. */
  function displayNames(chineseNames: string[]): string {
    return [...chineseNames]
      .map((cn) => ({ cn, display: englishNameMap.get(cn) || cn }))
      .sort((a, b) => a.display.localeCompare(b.display, 'en', { sensitivity: 'base' }))
      .map((item) => item.display)
      .join('、');
  }

  useEffect(() => {
    const nextResolved = getResolvedStudents(classCode);
    const nextNames = sortStudentNames(nextResolved.map((student) => student.chineseName));
    setResolvedStudents(nextResolved);
    setStudentNames(nextNames);
    setStudentListCollapsed(nextNames.length > 12);
    const draft = loadDraft(classCode, week);
    setContent(draft ?? createEmptyContent(classCode, week, { orderedDays, studentNames: nextNames }));
  }, [classCode, orderedDays, week]);

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
      let nextPhases = syncPhaseChallenges(current.phaseChallenges, studentNames);
      // Auto-default: put unassigned students into 维稳达标
      const assigned = new Set(nextPhases.flatMap((row) => row.selectedStudents));
      const unassigned = studentNames.filter((n) => !assigned.has(n));
      if (unassigned.length > 0) {
        nextPhases = nextPhases.map((row) =>
          row.key === '维稳达标'
            ? { ...row, selectedStudents: sortStudentNames([...row.selectedStudents, ...unassigned]) }
            : row,
        );
      }
      const nextGroups = normalizeCommunicationGroups(current.communicationPlan.groups).map((group) => ({
        ...group,
        selectedStudents: sortStudentNames(group.selectedStudents.filter((name) => studentNames.includes(name))),
      }));
      const nextCommunicationPlan = syncCommunicationPlan(nextGroups);

      const challengesChanged = nextChallenges.length !== current.weeklyChallenges.length ||
        nextChallenges.some((item, i) => item.day !== current.weeklyChallenges[i]?.day);
      const phasesChanged = nextPhases.some((row, i) =>
        row.selectedStudents.length !== current.phaseChallenges[i]?.selectedStudents.length,
      );
      const selectedChanged = JSON.stringify(nextCommunicationPlan.groups.map((group) => group.selectedStudents))
        !== JSON.stringify(current.communicationPlan.groups.map((group) => group.selectedStudents));

      if (!challengesChanged && !phasesChanged && !selectedChanged) return current;

      return {
        ...current,
        challengeStartDay: current.challengeStartDay || orderedDays[0] || '周一',
        weeklyChallenges: nextChallenges,
        phaseChallenges: nextPhases,
        communicationPlan: nextCommunicationPlan,
      };
    });
  }, [orderedDays, studentNames]);

  function updateContent(updater: (current: OverviewContent) => OverviewContent) {
    setContent((current) => {
      const next = updater(current);
      return {
        ...next,
        classCode,
        week,
        communicationPlan: normalizeCommunicationPlan(next.communicationPlan),
      };
    });
  }

  function handleEnglishNameDoubleClick(chineseName: string) {
    const student = resolvedStudents.find((s) => s.chineseName === chineseName);
    setEditingChineseName(chineseName);
    setEditingValue(student?.englishName ?? '');
  }

  function handleEnglishNameSave() {
    if (editingChineseName === null) return;
    const trimmed = editingValue.trim();
    const nextResolved = resolvedStudents.map((s) =>
      s.chineseName === editingChineseName ? { ...s, englishName: trimmed || undefined } : s,
    );
    setResolvedStudents(nextResolved);
    updateClassProfile(classCode, {
      students: nextResolved,
    });
    setEditingChineseName(null);
    setEditingValue('');
  }

  function getStudentPhase(name: string): PhaseChallengeRow['key'] | null {
    for (const row of content.phaseChallenges) {
      if (row.selectedStudents.includes(name)) return row.key;
    }
    return null;
  }

  function moveStudentToTier(name: string, tier: PhaseChallengeRow['key']) {
    updateContent((draft) => ({
      ...draft,
      phaseChallenges: draft.phaseChallenges.map((row) => {
        const without = row.selectedStudents.filter((n) => n !== name);
        if (row.key === tier) {
          return { ...row, selectedStudents: sortStudentNames([...without, name]) };
        }
        return { ...row, selectedStudents: without };
      }),
    }));
  }

  function handleWeekChange(nextWeek: number) {
    setWeek(nextWeek);
    const draft = loadDraft(classCode, nextWeek);
    setContent(draft ?? createEmptyContent(classCode, nextWeek, { orderedDays, studentNames }));
  }

  async function handleListeningBatchImport() {
    const pairs = extractListeningPairs(listeningBatchInput);
    const words = pairs.map((pair) => pair.english).filter(Boolean);
    if (words.length === 0) {
      setNotice('先把英文单词整段贴进来。');
      return;
    }

    setTranslating(true);
    try {
      const materials = await buildListeningMaterials(listeningBatchInput);
      if (materials.length === 0) {
        setNotice('没有识别到可用单词。');
        return;
      }
      updateContent((current) => ({
        ...current,
        listeningMaterials: materials,
      }));
      setNotice(`已识别 ${materials.length} 个单词，中文释义优先保留你粘贴的内容。`);
    } catch {
      setNotice('英文识别到了，但自动补中文失败了。我已经改成后端翻译链路，刷新后再试一次。');
    } finally {
      setTranslating(false);
    }
  }

  function applyStudentNames(names: string[]) {
    importStudentNames(classCode, names);
    const nextResolved = getResolvedStudents(classCode);
    const nextNames = sortStudentNames(nextResolved.map((student) => student.chineseName));
    setResolvedStudents(nextResolved);
    setStudentNames(nextNames);
    setNotice(`已导入 ${nextNames.length} 位学生。`);
  }

  async function handleStudentFileImport(file: File | null) {
    if (!file) return;
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      const { read, utils } = await import('xlsx');
      const workbook = read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const rows = utils.sheet_to_json<(string | number | null)[]>(workbook.Sheets[firstSheetName], {
        header: 1,
      });
      const names = rows
        .flatMap((row) => row.map((cell) => String(cell ?? '').trim()))
        .filter(Boolean);
      applyStudentNames(names);
      return;
    }

    const text = await fileToText(file);
    applyStudentNames(parseStudentNames(text));
  }

  function handleManualStudentImport() {
    const names = parseStudentNames(studentImportInput);
    if (names.length === 0) {
      setNotice('先粘贴学生名单。');
      return;
    }
    applyStudentNames(names);
    setStudentImportInput('');
  }

  function toggleName(list: string[], name: string): string[] {
    return list.includes(name) ? list.filter((item) => item !== name) : [...list, name];
  }

  function toggleSortedName(list: string[], name: string): string[] {
    return sortStudentNames(toggleName(list, name));
  }

  function togglePhaseStudent(rowId: string, name: string) {
    updateContent((current) => {
      const currentRow = current.phaseChallenges.find((row) => row.id === rowId);
      const removing = currentRow?.selectedStudents.includes(name);

      return {
        ...current,
        phaseChallenges: current.phaseChallenges.map((row) => {
          if (row.id === rowId) {
            return {
              ...row,
              selectedStudents: removing
                ? sortStudentNames(row.selectedStudents.filter((item) => item !== name))
                : sortStudentNames([...row.selectedStudents.filter((item) => item !== name), name]),
            };
          }

          return removing
            ? row
            : { ...row, selectedStudents: sortStudentNames(row.selectedStudents.filter((item) => item !== name)) };
        }),
      };
    });
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

  function logCommunication(group: CommunicationGroup) {
    if (group.selectedStudents.length === 0) {
      setNotice('先勾选交流学生。');
      return;
    }

    addCommunicationRecord(classCode, {
      week,
      studentNames: sortStudentNames(group.selectedStudents),
      teacherName: group.teacherName,
      scheduleText: group.scheduleText,
      note: group.note,
      groupLabel: group.label,
    });

    setNotice('交流名单已记忆，下次会继续提醒哪些学生已交流。');
  }

  const communicationStats = useMemo(
    () => getCommunicationStats(classCode, studentNames),
    [classCode, studentNames, content.communicationPlan.groups],
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
  const showWeeklyChallenges = hasWeeklyChallenges(content);
  const showCommunicationSection = hasCommunicationPlan(content);
  const communicationGroups = content.communicationPlan.groups.length > 0
    ? content.communicationPlan.groups
    : [createCommunicationGroup()];
  const previewCommunicationGroups = communicationGroups.filter((group) =>
    group.selectedStudents.length > 0 ||
    group.teacherName.trim() ||
    group.scheduleText.trim() ||
    group.note.trim(),
  );
  const visibleCustomBlocks = content.customBlocks.filter(shouldShowCustomBlock);
  const previewTheme = content.theme || 'green';
  const phasePreviewRows = PHASE_TIER_ORDER
    .map((tierKey) => content.phaseChallenges.find((r) => r.key === tierKey)!)
    .filter((row) => row && row.selectedStudents.length > 0 && (row.challengeContent.trim() || row.method.trim()));
  const challengePreviewItems = content.challengeItems.filter(
    (item) => item.title.trim() || item.detail.trim() || item.media.length > 0,
  );
  const listeningPreviewItems = content.listeningMaterials.filter(
    (item) => item.english.trim() || item.chinese.trim(),
  );

  return (
    <div className="ov-shell fade-in">
      {onBackToHome && (
        <button className="tool-home-rail" onClick={onBackToHome}>
          <span className="tool-home-rail-icon">←</span>
          <span>返回主页</span>
        </button>
      )}
      <div className="ov-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="back-btn" onClick={onBack}>← 返回</button>
          {classes && classes.length > 1 && onSwitchClass ? (
            <select className="tool-class-switch" value={classCode} onChange={(e) => onSwitchClass(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          ) : (
            <strong style={{ fontSize: 16, color: 'var(--gray-900)' }}>{classCode}</strong>
          )}
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{formatDateShort(weekRange.start)} - {formatDateShort(weekRange.end)}</span>
        </div>
        <div className="ov-toolbar-actions">
          <select
            value={previewTheme}
            onChange={(event) =>
              updateContent((current) => ({ ...current, theme: event.target.value as OverviewThemeOption }))
            }
          >
            {OVERVIEW_THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
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
          <section className="ov-editor-section ov-editor-section-compact">
            <div className="ov-section-head">
              <h3>学生名单</h3>
              <div className="ov-section-head-actions">
                <p>{studentNames.length > 0 ? `已读取 ${studentNames.length} 人` : '当前还没有可用名单'}</p>
                {studentNames.length > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setStudentListCollapsed((collapsed) => !collapsed)}
                  >
                    {studentListCollapsed ? '展开名单' : '收起名单'}
                  </button>
                )}
              </div>
            </div>
            {studentNames.length > 0 && !studentListCollapsed ? (
              <div className="ov-student-grid">
                {[...resolvedStudents].sort((a, b) =>
                  (a.englishName || a.chineseName).localeCompare(b.englishName || b.chineseName, 'en', { sensitivity: 'base' })
                ).map((student) => {
                  const isEditing = editingChineseName === student.chineseName;
                  const displayName = student.englishName || student.chineseName;
                  return isEditing ? (
                    <input
                      key={student.chineseName}
                      className="ov-student-chip ov-student-chip-edit"
                      autoFocus
                      value={editingValue}
                      placeholder={student.chineseName}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={handleEnglishNameSave}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEnglishNameSave();
                        if (e.key === 'Escape') { setEditingChineseName(null); setEditingValue(''); }
                      }}
                    />
                  ) : (
                    <span
                      key={student.chineseName}
                      className="ov-student-chip ov-student-chip-static"
                      title={`${student.chineseName}${student.englishName ? ' / ' + student.englishName : ''} — 双击修改英文名`}
                      onDoubleClick={() => handleEnglishNameDoubleClick(student.chineseName)}
                    >
                      {displayName}
                    </span>
                  );
                })}
              </div>
            ) : studentNames.length > 0 ? (
              <div className="ov-empty-state-inline">
                <p>名单已收起，下面导入区和各层级勾选仍然可用。</p>
              </div>
            ) : (
              <div className="ov-empty-state-inline">
                <p>没有读到班级名单。我会优先从座位表回收；如果这边还没有，再在下面导入一次。</p>
              </div>
            )}
            <div className="ov-student-import">
              <textarea
                rows={3}
                placeholder="粘贴学生名单，支持换行、逗号、分号分隔"
                value={studentImportInput}
                onChange={(event) => setStudentImportInput(event.target.value)}
              />
              <div className="ov-inline-actions">
                <button className="btn btn-ghost btn-sm" onClick={handleManualStudentImport}>导入粘贴名单</button>
                <label className="btn btn-ghost btn-sm ov-upload-btn">
                  上传名单文件
                  <input
                    type="file"
                    accept=".txt,.csv,.xlsx,.xls"
                    hidden
                    onChange={(event) => {
                      void handleStudentFileImport(event.target.files?.[0] ?? null);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="ov-editor-section">
            <div className="ov-section-head">
              <h3>① 本周挑战</h3>
              <p>横排填写，预览里只保留干净的表格。</p>
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
              <div className="ov-week-table" style={{ gridTemplateColumns: `repeat(${weeklyChallengeRows.length}, minmax(220px, 1fr))` }}>
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
              <div className="ov-section-head-actions">
                <p>先选层级，再点学生名字把他刷成那个层级。所有学生默认「维稳达标」。</p>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPhaseTierCollapsed((v) => !v)}
                >
                  {phaseTierCollapsed ? '展开分层' : '收起分层'}
                </button>
              </div>
            </div>

            {!phaseTierCollapsed && (
              <>
                {/* Tier selector tabs — pick which "brush" to paint with */}
                <div className="ov-phase-tabs">
                  {PHASE_TIER_ORDER.map((tierKey) => {
                    const tone = getPhaseTone(tierKey);
                    const row = content.phaseChallenges.find((r) => r.key === tierKey);
                    const count = row?.selectedStudents.length ?? 0;
                    return (
                      <button
                        key={tierKey}
                        className={`ov-phase-tab ov-phase-tab-${tone}${activePhaseTier === tierKey ? ' active' : ''}`}
                        onClick={() => setActivePhaseTier(tierKey)}
                      >
                        {tierKey}
                        <span className="ov-phase-tab-count">{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* All students always visible, colored by their current tier */}
                <div className="ov-student-grid ov-phase-tier-grid">
                  {[...studentNames]
                    .sort((a, b) => (englishNameMap.get(a) || a).localeCompare(englishNameMap.get(b) || b, 'en', { sensitivity: 'base' }))
                    .map((name) => {
                      const currentPhase = getStudentPhase(name) ?? '维稳达标';
                      const tone = getPhaseTone(currentPhase);
                      const isActiveTier = currentPhase === activePhaseTier;
                      return (
                        <span
                          key={name}
                          className={`ov-student-chip ov-student-chip-tone-${tone} active${isActiveTier ? ' ov-chip-selected-tier' : ''}`}
                          onClick={() => {
                            if (currentPhase !== activePhaseTier) {
                              moveStudentToTier(name, activePhaseTier);
                            }
                          }}
                          title={`${englishNameMap.get(name) || name}（${currentPhase}）— 点击移到「${activePhaseTier}」`}
                        >
                          {englishNameMap.get(name) || name}
                        </span>
                      );
                    })}
                </div>
              </>
            )}

            {/* Per-tier challenge content + method */}
            <div className="ov-phase-editor-list">
              {PHASE_TIER_ORDER
                .map((tierKey) => content.phaseChallenges.find((r) => r.key === tierKey)!)
                .filter((row) => row && row.selectedStudents.length > 0)
                .map((row) => (
                  <section key={row.id} className="ov-phase-editor-card">
                    <div className={`ov-phase-editor-title ov-phase-title-${getPhaseTone(row.key)}`}>
                      {row.label}
                      <span className="ov-phase-title-count">
                        {row.selectedStudents.map((n) => englishNameMap.get(n) || n).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })).join('、')}
                      </span>
                    </div>
                    <div className="ov-phase-editor-detail-grid">
                      <div className="ov-phase-cell">
                        <div className="ov-phase-subtitle">具体挑战内容</div>
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
                      <div className="ov-phase-cell">
                        <div className="ov-phase-subtitle">达成途径</div>
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
                    </div>
                  </section>
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
                  onPaste={(event) => {
                    const pastedImages = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
                    if (pastedImages.length === 0) return;
                    event.preventDefault();
                    void filesToMediaItems(pastedImages).then((uploaded) =>
                      updateContent((current) => ({
                        ...current,
                        challengeItems: current.challengeItems.map((challenge) =>
                          challenge.id === item.id
                            ? { ...challenge, media: [...challenge.media, ...uploaded] }
                            : challenge,
                        ),
                      })),
                    );
                  }}
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
              <p>可以分成多组安排，每组各自记学生、时间和说明。</p>
            </div>
            <div className="ov-summary-strip">
              <span className="chip">已交流 {communicationStats.contacted.length} 人</span>
              <span className="chip">待交流 {communicationStats.pending.length} 人</span>
            </div>
            <div className="ov-inline-actions ov-inline-actions-start">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    updateContent((current) => ({
                      ...current,
                    communicationPlan: syncCommunicationPlan([
                      ...current.communicationPlan.groups,
                      createCommunicationGroup({ label: `第${current.communicationPlan.groups.length + 1}组` }),
                    ]),
                    }))
                  }
                >
                + 增加一组
              </button>
            </div>
            <div className="ov-comm-group-list">
              {communicationGroups.map((group, index) => (
                <section key={group.id} className="ov-comm-group-card">
                  <div className="ov-comm-group-head">
                    <strong>{group.label || `第 ${index + 1} 组`}</strong>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => logCommunication(group)}
                    >
                      记为已交流
                    </button>
                  </div>
                  <StudentPicker
                    studentNames={studentNames}
                    selected={group.selectedStudents}
                    onToggle={(name) =>
                      updateContent((current) => ({
                        ...current,
                        communicationPlan: syncCommunicationPlan(
                          current.communicationPlan.groups.map((item) =>
                            item.id === group.id
                              ? { ...item, selectedStudents: toggleSortedName(item.selectedStudents, name) }
                              : item,
                          ),
                        ),
                      }))
                    }
                    nameMap={englishNameMap}
                  />
                  <div className="ov-three-cols">
                    <input
                      className="input-field"
                      placeholder="交流人"
                      value={group.teacherName}
                      onChange={(event) =>
                        updateContent((current) => ({
                          ...current,
                          communicationPlan: syncCommunicationPlan(
                            current.communicationPlan.groups.map((item) =>
                              item.id === group.id ? { ...item, teacherName: event.target.value } : item,
                            ),
                          ),
                        }))
                      }
                    />
                    <input
                      className="input-field"
                      placeholder="周几 / 时间 / 地点"
                      value={group.scheduleText}
                      onChange={(event) =>
                        updateContent((current) => ({
                          ...current,
                          communicationPlan: syncCommunicationPlan(
                            current.communicationPlan.groups.map((item) =>
                              item.id === group.id ? { ...item, scheduleText: event.target.value } : item,
                            ),
                          ),
                        }))
                      }
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        updateContent((current) => {
                          const nextGroups = current.communicationPlan.groups.filter((item) => item.id !== group.id);
                          return {
                            ...current,
                            communicationPlan: syncCommunicationPlan(nextGroups),
                          };
                        })
                      }
                      disabled={communicationGroups.length === 1}
                    >
                      删除组
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="交流补充说明"
                    value={group.note}
                    onChange={(event) =>
                      updateContent((current) => ({
                        ...current,
                        communicationPlan: syncCommunicationPlan(
                          current.communicationPlan.groups.map((item) =>
                            item.id === group.id ? { ...item, note: event.target.value } : item,
                          ),
                        ),
                      }))
                    }
                  />
                </section>
              ))}
            </div>
            {communicationStats.contacted.length > 0 && (
              <div className="ov-history-list">
                {[...communicationStats.contacted].sort((a, b) => displayName(a).localeCompare(displayName(b), 'en', { sensitivity: 'base' })).map((name) => {
                  const record = communicationStats.latestByStudent[name];
                  return (
                    <div key={name} className="ov-history-item">
                      <strong>{displayName(name)}</strong>
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
          <div className={`ov-preview-paper ov-theme-${previewTheme}`} ref={cardRef}>
            <header className="ov-paper-header">
              <div className="ov-paper-header-grid">
                <div className="ov-paper-class-code">{classCode}</div>
                <div className="ov-paper-meta">
                  <span>课程概览</span>
                  <strong>Week {week}</strong>
                </div>
              </div>
              <div className="ov-paper-date-block">
                <span>{formatDateShort(weekRange.start)} - {formatDateShort(weekRange.end)}</span>
              </div>
            </header>

            {showWeeklyChallenges && (
              <section className="ov-paper-section">
                <div className="ov-paper-title">① 本周挑战</div>
                <div className="ov-paper-week-table" style={{ gridTemplateColumns: `repeat(${weeklyChallengeRows.length}, minmax(0, 1fr))` }}>
                  {weeklyChallengeRows.map((item) => (
                    <div key={`${item.day}_preview_head`} className="ov-paper-week-head">{item.day}</div>
                  ))}
                  {weeklyChallengeRows.map((item) => (
                    <div key={`${item.day}_preview_body`} className="ov-paper-week-cell">{item.task.trim()}</div>
                  ))}
                </div>
              </section>
            )}

            {phasePreviewRows.length > 0 && (
              <section className="ov-paper-section">
                <div className="ov-paper-title">② 分阶段挑战</div>
                <div className="ov-paper-phase-table">
                  <div className="ov-paper-phase-head">阶段</div>
                  <div className="ov-paper-phase-head">学生名单</div>
                  <div className="ov-paper-phase-head">具体挑战内容</div>
                  <div className="ov-paper-phase-head">达成途径</div>
                  {phasePreviewRows.map((row: PhaseChallengeRow) => (
                      <Fragment key={row.id}>
                        <div key={`${row.id}_stage`} className="ov-paper-phase-stage">{row.label}</div>
                        <div key={`${row.id}_students`} className="ov-paper-phase-cell">{displayNames(row.selectedStudents)}</div>
                        <div key={`${row.id}_content`} className="ov-paper-phase-cell">{row.challengeContent.trim()}</div>
                        <div key={`${row.id}_method`} className="ov-paper-phase-cell">{row.method.trim()}</div>
                      </Fragment>
                  ))}
                </div>
              </section>
            )}

            {challengePreviewItems.length > 0 && (
              <section className="ov-paper-section">
                <div className="ov-paper-title">③ 本周挑战内容</div>
                <div className="ov-paper-stack">
                  {challengePreviewItems.map((item: ChallengeItem, index) => (
                      <article key={item.id} className="ov-paper-task">
                        {(item.title || item.detail) && <div className="ov-paper-task-index">挑战 {index + 1}</div>}
                        {item.title.trim() && <h4>{item.title.trim()}</h4>}
                        {item.detail.trim() && <p>{item.detail.trim()}</p>}
                        {item.media.length > 0 && (
                          <div className="ov-paper-media-grid">
                            {item.media.map((media) => (
                              <figure key={media.id} className="ov-paper-figure" style={{ width: getPaperMediaWidth(media.displayWidth) }}>
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
            )}

            {listeningPreviewItems.length > 0 && (
              <section className="ov-paper-section">
                <div className="ov-paper-title">④ 下周听读语料</div>
                <div className={`ov-paper-listening ov-paper-listening-${content.listeningFont}`}>
                  {listeningPreviewItems.map((item: ListeningMaterialItem) => (
                      <div key={item.id} className="ov-paper-listening-row">
                        <span className="ov-paper-word">{item.english.trim()}</span>
                        <span className="ov-paper-meaning">{item.chinese.trim()}</span>
                      </div>
                  ))}
                </div>
              </section>
            )}

            {showCommunicationSection && (
              <section className="ov-paper-section">
                <div className="ov-paper-title">⑤ 交流名单</div>
                <div className="ov-paper-comm-groups">
                  {previewCommunicationGroups.map((group, index) => (
                    <article key={group.id} className="ov-paper-comm-group">
                      <div className="ov-paper-comm-meta">
                        <span>{group.label || `第 ${index + 1} 组`}</span>
                        {group.teacherName && <span>交流人：{group.teacherName}</span>}
                        {group.scheduleText && <span>时间地点：{group.scheduleText}</span>}
                      </div>
                      {group.selectedStudents.length > 0 && (
                        <div className="ov-paper-comm-students">{displayNames(group.selectedStudents)}</div>
                      )}
                      {group.note && <p className="ov-paper-comm-note">{group.note}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {visibleCustomBlocks.map((block) => (
              <section key={block.id} className="ov-paper-section">
                <div className="ov-paper-title">⑥ {block.title.trim() || '补充内容'}</div>
                {block.mode === 'text' && <p className="ov-paper-paragraph">{block.text.trim() || '暂无内容'}</p>}
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
                      <figure key={media.id} className="ov-paper-figure" style={{ width: getPaperMediaWidth(media.displayWidth) }}>
                        <img src={media.src} alt={media.name || block.title} />
                        {media.caption && <figcaption>{media.caption}</figcaption>}
                      </figure>
                    ))}
                    {block.media.length === 0 && <div className="ov-paper-empty">暂无图片</div>}
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
