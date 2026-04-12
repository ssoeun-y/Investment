const riskItems = [
    { label: 'BTC',  score: 72, color: '#f5c842' },
    { label: 'ETH',  score: 58, color: '#10d9a0' },
    { label: 'NVDA', score: 45, color: '#10d9a0' },
    { label: 'TSLA', score: 83, color: '#f05a5a' },
    { label: 'SOL',  score: 67, color: '#f5c842' },
];

export default function RiskScore() {
    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">⚠️ 리스크 스코어</span>
                <span className="card-badge badge-red">AI 분석</span>
            </div>
            <div className="card-body">
                {riskItems.map((item, i) => (
                    <div key={i} className="risk-item">
            <span style={{ fontSize:12, fontWeight:500, minWidth:40, color:item.color }}>
              {item.label}
            </span>
                        <div className="risk-bar-wrap">
                            <div className="risk-bar" style={{ width: item.score + '%', background: item.color }}></div>
                        </div>
                        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, minWidth:30, textAlign:'right', color:item.color }}>
              {item.score}
            </span>
                    </div>
                ))}
            </div>
        </div>
    );
}