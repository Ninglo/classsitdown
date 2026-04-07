interface Props {
  classCode: string;
  onBack: () => void;
}

export default function NewestSeatingFrame({ classCode, onBack }: Props) {
  const target = `/seating/?class=${encodeURIComponent(classCode)}`;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f7fb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: '#ffffff', borderBottom: '1px solid #d8e0ea' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ border: 'none', borderRadius: 10, padding: '10px 14px', background: '#e8eef8', color: '#24415f', fontSize: 16, cursor: 'pointer' }}
        >
          ← 返回
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <strong style={{ fontSize: 18, color: '#1f2d3d' }}>最新座位表</strong>
          <span style={{ fontSize: 13, color: '#627487' }}>{classCode}</span>
        </div>
      </div>
      <iframe
        title={`最新座位表-${classCode}`}
        src={target}
        style={{ flex: 1, width: '100%', border: 'none', background: '#ffffff' }}
      />
    </div>
  );
}
