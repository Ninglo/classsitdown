import { useMemo, useRef, useState } from 'react';
import type { ClassInfo } from '../types';
import './DailyReportApp.css';

interface Props {
  classInfo: ClassInfo;
  classes?: ClassInfo[];
  onBack: () => void;
  onBackToHome?: () => void;
  onSwitchClass?: (name: string) => void;
}

type ReportMode = 'standard' | 'detail';
type UploadKind = 'student' | 'checkin';

interface UploadedFileState {
  file: File | null;
  name: string;
}

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls'];

function isExcelFile(file: File) {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((suffix) => lower.endsWith(suffix));
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      if (!base64) {
        reject(new Error('文件读取失败'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function getDownloadName(header: string | null, fallback: string) {
  if (!header) return fallback;
  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }
  const plainMatch = header.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || fallback;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function DailyReportApp({ classInfo, classes, onBack, onBackToHome, onSwitchClass }: Props) {
  const [reportMode, setReportMode] = useState<ReportMode>('standard');
  const [className, setClassName] = useState('');
  const [studentFile, setStudentFile] = useState<UploadedFileState>({ file: null, name: '' });
  const [checkinFile, setCheckinFile] = useState<UploadedFileState>({ file: null, name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const studentInputRef = useRef<HTMLInputElement>(null);
  const checkinInputRef = useRef<HTMLInputElement>(null);

  const ready = useMemo(() => !!studentFile.file, [studentFile.file]);

  function updateFile(kind: UploadKind, nextFile: File | null) {
    setError('');
    setSuccess('');

    if (!nextFile) {
      if (kind === 'student') setStudentFile({ file: null, name: '' });
      if (kind === 'checkin') setCheckinFile({ file: null, name: '' });
      return;
    }

    if (!isExcelFile(nextFile)) {
      setError('请上传 .xlsx 或 .xls 文件');
      return;
    }

    const nextState = { file: nextFile, name: nextFile.name };
    if (kind === 'student') setStudentFile(nextState);
    if (kind === 'checkin') setCheckinFile(nextState);
  }

  function onFileChange(kind: UploadKind, event: React.ChangeEvent<HTMLInputElement>) {
    updateFile(kind, event.target.files?.[0] || null);
    event.target.value = '';
  }

  async function generateReport() {
    if (!studentFile.file) {
      setError('请先上传学生个人数据文件');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const studentContent = await readFileAsBase64(studentFile.file);
      const checkinContent = checkinFile.file ? await readFileAsBase64(checkinFile.file) : '';

      const response = await fetch('/api/reports/class-daily-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          className: className.trim(),
          reportMode,
          studentFile: {
            name: studentFile.file.name,
            content: studentContent,
          },
          checkinFile: {
            name: checkinFile.file?.name || '',
            content: checkinContent,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || '班级日报生成失败');
      }

      const blob = await response.blob();
      const fallbackName = `${className || classInfo.name}${reportMode === 'detail' ? '明细版本' : '完成公示'}.xlsx`;
      const filename = getDownloadName(response.headers.get('Content-Disposition'), fallbackName);
      triggerDownload(blob, filename);
      setSuccess(`已生成并下载：${filename}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '班级日报生成失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dr-wrap fade-in">
      {onBackToHome && (
        <button className="tool-home-rail" onClick={onBackToHome}>
          <span className="tool-home-rail-icon">←</span>
          <span>返回主页</span>
        </button>
      )}
      <div className="dr-topbar">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <span className="dr-title">
          📗{' '}
          {classes && classes.length > 1 && onSwitchClass ? (
            <select className="tool-class-switch" value={classInfo.name} onChange={(e) => onSwitchClass(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          ) : classInfo.name}
          {' '}· 班级日报
        </span>
      </div>

      <div className="dr-body">
        <div className="dr-hero">
          <div className="dr-hero-badge">RemoteLab 版本</div>
          <h2 className="dr-hero-title">这里生成的是班级群实际要发的那套 Excel 日报</h2>
          <p className="dr-hero-text">
            上传两份源表后，直接输出和 RemoteLab 里一致的成品文件。
            标准版会生成“完成公示 + 质量分析”，明细版会生成按分数展示的公示表。
          </p>
        </div>

        <div className="dr-mode-row">
          <button
            type="button"
            className={`dr-mode-btn${reportMode === 'standard' ? ' active' : ''}`}
            onClick={() => setReportMode('standard')}
          >
            标准版
          </button>
          <button
            type="button"
            className={`dr-mode-btn${reportMode === 'detail' ? ' active' : ''}`}
            onClick={() => setReportMode('detail')}
          >
            明细版
          </button>
        </div>

        <div className="dr-panel">
          <label className="dr-field-label" htmlFor="daily-report-class-name">班名（可选）</label>
          <input
            id="daily-report-class-name"
            className="dr-input"
            value={className}
            onChange={(event) => setClassName(event.target.value)}
            placeholder="留空则从学生个人数据文件名识别"
          />
        </div>

        <div className="dr-upload-grid">
          <div className="dr-upload-card">
            <div className="dr-upload-kicker">文件 1</div>
            <div className="dr-upload-title">学生个人数据</div>
            <div className="dr-upload-desc">需要包含 数据底表 / 概览 / 数据情况</div>
            <input
              ref={studentInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="dr-hidden-input"
              onChange={(event) => onFileChange('student', event)}
            />
            <button className="dr-upload-btn" onClick={() => studentInputRef.current?.click()}>
              {studentFile.name ? '重新选择' : '选择文件'}
            </button>
            <div className={`dr-file-pill${studentFile.name ? ' filled' : ''}`}>
              {studentFile.name || '未上传'}
            </div>
          </div>

          <div className="dr-upload-card">
            <div className="dr-upload-kicker">文件 2</div>
            <div className="dr-upload-title">打卡情况</div>
            <div className="dr-upload-desc">选填；如果不传，成品里不会出现打卡列</div>
            <input
              ref={checkinInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="dr-hidden-input"
              onChange={(event) => onFileChange('checkin', event)}
            />
            <button className="dr-upload-btn" onClick={() => checkinInputRef.current?.click()}>
              {checkinFile.name ? '重新选择' : '选择文件'}
            </button>
            <div className={`dr-file-pill${checkinFile.name ? ' filled' : ''}`}>
              {checkinFile.name || '未上传'}
            </div>
          </div>
        </div>

        <div className="dr-tips">
          <div className="dr-tip">
            标准版：输出一个 Excel，含「完成公示」和「质量分析」两个 sheet。
          </div>
          <div className="dr-tip">
            明细版：按测试得分、AI语音平均分、词王准确率、小挑战生成明细公示。
          </div>
          <div className="dr-tip">
            打卡情况：选填。不上传时会直接移除打卡列。
          </div>
        </div>

        {error && <div className="dr-error">{error}</div>}
        {success && <div className="dr-success">{success}</div>}

        <button
          className={`dr-generate-btn${loading ? ' loading' : ''}`}
          onClick={generateReport}
          disabled={loading || !ready}
        >
          {loading ? '生成中...' : '生成并下载 Excel'}
        </button>
      </div>
    </div>
  );
}
