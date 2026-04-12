const events = [
    { title: 'BTC 급등 감지',    body: '24시간 내 +8.3% 이상 이동',  color: '#10d9a0' },
    { title: 'NVDA 이상 거래량', body: '평균 대비 340% 거래량 급증',  color: '#f5c842' },
    { title: '크로스마켓 신호',  body: 'S&P500↑ + BTC↑ 동시 강세', color: '#4f8eff' },
];

export default function EventAlert() {
    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">⚡ 이벤트 감지</span>
                <span className="card-badge badge-red">ALERT</span>
            </div>
            <div className="card-body">
                {events.map((e, i) => (
                    <div key={i} className="event-item">
                        <div className="event-dot" style={{ background: e.color }}></div>
                        <div>
                            <div className="event-title">{e.title}</div>
                            <div className="event-body">{e.body}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}