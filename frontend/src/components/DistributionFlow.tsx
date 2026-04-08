import { useState, useRef, useEffect } from 'react';
import type { ClassInfo, Module, StudentData, MPBreakdown, SchemeId, BonusItem, SavedCustomScheme, SchemeSettings, StudentRecord } from '../types';
import { generateOutputExcel, parseBasicFile, parseDailyCheckFile } from '../utils/parseExcel';
import { calculateMP, SCHEMES } from '../utils/calculateMP';
import { getCurrentWeek } from '../utils/weekNumber';
import { loadSavedSchemes, saveScheme, deleteScheme } from '../utils/customScheme';
import { saveBonusRecord, getBonusNames, getLastAmount, getHistoryForBonus } from '../utils/bonusHistory';
import { getClassProfile } from '../utils/classProfiles';
import CustomSchemeEditor from './CustomSchemeEditor';
import ResultView from './ResultView';
import './DistributionFlow.css';

interface Props {
  classInfo: ClassInfo;
  onBack: () => void;
  onSessionExpired?: () => void;
}

const ALL_MODULES: Module[] = ['基础落实', '每日开口', '课堂参与', '个性化奖励'];

const MODULE_DESC: Record<Module, string> = {
  基础落实: '基于官网下载的学生个人数据表',
  每日开口: '基于打卡情况表，按天数发放',
  课堂参与: '默认发放 + 手动调整PK获胜者',
  个性化奖励: '老师自定义任务与金额',
};

const MODULE_REQUIRED: Record<Module, boolean> = {
  基础落实: true,
  每日开口: false,
  课堂参与: false,
  个性化奖励: false,
};

const QUICK_ROSTER_KEY = 'amber_mp_quick_rosters_v1';
type EntryMode = 'standard' | 'quick';

function normalizeStudentName(raw: string): string {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

function saveQuickRoster(classCode: string, students: StudentData[]) {
  try {
    const key = String(classCode || '').trim().toUpperCase();
    if (!key || students.length === 0) return;
    const raw = localStorage.getItem(QUICK_ROSTER_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[key] = students.map((student) => ({
      studentId: student.studentId,
      chineseName: student.chineseName,
      englishName: student.englishName,
      classCode: key,
    }));
    localStorage.setItem(QUICK_ROSTER_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
}

function loadQuickRoster(classCode: string): StudentRecord[] {
  try {
    const key = String(classCode || '').trim().toUpperCase();
    if (!key) return [];
    const profileRoster = (getClassProfile(key)?.students || [])
      .filter((student) => student.studentId)
      .map((student) => ({
        studentId: String(student.studentId || ''),
        chineseName: student.chineseName,
        englishName: student.englishName || '',
        classCode: key,
      }));
    if (profileRoster.length > 0) return profileRoster;
    const raw = localStorage.getItem(QUICK_ROSTER_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return Array.isArray(all[key]) ? all[key] : [];
  } catch {
    return [];
  }
}

function parseQuickRewardText(raw: string): Array<{ chineseName: string; amount: number }> {
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)[\s,，:：\-]+(-?\d+(?:\.\d+)?)$/);
      if (!match) return null;
      return {
        chineseName: normalizeStudentName(match[1]),
        amount: Number(match[2]),
      };
    })
    .filter((item): item is { chineseName: string; amount: number } => Boolean(item && item.chineseName));
}

function buildQuickTemplateRows(roster: StudentRecord[], rewards: Array<{ chineseName: string; amount: number }>): {
  students: StudentData[];
  mpMap: Map<string, number>;
  missingNames: string[];
} {
  const rosterMap = new Map(
    roster.map((student) => [normalizeStudentName(student.chineseName), student]),
  );
  const students: StudentData[] = [];
  const mpMap = new Map<string, number>();
  const missingNames: string[] = [];

  for (const reward of rewards) {
    const hit = rosterMap.get(reward.chineseName);
    if (!hit) {
      missingNames.push(reward.chineseName);
      continue;
    }
    students.push({
      studentId: hit.studentId,
      chineseName: hit.chineseName,
      englishName: hit.englishName || '',
      classCode: hit.classCode,
      resources: [],
      dailyCheckIns: 0,
      classParticipation: 0,
      bonusItems: [],
    });
    mpMap.set(hit.studentId, reward.amount);
  }

  return { students, mpMap, missingNames };
}

export default function DistributionFlow({ classInfo, onBack, onSessionExpired }: Props) {
  const isManual = classInfo.id === 'manual';
  const [manualCode, setManualCode] = useState('');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [entryMode, setEntryMode] = useState<EntryMode>('standard');
  const [selectedModules, setSelectedModules] = useState<Set<Module>>(new Set(['基础落实']));
  const [basicFile, setBasicFile] = useState<File | null>(null);
  const [dailyFile, setDailyFile] = useState<File | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [scheme, setScheme] = useState<SchemeId>('scheme1');
  const [customSchemeData, setCustomSchemeData] = useState<SavedCustomScheme | undefined>();
  const [dailyRate, setDailyRate] = useState(0.1);
  const [schemeSettings, setSchemeSettings] = useState<SchemeSettings>({ scheme2AllDoneAmount: 0.5 });
  const [defaultParticipation, setDefaultParticipation] = useState(0.2);
  const [bonusItems, setBonusItems] = useState<BonusItem[]>([]);
  const [mpResults, setMpResults] = useState<MPBreakdown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const week = getCurrentWeek();
  const displayCode = isManual ? (manualCode || '手动输入') : classInfo.name;

  function toggleModule(m: Module) {
    if (MODULE_REQUIRED[m]) return;
    setSelectedModules((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  }

  async function handleLoadFiles() {
    if (!basicFile) { setError('请上传基础落实文件'); return; }
    setError('');
    setLoading(true);
    try {
      const parsed = await parseBasicFile(basicFile);
      let stud = parsed.students;

      if (selectedModules.has('每日开口') && dailyFile) {
        stud = await parseDailyCheckFile(dailyFile, stud);
      }

      stud = stud.map((s) => ({
        ...s,
        classParticipation: defaultParticipation,
        bonusItems: [],
      }));

      saveQuickRoster(parsed.classCode || classInfo.name || manualCode, stud);
      setStudents(stud);
      setStep(3);
    } catch (err) {
      setError(`解析文件失败: ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  }

  function applyResults() {
    const studWithBonus = students.map((s) => ({
      ...s,
      bonusItems: bonusItems.filter((b) => b.studentIds.includes(s.studentId)),
    }));
    const results = calculateMP(
      studWithBonus,
      scheme,
      dailyRate,
      selectedModules,
      customSchemeData,
      schemeSettings
    );
    bonusItems.forEach((b) => {
      const names = students
        .filter((s) => b.studentIds.includes(s.studentId))
        .map((s) => s.englishName);
      saveBonusRecord(b.name, displayCode, week, names, b.amount);
    });
    setMpResults(results);
    setStep(4);
  }

  const STEPS = entryMode === 'quick'
    ? [
        { n: 1, label: '选择方式' },
        { n: 2, label: '快捷生成' },
      ]
    : [
        { n: 1, label: '选择方式' },
        { n: 2, label: '上传文件' },
        { n: 3, label: '确认明细' },
        { n: 4, label: '生成输出' },
      ];

  return (
    <div className="flow-wrap fade-in">
      <div className="flow-topbar">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <div className="flow-class-tag">
          {isManual ? (
            <input
              className="flow-class-input"
              type="text"
              placeholder="输入班级号"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
          ) : (
            <span className="flow-class-code">{classInfo.name}</span>
          )}
          <span className="flow-week">Week {week}</span>
        </div>
      </div>

      <div className="step-indicator">
        {STEPS.map((s, i) => (
          <div key={s.n} className="step-item">
            <div className={`step-dot ${step === s.n ? 'active' : step > s.n ? 'done' : ''}`}>
              {step > s.n ? '✓' : s.n}
            </div>
            <span className={`step-label ${step === s.n ? 'active' : ''}`}>{s.label}</span>
            {i < STEPS.length - 1 && <div className={`step-line ${step > s.n ? 'done' : ''}`} />}
          </div>
        ))}
      </div>

      {error && <div className="flow-error">{error}</div>}

      {step === 1 && (
        <StepEntry
          mode={entryMode}
          onModeChange={setEntryMode}
          selected={selectedModules}
          onToggle={toggleModule}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && entryMode === 'standard' && (
        <StepUpload
          modules={selectedModules}
          basicFile={basicFile}
          dailyFile={dailyFile}
          onBasicFile={setBasicFile}
          onDailyFile={setDailyFile}
          onBack={() => setStep(1)}
          onNext={handleLoadFiles}
          loading={loading}
        />
      )}
      {step === 2 && entryMode === 'quick' && (
        <StepQuick
          classCode={displayCode}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <StepPreview
          students={students}
          scheme={scheme}
          customSchemeData={customSchemeData}
          schemeSettings={schemeSettings}
          dailyRate={dailyRate}
          defaultParticipation={defaultParticipation}
          bonusItems={bonusItems}
          modules={selectedModules}
          onSchemeChange={(id, data) => { setScheme(id); setCustomSchemeData(data); }}
          onDailyRateChange={setDailyRate}
          onSchemeSettingsChange={(patch) =>
            setSchemeSettings((prev) => ({ ...prev, ...patch }))
          }
          onParticipationChange={(sid, val) => {
            setStudents((prev) =>
              prev.map((s) => s.studentId === sid ? { ...s, classParticipation: val } : s)
            );
          }}
          onBulkParticipation={(sids, val) => {
            setStudents((prev) =>
              prev.map((s) => sids.includes(s.studentId) ? { ...s, classParticipation: val } : s)
            );
          }}
          onDefaultParticipationChange={(val) => {
            setDefaultParticipation(val);
            setStudents((prev) => prev.map((s) => ({ ...s, classParticipation: val })));
          }}
          onAddBonus={(b) => setBonusItems((prev) => [...prev, b])}
          onRemoveBonus={(i) => setBonusItems((prev) => prev.filter((_, idx) => idx !== i))}
          classCode={displayCode}
          classInfo={classInfo}
          week={week}
          onBack={() => setStep(2)}
          onGenerate={applyResults}
        />
      )}
      {step === 4 && (
        <ResultView
          results={mpResults}
          students={students}
          bonusItems={bonusItems}
          classCode={displayCode}
          classInfo={classInfo}
          week={week}
          schemeSettings={schemeSettings}
          onBack={() => setStep(3)}
          onSessionExpired={onSessionExpired}
        />
      )}
    </div>
  );
}

function StepEntry({
  mode,
  onModeChange,
  selected,
  onToggle,
  onNext,
}: {
  mode: EntryMode;
  onModeChange: (mode: EntryMode) => void;
  selected: Set<Module>;
  onToggle: (m: Module) => void;
  onNext: () => void;
}) {
  return (
    <div className="step-card card">
      <h3 className="step-heading">选择生成方式</h3>
      <p className="step-sub">先决定走标准流程还是快捷流程，原来的上传和勾选逻辑仍然保留。</p>

      <div className="mode-list">
        <button
          type="button"
          className={`mode-card ${mode === 'standard' ? 'selected' : ''}`}
          onClick={() => onModeChange('standard')}
        >
          <div className="mode-card-head">
            <strong>标准生成</strong>
            <span className="tag tag-green">完整流程</span>
          </div>
          <p>上传基础落实、打卡文件，继续走后面的确认和勾选。</p>
        </button>
        <button
          type="button"
          className={`mode-card ${mode === 'quick' ? 'selected' : ''}`}
          onClick={() => onModeChange('quick')}
        >
          <div className="mode-card-head">
            <strong>快捷生成</strong>
            <span className="tag">快速入口</span>
          </div>
          <p>直接粘贴“中文名 + 数量”，快速生成 MP 标准模板，不先进入上传页。</p>
        </button>
      </div>

      {mode === 'standard' && (
        <>
          <div>
            <h4 className="sub-section-title">标准流程模块</h4>
            <p className="sub-section-sub">勾选本次需要计算的项目，基础落实为必选。</p>
          </div>
          <div className="module-list">
            {ALL_MODULES.map((m) => (
              <label key={m} className={`module-item ${selected.has(m) ? 'selected' : ''} ${MODULE_REQUIRED[m] ? 'required' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.has(m)}
                  onChange={() => onToggle(m)}
                  disabled={MODULE_REQUIRED[m]}
                />
                <div className="module-info">
                  <span className="module-name">{m}</span>
                  {MODULE_REQUIRED[m] && <span className="tag tag-green" style={{ fontSize: 11, padding: '1px 7px' }}>必选</span>}
                  <p className="module-desc">{MODULE_DESC[m]}</p>
                </div>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="step-actions">
        <button className="btn btn-primary" onClick={onNext}>
          {mode === 'standard' ? '进入上传 →' : '进入快捷生成 →'}
        </button>
      </div>
    </div>
  );
}

function StepUpload({
  modules,
  basicFile,
  dailyFile,
  onBasicFile,
  onDailyFile,
  onBack,
  onNext,
  loading,
}: {
  modules: Set<Module>;
  basicFile: File | null;
  dailyFile: File | null;
  onBasicFile: (f: File) => void;
  onDailyFile: (f: File) => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  return (
    <div className="step-card card">
      <h3 className="step-heading">上传数据文件</h3>
      <p className="step-sub">从官网下载对应文件后上传</p>

      <div className="upload-list">
        <UploadField
          label="基础落实（必须）"
          hint="文件名格式：J328_学生个人数据_*.xlsx"
          accept=".xlsx"
          file={basicFile}
          onChange={onBasicFile}
        />
        {modules.has('每日开口') && (
          <UploadField
            label="每日开口（打卡情况）"
            hint="文件名格式：打卡情况*.xlsx"
            accept=".xlsx"
            file={dailyFile}
            onChange={onDailyFile}
          />
        )}
      </div>

      <div className="step-actions">
        <button className="btn btn-ghost" onClick={onBack}>← 上一步</button>
        <button className="btn btn-primary" onClick={onNext} disabled={loading || !basicFile}>
          {loading ? <><span className="spinner" /> 解析中...</> : '解析文件 →'}
        </button>
      </div>
    </div>
  );
}

function StepQuick({
  classCode,
  onBack,
}: {
  classCode: string;
  onBack: () => void;
}) {
  const rememberedRoster = loadQuickRoster(classCode);
  const [quickInput, setQuickInput] = useState('');
  const [quickMessage, setQuickMessage] = useState('');

  function downloadQuickTemplate() {
    if (!rememberedRoster.length) {
      setQuickMessage('这个班目前还没有记住学号名单。先完整上传一次基础落实文件，后面这里就能反复直接生成。');
      return;
    }
    const rewards = parseQuickRewardText(quickInput);
    if (!rewards.length) {
      setQuickMessage('先粘贴“中文名 + 数量”，一行一个，例如：李晓彤 0.5');
      return;
    }

    const { students, mpMap, missingNames } = buildQuickTemplateRows(rememberedRoster, rewards);
    if (!students.length) {
      setQuickMessage('没有匹配到可用学生，请检查中文名是否和系统里一致。');
      return;
    }

    const buffer = generateOutputExcel(students, mpMap);
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${classCode}_快捷MP模板.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);

    setQuickMessage(
      missingNames.length
        ? `已生成模板，未匹配：${missingNames.join('、')}`
        : `已生成 ${students.length} 人的标准模板。`,
    );
  }

  return (
    <div className="step-card card">
      <h3 className="step-heading">快捷生成 MP 标准模板</h3>
      <p className="step-sub">这里是单独的快捷流程，不再混在上传文件步骤里。</p>

      <div className="quick-template-box">
        <div className="quick-template-head">
          <div>
            <strong>按中文名直接生成</strong>
            <p>如果这个班已经记住过学号和名单，直接粘贴“中文名 + 数量”就能出标准 Excel。</p>
          </div>
          <span className={`quick-template-badge${rememberedRoster.length ? ' active' : ''}`}>
            {rememberedRoster.length ? `已记住 ${rememberedRoster.length} 人` : '暂未记住名单'}
          </span>
        </div>
        <textarea
          className="input-field quick-template-input"
          rows={8}
          placeholder={'李晓彤 0.5\n周子然 1\n王一诺 0.8'}
          value={quickInput}
          onChange={(event) => setQuickInput(event.target.value)}
        />
        <div className="quick-template-actions">
          <button className="btn btn-ghost" type="button" onClick={downloadQuickTemplate}>
            直接生成标准模板
          </button>
          <span className="quick-template-hint">先完整传过一次基础落实文件，这个快捷入口以后就能反复用。</span>
        </div>
        {quickMessage && <div className="quick-template-message">{quickMessage}</div>}
      </div>

      <div className="step-actions">
        <button className="btn btn-ghost" onClick={onBack}>← 上一步</button>
      </div>
    </div>
  );
}

function UploadField({
  label,
  hint,
  accept,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onChange: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`upload-zone ${file ? 'uploaded' : ''}`}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])}
      />
      <div className="upload-icon">{file ? '✅' : '📄'}</div>
      <div className="upload-text">
        <strong>{label}</strong>
        <span>{file ? file.name : hint}</span>
      </div>
    </div>
  );
}

function StepPreview({
  students,
  scheme,
  customSchemeData,
  schemeSettings,
  dailyRate,
  defaultParticipation,
  bonusItems,
  modules,
  onSchemeChange,
  onDailyRateChange,
  onSchemeSettingsChange,
  onParticipationChange,
  onBulkParticipation,
  onDefaultParticipationChange,
  onAddBonus,
  onRemoveBonus,
  classCode,
  classInfo,
  week,
  onBack,
  onGenerate,
}: {
  students: StudentData[];
  scheme: SchemeId;
  customSchemeData: SavedCustomScheme | undefined;
  schemeSettings: SchemeSettings;
  dailyRate: number;
  defaultParticipation: number;
  bonusItems: BonusItem[];
  modules: Set<Module>;
  onSchemeChange: (id: SchemeId, data?: SavedCustomScheme) => void;
  onDailyRateChange: (v: number) => void;
  onSchemeSettingsChange: (patch: Partial<SchemeSettings>) => void;
  onParticipationChange: (sid: string, val: number) => void;
  onBulkParticipation: (sids: string[], val: number) => void;
  onDefaultParticipationChange: (val: number) => void;
  onAddBonus: (b: BonusItem) => void;
  onRemoveBonus: (i: number) => void;
  classCode: string;
  classInfo: ClassInfo;
  week: number;
  onBack: () => void;
  onGenerate: () => void;
}) {
  const [selectedSids, setSelectedSids] = useState<Set<string>>(new Set());
  const [bulkVal, setBulkVal] = useState('');
  const [bonusName, setBonusName] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusStudents, setBonusStudents] = useState<Set<string>>(new Set());
  const [bonusError, setBonusError] = useState('');
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null);
  const [bonusNameSuggestions] = useState<string[]>(() => getBonusNames());

  const [savedSchemes, setSavedSchemes] = useState<SavedCustomScheme[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingScheme, setEditingScheme] = useState<SavedCustomScheme | undefined>();

  useEffect(() => {
    setSavedSchemes(loadSavedSchemes());
  }, []);

  function toggleStudent(sid: string) {
    setSelectedSids((prev) => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  }

  function applyBulk() {
    const val = parseFloat(bulkVal);
    if (isNaN(val) || selectedSids.size === 0) return;
    onBulkParticipation(Array.from(selectedSids), val);
    setSelectedSids(new Set());
    setBulkVal('');
  }

  function addBonus() {
    const amount = parseFloat(bonusAmount);
    const missing: string[] = [];
    if (!bonusName.trim()) missing.push('奖励名称');
    if (isNaN(amount)) missing.push('MP金额');
    if (bonusStudents.size === 0) missing.push('至少选一名学生');
    if (missing.length > 0) { setBonusError(`请填写：${missing.join('、')}`); return; }
    setBonusError('');
    onAddBonus({ name: bonusName.trim(), amount, studentIds: Array.from(bonusStudents) });
    setBonusName('');
    setBonusAmount('');
    setBonusStudents(new Set());
  }

  function handleSaveCustomScheme(s: SavedCustomScheme) {
    saveScheme(s);
    const updated = loadSavedSchemes();
    setSavedSchemes(updated);
    setShowEditor(false);
    setEditingScheme(undefined);
    onSchemeChange(s.id, s);
  }

  function handleDeleteScheme(id: string) {
    deleteScheme(id);
    setSavedSchemes(loadSavedSchemes());
    if (scheme === id) onSchemeChange('scheme1', undefined);
  }

  function getSchemeDescription(): string {
    const builtin = SCHEMES.find((s) => s.id === scheme);
    if (builtin) {
      if (builtin.id === 'scheme2') {
        return `固定全勤奖励：只有所有任务全部完成时，基础落实才发放 ${schemeSettings.scheme2AllDoneAmount} MP；不再叠加词王、准确率、AI语音、测试这些条件奖励`;
      }
      return builtin.description;
    }
    if (customSchemeData) {
      const enabled = customSchemeData.rules.filter((r) => r.enabled);
      return `自定义方案 · ${enabled.length} 条规则已启用`;
    }
    return '';
  }

  return (
    <div className="step-card card">
      <h3 className="step-heading">确认发放明细</h3>

      <div className="preview-config">
        <div className="config-row">
          <span className="config-label">发放方案</span>
          <div className="scheme-selector">
            <div className="scheme-tabs">
              {SCHEMES.map((s) => (
                <button
                  key={s.id}
                  className={`scheme-tab ${scheme === s.id ? 'active' : ''}`}
                  onClick={() => { onSchemeChange(s.id, undefined); setShowEditor(false); }}
                >
                  {s.name}
                </button>
              ))}
              {savedSchemes.map((s) => (
                <div key={s.id} className="scheme-tab-custom-wrap">
                  <button
                    className={`scheme-tab scheme-tab-custom ${scheme === s.id ? 'active' : ''}`}
                    onClick={() => { onSchemeChange(s.id, s); setShowEditor(false); }}
                  >
                    {s.name}
                  </button>
                  <button
                    className="scheme-tab-edit"
                    title="编辑方案"
                    onClick={() => { setEditingScheme(s); setShowEditor(true); onSchemeChange(s.id, s); }}
                  >✎</button>
                  <button
                    className="scheme-tab-del"
                    title="删除方案"
                    onClick={() => handleDeleteScheme(s.id)}
                  >×</button>
                </div>
              ))}
              <button
                className="scheme-tab-new"
                onClick={() => { setEditingScheme(undefined); setShowEditor((v) => !v); }}
              >
                {showEditor && !editingScheme ? '收起' : '+ 新建方案'}
              </button>
            </div>
            <p className="scheme-desc">{getSchemeDescription()}</p>

            {showEditor && (
              <CustomSchemeEditor
                existing={editingScheme}
                onSave={handleSaveCustomScheme}
                onCancel={() => { setShowEditor(false); setEditingScheme(undefined); }}
              />
            )}
          </div>
        </div>
        {scheme === 'scheme2' && (
          <div className="config-row">
            <span className="config-label">全部完成奖励 =</span>
            <input
              className="input-field config-input"
              type="number"
              step="0.1"
              min="0"
              value={schemeSettings.scheme2AllDoneAmount}
              onChange={(e) =>
                onSchemeSettingsChange({ scheme2AllDoneAmount: parseFloat(e.target.value) || 0 })
              }
            />
            <span className="config-unit">MP</span>
          </div>
        )}
        {modules.has('每日开口') && (
          <div className="config-row">
            <span className="config-label">每次打卡 =</span>
            <input
              className="input-field config-input"
              type="number"
              step="0.05"
              min="0"
              value={dailyRate}
              onChange={(e) => onDailyRateChange(parseFloat(e.target.value) || 0)}
            />
            <span className="config-unit">MP / 次</span>
          </div>
        )}
      </div>

      {modules.has('课堂参与') && (
        <div className="participation-section">
          <div className="section-mini-title">课堂参与</div>
          <div className="default-row">
            <span className="config-label">全班默认值</span>
            <input
              className="input-field row-mp-input"
              type="number"
              step="0.1"
              min="0"
              value={defaultParticipation}
              onChange={(e) => onDefaultParticipationChange(parseFloat(e.target.value) || 0)}
            />
            <span className="config-unit">MP（修改后自动同步到所有人）</span>
          </div>
          <p className="section-mini-desc">勾选PK获胜学生，一键批量改值</p>
          <div className="student-select-list">
            {students.map((s) => (
              <label key={s.studentId} className={`student-chip ${selectedSids.has(s.studentId) ? 'selected' : ''}`}>
                <input type="checkbox" checked={selectedSids.has(s.studentId)} onChange={() => toggleStudent(s.studentId)} />
                <span>{s.englishName}</span>
                <span className="chip-val">{s.classParticipation} MP</span>
              </label>
            ))}
          </div>
          {selectedSids.size > 0 && (
            <div className="bulk-bar">
              <span>{selectedSids.size} 人已选，批量设定为：</span>
              <input
                className="input-field"
                style={{ width: 80 }}
                type="number"
                step="0.1"
                placeholder="0.5"
                value={bulkVal}
                onChange={(e) => setBulkVal(e.target.value)}
              />
              <span>MP</span>
              <button className="btn btn-primary btn-sm" onClick={applyBulk}>确定</button>
            </div>
          )}
        </div>
      )}

      {modules.has('个性化奖励') && (
        <div className="bonus-section">
          <div className="section-mini-title">个性化奖励</div>
          <div className="bonus-add-row">
            <input
              className="input-field"
              placeholder="奖励名称"
              value={bonusName}
              list="bonus-name-list"
              onChange={(e) => {
                const v = e.target.value;
                setBonusName(v);
                const last = getLastAmount(v);
                if (last !== null && bonusAmount === '') setBonusAmount(String(last));
              }}
              style={{ flex: 2 }}
            />
            <datalist id="bonus-name-list">
              {bonusNameSuggestions.map((n) => <option key={n} value={n} />)}
            </datalist>
            <input className="input-field" placeholder="MP" type="number" step="0.1" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} style={{ width: 80 }} />
          </div>
          <div className="student-select-list">
            {students.map((s) => (
              <label key={s.studentId} className={`student-chip ${bonusStudents.has(s.studentId) ? 'selected' : ''}`}>
                <input type="checkbox" checked={bonusStudents.has(s.studentId)} onChange={() => setBonusStudents((p) => { const n = new Set(p); n.has(s.studentId) ? n.delete(s.studentId) : n.add(s.studentId); return n; })} />
                <span>{s.englishName}</span>
              </label>
            ))}
          </div>
          {bonusError && <p className="bonus-error">{bonusError}</p>}
          <button className="btn btn-ghost btn-sm" onClick={addBonus}>
            + 添加奖励
          </button>
          {bonusItems.length > 0 && (
            <div className="bonus-list">
              {bonusItems.map((b, i) => {
                const hist = getHistoryForBonus(b.name);
                const isOpen = expandedHistory === i;
                return (
                  <div key={i} className="bonus-tag-wrap">
                    <div className="bonus-tag">
                      <span>{b.name}: {b.amount} MP × {b.studentIds.length}人</span>
                      {hist.length > 0 && (
                        <button
                          className="bonus-hist-btn"
                          title="查看历史"
                          onClick={() => setExpandedHistory(isOpen ? null : i)}
                        >📋</button>
                      )}
                      <button onClick={() => { onRemoveBonus(i); if (expandedHistory === i) setExpandedHistory(null); }}>×</button>
                    </div>
                    {isOpen && hist.length > 0 && (
                      <div className="bonus-history-panel">
                        <div className="bonus-history-title">历史记录</div>
                        {hist.map((rec, ri) => (
                          <div key={ri} className="bonus-history-row">
                            <span className="bonus-history-meta">Week {rec.week} · {rec.classCode}</span>
                            <span>{rec.studentNames.join('、')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="step-actions">
        <button className="btn btn-ghost" onClick={onBack}>← 上一步</button>
        <button className="btn btn-primary" onClick={onGenerate}>生成结果 →</button>
      </div>
    </div>
  );
}
