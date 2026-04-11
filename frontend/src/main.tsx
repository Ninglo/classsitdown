import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

function migrateSeatingStorage(): void {
  if (typeof window === 'undefined') return;

  const currentKey = 'superamberClassData';
  const legacyKey = 'classSeatingData';

  try {
    const currentValue = window.localStorage.getItem(currentKey);
    const legacyValue = window.localStorage.getItem(legacyKey);

    if (currentValue && !legacyValue) {
      window.localStorage.setItem(legacyKey, currentValue);
      return;
    }

    if (!currentValue && legacyValue) {
      window.localStorage.setItem(currentKey, legacyValue);
      return;
    }

    if (currentValue && legacyValue) {
      const currentData = JSON.parse(currentValue) as Record<string, unknown>;
      const legacyData = JSON.parse(legacyValue) as Record<string, unknown>;
      if (
        currentData
        && legacyData
        && typeof currentData === 'object'
        && typeof legacyData === 'object'
        && !Array.isArray(currentData)
        && !Array.isArray(legacyData)
      ) {
        const merged = JSON.stringify({ ...legacyData, ...currentData });
        window.localStorage.setItem(currentKey, merged);
        window.localStorage.setItem(legacyKey, merged);
      }
    }
  } catch {
    // Ignore malformed local data and let runtime fallback handle empty state.
  }
}

migrateSeatingStorage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
