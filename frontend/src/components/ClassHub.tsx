import type { AppScreen, ClassInfo } from '../types';
import { getCurrentWeek } from '../utils/weekNumber';
import { getClassDays } from '../utils/classSchedule';
import { getStudentCount } from '../utils/classProfiles';
import './ClassHub.css';

interface Props {
  classInfo: ClassInfo;
  onNavigate: (target: AppScreen) => void;
  onBack: () => void;
}

interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
  target: AppScreen | 'external-daily-report';
}

const FEATURES: FeatureItem[] = [
  { icon: '🪑', title: '座位表',       desc: '座位安排、轮换、导出图片',              target: 'seating' },
  { icon: '🏆', title: 'MP 积分发放',  desc: 'MP 计算、导出图片 & Excel',            target: 'flow' },
  { icon: '📋', title: '课程概览',     desc: '简报制作，模块拼接导出',                target: 'overview' },
  { icon: '📗', title: '班级日报',     desc: '在 RemoteLab 聊天中发送两份 xlsx 触发',  target: 'external-daily-report' },
];

export default function ClassHub({ classInfo, onNavigate, onBack }: Props) {
  const week = getCurrentWeek();
  const displayName = classInfo.id === 'manual'
    ? (classInfo.name === '手动输入' ? '手动模式' : classInfo.name)
    : classInfo.name;

  const days = getClassDays(classInfo.name);
  const studentCount = getStudentCount(classInfo.name);

  function handleCard(item: FeatureItem) {
    if (item.target === 'external-daily-report') return;
    if (item.target === 'overview') return;
    onNavigate(item.target);
  }

  const isAvailable = (item: FeatureItem) =>
    item.target !== 'external-daily-report' && item.target !== 'overview';

  return (
    <div className="hub-wrap fade-in">
      <div className="hub-topbar">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <div className="hub-class-tag">
          <span className="hub-class-code">{displayName}</span>
          <span className="hub-week">W{week}</span>
        </div>
      </div>

      {(days.length > 0 || studentCount > 0) && (
        <div className="hub-class-meta">
          {days.length > 0 && (
            <span className="hub-meta-item">📅 {days.join(' · ')}</span>
          )}
          {studentCount > 0 && (
            <span className="hub-meta-item">👥 {studentCount}人</span>
          )}
        </div>
      )}

      <div className="hub-grid">
        {FEATURES.map((f) => {
          const available = isAvailable(f);
          const isDailyReport = f.target === 'external-daily-report';
          return (
            <button
              key={f.title}
              className={`hub-card${!available ? ' hub-card-coming' : ''}`}
              onClick={() => handleCard(f)}
              disabled={!available}
            >
              <div className="hub-card-icon">{f.icon}</div>
              <div className="hub-card-title">{f.title}</div>
              <div className="hub-card-desc">{f.desc}</div>
              {isDailyReport && <div className="hub-coming-badge">聊天触发</div>}
              {f.target === 'overview' && <div className="hub-coming-badge">开发中</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
