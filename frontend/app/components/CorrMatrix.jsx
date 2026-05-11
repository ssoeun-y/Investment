import { useEffect, useState } from 'react';

export default function CorrMatrix() {
    const [assets, setAssets] = useState([]);
    const [cells, setCells] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/market/correlation')
            .then(r => r.json())
            .then(json => {
                const result = json.result;
                setAssets(result.assets);
                setCells(result.cells);
            })
            .catch(err => console.error('CorrMatrix fetch 에러:', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="card"><div className="card-body">로딩 중...</div></div>;

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">🔗 주식↔코인 상관관계</span>
            </div>
            <div className="card-body">
                <div
                    className="corr-grid"
                    style={{ gridTemplateColumns: `repeat(${assets.length}, 1fr)` }}
                >
                    {cells.map((cell, idx) => {
                        const v = cell.value;
                        const isDiag = cell.x === cell.y;
                        const alpha = 0.08 + v * 0.55;
                        const bg = isDiag
                            ? 'var(--bg3)'
                            : v > 0.5
                                ? `rgba(16,217,160,${alpha})`
                                : `rgba(79,142,255,${alpha})`;
                        const tc = isDiag
                            ? 'var(--muted)'
                            : v > 0.5 ? 'var(--green)' : 'var(--blue)';
                        return (
                            <div key={idx} className="corr-cell" style={{ background: bg }}>
                                <div style={{ fontWeight: 600, color: tc }}>{v.toFixed(2)}</div>
                                <div className="corr-cell-label">{cell.x}</div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)' }}>
                    값이 클수록 강한 양의 상관 | BTC·NASDAQ·KOSPI 30일 기준
                </div>
            </div>
        </div>
    );
}