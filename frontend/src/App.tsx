import { useState, useEffect, useCallback, lazy, Suspense, startTransition } from 'react';
import Login from './components/Login';
import Welcome from './components/Welcome';
import ClassHub from './components/ClassHub';
const NewestSeatingFrame = lazy(() => import('./components/NewestSeatingFrame'));
import ReLoginModal from './components/ReLoginModal';
import { flushLoginPerf, markLoginPerf } from './utils/loginPerf';
import { inferModuleFromScreen, trackUsageEvent } from './utils/usageTracking';

function lazyWithReload<T extends { default: React.ComponentType<any> }>(
  loader: () => Promise<T>,
) {
  return lazy(async () => {
    try {
      const mod = await loader();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('amber_lazy_reload_once');
      }
      return mod;
    } catch (error) {
      if (typeof window !== 'undefined') {
        const message = error instanceof Error ? error.message : String(error);
        const isChunkLoadError =
          /Failed to fetch dynamically imported module/i.test(message)
          || /Importing a module script failed/i.test(message)
          || /ChunkLoadError/i.test(message);

        if (isChunkLoadError && !sessionStorage.getItem('amber_lazy_reload_once')) {
          sessionStorage.setItem('amber_lazy_reload_once', '1');
          window.location.reload();
          return await new Promise<T>(() => {});
        }
      }
      throw error;
    }
  });
}

const OverviewApp = lazyWithReload(() => import('./components/OverviewApp'));
const ClassRosterApp = lazyWithReload(() => import('./components/ClassRosterApp'));
const DistributionFlow = lazyWithReload(() => import('./components/DistributionFlow'));
const MakeupTool = lazyWithReload(() => import('./components/MakeupTool'));
const DailyReportApp = lazyWithReload(() => import('./components/DailyReportApp'));
const UsageInsightsApp = lazyWithReload(() => import('./components/UsageInsightsApp'));
import type { AppScreen, ClassInfo } from './types';
import { saveAppState, loadAppState } from './utils/appPersistence';


function isUsageInsightsEnabled() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === '127.0.0.1' || host === 'localhost' || host.includes('superamber-test');
}

function ScreenLoading() {
  return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>;
}

function normalizeClasses(raw: unknown): ClassInfo[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.reduce<ClassInfo[]>((list, item) => {
    if (!item || typeof item !== 'object') {
      return list;
    }

    const data = item as Partial<ClassInfo>;
    const name = String(data.name || '').trim();
    if (!name) {
      return list;
    }

    const normalized: ClassInfo = {
      id: String(data.id || name),
      name,
    };

    if (typeof data.squadId === 'string' && data.squadId.trim()) {
      normalized.squadId = data.squadId;
    }

    list.push(normalized);
    return list;
  }, []);
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
  const usageInsightsEnabled = isUsageInsightsEnabled();
  const [screen, setScreen] = useState<AppScreen>('login');
  const [teacherName, setTeacherName] = useState('');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [restored, setRestored] = useState(false);
  const [showReLogin, setShowReLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      const saved = loadAppState();
      const savedTeacherName = String(saved?.teacherName || '').trim();
      const savedClasses = normalizeClasses(saved?.classes || []);
      const savedSelectedClassName = String(saved?.selectedClass?.name || '').trim();

      if (savedTeacherName) {
        setTeacherName(savedTeacherName);
      }

      const restoreSavedState = () => {
        if (!savedTeacherName || savedClasses.length === 0) {
          return false;
        }

        setTeacherName(savedTeacherName);
        setClasses(savedClasses);
        const restoredSelectedClass = savedSelectedClassName
          ? savedClasses.find((item) => item.name === savedSelectedClassName) || null
          : null;
        setSelectedClass(restoredSelectedClass);
        setScreen(restoredSelectedClass ? 'hub' : 'welcome');
        return true;
      };

      try {
        const healthResp = await fetch('/api/health', {
          credentials: 'include',
          cache: 'no-store',
        });
        const healthData = await healthResp.json().catch(() => ({} as Record<string, unknown>));

        if (cancelled) {
          return;
        }

        const backendTeacherName = String(healthData.username || '').trim();
        if (backendTeacherName) {
          setTeacherName(backendTeacherName);
          localStorage.setItem('amber_username', backendTeacherName);
        }

        if (!healthResp.ok || !healthData.loggedIn) {
          // Backend session lost (e.g. service restart) — restore from saved state if available
          if (restoreSavedState()) {
            return;
          }
          setClasses([]);
          setSelectedClass(null);
          setScreen('login');
          return;
        }

        // Use saved classes immediately to avoid slow getClassMap refresh
        if (restoreSavedState()) {
          return;
        }

        // No saved state — need to fetch classes from backend
        const classResp = await fetch('/api/scraper/get-classes', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const classData = await classResp.json().catch(() => ({} as Record<string, unknown>));

        if (cancelled) {
          return;
        }

        const liveClasses = normalizeClasses((classData as { data?: unknown }).data);
        if (classResp.ok && liveClasses.length > 0) {
          setClasses(liveClasses);
          const restoredSelectedClass = savedSelectedClassName
            ? liveClasses.find((item) => item.name === savedSelectedClassName) || null
            : null;
          setSelectedClass(restoredSelectedClass);
          setScreen(restoredSelectedClass ? 'hub' : 'welcome');
          return;
        }

        setClasses([]);
        setSelectedClass(null);
        setScreen('login');
      } catch {
        if (!cancelled && !restoreSavedState()) {
          setClasses([]);
          setSelectedClass(null);
          setScreen('login');
        }
      } finally {
        if (!cancelled) {
          setRestored(true);
        }
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist state on changes (after initial restore)
  const persist = useCallback(() => {
    if (!restored) return;
    saveAppState({ screen, teacherName, classes, selectedClass });
  }, [screen, teacherName, classes, selectedClass, restored]);

  useEffect(() => { persist(); }, [persist]);

  // Modules load on demand when needed — no eager warmup

  useEffect(() => {
    if (!restored) return;
    const moduleName = inferModuleFromScreen(screen);
    if (!moduleName) return;
    void trackUsageEvent({
      event: 'screen_view',
      module: moduleName,
      screen,
      teacherName,
      className: selectedClass?.name || '',
    });
  }, [restored, screen, teacherName, selectedClass?.name]);

  useEffect(() => {
    if (usageInsightsEnabled) return;
    if (screen !== 'usage-insights') return;
    startTransition(() => {
      setScreen('welcome');
    });
  }, [screen, usageInsightsEnabled]);

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
    void trackUsageEvent({
      event: 'select_class',
      module: 'class-hub',
      teacherName,
      className: cls.name,
      screen: 'hub',
    });
    startTransition(() => {
      setSelectedClass(cls);
      setScreen('hub');
    });
  }

  function handleNavigate(target: AppScreen) {
    if (target === 'usage-insights' && !usageInsightsEnabled) {
      return;
    }
    startTransition(() => {
      setScreen(target);
    });
  }

  function handleOpenTodoTarget(cls: ClassInfo, target: Extract<AppScreen, 'hub' | 'seating' | 'overview' | 'flow'>) {
    startTransition(() => {
      setSelectedClass(cls);
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
          onOpenTodoTarget={handleOpenTodoTarget}
        />
      )}
      {screen === 'roster' && (
        <Suspense fallback={<ScreenLoading />}>
          <ClassRosterApp
            key={`roster:${selectedClass?.name ?? 'none'}`}
            classInfo={selectedClass}
            knownClasses={classes}
            onBack={selectedClass ? handleBackToHub : handleBackToWelcome}
            onBackToHome={handleBackToWelcome}
            onSessionExpired={handleSessionExpired}
          />
        </Suspense>
      )}
      {screen === 'usage-insights' && usageInsightsEnabled && (
        <Suspense fallback={<ScreenLoading />}>
          <UsageInsightsApp onBack={handleBackToWelcome} />
        </Suspense>
      )}
      {screen === 'hub' && selectedClass && (
        <ClassHub
          classInfo={selectedClass}
          classes={classes}
          onNavigate={handleNavigate}
          onBack={handleBackToWelcome}
          onSwitchClass={handleSwitchClass}
        />
      )}
      {screen === 'flow' && selectedClass && (
        <Suspense fallback={<ScreenLoading />}>
          <DistributionFlow
            key={`flow:${selectedClass.name}`}
            classInfo={selectedClass}
            classes={classes}
            onBack={handleBackToHub}
            onBackToHome={handleBackToWelcome}
            onSwitchClass={handleSwitchClass}
            onSessionExpired={handleSessionExpired}
          />
        </Suspense>
      )}
      {selectedClass && screen === 'seating' && (
        <Suspense fallback={<ScreenLoading />}>
          <NewestSeatingFrame
            classCode={selectedClass.name}
            classes={classes}
            onBack={handleBackToHub}
            onBackToHome={handleBackToWelcome}
            onSwitchClass={handleSwitchClass}
            active
          />
        </Suspense>
      )}
      {screen === 'overview' && selectedClass && (
        <Suspense fallback={<ScreenLoading />}>
          <OverviewApp
            key={`overview:${selectedClass.name}`}
            classInfo={selectedClass}
            classes={classes}
            onBack={handleBackToHub}
            onBackToHome={handleBackToWelcome}
            onSwitchClass={handleSwitchClass}
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
            classes={classes}
            onBack={handleBackToHub}
            onBackToHome={handleBackToWelcome}
            onSwitchClass={handleSwitchClass}
          />
        </Suspense>
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
