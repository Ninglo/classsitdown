import { useRef, useState } from 'react';
import type { MPBreakdown, StudentData, BonusItem } from '../types';
import { generateOutputExcel } from '../utils/parseExcel';
import './ResultView.css';

interface Props {
  results: MPBreakdown[];
  students: StudentData[];
  bonusItems: BonusItem[];
  classCode: string;
  week: number;
  onBack: () => void;
}

type SortKey = 'total_desc' | 'total_asc' | 'en_asc' | 'en_desc' | 'zh_asc' | 'zh_desc';

function fmt(mp: number): string {
  if (mp <= 0) return '—';
  if (mp >= 1) return `${parseFloat(mp.toFixed(1))} MP`;
  return `${Math.round(mp * 10)} CP`;
}

function sortResults(list: MPBreakdown[], key: SortKey): MPBreakdown[] {
  const r = [...list];
  switch (key) {
    case 'total_desc': return r.sort((a, b) => b.total - a.total);
    case 'total_asc':  return r.sort((a, b) => a.total - b.total);
    case 'en_asc':  return r.sort((a, b) => a.englishName.localeCompare(b.englishName));
    case 'en_desc': return r.sort((a, b) => b.englishName.localeCompare(a.englishName));
    case 'zh_asc':  return r.sort((a, b) => a.chineseName.localeCompare(b.chineseName, 'zh'));
    case 'zh_desc': return r.sort((a, b) => b.chineseName.localeCompare(a.chineseName, 'zh'));
  }
}

export default function ResultView({ results, students, bonusItems, classCode, week, onBack }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('total_desc');

  const mpMap = new Map(results.map((r) => [r.studentId, r.total]));

  const showBasic = results.some((r) => r.基础落实 > 0);
  const showDaily = results.some((r) => r.每日开口 > 0);
  const showClass = results.some((r) => r.课堂参与 > 0);

  // 每个独立奖励项目作为单独一列，只要有学生的这一项>0才显示
  const bonusCols = bonusItems.filter((b) =>
    results.some((r) => b.studentIds.includes(r.studentId) && b.amount > 0)
  );

  // 获取某学生在某个奖励项的金额
  function getBonusAmount(studentId: string, bonus: BonusItem): number {
    return bonus.studentIds.includes(studentId) ? bonus.amount : 0;
  }

  const sorted = sortResults(results, sortKey);
  const totalMP = results.reduce((s, r) => s + r.total, 0);

  async function handleDownloadImage() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#f7faf2',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `${classCode}_Week${week}_MP发放公示.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  }

  function handleDownloadExcel() {
    const buf = generateOutputExcel(students, mpMap);
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${classCode}_Week${week}_MP发放.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'total_desc', label: '总量 ↓' },
    { key: 'total_asc',  label: '总量 ↑' },
    { key: 'en_asc',  label: '英文名 A→Z' },
    { key: 'en_desc', label: '英文名 Z→A' },
    { key: 'zh_asc',  label: '中文名 升序' },
    { key: 'zh_desc', label: '中文名 降序' },
  ];

  return (
    <div className="result-wrap fade-in">
      <div className="result-topbar">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <div className="result-controls">
          <select className="sort-select" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={handleDownloadExcel}>↓ Excel</button>
          <button className="btn btn-primary btn-sm" onClick={handleDownloadImage} disabled={exporting}>
            {exporting ? '生成中...' : '↓ 图片'}
          </button>
        </div>
      </div>

      <div className="result-card card" ref={cardRef}>
        <div className="result-header">
          <div className="result-class-info">
            <span className="result-class-code">{classCode}</span>
            <span className="result-week-badge">Week {week}</span>
            <span className="result-meta">{results.length} 人 · 合计 {fmt(totalMP)}</span>
          </div>
        </div>

        <div className="result-table-wrap">
          <table className="result-table">
            <thead>
              <tr>
                <th>#</th>
                <th>英文名</th>
                <th>中文名</th>
                {showBasic && <th>基础落实</th>}
                {showDaily && <th>每日开口</th>}
                {showClass && <th>课堂参与</th>}
                {bonusCols.map((b) => <th key={b.name}>{b.name}</th>)}
                <th className="col-total-h">合计</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.studentId} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                  <td className="col-rank">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="col-name-en">{r.englishName}</td>
                  <td className="col-name-zh">{r.chineseName}</td>
                  {showBasic && <td>{fmt(r.基础落实)}</td>}
                  {showDaily && <td>{fmt(r.每日开口)}</td>}
                  {showClass && <td>{fmt(r.课堂参与)}</td>}
                  {bonusCols.map((b) => (
                    <td key={b.name}>{fmt(getBonusAmount(r.studentId, b))}</td>
                  ))}
                  <td className="col-total-val">{fmt(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="result-footer">Super Amber is here! · I will help you</div>
      </div>
    </div>
  );
}
