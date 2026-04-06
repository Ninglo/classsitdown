import { useState, useEffect, useCallback } from 'react';
import Login from './components/Login';
import Welcome from './components/Welcome';
import ClassHub from './components/ClassHub';
import DistributionFlow from './components/DistributionFlow';
import SeatingApp from './components/SeatingApp';
import ReLoginModal from './components/ReLoginModal';
import type { AppScreen, ClassInfo } from './types';
import { saveAppState, loadAppState } from './utils/appPersistence';

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

  function handleLogin(name: string, classList: ClassInfo[]) {
    setTeacherName(name);
    setClasses(classList);
    setScreen('welcome');
  }

  function handleSelectClass(cls: ClassInfo) {
    setSelectedClass(cls);
    setScreen('hub');
  }

  function handleNavigate(target: AppScreen) {
    setScreen(target);
  }

  function handleBackToHub() {
    setScreen('hub');
  }

  function handleBackToWelcome() {
    setSelectedClass(null);
    setScreen('welcome');
  }

  function handleLogout() {
    setTeacherName('');
    setClasses([]);
    setSelectedClass(null);
    setScreen('login');
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
        />
      )}
      {screen === 'hub' && selectedClass && (
        <ClassHub
          classInfo={selectedClass}
          onNavigate={handleNavigate}
          onBack={handleBackToWelcome}
        />
      )}
      {screen === 'flow' && selectedClass && (
        <DistributionFlow
          classInfo={selectedClass}
          onBack={handleBackToHub}
          onSessionExpired={handleSessionExpired}
        />
      )}
      {screen === 'seating' && selectedClass && (
        <SeatingApp
          classCode={selectedClass.name}
          onBack={handleBackToHub}
        />
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
