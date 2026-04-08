import type { AppScreen, ClassInfo } from '../types';
import { getCurrentWeek } from '../utils/weekNumber';
import { getClassDays } from '../utils/classSchedule';
import { getStudentCount, hasSeatingData } from '../utils/classProfiles';
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
  target: AppScreen;
}

const FEATURES: FeatureItem[] = [
  { icon: '🪑', title: '座位表',       desc: '查看座位、名单、上课时间；图片识别后先在这里确认', target: 'seating' },
  { icon: '📗', title: '班级日报',     desc: '上传两份 Excel，直接生成公示表或明细版',   target: 'daily-report' },
  { icon: '🏆', title: 'MP积分发放',   desc: 'MP 计算、导出图片和 Excel',            target: 'flow' },
  { icon: '📋', title: '课程概览',     desc: '简报制作，模块拼接导出',                target: 'overview' },
  { icon: '🧾', title: '班级名单检查', desc: '把学号、中文名、英文名一次性整理好，后面会更省事', target: 'roster' },
];

export default function ClassHub({ classInfo, onNavigate, onBack }: Props) {
  const week = getCurrentWeek();
  const displayName = classInfo.id === 'manual'
    ? (classInfo.name === '手动输入' ? '手动模式' : classInfo.name)
    : classInfo.name;

  const days = getClassDays(classInfo.name);
  const studentCount = getStudentCount(classInfo.name);
  const hasSeating = hasSeatingData(classInfo.name);

  function handleCard(item: FeatureItem) {
    onNavigate(item.target);
  }

  return (
    <div className="hub-wrap fade-in">
      <button className="hub-home-rail" onClick={onBack}>
        <span className="hub-home-rail-icon">←</span>
        <span className="hub-home-rail-text">返回主页</span>
      </button>

      <div className="hub-topbar">
        <button className="back-btn" onClick={onBack}>← 返回主页</button>
        <div className="hub-class-tag">
          <span className="hub-class-code">{displayName}</span>
          <span className="hub-week">W{week}</span>
        </div>
      </div>

      {(days.length > 0 || studentCount > 0 || hasSeating) && (
        <div className="hub-class-meta">
          {days.length > 0 && (
            <span className="hub-meta-item">📅 {days.join(' · ')}</span>
          )}
          {studentCount > 0 && (
            <span className="hub-meta-item">👥 {studentCount}人</span>
          )}
          {hasSeating && (
            <span className="hub-meta-item">🪑 座位表已录入</span>
          )}
        </div>
      )}

      <div className="hub-grid">
        {FEATURES.map((f) => (
          <button
            key={f.title}
            className="hub-card"
            onClick={() => handleCard(f)}
          >
            <div className="hub-card-icon">{f.icon}</div>
            <div className="hub-card-title">{f.title}</div>
            <div className="hub-card-desc">{f.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
