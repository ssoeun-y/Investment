'use client';
import { useState, useEffect } from 'react';

export default function EventAlert({ cryptoData = [] }) {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        if (!cryptoData || cryptoData.length === 0) return;

        const scored = cryptoData.map(c => {
            const chg = c.price_change_percentage_24h || 0;
            const vol = c.total_volume || 0;
            const absChg = Math.abs(chg);
            const score = absChg * 0.6 + (vol > 1e11 ? 10 : vol > 5e10 ? 5 : 0);
            const level = absChg >= 3 ? 'HIGH' : absChg >= 1 ? 'MID' : 'LOW';
            const icon  = absChg >= 3 ? '🔥' : absChg >= 1 ? '⚡' : 'ℹ️';
            const tags  = [];
            if (absChg >= 2) tags.push(chg > 0 ? '급등' : '급락');
            if (vol > 1e11)  tags.push('거래량 급증');
            if (absChg >= 1) tags.push(chg > 0 ? '상승 중' : '하락 중');

            return {
                symbol: c.symbol,
                chg, score, level, icon, tags,
                levelColor: level === 'HIGH' ? 'var(--red)' : level === 'MID' ? 'var(--yellow)' : 'var(--muted2)',
                levelBg:    level === 'HIGH' ? 'rgba(239,68,68,0.1)' : level === 'MID' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.08)',
            };
        });

        scored.sort((a, b) => b.score - a.score);
        setEvents(scored.slice(0, 5));
    }, [cryptoData]);

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">⚡ 이벤트 감지</span>
                <span className="card-badge badge-green">실시간</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                {events.length === 0 ? (
                    <div style={{ color: 'var(--muted2)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                        데이터 로딩 중...
                    </div>
                ) : events.map((ev, i) => (
                    <div key={ev.symbol} style={{
                        background: ev.levelBg,
                        borderRadius: 8, padding: '8px 12px',
                        borderLeft: `3px solid ${ev.levelColor}`,
                        display: 'flex', alignItems: 'center', gap: 10
                    }}>
                        <div style={{ fontSize: 18 }}>{ev.icon}</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{ev.symbol}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: ev.levelColor }}>{ev.level}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: ev.chg >= 0 ? 'var(--green)' : 'var(--red)', marginLeft: 'auto' }}>
                                    {ev.chg >= 0 ? '+' : ''}{ev.chg.toFixed(2)}%
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {ev.tags.map(tag => (
                                    <span key={tag} style={{
                                        fontSize: 10, padding: '2px 6px',
                                        background: 'var(--surface2)', borderRadius: 4,
                                        color: 'var(--muted2)'
                                    }}>{tag}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}