'use client';

export default function Portfolio() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 200, gap: 10, background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 12, color: 'var(--muted2)', fontSize: 13,
    }}>
      <span style={{ fontSize: 24 }}>📊</span>
      <span style={{ fontWeight: 600, color: 'var(--text)' }}>포트폴리오</span>
      <span>추후 구현 예정</span>
    </div>
  );
}
