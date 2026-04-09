import { useState, useEffect, useCallback, lazy, Suspense, startTransition } from 'react';
import Login from './components/Login';
import Welcome from './components/Welcome';
import ClassHub from './components/ClassHub';
import NewestSeatingFrame from './components/NewestSeatingFrame';
import ReLoginModal from './components/ReLoginModal';
import { flushLoginPerf, markLoginPerf } from './utils/loginPerf';

const OverviewApp = lazy(() => import('./components/OverviewApp'));
const ClassRosterApp = lazy(() => import('./components/ClassRosterApp'));
const DistributionFlow = lazy(() => import('./components/DistributionFlow'));
const MakeupTool = lazy(() => import('./components/MakeupTool'));
const DailyReportApp = lazy(() => import('./components/DailyReportApp'));
import type { AppScreen, ClassInfo } from './types';
import { saveAppState, loadAppState } from './utils/appPersistence';

const CLASS_CONTEXT_SCREENS: AppScreen[] = ['flow', 'seating', 'overview', 'daily-report', 'roster'];

function ScreenLoading() {
  return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>;
}

function warmFeatureModules() {
  return Promise.all([
    import('./components/ClassRosterApp'),
    import('./components/DistributionFlow'),
    import('./components/DailyReportApp'),
    import('./components/OverviewApp'),
  ]);
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('login');
  const [teacherName, setTeacherName] = useState('');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [restored, setRestored] = useState(false);
  const [showReLogin, setShowReLogin] = useState(false);

  // Restore persisted state on mount
  useEffect(() => {
    const saved = loadAppState();
    if (saved && saved.teacherName && saved.classes.length > 0) {
      setTeacherName(saved.teacherName);
      setClasses(saved.classes);
      setSelectedClass(saved.selectedClass);
      // If they had a class selected, go back to hub; otherwise welcome
      // Don't restore directly to flow/seating/overview — those need fresh data
      if (saved.selectedClass) {
        setScreen('hub');
      } else {
        setScreen('welcome');
      }
    }
    setRestored(true);
  }, []);

  // Persist state on changes (after initial restore)
  const persist = useCallback(() => {
    if (!restored) return;
    saveAppState({ screen, teacherName, classes, selectedClass });
  }, [screen, teacherName, classes, selectedClass, restored]);

  useEffect(() => { persist(); }, [persist]);

  useEffect(() => {
    if (classes.length === 0) {
      return;
    }

    void warmFeatureModules();

    const scheduleWarmup = () => {
      void import('xlsx');
    };

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(scheduleWarmup, { timeout: 1200 });
      return () => {
        window.cancelIdleCallback(idleId);
      };
    }

    const timer = globalThis.setTimeout(scheduleWarmup, 900);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [classes.length]);

  function handleLogin(name: string, classList: ClassInfo[]) {
    markLoginPerf('app_handle_login', { classCount: classList.length });
    setTeacherName(name);
    setClasses(classList);
    startTransition(() => {
      setScreen('welcome');
    });
  }

  useEffect(() => {
    if (screen !== 'welcome') return;

    markLoginPerf('welcome_state_committed', { classCount: classes.length });
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      markLoginPerf('welcome_first_frame', { classCount: classes.length });
      raf2 = window.requestAnimationFrame(() => {
        flushLoginPerf('welcome_interactive', { classCount: classes.length });
      });
    });

    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [screen, classes.length]);

  function handleSelectClass(cls: ClassInfo) {
    startTransition(() => {
      setSelectedClass(cls);
      setScreen('hub');
    });
  }

  function handleNavigate(target: AppScreen) {
    startTransition(() => {
      setScreen(target);
    });
  }

  function handleBackToHub() {
    startTransition(() => {
      setScreen('hub');
    });
  }

  function handleBackToWelcome() {
    startTransition(() => {
      setSelectedClass(null);
      setScreen('welcome');
    });
  }

  function handleLogout() {
    startTransition(() => {
      setTeacherName('');
      setClasses([]);
      setSelectedClass(null);
      setScreen('login');
    });
  }

  function handleSessionExpired() {
    setShowReLogin(true);
  }

  function handleReLoginSuccess(newClasses: ClassInfo[]) {
    setShowReLogin(false);
    if (newClasses.length > 0) {
      setClasses(newClasses);
      // Update selectedClass in case squadId changed
      if (selectedClass) {
        const updated = newClasses.find((c) => c.name === selectedClass.name);
        if (updated) setSelectedClass(updated);
      }
    }
  }

  function handleSwitchClass(nextClassName: string) {
    const nextClass = classes.find((item) => item.name === nextClassName);
    if (!nextClass || nextClass.name === selectedClass?.name) {
      return;
    }

    startTransition(() => {
      setSelectedClass(nextClass);
    });
  }

  if (!restored) return null;

  const showClassContextBar =
    Boolean(selectedClass)
    && selectedClass?.id !== 'manual'
    && CLASS_CONTEXT_SCREENS.includes(screen);

  return (
    <>
      {screen === 'login' && (
        <Login onLogin={handleLogin} />
      )}
      {screen === 'welcome' && (
        <Welcome
          teacherName={teacherName}
          classes={classes}
          onSelectClass={handleSelectClass}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
        />
      )}
      {screen === 'roster' && (
        <Suspense fallback={<ScreenLoading />}>
          <ClassRosterApp
            key={`roster:${selectedClass?.name ?? 'none'}`}
            classInfo={selectedClass}
            knownClasses={classes}
            onBack={selectedClass ? handleBackToHub : handleBackToWelcome}
          />
        </Suspense>
      )}
      {screen === 'hub' && selectedClass && (
        <ClassHub
          classInfo={selectedClass}
          onNavigate={handleNavigate}
          onBack={handleBackToWelcome}
        />
      )}
      {screen === 'flow' && selectedClass && (
        <Suspense fallback={<ScreenLoading />}>
          <DistributionFlow
            key={`flow:${selectedClass.name}`}
            classInfo={selectedClass}
            onBack={handleBackToHub}
            onSessionExpired={handleSessionExpired}
          />
        </Suspense>
      )}
      {selectedClass && (screen === 'hub' || screen === 'seating') && (
        <NewestSeatingFrame
          classCode={selectedClass.name}
          onBack={handleBackToHub}
          active={screen === 'seating'}
        />
      )}
      {screen === 'overview' && selectedClass && (
        <Suspense fallback={<ScreenLoading />}>
          <OverviewApp
            key={`overview:${selectedClass.name}`}
            classInfo={selectedClass}
            onBack={handleBackToHub}
          />
        </Suspense>
      )}
      {screen === 'makeup' && (
        <Suspense fallback={<ScreenLoading />}>
          <MakeupTool onBack={handleBackToWelcome} />
        </Suspense>
      )}
      {screen === 'daily-report' && selectedClass && (
        <Suspense fallback={<ScreenLoading />}>
          <DailyReportApp
            key={`daily-report:${selectedClass.name}`}
            classInfo={selectedClass}
            onBack={handleBackToHub}
          />
        </Suspense>
      )}
      {showClassContextBar && (
        <div className="screen-class-switcher">
          <span className="screen-class-switcher-label">班级</span>
          <select
            value={selectedClass?.name || ''}
            onChange={(event) => handleSwitchClass(event.target.value)}
          >
            {classes.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {showReLogin && (
        <ReLoginModal
          defaultUsername={teacherName}
          onSuccess={handleReLoginSuccess}
          onDismiss={() => setShowReLogin(false)}
        />
      )}
    </>
  );
}
