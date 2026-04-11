import { useEffect, useState } from 'react';
import './UsageInsightsApp.css';

interface Props {
  onBack: () => void;
}

interface CountEntry {
  count: number;
  event?: string;
  teacherName?: string;
  module?: string;
}

interface DailyEntry {
  day: string;
  events: number;
  activeUsers: number;
}

interface UsageSummary {
  totalEvents: number;
  uniqueUsers: number;
  byEvent: CountEntry[];
  byUser: CountEntry[];
  byModule: CountEntry[];
  daily: DailyEntry[];
}

const DAY_OPTIONS = [7, 30, 90];

function SummaryBlock({ title, items, field }: { title: string; items: CountEntry[]; field: 'event' | 'teacherName' | 'module' }) {
  return (
    <section className="usage-card">
      <div className="usage-card-head">
        <h3>{title}</h3>
      </div>
      <div className="usage-list">
        {items.length > 0 ? items.slice(0, 8).map((item) => (
          <div key={`${field}:${item[field] || 'unknown'}`} className="usage-row">
            <span>{item[field] || '未命名'}</span>
            <strong>{item.count}</strong>
          </div>
        )) : (
          <div className="usage-empty">暂无数据</div>
        )}
      </div>
    </section>
  );
}

export default function UsageInsightsApp({ onBack }: Props) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/usage-summary?days=${days}`, {
          credentials: 'include',
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || '使用统计加载失败');
        }
        if (!cancelled) {
          setSummary(data.summary || null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : '使用统计加载失败');
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="usage-wrap fade-in">
      <div className="usage-topbar">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <div className="usage-title-group">
          <span className="usage-kicker">运营视角</span>
          <h2>使用情况</h2>
        </div>
        <div className="usage-range-switch">
          {DAY_OPTIONS.map((option) => (
            <button
              key={option}
              className={`usage-range-btn${days === option ? ' active' : ''}`}
              onClick={() => setDays(option)}
            >
              近{option}天
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="usage-loading card">正在加载使用统计...</div>}
      {error && <div className="usage-error card">{error}</div>}

      {!loading && !error && summary && (
        <>
          <div className="usage-overview-grid">
            <section className="usage-stat-card">
              <span className="usage-stat-label">总事件数</span>
              <strong>{summary.totalEvents}</strong>
            </section>
            <section className="usage-stat-card">
              <span className="usage-stat-label">活跃老师数</span>
              <strong>{summary.uniqueUsers}</strong>
            </section>
            <section className="usage-stat-card">
              <span className="usage-stat-label">最常用模块</span>
              <strong>{summary.byModule[0]?.module || '暂无'}</strong>
            </section>
          </div>

          <div className="usage-grid">
            <SummaryBlock title="老师使用次数" items={summary.byUser} field="teacherName" />
            <SummaryBlock title="模块使用次数" items={summary.byModule} field="module" />
            <SummaryBlock title="行为分布" items={summary.byEvent} field="event" />
            <section className="usage-card">
              <div className="usage-card-head">
                <h3>每日活跃</h3>
              </div>
              <div className="usage-list">
                {summary.daily.length > 0 ? summary.daily.slice(-10).reverse().map((item) => (
                  <div key={item.day} className="usage-row multi">
                    <span>{item.day}</span>
                    <strong>{item.activeUsers}人 / {item.events}次</strong>
                  </div>
                )) : (
                  <div className="usage-empty">暂无数据</div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
