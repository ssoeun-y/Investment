const threads = [
    { user: 'K', bg: 'rgba(79,142,255,0.1)',  color: '#4f8eff',  name: 'kimInvest',  time: '5분 전',   text: 'BTC 1억 돌파하면 다음 목표 1.2억 본다',              tags: ['BTC', '기술적분석'] },
    { user: 'P', bg: 'rgba(168,85,247,0.1)', color: '#a855f7',  name: 'parkCrypto', time: '18분 전',  text: 'NVDA AI 수요 계속 강해서 주식+코인 동반 상승 올 것', tags: ['NVDA', 'AI', 'BULL'] },
    { user: 'L', bg: 'rgba(16,217,160,0.1)',  color: '#10d9a0',  name: 'leeQuant',   time: '1시간 전', text: '공포탐욕지수 60대 유지. 아직 탐욕 과열은 아님',       tags: ['공포탐욕', '지표'] },
];

export default function CommunityThread() {
    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">💬 커뮤니티 핫토픽</span>
                <span className="card-badge badge-green">AI 요약</span>
            </div>
            <div className="card-body">
                {threads.map((t, i) => (
                    <div key={i} className="thread-item">
                        <div className="thread-meta">
                            <div className="avatar" style={{ background: t.bg, color: t.color }}>
                                {t.user}
                            </div>
                            <span className="thread-user">{t.name}</span>
                            <span className="thread-time">{t.time}</span>
                        </div>
                        <div className="thread-text">{t.text}</div>
                        <div className="thread-tags">
                            {t.tags.map(tag => (
                                <span key={tag} className="thread-tag">#{tag}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}