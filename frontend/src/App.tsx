import { useState } from 'react';
import Login from './components/Login';
import Welcome from './components/Welcome';
import DistributionFlow from './components/DistributionFlow';
import type { AppScreen, ClassInfo } from './types';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('login');
  const [teacherName, setTeacherName] = useState('');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);

  function handleLogin(name: string, classList: ClassInfo[]) {
    setTeacherName(name);
    setClasses(classList);
    setScreen('welcome');
  }

  function handleSelectClass(cls: ClassInfo) {
    setSelectedClass(cls);
    setScreen('flow');
  }

  function handleBackToWelcome() {
    setSelectedClass(null);
    setScreen('welcome');
  }

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
        />
      )}
      {screen === 'flow' && selectedClass && (
        <DistributionFlow
          classInfo={selectedClass}
          onBack={handleBackToWelcome}
        />
      )}
    </>
  );
}
