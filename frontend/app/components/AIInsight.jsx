const insightItems = [
    { tag: 'BULL',  tagColor: '#10d9a0', text: 'BTC 기술적 저항선 돌파, 강세 모멘텀 지속 예상', time: '3분 전' },
    { tag: 'ALERT', tagColor: '#f05a5a', text: 'TSLA 옵션 시장 변동성 급등, 실적 발표 예고',    time: '12분 전' },
    { tag: 'CORR',  tagColor: '#4f8eff', text: 'AI 섹터-BTC 30일 상관계수 0.73 기록',         time: '1시간 전' },
];

export default function AIInsight() {
    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">🤖 AI 인사이트</span>
                <span className="card-badge badge-purple">LLM</span>
            </div>
            <div className="card-body">
                {insightItems.map((item, i) => (
                    <div key={i} className="insight-item">
                        <div className="insight-tag" style={{ color: item.tagColor }}>
                            ▸ {item.tag}
                        </div>
                        <div className="insight-text">{item.text}</div>
                        <div className="insight-time">{item.time}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}