'use client';
import { useState, useEffect } from 'react';

const SEVERITY_STYLE = {
    HIGH:   { bg: '#ef444422', border: '#ef4444', icon: '🚨' },
    MEDIUM: { bg: '#f59e0b22', border: '#f59e0b', icon: '⚠️' },
    LOW:    { bg: '#3b82f622', border: '#3b82f6', icon: 'ℹ️' },
};

export default function EventAlert() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const res = await fetch('http://localhost:8080/api/market/events');
                const json = await res.json();
                setEvents(json.result ?? []);
            } catch (e) {
                console.error('[EventAlert] fetch 실패:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
        const id = setInterval(fetchEvents, 60000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                🔔 이벤트 감지
            </div>

            {loading ? (
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>로딩 중...</div>
            ) : events.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                    ✅ 현재 특이 이벤트 없음
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {events.map((ev, i) => {
                        const s = SEVERITY_STYLE[ev.severity] ?? SEVERITY_STYLE.LOW;
                        return (
                            <div key={i} style={{
                                background: s.bg,
                                border: `1px solid ${s.border}55`,
                                borderRadius: 8, padding: '6px 10px',
                                display: 'flex', alignItems: 'center', gap: 8
                            }}>
                                <span style={{ fontSize: 14 }}>{s.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>
                                        {ev.message}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}