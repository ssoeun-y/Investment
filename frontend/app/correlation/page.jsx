'use client';
import { useEffect, useState, useRef } from 'react';
import { useMarketData } from '../hooks/useMarketData';

// ─── 유틸 ─────────────────────────────────────────────────
const pct = n => n == null ? '--' : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const cl  = n => n == null ? 'var(--muted)' : n >= 0 ? '#10d9a0' : '#f05a5a';
const fmt = (n, d = 2) => n == null ? '--' : Number(n).toFixed(d);

// ─── 피어슨 상관계수 ───────────────────────────────────────
function pearson(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 5) return null;
    const ax = a.slice(-n), bx = b.slice(-n);
    const ma = ax.reduce((s, v) => s + v, 0) / n;
    const mb = bx.reduce((s, v) => s + v, 0) / n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
        const A = ax[i] - ma, B = bx[i] - mb;
        num += A * B; da += A * A; db += B * B;
    }
    return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

// ─── 수익률 시계열 변환 ────────────────────────────────────
function toReturns(prices) {
    const r = [];
    for (let i = 1; i < prices.length; i++) {
        r.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return r;
}

// ─── Lead-Lag 계산 ────────────────────────────────────────
function calcLeadLag(a, b, maxLag = 5) {
    let best = { lag: 0, corr: pearson(a, b) ?? 0 };
    for (let lag = 1; lag <= maxLag; lag++) {
        const corrPos = pearson(a.slice(0, -lag), b.slice(lag));
        const corrNeg = pearson(b.slice(0, -lag), a.slice(lag));
        if (corrPos != null && Math.abs(corrPos) > Math.abs(best.corr)) best = { lag: -lag, corr: corrPos };
        if (corrNeg != null && Math.abs(corrNeg) > Math.abs(best.corr)) best = { lag,       corr: corrNeg };
    }
    return best;
}

// ─── 상관관계 색상 ────────────────────────────────────────
function corrColor(v) {
    if (v == null) return 'rgba(255,255,255,0.04)';
    if (v >= 0.7)  return `rgba(16,217,160,${0.15 + v * 0.35})`;
    if (v >= 0.3)  return `rgba(245,200,66,${0.1  + v * 0.25})`;
    if (v >= 0)    return `rgba(255,255,255,${0.02 + v * 0.06})`;
    if (v >= -0.3) return `rgba(240,90,90,${0.05  + Math.abs(v) * 0.1})`;
    return             `rgba(240,90,90,${0.1       + Math.abs(v) * 0.3})`;
}
function corrTextColor(v) {
    if (v == null) return 'var(--muted)';
    if (v >= 0.7)  return '#10d9a0';
    if (v >= 0.3)  return '#f5c842';
    if (v >= 0)    return 'var(--text2)';
    return '#f05a5a';
}

// ─── 분산화 점수 ──────────────────────────────────────────
function diversificationScore(matrix, assets, selected) {
    const idx = selected.map(a => assets.indexOf(a)).filter(i => i >= 0);
    if (idx.length < 2) return null;
    let sum = 0, count = 0;
    for (let i = 0; i < idx.length; i++)
        for (let j = i + 1; j < idx.length; j++) {
            sum += Math.abs(matrix[idx[i]][idx[j]] ?? 0);
            count++;
        }
    const avgCorr = count > 0 ? sum / count : 0;
    return Math.max(0, Math.round((1 - avgCorr) * 100));
}

// ─── 더미 히스토리 생성 (실제 데이터 없을 때) ───────────────
function genDummy(base, vol, days, seed = 1) {
    const prices = [base];
    for (let i = 1; i < days; i++) {
        const rng = Math.sin(seed * i * 127.1 + i * 311.7) * 0.5 + 0.5;
        prices.push(prices[i - 1] * (1 + (rng - 0.5) * vol));
    }
    return prices;
}

const ASSETS = ['BTC', 'ETH', 'SOL', 'NVDA', 'AAPL', 'TSLA'];
const ASSET_META = {
    BTC:  { name: 'Bitcoin',  color: '#f5c842', type: 'crypto' },
    ETH:  { name: 'Ethereum', color: '#4f8eff', type: 'crypto' },
    SOL:  { name: 'Solana',   color: '#9945ff', type: 'crypto' },
    NVDA: { name: 'NVIDIA',   color: '#76b900', type: 'stock'  },
    AAPL: { name: 'Apple',    color: '#aaa',    type: 'stock'  },
    TSLA: { name: 'Tesla',    color: '#e82127', type: 'stock'  },
};

const WINDOWS = [
    { label: '7일',  days: 7  },
    { label: '30일', days: 30 },
    { label: '90일', days: 90 },
];

export default function CorrMatrix() {
    const { cryptoData, stockData, fetchCrossMarketHistory } = useMarketData();

    const [window,      setWindow]      = useState(30);
    const [matrix,      setMatrix]      = useState([]);
    const [returns,     setReturns]     = useState({});
    const [leadLag,     setLeadLag]     = useState({});
    const [alerts,      setAlerts]      = useState([]);
    const [selected,    setSelected]    = useState(['BTC', 'ETH', 'NVDA']);
    const [hoveredCell, setHoveredCell] = useState(null);
    const [aiInsight,   setAiInsight]   = useState('');
    const [aiLoading,   setAiLoading]   = useState(false);
    const [tab,         setTab]         = useState('heatmap'); // heatmap | rolling | leadlag | diversify
    const prevMatrix = useRef([]);

    // ─── 히스토리 로드 + 상관관계 계산 ───────────────────
    useEffect(() => {
        const load = async () => {
            const hist = await fetchCrossMarketHistory(90);

            // 실제 데이터가 있으면 사용, 없으면 더미
            const priceMap = {
                BTC:  hist?.btc?.map(p => p[1])  ?? genDummy(95000,  0.03, 90, 1),
                ETH:  hist?.eth?.map(p => p[1])  ?? genDummy(3500,   0.035,90, 2),
                SOL:  hist?.sol?.map(p => p[1])  ?? genDummy(180,    0.04, 90, 3),
                NVDA: hist?.nvda?.map(p => p[1]) ?? genDummy(870,    0.025,90, 4),
                AAPL: hist?.aapl?.map(p => p[1]) ?? genDummy(195,    0.018,90, 5),
                TSLA: hist?.tsla?.map(p => p[1]) ?? genDummy(250,    0.04, 90, 6),
            };

            // 수익률 변환
            const ret = {};
            ASSETS.forEach(a => { ret[a] = toReturns(priceMap[a]); });
            setReturns(ret);
        };
        load();
    }, []);

    // ─── 윈도우 변경 시 매트릭스 재계산 ─────────────────
    useEffect(() => {
        if (!Object.keys(returns).length) return;

        const sliced = {};
        ASSETS.forEach(a => { sliced[a] = returns[a]?.slice(-window) ?? []; });

        const mat = ASSETS.map(a =>
            ASSETS.map(b => a === b ? 1 : pearson(sliced[a], sliced[b]))
        );
        setMatrix(mat);

        // Lead-Lag
        const ll = {};
        ASSETS.forEach((a, i) => {
            ASSETS.forEach((b, j) => {
                if (i >= j) return;
                ll[`${a}_${b}`] = calcLeadLag(sliced[a], sliced[b]);
            });
        });
        setLeadLag(ll);

        // 상관관계 변화 알림
        if (prevMatrix.current.length) {
            const newAlerts = [];
            ASSETS.forEach((a, i) => {
                ASSETS.forEach((b, j) => {
                    if (i >= j) return;
                    const prev = prevMatrix.current[i]?.[j];
                    const curr = mat[i][j];
                    if (prev == null || curr == null) return;
                    const delta = Math.abs(curr - prev);
                    if (delta >= 0.15) {
                        newAlerts.push({
                            a, b,
                            prev: prev.toFixed(2),
                            curr: curr.toFixed(2),
                            delta: delta.toFixed(2),
                            dir: curr > prev ? '증가' : '감소',
                            color: curr > prev ? '#f5c842' : '#4f8eff',
                        });
                    }
                });
            });
            if (newAlerts.length) setAlerts(newAlerts);
        }
        prevMatrix.current = mat;
    }, [returns, window]);

    // ─── AI 인사이트 ──────────────────────────────────────
    const fetchAiInsight = async () => {
        if (!matrix.length) return;
        setAiLoading(true);
        setAiInsight('');
        try {
            const pairs = [];
            ASSETS.forEach((a, i) => {
                ASSETS.forEach((b, j) => {
                    if (i >= j) return;
                    pairs.push(`${a}↔${b}: ${matrix[i][j]?.toFixed(2) ?? 'N/A'}`);
                });
            });
            const prompt = `다음은 금융 자산들의 ${window}일 기준 상관관계 데이터입니다:\n${pairs.join('\n')}\n\n이 데이터를 바탕으로 한국어로 3~4문장의 투자 인사이트를 제공해주세요. 숫자를 그대로 나열하지 말고, 시장 관계와 투자 힌트 중심으로 설명해주세요.`;
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1000,
                    messages: [{ role: 'user', content: prompt }],
                }),
            });
            const data = await res.json();
            setAiInsight(data.content?.[0]?.text ?? '인사이트를 가져올 수 없습니다.');
        } catch {
            setAiInsight('AI 인사이트를 불러오는 데 실패했습니다.');
        }
        setAiLoading(false);
    };

    // ─── 분산화 점수 ──────────────────────────────────────
    const divScore = matrix.length ? diversificationScore(matrix, ASSETS, selected) : null;
    const divLabel = divScore == null ? '--' : divScore >= 70 ? '우수' : divScore >= 40 ? '보통' : '낮음';
    const divColor = divScore == null ? 'var(--muted)' : divScore >= 70 ? '#10d9a0' : divScore >= 40 ? '#f5c842' : '#f05a5a';

    // ─── 유사 자산 찾기 ───────────────────────────────────
    const similarTo = 'BTC';
    const similarRanking = matrix.length
        ? ASSETS
            .filter(a => a !== similarTo)
            .map(a => ({ asset: a, corr: matrix[ASSETS.indexOf(similarTo)][ASSETS.indexOf(a)] ?? 0 }))
            .sort((a, b) => b.corr - a.corr)
        : [];

    // ─── 트레이딩 힌트 ────────────────────────────────────
    const hints = [];
    if (matrix.length) {
        ASSETS.forEach((a, i) => {
            ASSETS.forEach((b, j) => {
                if (i >= j) return;
                const v = matrix[i][j];
                if (v == null) return;
                const ll = leadLag[`${a}_${b}`] ?? leadLag[`${b}_${a}`];
                if (ll && Math.abs(ll.lag) >= 1 && Math.abs(ll.corr) >= 0.5) {
                    const leader = ll.lag < 0 ? a : b;
                    const follower = ll.lag < 0 ? b : a;
                    hints.push({ leader, follower, lag: Math.abs(ll.lag), corr: ll.corr });
                }
            });
        });
    }

    // ─── 스타일 헬퍼 ─────────────────────────────────────
    const card = (extra = {}) => ({
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        overflow: 'hidden',
        ...extra,
    });
    const cardHeader = {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    };
    const pill = (active, bg = '#4f8eff') => ({
        padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        cursor: 'pointer', border: 'none',
        background: active ? bg : 'rgba(255,255,255,0.06)',
        color: active ? '#fff' : 'var(--muted)',
        transition: 'all 0.15s',
    });

    return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1400 }}>

            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>🔗 상관관계 분석</h2>
                <span style={{ fontSize: 11, color: '#4f8eff', background: '#4f8eff18', padding: '3px 10px', borderRadius: 20, border: '1px solid #4f8eff33' }}>
                    코인 ↔ 주식
                </span>
                {alerts.length > 0 && (
                    <span style={{ fontSize: 11, color: '#f5c842', background: '#f5c84218', padding: '3px 10px', borderRadius: 20, border: '1px solid #f5c84244' }}>
                        ⚠ 변화 감지 {alerts.length}건
                    </span>
                )}
                {/* 윈도우 선택 */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    {WINDOWS.map(w => (
                        <button key={w.days} onClick={() => setWindow(w.days)} style={pill(window === w.days)}>
                            {w.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 상관관계 변화 알림 */}
            {alerts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {alerts.map((a, i) => (
                        <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: '#f5c84210', border: '1px solid #f5c84233', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 16 }}>⚠️</span>
                            <div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#f5c842' }}>Correlation Shift — </span>
                                <span style={{ fontSize: 12, color: 'var(--text)' }}>
                                    {a.a} ↔ {a.b} 상관관계 {a.dir}:
                                </span>
                                <span style={{ fontSize: 12, color: a.color, fontFamily: "'DM Mono', monospace", marginLeft: 6 }}>
                                    {a.prev} → {a.curr}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 탭 */}
            <div style={{ display: 'flex', gap: 6 }}>
                {[['heatmap', '🌡️ 히트맵'], ['rolling', '📈 롤링 상관'], ['leadlag', '⏱ 선행 분석'], ['diversify', '🎯 분산화']].map(([t, l]) => (
                    <button key={t} onClick={() => setTab(t)} style={pill(tab === t, '#4f8eff')}>{l}</button>
                ))}
            </div>

            {/* ── 히트맵 탭 ── */}
            {tab === 'heatmap' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
                    <div style={card()}>
                        <div style={cardHeader}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>상관관계 히트맵</span>
                            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{window}일 기준</span>
                        </div>
                        <div style={{ padding: 16 }}>
                            {/* 컬럼 헤더 */}
                            <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${ASSETS.length}, 1fr)`, gap: 4, marginBottom: 4 }}>
                                <div />
                                {ASSETS.map(a => (
                                    <div key={a} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: ASSET_META[a].color, padding: '4px 0' }}>
                                        {a}
                                    </div>
                                ))}
                            </div>
                            {/* 행 */}
                            {ASSETS.map((a, i) => (
                                <div key={a} style={{ display: 'grid', gridTemplateColumns: `80px repeat(${ASSETS.length}, 1fr)`, gap: 4, marginBottom: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: ASSET_META[a].color }}>
                                        {a}
                                    </div>
                                    {ASSETS.map((b, j) => {
                                        const v = matrix[i]?.[j];
                                        const isHovered = hoveredCell && ((hoveredCell.r === i && hoveredCell.c === j) || (hoveredCell.r === j && hoveredCell.c === i));
                                        return (
                                            <div key={b}
                                                onMouseEnter={() => setHoveredCell({ r: i, c: j, a, b, v })}
                                                onMouseLeave={() => setHoveredCell(null)}
                                                style={{
                                                    height: 52, borderRadius: 8,
                                                    background: i === j ? 'rgba(255,255,255,0.06)' : corrColor(v),
                                                    border: isHovered ? `1px solid ${corrTextColor(v)}88` : '1px solid transparent',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'default', transition: 'all 0.15s',
                                                }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: i === j ? 'var(--muted)' : corrTextColor(v), fontFamily: "'DM Mono', monospace" }}>
                                                    {v != null ? v.toFixed(2) : '--'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* 범례 */}
                            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 10, color: 'var(--muted)' }}>-1</span>
                                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, rgba(240,90,90,0.6), rgba(255,255,255,0.1), rgba(16,217,160,0.6))' }} />
                                <span style={{ fontSize: 10, color: 'var(--muted)' }}>+1</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                <span style={{ fontSize: 9, color: '#f05a5a' }}>반대 움직임</span>
                                <span style={{ fontSize: 9, color: 'var(--muted)' }}>무관</span>
                                <span style={{ fontSize: 9, color: '#10d9a0' }}>같이 움직임</span>
                            </div>

                            {/* 호버 상세 */}
                            {hoveredCell && hoveredCell.a !== hoveredCell.b && (
                                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: corrTextColor(hoveredCell.v), marginBottom: 4 }}>
                                        {hoveredCell.a} ↔ {hoveredCell.b}: {hoveredCell.v?.toFixed(2) ?? '--'}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                        {hoveredCell.v >= 0.7  ? '매우 강한 양의 상관 — 같이 움직일 가능성 높음' :
                                         hoveredCell.v >= 0.3  ? '중간 양의 상관 — 어느 정도 같이 움직임' :
                                         hoveredCell.v >= -0.3 ? '약한 상관 — 거의 독립적으로 움직임' :
                                         hoveredCell.v >= -0.7 ? '중간 음의 상관 — 반대로 움직이는 경향' :
                                                                  '매우 강한 음의 상관 — 헤지 효과 기대 가능'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 유사 자산 랭킹 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={card()}>
                            <div style={cardHeader}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🔍 BTC와 유사한 자산</span>
                            </div>
                            <div style={{ padding: 12 }}>
                                {similarRanking.map((item, i) => (
                                    <div key={item.asset} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 16 }}>{i + 1}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: ASSET_META[item.asset].color, minWidth: 40 }}>{item.asset}</span>
                                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                            <div style={{ width: `${Math.abs(item.corr) * 100}%`, height: '100%', background: corrTextColor(item.corr), borderRadius: 2 }} />
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: corrTextColor(item.corr), fontFamily: "'DM Mono', monospace", minWidth: 36, textAlign: 'right' }}>
                                            {item.corr.toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 트레이딩 힌트 */}
                        <div style={card()}>
                            <div style={cardHeader}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>💡 트레이딩 힌트</span>
                            </div>
                            <div style={{ padding: 12 }}>
                                {hints.length === 0 ? (
                                    <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
                                        유의미한 선행 신호 없음
                                    </div>
                                ) : hints.slice(0, 3).map((h, i) => (
                                    <div key={i} style={{ padding: '8px 10px', marginBottom: 6, borderRadius: 8, background: '#10d9a010', border: '1px solid #10d9a033' }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#10d9a0', marginBottom: 2 }}>
                                            {h.leader} → {h.follower}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                            {h.leader} 움직임 후 약 {h.lag}일 뒤 {h.follower} 반응
                                        </div>
                                        <div style={{ fontSize: 10, color: '#f5c842', marginTop: 2 }}>
                                            상관: {h.corr.toFixed(2)} — {h.leader} 모니터링 추천
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 롤링 상관 탭 ── */}
            {tab === 'rolling' && (
                <div style={card()}>
                    <div style={cardHeader}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>📈 기간별 상관관계 변화</span>
                    </div>
                    <div style={{ padding: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                            {[7, 30, 90].map(days => {
                                const sliced = {};
                                ASSETS.forEach(a => { sliced[a] = returns[a]?.slice(-days) ?? []; });
                                const pairs = [];
                                ASSETS.forEach((a, i) => {
                                    ASSETS.forEach((b, j) => {
                                        if (i >= j) return;
                                        pairs.push({ a, b, corr: pearson(sliced[a], sliced[b]) });
                                    });
                                });
                                pairs.sort((x, y) => Math.abs(y.corr ?? 0) - Math.abs(x.corr ?? 0));
                                return (
                                    <div key={days} style={{ padding: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{days}일 기준</div>
                                        {pairs.slice(0, 6).map(({ a, b, corr }, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                                                    <span style={{ color: ASSET_META[a].color }}>{a}</span>
                                                    <span style={{ color: 'var(--muted)', margin: '0 4px' }}>↔</span>
                                                    <span style={{ color: ASSET_META[b].color }}>{b}</span>
                                                </span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: corrTextColor(corr), fontFamily: "'DM Mono', monospace" }}>
                                                    {corr?.toFixed(2) ?? '--'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 기간 비교 — 가장 많이 변한 쌍 */}
                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>📊 기간별 변화가 큰 쌍</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {(() => {
                                    const changes = [];
                                    ASSETS.forEach((a, i) => {
                                        ASSETS.forEach((b, j) => {
                                            if (i >= j) return;
                                            const c7  = pearson(returns[a]?.slice(-7)  ?? [], returns[b]?.slice(-7)  ?? []);
                                            const c90 = pearson(returns[a]?.slice(-90) ?? [], returns[b]?.slice(-90) ?? []);
                                            if (c7 == null || c90 == null) return;
                                            changes.push({ a, b, c7, c90, delta: c7 - c90 });
                                        });
                                    });
                                    return changes.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 4).map(({ a, b, c7, c90, delta }, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                                            <span style={{ fontSize: 12, minWidth: 80 }}>
                                                <span style={{ color: ASSET_META[a].color, fontWeight: 700 }}>{a}</span>
                                                <span style={{ color: 'var(--muted)', margin: '0 4px' }}>↔</span>
                                                <span style={{ color: ASSET_META[b].color, fontWeight: 700 }}>{b}</span>
                                            </span>
                                            <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 60, fontFamily: "'DM Mono', monospace" }}>90일: {c90.toFixed(2)}</span>
                                            <span style={{ fontSize: 14, color: 'var(--muted)' }}>→</span>
                                            <span style={{ fontSize: 11, color: corrTextColor(c7), fontWeight: 700, minWidth: 60, fontFamily: "'DM Mono', monospace" }}>7일: {c7.toFixed(2)}</span>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: delta > 0 ? '#10d9a0' : '#f05a5a', fontFamily: "'DM Mono', monospace" }}>
                                                {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}
                                            </span>
                                            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                {Math.abs(delta) > 0.3 ? '⚠ 큰 변화' : '완만한 변화'}
                                            </span>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Lead-Lag 탭 ── */}
            {tab === 'leadlag' && (
                <div style={card()}>
                    <div style={cardHeader}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>⏱ 선행-후행 분석</span>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>누가 먼저 움직이나?</span>
                    </div>
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {Object.entries(leadLag).map(([key, ll]) => {
                            const [a, b] = key.split('_');
                            const leader   = ll.lag < 0 ? a : b;
                            const follower = ll.lag < 0 ? b : a;
                            const lagDays  = Math.abs(ll.lag);
                            const strength = Math.abs(ll.corr);
                            return (
                                <div key={key} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ minWidth: 120 }}>
                                        <span style={{ fontSize: 13, fontWeight: 800, color: ASSET_META[leader]?.color ?? 'var(--text)' }}>{leader}</span>
                                        <span style={{ fontSize: 11, color: '#f5c842', margin: '0 6px' }}>→ {lagDays}일 후</span>
                                        <span style={{ fontSize: 13, fontWeight: 800, color: ASSET_META[follower]?.color ?? 'var(--text)' }}>{follower}</span>
                                    </div>
                                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                        <div style={{ width: `${strength * 100}%`, height: '100%', background: corrTextColor(ll.corr), borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: corrTextColor(ll.corr), fontFamily: "'DM Mono', monospace", minWidth: 40 }}>
                                        {ll.corr.toFixed(2)}
                                    </span>
                                    <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 80 }}>
                                        {strength >= 0.6 ? '🔥 강한 선행 신호' : strength >= 0.4 ? '💡 참고 가능' : '❓ 약한 신호'}
                                    </span>
                                </div>
                            );
                        })}
                        <div style={{ marginTop: 8, padding: '10px 14px', background: '#4f8eff0a', borderRadius: 8, border: '1px solid #4f8eff22', fontSize: 11, color: 'var(--muted)' }}>
                            💡 선행 신호가 강할수록 해당 자산의 움직임을 먼저 보고 후행 자산을 모니터링하면 유리합니다.
                        </div>
                    </div>
                </div>
            )}

            {/* ── 분산화 탭 ── */}
            {tab === 'diversify' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={card()}>
                        <div style={cardHeader}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🎯 포트폴리오 분산화 점수</span>
                        </div>
                        <div style={{ padding: 16 }}>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>자산 선택</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                {ASSETS.map(a => {
                                    const on = selected.includes(a);
                                    return (
                                        <button key={a} onClick={() => setSelected(prev => on ? prev.filter(x => x !== a) : [...prev, a])} style={{
                                            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                            cursor: 'pointer', border: `1px solid ${on ? ASSET_META[a].color + '66' : 'rgba(255,255,255,0.08)'}`,
                                            background: on ? ASSET_META[a].color + '18' : 'rgba(255,255,255,0.03)',
                                            color: on ? ASSET_META[a].color : 'var(--muted)',
                                        }}>{a}</button>
                                    );
                                })}
                            </div>

                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <div style={{ fontSize: 56, fontWeight: 800, color: divColor, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
                                    {divScore ?? '--'}
                                </div>
                                <div style={{ fontSize: 14, color: divColor, fontWeight: 700, marginTop: 6 }}>{divLabel}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>분산화 점수 (0~100)</div>
                            </div>

                            <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${divScore ?? 0}%`, height: '100%', background: `linear-gradient(90deg, #f05a5a, #f5c842, #10d9a0)`, transition: 'width 0.6s ease' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                <span style={{ fontSize: 9, color: '#f05a5a' }}>낮음 (집중)</span>
                                <span style={{ fontSize: 9, color: '#f5c842' }}>보통</span>
                                <span style={{ fontSize: 9, color: '#10d9a0' }}>높음 (분산)</span>
                            </div>

                            <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'var(--muted)' }}>
                                {divScore >= 70 ? '✅ 잘 분산된 포트폴리오입니다. 선택 자산들이 독립적으로 움직이는 경향이 있어요.' :
                                 divScore >= 40 ? '💡 적당한 분산도입니다. 상관관계가 낮은 자산을 추가하면 리스크를 줄일 수 있어요.' :
                                 divScore != null ? '⚠ 분산도가 낮습니다. 선택 자산들이 비슷하게 움직여 한쪽 하락 시 전체 손실 위험이 있어요.' :
                                 '자산을 2개 이상 선택해주세요.'}
                            </div>
                        </div>
                    </div>

                    {/* 선택 자산 간 상관관계 */}
                    <div style={card()}>
                        <div style={cardHeader}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>선택 자산 간 관계</span>
                        </div>
                        <div style={{ padding: 16 }}>
                            {selected.length < 2 ? (
                                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)', fontSize: 12 }}>자산을 2개 이상 선택하세요</div>
                            ) : selected.flatMap((a, i) =>
                                selected.slice(i + 1).map(b => {
                                    const ai = ASSETS.indexOf(a), bi = ASSETS.indexOf(b);
                                    const v = matrix[ai]?.[bi];
                                    return (
                                        <div key={`${a}-${b}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: ASSET_META[a].color }}>{a}</span>
                                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>↔</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: ASSET_META[b].color }}>{b}</span>
                                            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                                <div style={{ width: `${Math.abs(v ?? 0) * 100}%`, height: '100%', background: corrTextColor(v), borderRadius: 2 }} />
                                            </div>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: corrTextColor(v), fontFamily: "'DM Mono', monospace" }}>
                                                {v?.toFixed(2) ?? '--'}
                                            </span>
                                            <span style={{ fontSize: 9, color: 'var(--muted)' }}>
                                                {v >= 0.7 ? '위험' : v >= 0.3 ? '보통' : '양호'}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── AI 인사이트 (항상 하단) ── */}
            <div style={card()}>
                <div style={cardHeader}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🤖 AI 상관관계 인사이트</span>
                    <button onClick={fetchAiInsight} disabled={aiLoading} style={{
                        padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        cursor: aiLoading ? 'not-allowed' : 'pointer', border: 'none',
                        background: aiLoading ? 'rgba(255,255,255,0.05)' : '#4f8eff',
                        color: aiLoading ? 'var(--muted)' : '#fff',
                    }}>
                        {aiLoading ? '분석 중...' : '✨ 분석하기'}
                    </button>
                </div>
                <div style={{ padding: 16 }}>
                    {aiInsight ? (
                        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                            {aiInsight}
                        </div>
                    ) : (
                        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>
                            "분석하기" 버튼을 눌러 현재 상관관계에 대한 AI 인사이트를 받아보세요
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}