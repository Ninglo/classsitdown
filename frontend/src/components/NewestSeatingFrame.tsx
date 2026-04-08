import { useEffect, useState } from 'react';
import { resolveSeatingKey } from '../utils/classProfiles';

interface Props {
  classCode: string;
  onBack: () => void;
  active: boolean;
}

export default function NewestSeatingFrame({ classCode, onBack, active }: Props) {
  // Use the actual key from classSeatingData (may differ in case from scraper's uppercase)
  const seatingKey = resolveSeatingKey(classCode) ?? classCode;
  const src = `/seating/?class=${encodeURIComponent(seatingKey)}`;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    type PreloadAsset = {
      rel: string;
      href: string;
      as?: string;
      type?: string;
      crossOrigin?: '' | 'anonymous' | 'use-credentials';
    };

    const assets: PreloadAsset[] = [
      { rel: 'modulepreload', href: '/seating/assets/index-BJkVfsNQ.js' },
      { rel: 'preload', href: '/seating/assets/index-C4B9Ofc0.css', as: 'style' },
      { rel: 'preload', href: '/seating/fonts/SmileySans-Oblique.ttf', as: 'font', type: 'font/ttf', crossOrigin: 'anonymous' },
    ];

    const created = assets.map((asset) => {
      const existing = document.head.querySelector(`link[href="${asset.href}"]`);
      if (existing) return null;
      const link = document.createElement('link');
      link.rel = asset.rel;
      link.href = asset.href;
      if (asset.as) link.as = asset.as;
      if (asset.type) link.type = asset.type;
      if (asset.crossOrigin !== undefined) link.crossOrigin = asset.crossOrigin;
      document.head.appendChild(link);
      return link;
    });

    return () => {
      created.forEach((link) => link?.remove());
    };
  }, []);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

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
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid rgba(221,217,208,0.55)',
          background: 'rgba(255,255,255,0.95)',
          flexShrink: 0,
        }}>
          <button className="back-btn" onClick={onBack}>← 返回</button>
          <span style={{ fontSize: 14, color: '#6a746f' }}>{classCode} · 座位表</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9aa39f' }}>
            {loaded ? '已预热' : '正在预加载'}
          </span>
        </div>
      )}
      {active && !loaded && (
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>
      )}
      <iframe
        src={src}
        style={{
          flex: 1, border: 'none', width: '100%',
          opacity: active && loaded ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
        onLoad={() => setLoaded(true)}
        loading="eager"
        title={`${classCode} 座位表`}
      />
    </div>
  );
}
