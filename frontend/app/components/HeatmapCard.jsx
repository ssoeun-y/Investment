export default function HeatmapCard({ cryptoData }) {
    const heatmapCells = cryptoData.map(c => ({
        s: (c.symbol || '').toUpperCase().slice(0, 3),
        ch: c.price_change_percentage_24h || 0
    }));

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">🔥 섹터 히트맵</span>
                <span className="card-badge badge-amber">업비트</span>
            </div>
            <div className="card-body">
                <div className="heatmap-grid">
                    {heatmapCells.map((c, i) => {
                        const p  = Math.min(Math.abs(c.ch) / 15, 1);
                        const bg = c.ch >= 0
                            ? `rgba(16,217,160,${0.1 + p * 0.5})`
                            : `rgba(240,90,90,${0.1 + p * 0.5})`;
                        const tc = c.ch >= 0 ? 'var(--green)' : 'var(--red)';
                        return (
                            <div
                                key={i}
                                className="hm-cell"
                                style={{
                                    background: bg,
                                    color: tc,
                                    border: `1px solid ${c.ch >= 0 ? 'rgba(16,217,160,0.2)' : 'rgba(240,90,90,0.2)'}`
                                }}
                                title={`${c.s}: ${c.ch >= 0 ? '+' : ''}${c.ch.toFixed(2)}%`}
                            >
                                {c.s}
                            </div>
                        );
                    })}
                </div>
                <div style={{ marginTop:12, display:'flex', gap:8, alignItems:'center', fontSize:10, color:'var(--muted)', fontFamily:"'DM Mono',monospace" }}>
                    <span style={{ width:10, height:10, background:'var(--red-dim)',   border:'1px solid var(--red)',   borderRadius:2, display:'inline-block' }}></span>하락
                    <span style={{ width:10, height:10, background:'var(--green-dim)', border:'1px solid var(--green)', borderRadius:2, display:'inline-block' }}></span>상승
                </div>
            </div>
        </div>
    );
}