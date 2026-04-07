import { useState } from 'react';
import type { ClassInfo, WelcomeView, DayOfWeek, AppScreen } from '../types';
import { loadMakeupData } from '../utils/makeupData';
import { getCurrentWeek, getWeekRange, formatDateShort } from '../utils/weekNumber';
import { ALL_DAYS, getClassDays, sortClassesBySchedule, getResolvedSchedule } from '../utils/classSchedule';
import { getStudentCount } from '../utils/classProfiles';
import ScheduleEditor from './ScheduleEditor';
import './Welcome.css';

interface Props {
  teacherName: string;
  classes: ClassInfo[];
  onSelectClass: (cls: ClassInfo) => void;
  onLogout: () => void;
  onNavigate: (target: AppScreen) => void;
}

export default function Welcome({ teacherName, classes, onSelectClass, onLogout, onNavigate }: Props) {
  const week = getCurrentWeek();
  const { start, end } = getWeekRange(week);
  const [showGuide, setShowGuide] = useState(false);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [view, setView] = useState<WelcomeView>('byClass');

  const firstName = teacherName.replace(/^(ms\.?|mr\.?|mrs\.?)/i, '').trim().split(/[\s_]/)[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  function handleManualStart() {
    onSelectClass({ id: 'manual', name: '手动输入' });
  }

  const sortedClasses = sortClassesBySchedule(classes);
  const resolvedSchedule = getResolvedSchedule(classes.map((item) => item.name));

  // Build day-grouped schedule for "by date" view
  function buildDayView(): { day: DayOfWeek; classes: ClassInfo[] }[] {
    const result: { day: DayOfWeek; classes: ClassInfo[] }[] = [];
    for (const day of ALL_DAYS) {
      const codes = resolvedSchedule[day] ?? [];
      if (codes.length === 0) continue;
      const matched = codes
        .map((code) => classes.find((c) => c.name === code))
        .filter((c): c is ClassInfo => !!c);
      if (matched.length > 0) {
        result.push({ day, classes: matched });
      }
    }
    return result;
  }

  const daySchedule = view === 'byDate' ? buildDayView() : [];

  return (
    <div className="welcome-wrap fade-in">
      <header className="welcome-header">
        <div className="welcome-greeting">
          <div className="greeting-text">
            <h1>Welcome, {displayName}</h1>
            <p className="slogan">Super Amber is here! · I will help you</p>
          </div>
        </div>
        <div className="welcome-header-right">
          <div className="week-badge">
            <span className="week-num">Week {week}</span>
            <span className="week-range">{formatDateShort(start)} – {formatDateShort(end)}</span>
          </div>
          <button className="btn btn-ghost btn-sm logout-btn" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </header>

      <div className="welcome-body">
        <div className="welcome-toolbox-area">
          <div className="toolbox-section">
            <div className="toolbox-title">工具箱</div>
            <div className="toolbox-grid">
              <button className="toolbox-card" onClick={() => onNavigate('makeup')}>
                <span className="toolbox-card-icon">💊</span>
                <div className="toolbox-card-body">
                  <strong>补课助手</strong>
                  <p>{loadMakeupData() ? '数据已导入' : '点击进入'}</p>
                </div>
                <span className="toolbox-card-arrow">→</span>
              </button>
            </div>
          </div>
        </div>

        <div className="welcome-classes-area">
          {classes.length > 0 ? (
            <>
              <div className="section-title">
                <div className="view-toggle">
                  <button
                    className={`view-toggle-btn${view === 'byClass' ? ' active' : ''}`}
                    onClick={() => setView('byClass')}
                  >
                    按班级
                  </button>
                  <button
                    className={`view-toggle-btn${view === 'byDate' ? ' active' : ''}`}
                    onClick={() => setView('byDate')}
                  >
                    按日期
                  </button>
                </div>
                <div className="section-title-right">
                  <span className="section-count">{classes.length} 个班级</span>
                  <button
                    className={`btn btn-ghost btn-sm schedule-btn${showScheduleEditor ? ' active' : ''}`}
                    onClick={() => setShowScheduleEditor((v) => !v)}
                  >
                    📅 {showScheduleEditor ? '收起' : '补充上课时间'}
                  </button>
                </div>
              </div>

              {showScheduleEditor && (
                <ScheduleEditor
                  key={scheduleVersion}
                  classes={classes}
                  onClose={() => setShowScheduleEditor(false)}
                  onSaved={() => setScheduleVersion((v) => v + 1)}
                />
              )}

              {view === 'byClass' ? (
                <div className="class-grid">
                  {sortedClasses.map((cls) => {
                    const days = getClassDays(cls.name);
                    const count = getStudentCount(cls.name);
                    return (
                      <button
                        key={cls.id}
                        className="class-card"
                        onClick={() => onSelectClass(cls)}
                      >
                        <div className="class-code">{cls.name}</div>
                        {days.length > 0 && (
                          <div className="class-days">{days.join(' · ')}</div>
                        )}
                        {count > 0 && (
                          <div className="class-student-count">{count}人</div>
                        )}
                        <div className="class-action">进入 →</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="day-view">
                  {daySchedule.length > 0 ? (
                    daySchedule.map(({ day, classes: dayClasses }) => (
                      <div key={day} className="day-group">
                        <div className="day-group-label">{day}</div>
                        <div className="day-group-classes">
                          {dayClasses.map((cls) => {
                            const count = getStudentCount(cls.name);
                            return (
                              <button
                                key={cls.id}
                                className="day-class-card"
                                onClick={() => onSelectClass(cls)}
                              >
                                <span className="day-class-code">{cls.name}</span>
                                {count > 0 && <span className="day-class-count">{count}人</span>}
                                <span className="day-class-action">→</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-classes card">
                      <div className="empty-icon">📅</div>
                      <div className="empty-text">
                        <strong>尚未设置上课时间</strong>
                        <p>座位表未录入上课时间时，再点上方「补充上课时间」手动补录</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="empty-classes card">
              <div className="empty-icon">📂</div>
              <div className="empty-text">
                <strong>未绑定教务系统</strong>
                <p>班级号将在上传文件时自动从文件名中读取</p>
              </div>
              <button className="btn btn-primary" onClick={handleManualStart}>
                直接开始 →
              </button>
            </div>
          )}
        </div>

        <div className="guide-panel card">
          <button className="guide-toggle" onClick={() => setShowGuide((v) => !v)}>
            <span className="guide-toggle-icon">📖</span>
            <span>使用说明</span>
            <span className="guide-toggle-arrow">{showGuide ? '▲' : '▼'}</span>
          </button>
          {showGuide && (
            <iframe
              src="/guide.html"
              className="guide-frame"
              title="使用说明"
              sandbox="allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  );
}
