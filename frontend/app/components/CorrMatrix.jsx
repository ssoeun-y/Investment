const corrAssets = ['BTC', 'ETH', 'NVDA', 'AAPL', 'TSLA'];
const corrMatrix = [
    [1.00, 0.87, 0.73, 0.51, 0.62],
    [0.87, 1.00, 0.69, 0.48, 0.58],
    [0.73, 0.69, 1.00, 0.81, 0.74],
    [0.51, 0.48, 0.81, 1.00, 0.67],
    [0.62, 0.58, 0.74, 0.67, 1.00],
];

export default function CorrMatrix() {
    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">🔗 주식↔코인 상관관계</span>
            </div>
            <div className="card-body">
                <div className="corr-grid">
                    {corrAssets.flatMap((_, r) =>
                        corrAssets.map((asset, c) => {
                            const v     = corrMatrix[r][c];
                            const alpha = 0.08 + v * 0.55;
                            const bg    = r === c
                                ? 'var(--bg3)'
                                : v > 0.5
                                    ? `rgba(16,217,160,${alpha})`
                                    : `rgba(79,142,255,${alpha})`;
                            const tc = r === c
                                ? 'var(--muted)'
                                : v > 0.5 ? 'var(--green)' : 'var(--blue)';
                            return (
                                <div key={`${r}-${c}`} className="corr-cell" style={{ background: bg }}>
                                    <div style={{ fontWeight:600, color:tc }}>{v.toFixed(2)}</div>
                                    <div className="corr-cell-label">{asset}</div>
                                </div>
                            );
                        })
                    )}
                </div>
                <div style={{ marginTop:12, fontSize:11, color:'var(--muted)' }}>
                    값이 클수록 강한 양의 상관
                </div>
            </div>
        </div>
    );
}