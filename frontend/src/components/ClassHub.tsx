import type { ClassInfo } from '../types';
import { getCurrentWeek } from '../utils/weekNumber';
import './ClassHub.css';

interface Props {
  classInfo: ClassInfo;
  onSelectFlow: () => void;
  onBack: () => void;
}

interface FeatureCard {
  icon: string;
  title: string;
  desc: string;
  action: 'flow' | 'seating' | 'coming';
}

const FEATURES: FeatureCard[] = [
  { icon: '🏆', title: 'MP汇总与发放',  desc: 'MP 计算、导出图片 & Excel', action: 'flow' },
  { icon: '🪑', title: '班级座位',      desc: '座位安排，新窗口打开 ↗',   action: 'seating' },
  { icon: '📝', title: '概览制作',      desc: '敬请期待…',               action: 'coming' },
  { icon: '📅', title: '请假管理',      desc: '敬请期待…',               action: 'coming' },
];

const SEATING_APP_PATH = '/seating/';

export default function ClassHub({ classInfo, onSelectFlow, onBack }: Props) {
  const week = getCurrentWeek();
  const displayName = classInfo.id === 'manual'
    ? (classInfo.name === '手动输入' ? '手动模式' : classInfo.name)
    : classInfo.name;

  function handleCard(action: FeatureCard['action']) {
    if (action === 'flow') onSelectFlow();
    else if (action === 'seating') {
      const url = new URL(SEATING_APP_PATH, window.location.origin);
      if (classInfo.id !== 'manual' && displayName) {
        url.searchParams.set('class', displayName);
      }
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="hub-wrap fade-in">
      <div className="hub-topbar">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <div className="hub-class-tag">
          <span className="hub-class-code">{displayName}</span>
          <span className="hub-week">Week {week}</span>
        </div>
      </div>

      <h2 className="hub-heading">选择功能</h2>

      <div className="hub-grid">
        {FEATURES.map((f) => (
          <button
            key={f.title}
            className={`hub-card${f.action === 'coming' ? ' hub-card-coming' : ''}`}
            onClick={() => handleCard(f.action)}
            disabled={f.action === 'coming'}
          >
            <div className="hub-card-icon">{f.icon}</div>
            <div className="hub-card-title">{f.title}</div>
            <div className="hub-card-desc">{f.desc}</div>
            {f.action === 'coming' && <div className="hub-coming-badge">开发中</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
