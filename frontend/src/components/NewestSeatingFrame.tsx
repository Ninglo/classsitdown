import { useEffect, useRef, useState } from 'react';
import { resolveSeatingKey } from '../utils/classProfiles';

interface Props {
  classCode: string;
  classes?: { id: string; name: string }[];
  onBack: () => void;
  onBackToHome?: () => void;
  onSwitchClass?: (name: string) => void;
  active: boolean;
}

export default function NewestSeatingFrame({ classCode, classes, onBack, onBackToHome, onSwitchClass, active }: Props) {
  const seatingKey = resolveSeatingKey(classCode) ?? classCode;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function mountEmbeddedApp() {
      if (!hostRef.current) {
        return;
      }

      setLoaded(false);
      setLoadError('');

      try {
        const { mountSuperamberApp } = await import('../vendor/superamber/embed');
        if (cancelled || !hostRef.current) {
          return;
        }

        cleanup = mountSuperamberApp(hostRef.current, {
          launchClassName: seatingKey,
          embedded: true,
          setDocumentTitle: false,
        });

        if (!cancelled) {
          setLoaded(true);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : '座位表加载失败');
        }
      }
    }

    void mountEmbeddedApp();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [seatingKey]);

  return (
    <div
      aria-hidden={!active}
      style={active ? {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#fff',
        zIndex: 50,
      } : {
        position: 'absolute',
        inset: 0,
        width: 1,
        height: 1,
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      {active && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderBottom: '1px solid rgba(221,217,208,0.4)',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(16px)',
          flexShrink: 0,
        }}>
          {onBackToHome && (
            <button className="tool-home-rail" style={{ position: 'static' }} onClick={onBackToHome}>
              <span className="tool-home-rail-icon">←</span>
              <span>主页</span>
            </button>
          )}
          <button className="tool-back-btn" onClick={onBack}>← 返回</button>
          {classes && classes.length > 1 && onSwitchClass ? (
            <select className="tool-class-switch" value={classCode} onChange={(e) => onSwitchClass(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          ) : (
            <span className="tool-class-switch" style={{ cursor: 'default' }}>{classCode}</span>
          )}
          <span className="tool-topbar-label">· 座位表</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9aa39f' }}>
            {loadError ? '加载失败' : loaded ? '已预热' : '正在预加载'}
          </span>
        </div>
      )}
      {active && !loaded && !loadError && (
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>
      )}
      {active && loadError && (
        <div style={{ padding: 40, textAlign: 'center', color: '#c24d4d' }}>{loadError}</div>
      )}
      <div
        ref={hostRef}
        style={{
          flex: 1,
          minHeight: 0,
          opacity: active && loaded && !loadError ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
      />
    </div>
  );
}
