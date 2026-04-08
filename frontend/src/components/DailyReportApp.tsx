import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { ClassInfo } from '../types';
import './DailyReportApp.css';

interface TableData {
  name: string;
  text: string;
}

interface Props {
  classInfo: ClassInfo;
  onBack: () => void;
}

function xlsxToMarkdown(wb: XLSX.WorkBook, fileName: string): TableData[] {
  return wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
    }) as (string | number | null)[][];

    // Remove fully empty rows
    const nonEmpty = rows.filter((row) => row.some((cell) => cell !== null && cell !== ''));
    if (nonEmpty.length === 0) return null;

    // Build markdown table from first sheet
    const header = nonEmpty[0].map((c) => String(c ?? '').trim());
    const divider = header.map(() => '---');
    const dataRows = nonEmpty.slice(1).map((row) =>
      header.map((_, i) => String(row[i] ?? '').trim())
    );

    const lines = [
      `| ${header.join(' | ')} |`,
      `| ${divider.join(' | ')} |`,
      ...dataRows.map((row) => `| ${row.join(' | ')} |`),
    ];

    return {
      name: `${fileName} · ${sheetName}`,
      text: lines.join('\n'),
    };
  }).filter(Boolean) as TableData[];
}

export default function DailyReportApp({ classInfo, onBack }: Props) {
  const [tables, setTables] = useState<TableData[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  function processFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv')
    );
    if (arr.length === 0) {
      setError('请上传 .xlsx / .xls / .csv 格式的文件');
      return;
    }
    setError('');

    const newTables: TableData[] = [];
    const newNames: string[] = [];
    let done = 0;

    for (const file of arr) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const parsed = xlsxToMarkdown(wb, file.name);
          newTables.push(...parsed);
          newNames.push(file.name);
        } catch {
          // skip unparseable files
        }
        done++;
        if (done === arr.length) {
          setTables((prev) => [...prev, ...newTables]);
          setFileNames((prev) => [...prev, ...newNames]);
          setReport('');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dropRef.current?.classList.remove('drag-over');
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  }

  function removeFile(name: string) {
    setFileNames((prev) => prev.filter((n) => n !== name));
    setTables((prev) => prev.filter((t) => !t.name.startsWith(name)));
    setReport('');
  }

  async function generate() {
    if (tables.length === 0) {
      setError('请先上传数据文件');
      return;
    }
    setLoading(true);
    setError('');
    setReport('');
    try {
      const resp = await fetch('/api/ai/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classCode: classInfo.name, tables, note }),
      });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || '生成失败');
      setReport(json.report ?? '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  function copyReport() {
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const hasTables = tables.length > 0;

  return (
    <div className="dr-wrap fade-in">
      <div className="dr-topbar">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <span className="dr-title">📗 {classInfo.name} · 班级日报</span>
      </div>

      <div className="dr-body">
        {/* Upload zone */}
        <div
          ref={dropRef}
          className={`dr-dropzone${hasTables ? ' dr-dropzone-compact' : ''}`}
          onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add('drag-over'); }}
          onDragLeave={() => dropRef.current?.classList.remove('drag-over')}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {hasTables ? (
            <span className="dr-dropzone-hint">点击或拖入继续添加文件</span>
          ) : (
            <>
              <div className="dr-dropzone-icon">📂</div>
              <div className="dr-dropzone-text">将 Excel / CSV 文件拖到这里，或点击选择</div>
              <div className="dr-dropzone-sub">支持同时上传多个文件（.xlsx / .xls / .csv）</div>
            </>
          )}
        </div>

        {/* File list */}
        {fileNames.length > 0 && (
          <div className="dr-file-list">
            {fileNames.map((name) => (
              <div key={name} className="dr-file-tag">
                <span>📄 {name}</span>
                <button className="dr-file-remove" onClick={() => removeFile(name)}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Note field */}
        <textarea
          className="dr-note"
          placeholder="老师补充说明（可选）：本节课重点、特殊情况等..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />

        {error && <div className="dr-error">{error}</div>}

        <button
          className={`dr-generate-btn${loading ? ' loading' : ''}`}
          onClick={generate}
          disabled={loading || !hasTables}
        >
          {loading ? '生成中...' : '✨ 生成日报'}
        </button>

        {/* Report output */}
        {report && (
          <div className="dr-result">
            <div className="dr-result-header">
              <span>生成结果</span>
              <button className="dr-copy-btn" onClick={copyReport}>
                {copied ? '已复制 ✓' : '复制全文'}
              </button>
            </div>
            <pre className="dr-result-body">{report}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
