import { useEffect } from 'react';

interface Props {
  classCode: string;
  onBack: () => void;
}

export default function NewestSeatingFrame({ classCode, onBack }: Props) {
  const target = `/seating/?class=${encodeURIComponent(classCode)}`;

  useEffect(() => {
    window.location.assign(target);
  }, [target]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', borderRadius: 20, padding: 24, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(221,217,208,0.55)', boxShadow: '0 14px 38px rgba(120,100,80,0.1)', textAlign: 'center' }}>
        <strong style={{ display: 'block', fontSize: 20, color: '#33414f' }}>正在打开座位表</strong>
        <p style={{ margin: '10px 0 16px', fontSize: 14, color: '#6a746f' }}>{classCode}</p>
        <button
          type="button"
          onClick={() => window.location.assign(target)}
          style={{ border: 'none', borderRadius: 999, padding: '10px 18px', background: '#7ba862', color: '#fff', fontSize: 14 }}
        >
          如果没有自动跳转，点这里
        </button>
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={onBack}
            style={{ border: 'none', background: 'transparent', color: '#7b7b76', fontSize: 13 }}
          >
            返回上一页
          </button>
        </div>
      </div>
    </div>
  );
}
