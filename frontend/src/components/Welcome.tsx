import type { ClassInfo } from '../types';
import { getCurrentWeek, getWeekRange, formatDateShort } from '../utils/weekNumber';
import './Welcome.css';

interface Props {
  teacherName: string;
  classes: ClassInfo[];
  onSelectClass: (cls: ClassInfo) => void;
}

export default function Welcome({ teacherName, classes, onSelectClass }: Props) {
  const week = getCurrentWeek();
  const { start, end } = getWeekRange(week);

  const firstName = teacherName.replace(/^(ms\.?|mr\.?|mrs\.?)/i, '').trim().split(/[\s_]/)[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  function handleManualStart() {
    onSelectClass({ id: 'manual', name: '手动输入' });
  }

  return (
    <div className="welcome-wrap fade-in">
      <header className="welcome-header">
        <div className="welcome-greeting">
          <div className="greeting-text">
            <h1>Welcome, {displayName}</h1>
            <p className="slogan">Super Amber is here! · I will help you</p>
          </div>
        </div>
        <div className="week-badge">
          <span className="week-num">Week {week}</span>
          <span className="week-range">{formatDateShort(start)} – {formatDateShort(end)}</span>
        </div>
      </header>

      <div className="welcome-body">
        {classes.length > 0 ? (
          <>
            <div className="section-title">
              <span>你的班级</span>
              <span className="section-count">{classes.length} 个班级</span>
            </div>
            <div className="class-grid">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  className="class-card"
                  onClick={() => onSelectClass(cls)}
                >
                  <div className="class-code">{cls.name}</div>
                  <div className="class-action">开始发放 →</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-classes card">
            <div className="empty-icon">📂</div>
            <div className="empty-text">
              <strong>未绑定教务系统</strong>
              <p>班级号将在上传文件时自动从文件名中读取</p>
            </div>
            <button className="btn btn-primary" onClick={handleManualStart}>
              直接开始发放 →
            </button>
          </div>
        )}

        <div className="welcome-hint card">
          <div className="hint-icon">💡</div>
          <div className="hint-text">
            <strong>操作流程</strong>
            <p>选择班级 → 勾选发放模块 → 上传数据文件 → 确认明细 → 生成图片 & Excel</p>
          </div>
        </div>
      </div>
    </div>
  );
}
