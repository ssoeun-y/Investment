'use client';
import { useState, useEffect } from 'react';

export default function RiskScore() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRisk = async () => {
            try {
                const res = await fetch('http://localhost:8080/api/market/risk');
                const json = await res.json();
                setData(json.result ?? null);
            } catch (e) {
                console.error('[RiskScore] fetch 실패:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchRisk();
        const id = setInterval(fetchRisk, 60000); // 1분 갱신
        return () => clearInterval(id);
    }, []);

    const score = data?.score ?? 0;
    const color = data?.color ?? '#94a3b8';
    const label = data?.label ?? '--';
    const avg   = data?.avgVolatility ?? '--';

    // 게이지 SVG (반원)
    const r = 54, cx = 70, cy = 70;
    const circ = Math.PI * r; // 반원 둘레
    const offset = circ - (score / 100) * circ;

    return (
        <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                📊 리스크 스코어
            </div>

            {loading ? (
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>로딩 중...</div>
            ) : (
                <>
                    {/* 반원 게이지 */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                        <svg width="140" height="80" viewBox="0 0 140 80">
                            {/* 배경 호 */}
                            <path
                                d="M 16 70 A 54 54 0 0 1 124 70"
                                fill="none" stroke="var(--border)" strokeWidth="10"
                                strokeLinecap="round"
                            />
                            {/* 값 호 */}
                            <path
                                d="M 16 70 A 54 54 0 0 1 124 70"
                                fill="none" stroke={color} strokeWidth="10"
                                strokeLinecap="round"
                                strokeDasharray={`${circ}`}
                                strokeDashoffset={`${offset}`}
                                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                            />
                            {/* 중앙 텍스트 */}
                            <text x="70" y="66" textAnchor="middle"
                                  fontSize="22" fontWeight="bold" fill={color}>
                                {score}
                            </text>
                        </svg>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <span style={{
                background: color + '22', color, border: `1px solid ${color}55`,
                borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600
            }}>
              {label}
            </span>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                            평균 변동률 {avg}%
                        </div>
                    </div>

                    {/* 상위 변동 코인 */}
                    {data?.breakdown?.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                            {data.breakdown.map((b, i) => {
                                const v = Number(b.change);
                                const c = v >= 0 ? '#22c55e' : '#ef4444';
                                return (
                                    <div key={i} style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        fontSize: 11, marginBottom: 3, color: 'var(--text)'
                                    }}>
                    <span style={{ color: 'var(--muted)' }}>
                      {String(b.symbol).toUpperCase()}
                    </span>
                                        <span style={{ color: c, fontWeight: 600 }}>
                      {v >= 0 ? '+' : ''}{v.toFixed(1)}%
                    </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}