import { useState } from 'react';
import type { ClassInfo, WelcomeView, DayOfWeek, AppScreen } from '../types';
import { hasStoredMakeupData } from '../utils/makeupStorage';
import { getCurrentWeek, getWeekRange, formatDateShort } from '../utils/weekNumber';
import { ALL_DAYS, getClassDays, sortClassesBySchedule, getResolvedSchedule, getClassTimeOnDay } from '../utils/classSchedule';
import { getStudentCount, listKnownClassCodes, savePreciseStudentList } from '../utils/classProfiles';
import ScheduleEditor from './ScheduleEditor';
import WelcomeTodoPanel from './WelcomeTodoPanel';
import ReLoginModal from './ReLoginModal';
import './Welcome.css';

interface Props {
  teacherName: string;
  classes: ClassInfo[];
  onSelectClass: (cls: ClassInfo) => void;
  onLogout: () => void;
  onNavigate: (target: AppScreen) => void;
  onOpenTodoTarget: (cls: ClassInfo, target: Extract<AppScreen, 'hub' | 'seating' | 'overview' | 'flow'>) => void;
}

export default function Welcome({ teacherName, classes, onSelectClass, onLogout, onNavigate, onOpenTodoTarget }: Props) {
  const week = getCurrentWeek();
  const { start, end } = getWeekRange(week);
  const [showGuide, setShowGuide] = useState(false);
  const [guideAnchor, setGuideAnchor] = useState<'top' | 'batch-import'>('top');
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [view, setView] = useState<WelcomeView>('byClass');

  function handleManualStart() {
    onSelectClass({ id: 'manual', name: '手动输入' });
  }

  const localDraftClasses = classes.length === 0
    ? listKnownClassCodes().map((code) => ({ id: code, name: code }))
    : [];
  const displayClasses = classes.length > 0 ? classes : localDraftClasses;
  const showingLocalDrafts = classes.length === 0 && localDraftClasses.length > 0;
  const sortedClasses = sortClassesBySchedule(displayClasses);
  const resolvedSchedule = getResolvedSchedule(displayClasses.map((item) => item.name));
  const [batchFetchBusy, setBatchFetchBusy] = useState(false);
  const [batchFetchStatus, setBatchFetchStatus] = useState('');
  const [batchFetchDone, setBatchFetchDone] = useState(false);
  const [showReLogin, setShowReLogin] = useState(false);
  const [pendingBatchRetry, setPendingBatchRetry] = useState(false);

  async function doBatchFetch() {
    setBatchFetchBusy(true);
    setBatchFetchDone(false);
    setBatchFetchStatus(`正在抓取 ${classes.length} 个班级...`);
    try {
      const resp = await fetch('/api/scraper/batch-student-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ classIds: classes.map((c) => c.name) }),
      });
      const data = await resp.json().catch(() => ({} as Record<string, unknown>));
      if (resp.status === 401) {
        setBatchFetchStatus('需要重新登录教务系统...');
        setBatchFetchBusy(false);
        setPendingBatchRetry(true);
        setShowReLogin(true);
        return;
      }
      if (!resp.ok) {
        setBatchFetchStatus((data as { error?: string }).error || '抓取失败');
        return;
      }
      const fetched = (data as { classes?: { classId: string; students: { no: string; chName: string; enName: string }[] }[] }).classes || [];
      let totalStudents = 0;
      for (const cls of fetched) {
        if (cls.students.length > 0) {
          savePreciseStudentList(cls.classId, cls.students.map((s) => ({
            studentId: s.no || '',
            chineseName: s.chName || '',
            englishName: s.enName || '',
          })));
          totalStudents += cls.students.length;
        }
      }
      const totalMs = (data as { totalMs?: number }).totalMs;
      setBatchFetchStatus(`完成！${fetched.length} 个班级，共 ${totalStudents} 名学生${totalMs ? `（${(totalMs / 1000).toFixed(1)}秒）` : ''}`);
      setBatchFetchDone(true);
    } catch (err) {
      setBatchFetchStatus(err instanceof Error ? err.message : '抓取失败');
    } finally {
      setBatchFetchBusy(false);
    }
  }

  function handleBatchFetchAll() {
    if (batchFetchBusy || classes.length === 0) return;
    void doBatchFetch();
  }

  function handleReLoginSuccess() {
    setShowReLogin(false);
    if (pendingBatchRetry) {
      setPendingBatchRetry(false);
      void doBatchFetch();
    }
  }

  const guideSrc = showGuide ? `/guide.html${guideAnchor === 'batch-import' ? '#batch-import' : ''}` : '';
  const showUsageInsights = typeof window !== 'undefined'
    && (
      window.location.hostname === '127.0.0.1'
      || window.location.hostname === 'localhost'
      || window.location.hostname.includes('superamber-test')
    );

  function openGuide(anchor: 'top' | 'batch-import' = 'top') {
    setGuideAnchor(anchor);
    setShowGuide(true);
  }

  // Build day-grouped schedule for "by date" view
  function buildDayView(): { day: DayOfWeek; classes: ClassInfo[] }[] {
    const result: { day: DayOfWeek; classes: ClassInfo[] }[] = [];
    for (const day of ALL_DAYS) {
      const codes = resolvedSchedule[day] ?? [];
      if (codes.length === 0) continue;
      const matched = codes
        .map((code) => displayClasses.find((c) => c.name === code))
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
            <h1>Super Amber is here!</h1>
            <p className="slogan">C&amp;F School · 班级事务助手</p>
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
                  <p>{hasStoredMakeupData() ? '数据已导入' : '点击进入'}</p>
                </div>
                <span className="toolbox-card-arrow">→</span>
              </button>
              {showUsageInsights && (
                <button className="toolbox-card" onClick={() => onNavigate('usage-insights')}>
                  <span className="toolbox-card-icon">📈</span>
                  <div className="toolbox-card-body">
                    <strong>使用情况</strong>
                    <p>看老师活跃度和模块使用次数</p>
                  </div>
                  <span className="toolbox-card-arrow">→</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="welcome-todo-area">
          <WelcomeTodoPanel classes={displayClasses} onOpenTask={onOpenTodoTarget} />
        </div>

        <div>
          <div className="welcome-classes-area">
            {displayClasses.length > 0 ? (
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
                    <span className="section-count">{displayClasses.length} 个班级</span>
                    <button
                      className={`btn btn-ghost btn-sm schedule-btn${showScheduleEditor ? ' active' : ''}`}
                      onClick={() => setShowScheduleEditor((v) => !v)}
                    >
                      📅 {showScheduleEditor ? '收起' : '补充上课时间'}
                    </button>
                  </div>
                </div>

                {showingLocalDrafts && (
                  <div className="empty-classes card" style={{ marginBottom: 14 }}>
                    <div className="empty-icon">🗂️</div>
                    <div className="empty-text">
                      <strong>教务班级暂时没拉回来，先显示本机已保存班级</strong>
                      <p>你之前录过的班级草稿还在，可以先直接点进班级继续用</p>
                    </div>
                  </div>
                )}

                {showScheduleEditor && (
                  <ScheduleEditor
                    key={scheduleVersion}
                    classes={displayClasses}
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
                              const time = getClassTimeOnDay(cls.name, day);
                              return (
                                <button
                                  key={cls.id}
                                  className="day-class-card"
                                  onClick={() => onSelectClass(cls)}
                                >
                                  <span className="day-class-code">{cls.name}</span>
                                  {time && <span className="day-class-time">{time}</span>}
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
        </div>

        <div className="guide-panel card">
          <button
            className="guide-toggle"
            onClick={() => {
              setGuideAnchor('top');
              setShowGuide((v) => !v);
            }}
          >
            <span className="guide-toggle-icon">📖</span>
            <span>使用说明</span>
            <span className="guide-toggle-arrow">{showGuide ? '▲' : '▼'}</span>
          </button>
          {showGuide && (
            <iframe
              src={guideSrc}
              className="guide-frame"
              title="使用说明"
              sandbox="allow-same-origin allow-scripts allow-forms allow-top-navigation-by-user-activation"
            />
          )}
        </div>

        {classes.length > 0 && (
          <div className="batch-import-panel card">
            <div className="batch-import-copy">
              <div className="batch-import-kicker">核心名单</div>
              <h2>一键抓取所有班级学生名单</h2>
              <p>从教务系统自动拉取每个班级的学号、中文名、英文名，储存为核心名单。</p>
              {batchFetchStatus && (
                <div className="batch-fetch-status">{batchFetchStatus}</div>
              )}
            </div>
            <div className="batch-import-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => void handleBatchFetchAll()}
                disabled={batchFetchBusy}
              >
                {batchFetchBusy ? '抓取中...' : batchFetchDone ? '重新抓取' : '一键抓取全部名单'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('roster')}>
                手动编辑名单
              </button>
            </div>
          </div>
        )}
      </div>
      {showReLogin && (
        <ReLoginModal
          defaultUsername={teacherName}
          onSuccess={handleReLoginSuccess}
          onDismiss={() => { setShowReLogin(false); setPendingBatchRetry(false); setBatchFetchStatus('已取消登录'); }}
        />
      )}
    </div>
  );
}
