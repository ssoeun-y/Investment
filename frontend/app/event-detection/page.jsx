'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMarketData } from '../hooks/useMarketData';

// ─── 유틸 ─────────────────────────────────────────────────
const pct = n => n == null ? '--' : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const cl  = n => n == null ? 'var(--muted)' : n >= 0 ? '#10d9a0' : '#f05a5a';
const fmt = (n, d = 2) => n == null ? '--' : Number(n).toFixed(d);
const now = () => Date.now();

// ─── RSI ──────────────────────────────────────────────────
const calcRSI = (prices, period = 14) => {
    if (!prices || prices.length < period + 1) return null;
    let ag = 0, al = 0;
    for (let i = 1; i <= period; i++) {
        const d = prices[i] - prices[i - 1];
        if (d > 0) ag += d; else al += Math.abs(d);
    }
    ag /= period; al /= period;
    for (let i = period + 1; i < prices.length; i++) {
        const d = prices[i] - prices[i - 1];
        ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
        al = (al * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
    }
    return al === 0 ? 100 : 100 - (100 / (1 + ag / al));
};

// ─── ATR ──────────────────────────────────────────────────
const calcATR = (prices, period = 14) => {
    if (!prices || prices.length < period + 1) return null;
    const trs = [];
    for (let i = 1; i < prices.length; i++) {
        trs.push(Math.abs(prices[i] - prices[i - 1]));
    }
    return trs.slice(-period).reduce((s, v) => s + v, 0) / period;
};

// ─── MACD ─────────────────────────────────────────────────
const calcEMA = (prices, period) => {
    if (!prices || prices.length < period) return null;
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
    return ema;
};
const calcMACD = (prices) => {
    const ema12 = calcEMA(prices, 12);
    const ema26 = calcEMA(prices, 26);
    if (ema12 == null || ema26 == null) return null;
    return ema12 - ema26;
};

// ─── 볼린저 밴드 ───────────────────────────────────────────
const calcBB = (prices, period = 20) => {
    if (!prices || prices.length < period) return null;
    const slice = prices.slice(-period);
    const mean = slice.reduce((s, v) => s + v, 0) / period;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    const curr = prices[prices.length - 1];
    const pctB = std === 0 ? 50 : ((curr - (mean - 2 * std)) / (4 * std)) * 100;
    return { upper: mean + 2 * std, lower: mean - 2 * std, mid: mean, std, pctB, curr };
};

// ─── 트렌드 상태 ───────────────────────────────────────────
const getTrend = (prices, window = 12) => {
    if (!prices || prices.length < window + 1) return 'neutral';
    const slice = prices.slice(-window).map(p => p[1]);
    const first = slice[0], last = slice[slice.length - 1];
    const chg = ((last - first) / first) * 100;
    if (chg > 0.5) return 'up';
    if (chg < -0.5) return 'down';
    return 'neutral';
};

// ─── 핵심: 모든 자산 점수화 (항상 이벤트 생성) ─────────────
function scoreAsset(asset, history, rules, fearGreed) {
    const prices = history?.[asset.symbol];
    if (!prices || prices.length < 60) {
        // 데이터 부족해도 24h 변화 기반 기본 이벤트 생성
        return buildBasicEvent(asset, rules);
    }

    const priceArr    = prices.map(p => p[1]);
    const shortWindow = prices.slice(-12);
    const prevPrice   = shortWindow[0][1];
    const currPrice   = shortWindow.at(-1)[1];
    const chg1m       = ((currPrice - prevPrice) / prevPrice) * 100;

    const longWindow  = prices.slice(-60);
    const prevLong    = longWindow[0][1];
    const chg5m       = ((currPrice - prevLong) / prevLong) * 100;

    // 속도
    const dt       = (shortWindow.at(-1)[0] - shortWindow[0][0]) / 1000;
    const velocity = dt > 0 ? Math.abs(chg1m) / dt : 0;

    // 거래량 스파이크
    const recentVol = prices.slice(-12).reduce((s, v) => s + (v[2] || 0), 0);
    const prevVol   = prices.slice(-60, -12).reduce((s, v) => s + (v[2] || 0), 0) / 4;
    const volSpike  = prevVol > 0 ? recentVol / prevVol : 1;

    // 가속도
    const h1 = shortWindow.slice(0, 6), h2 = shortWindow.slice(6);
    const c1  = ((h1.at(-1)[1] - h1[0][1]) / h1[0][1]) * 100;
    const c2  = ((h2.at(-1)[1] - h2[0][1]) / h2[0][1]) * 100;
    const accelerating = c2 > c1;

    // 기술지표
    const rsi  = calcRSI(priceArr);
    const macd = calcMACD(priceArr);
    const bb   = calcBB(priceArr);
    const atr  = calcATR(priceArr);

    // 연속 상승
    const isContinuousUp = shortWindow.every((p, i, arr) => i === 0 || p[1] >= arr[i - 1][1]);
    const isContinuousDn = shortWindow.every((p, i, arr) => i === 0 || p[1] <= arr[i - 1][1]);

    // 트렌드
    const trend = getTrend(prices);

    // ── 점수 계산 (항상 양수, 강도 표현) ──────────────────
    let score = 0;
    const signals = [];
    const conditions = [];

    // 가격 변화 기여
    const absChg = Math.abs(chg1m);
    score += Math.min(absChg * 8, 35);
    if (absChg > 0.3) signals.push(chg1m > 0 ? '가격 상승 중' : '가격 하락 중');

    // 속도 기여
    score += Math.min(velocity * 20, 20);
    if (velocity > 0.01) signals.push('빠른 속도');

    // 거래량 기여
    score += Math.min((volSpike - 1) * 8, 20);
    if (volSpike >= 2) signals.push(`거래량 ${volSpike.toFixed(1)}배`);

    // 가속도
    if (accelerating) { score += 5; signals.push('가속 중'); }

    // RSI
    let rsiSignal = null;
    if (rsi != null) {
        if (rsi >= 70)      { score += 10; rsiSignal = `RSI ${rsi.toFixed(0)} 과열`; signals.push(rsiSignal); }
        else if (rsi <= 30) { score += 10; rsiSignal = `RSI ${rsi.toFixed(0)} 과매도`; signals.push(rsiSignal); }
        else if (rsi >= 60) { score += 5;  signals.push(`RSI ${rsi.toFixed(0)}`); }
    }

    // BB %B
    if (bb) {
        if (bb.pctB > 90)      { score += 8; signals.push('볼린저 상단 돌파'); }
        else if (bb.pctB < 10) { score += 8; signals.push('볼린저 하단 이탈'); }
    }

    // MACD
    if (macd != null && Math.abs(macd) > 0) {
        score += Math.min(Math.abs(macd) * 2, 8);
        if (macd > 0) signals.push('MACD 양수');
        else signals.push('MACD 음수');
    }

    // 연속 방향성
    if (isContinuousUp) { score += 5; signals.push('연속 상승'); }
    if (isContinuousDn) { score += 5; signals.push('연속 하락'); }

    score = Math.min(Math.round(score), 100);

    // ── 이벤트 유형 결정 ──────────────────────────────────
    let type, icon, color, title, body;
    const dir = chg1m >= 0;

    // 조건 우선순위
    if (volSpike >= 3 && absChg >= 1) {
        type  = 'VOLUME_SPIKE';
        icon  = '🔥';
        color = '#f5c842';
        title = `${asset.symbol} 거래량+가격 동반 급변`;
        body  = `${pct(chg1m)} · 거래량 ${volSpike.toFixed(1)}배 폭증`;
    } else if (rsi != null && (rsi >= 70 || rsi <= 30)) {
        type  = 'RSI';
        icon  = rsi >= 70 ? '🌡️' : '🧊';
        color = rsi >= 70 ? '#f05a5a' : '#4f8eff';
        title = `${asset.symbol} RSI ${rsi >= 70 ? '과열' : '과매도'} 진입`;
        body  = `RSI ${rsi.toFixed(1)} · ${pct(chg1m)}`;
    } else if (bb && bb.pctB > 90) {
        type  = 'BB_BREAKOUT';
        icon  = '💥';
        color = '#ff6b35';
        title = `${asset.symbol} 볼린저 상단 돌파`;
        body  = `%B = ${bb.pctB.toFixed(0)} · ${pct(chg1m)}`;
    } else if (bb && bb.pctB < 10) {
        type  = 'BB_BREAKOUT';
        icon  = '🎯';
        color = '#9945ff';
        title = `${asset.symbol} 볼린저 하단 이탈`;
        body  = `%B = ${bb.pctB.toFixed(0)} · ${pct(chg1m)}`;
    } else if (absChg >= 2 && accelerating) {
        type  = 'PRICE_CHANGE';
        icon  = dir ? '📈' : '📉';
        color = dir ? '#10d9a0' : '#f05a5a';
        title = `${asset.symbol} ${dir ? '급등' : '급락'} 가속`;
        body  = `${pct(chg1m)} · 속도 증가 중`;
    } else if (volSpike >= 2) {
        type  = 'VOLUME_SPIKE';
        icon  = '🔊';
        color = '#f5c842';
        title = `${asset.symbol} 거래량 급증`;
        body  = `평균 대비 ${volSpike.toFixed(1)}배 · ${pct(chg1m)}`;
    } else if (isContinuousUp || isContinuousDn) {
        type  = 'TREND';
        icon  = isContinuousUp ? '↗️' : '↘️';
        color = isContinuousUp ? '#10d9a0' : '#f05a5a';
        title = `${asset.symbol} ${isContinuousUp ? '연속 상승' : '연속 하락'} 진행`;
        body  = `1분 ${pct(chg1m)} · 추세 ${trend === 'up' ? '강세' : trend === 'down' ? '약세' : '중립'}`;
    } else {
        // baseline — 항상 있어야 하는 흐름 이벤트
        type  = 'STREAM';
        icon  = dir ? '▲' : '▼';
        color = dir ? '#10d9a0' : '#f05a5a';
        title = `${asset.symbol} ${dir ? '상승' : '하락'} 중`;
        body  = `${pct(chg1m)} · 거래량 ${volSpike.toFixed(1)}배`;
    }

    // ── 조건 체크 (활성 룰 필터링용) ─────────────────────
    rules.forEach(rule => {
        if (!rule.enabled) return;
        if (rule.type === 'PRICE_CHANGE' && absChg >= rule.value) conditions.push(rule.label);
        if (rule.type === 'VOLUME_SPIKE' && volSpike >= rule.value) conditions.push(rule.label);
        if (rule.type === 'RSI' && rsi != null) {
            if (rule.op === 'overbought' && rsi >= rule.value) conditions.push(rule.label);
            if (rule.op === 'oversold'   && rsi <= rule.value) conditions.push(rule.label);
        }
    });

    return {
        id:         `${asset.symbol}_${type}_${now()}`,
        type,
        asset:      asset.symbol,
        market:     '코인',
        title,
        body,
        score,
        color,
        icon,
        ts:         now(),
        trend,
        signals:    signals.slice(0, 4),
        conditions,
        why:        signals.length > 0 ? signals[0] : '시장 흐름 관찰 중',
        detail: {
            chg1m,
            chg5m,
            volSpike,
            rsi,
            macd,
            atr,
            bbPctB: bb?.pctB ?? null,
            velocity,
        },
        raw: { prevPrice, currPrice, priceArr: priceArr.slice(-30) },
    };
}

function buildBasicEvent(asset, rules) {
    const chg   = asset.change24h ?? asset.price_change_percentage_24h ?? 0;
    const price = asset.price     ?? asset.current_price ?? 0;
    const dir   = chg >= 0;
    const score = Math.min(Math.round(Math.abs(chg) * 4), 60);
    return {
        id:         `${asset.symbol}_basic_${now()}`,
        type:       'STREAM',
        asset:      asset.symbol,
        market:     '코인',
        title:      `${asset.symbol} ${dir ? '상승' : '하락'} 중`,
        body:       `24h ${pct(chg)} · $${price.toLocaleString()}`,
        score,
        color:      dir ? '#10d9a0' : '#f05a5a',
        icon:       dir ? '▲' : '▼',
        ts:         now(),
        trend:      dir ? 'up' : 'down',
        signals:    [dir ? '24h 강세' : '24h 약세'],
        conditions: [],
        why:        dir ? '24시간 강세 흐름' : '24시간 약세 흐름',
        detail:     { chg1m: chg, chg5m: chg, volSpike: 1, rsi: null, macd: null, atr: null, bbPctB: null, velocity: 0 },
        raw:        { prevPrice: price, currPrice: price, priceArr: [] },
    };
}

// ─── 기본 룰 ──────────────────────────────────────────────
const defaultRules = [
    { id: 1, type: 'PRICE_CHANGE',  op: 'up',         value: 1,  enabled: true,  label: '가격 급등',      desc: '1분 +1% 이상',     group: 'price' },
    { id: 2, type: 'PRICE_CHANGE',  op: 'down',       value: 1,  enabled: true,  label: '가격 급락',      desc: '1분 -1% 이상',     group: 'price' },
    { id: 3, type: 'VOLUME_SPIKE',  op: 'spike',      value: 2,  enabled: true,  label: '거래량 급증',    desc: '평균 대비 2배',     group: 'volume' },
    { id: 4, type: 'RSI',           op: 'overbought', value: 70, enabled: true,  label: 'RSI 과열',       desc: 'RSI ≥ 70',         group: 'indicator' },
    { id: 5, type: 'RSI',           op: 'oversold',   value: 30, enabled: true,  label: 'RSI 과매도',     desc: 'RSI ≤ 30',         group: 'indicator' },
    { id: 6, type: 'BB',            op: 'upper',      value: 90, enabled: true,  label: 'BB 상단 돌파',   desc: '%B ≥ 90',          group: 'indicator' },
    { id: 7, type: 'BB',            op: 'lower',      value: 10, enabled: true,  label: 'BB 하단 이탈',   desc: '%B ≤ 10',          group: 'indicator' },
    { id: 8, type: 'CROSS_MARKET',  op: 'both_up',    value: 0,  enabled: true,  label: '크로스 강세',    desc: 'BTC+나스닥 동시↑', group: 'market' },
    { id: 9, type: 'FEAR_GREED',    op: 'fear',       value: 20, enabled: true,  label: '극단 공포',      desc: 'FG ≤ 20',          group: 'sentiment' },
    { id: 10,type: 'FEAR_GREED',    op: 'greed',      value: 80, enabled: false, label: '극단 탐욕',      desc: 'FG ≥ 80',          group: 'sentiment' },
];

const typeColors = {
    PRICE_CHANGE: '#10d9a0',
    VOLUME_SPIKE: '#f5c842',
    BB_BREAKOUT:  '#ff6b35',
    RSI:          '#4f8eff',
    CROSS_MARKET: '#9945ff',
    FEAR_GREED:   '#f05a5a',
    TREND:        '#10d9a0',
    STREAM:       '#7a8b9a',
};

const typeLabels = {
    PRICE_CHANGE: '가격',
    VOLUME_SPIKE: '거래량',
    BB_BREAKOUT:  'BB',
    RSI:          'RSI',
    CROSS_MARKET: '크로스',
    FEAR_GREED:   '심리',
    TREND:        '추세',
    STREAM:       '흐름',
};

const groupColors = {
    price:     '#10d9a0',
    volume:    '#f5c842',
    indicator: '#4f8eff',
    market:    '#9945ff',
    sentiment: '#f05a5a',
};

// ─── 미니 스파크라인 ───────────────────────────────────────
const Sparkline = ({ data, color, width = 80, height = 28 }) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) =>
        `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`
    ).join(' ');
    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
        </svg>
    );
};

// ─── 강도 바 ───────────────────────────────────────────────
const ScoreBar = ({ score, color, animated }) => (
    <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
            width: `${score}%`, height: '100%', background: color, borderRadius: 2,
            transition: animated ? 'width 0.8s ease' : 'none',
        }} />
    </div>
);

// ─── 강도 뱃지 ─────────────────────────────────────────────
const ScoreBadge = ({ score }) => {
    const [label, color] = score >= 70 ? ['HIGH', '#f05a5a'] : score >= 40 ? ['MID', '#f5c842'] : ['LOW', '#10d9a0'];
    return (
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', color, background: color + '1a', padding: '2px 5px', borderRadius: 3, border: `1px solid ${color}44` }}>
            {label}
        </span>
    );
};

// ─── 트렌드 아이콘 ─────────────────────────────────────────
const TrendIcon = ({ trend }) => {
    const map = { up: { icon: '↑', color: '#10d9a0' }, down: { icon: '↓', color: '#f05a5a' }, neutral: { icon: '→', color: '#7a8b9a' } };
    const { icon, color } = map[trend] ?? map.neutral;
    return <span style={{ color, fontWeight: 800, fontSize: 11 }}>{icon}</span>;
};

// ─── 메인 컴포넌트 ─────────────────────────────────────────
export default function EventDetectionPage() {
    const { cryptoData, stockData, kospiData, fearGreed, fetchCrossMarketHistory } = useMarketData();

    const [rules,          setRules]          = useState(defaultRules);
    const [events,         setEvents]         = useState([]);
    const [history,        setHistory]        = useState(null);
    const [selectedEvent,  setSelectedEvent]  = useState(null);
    const [filterType,     setFilterType]     = useState('전체');
    const [filterScore,    setFilterScore]    = useState(0);
    const [filterDir,      setFilterDir]      = useState('전체');   // 전체 / 상승 / 하락
    const [eventLog,       setEventLog]       = useState([]);
    const [showBuilder,    setShowBuilder]    = useState(true);
    const [tab,            setTab]            = useState('feed');   // feed / log / stats
    const [topN,           setTopN]           = useState(10);
    const [pulse,          setPulse]          = useState(false);

    useEffect(() => {
        fetchCrossMarketHistory(7).then(setHistory);
    }, []);

    useEffect(() => {
        if (!cryptoData.length) return;

        // ✅ 필드명 정규화 + history 키 매핑
        const scored = cryptoData.map(asset => {
            const normalized = {
                ...asset,
                price:     asset.current_price,
                change24h: asset.price_change_percentage_24h,
                volume:    asset.total_volume,
            };
            // history는 { btc, nasdaq, kospi } 구조
            // asset.symbol 키로 접근할 수 있도록 매핑
            const mappedHistory = history ? {
                ...history,
                [asset.symbol]: history[asset.symbol.toLowerCase()] ?? history.btc ?? null,
                BTC: history.btc ?? null,
                ETH: history.btc ?? null, // ETH 전용 히스토리 없으면 BTC로 fallback
            } : null;

            return scoreAsset(normalized, mappedHistory, rules, fearGreed);
        });

        const sorted = scored.sort((a, b) => b.score - a.score);

        setEvents(sorted);

        // 로그 (상위 신호만 기록)
        const highScore = sorted.filter(e => e.score >= 30);
        if (highScore.length > 0) {
            setEventLog(prev => {
                const entries = highScore.map(e => ({ ...e, logTs: Date.now() }));
                return [...entries, ...prev].slice(0, 100);
            });
        }

        // 펄스 애니메이션
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
    }, [cryptoData, history, rules]);

    const router = useRouter();
    const toggleRule    = id => setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    const updateRuleVal = (id, v) => setRules(prev => prev.map(r => r.id === id ? { ...r, value: Number(v) } : r));

    // 필터링
    const filteredEvents = events
        .filter(e => {
            if (filterType !== '전체' && e.type !== filterType)                   return false;
            if (filterDir  === '상승' && e.detail.chg1m < 0)                      return false;
            if (filterDir  === '하락' && e.detail.chg1m >= 0)                     return false;
            if (e.score < filterScore)                                             return false;
            return true;
        })
        .slice(0, topN);

    // TOP 3 (항상 보여야 하는 핵심)
    const top3 = events.slice(0, 3);

    // 통계
    const stats = {
        total:  events.length,
        high:   events.filter(e => e.score >= 70).length,
        mid:    events.filter(e => e.score >= 40 && e.score < 70).length,
        low:    events.filter(e => e.score < 40).length,
        avgScore: events.length ? Math.round(events.reduce((s, e) => s + e.score, 0) / events.length) : 0,
        rising: events.filter(e => e.detail.chg1m > 0).length,
        falling: events.filter(e => e.detail.chg1m < 0).length,
        byType:  Object.fromEntries(
            Object.keys(typeLabels).map(t => [t, events.filter(e => e.type === t).length])
        ),
    };

    // ─── 스타일 헬퍼 ────────────────────────────────────────
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
        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        cursor: 'pointer', border: 'none',
        background: active ? bg : 'rgba(255,255,255,0.06)',
        color: active ? '#fff' : 'var(--muted)',
        transition: 'all 0.15s',
    });

    return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1440 }}>

            {/* ── 헤더 ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%', background: '#10d9a0',
                        boxShadow: pulse ? '0 0 12px #10d9a0' : '0 0 4px #10d9a0',
                        transition: 'box-shadow 0.3s',
                    }} />
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
                        시장 이벤트 스트림
                    </h2>
                </div>
                <span style={{ fontSize: 11, color: '#10d9a0', background: '#10d9a018', padding: '3px 10px', borderRadius: 20, border: '1px solid #10d9a033' }}>
                    {events.length}개 자산 모니터링
                </span>
                <span style={{ fontSize: 11, color: stats.high > 0 ? '#f05a5a' : 'var(--muted)', background: stats.high > 0 ? '#f05a5a18' : 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 20, border: `1px solid ${stats.high > 0 ? '#f05a5a33' : 'rgba(255,255,255,0.1)'}` }}>
                    고강도 {stats.high}개
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button onClick={() => setShowBuilder(v => !v)} style={pill(showBuilder)}>
                        🧩 이벤트 빌더
                    </button>
                </div>
            </div>

            {/* ── TOP 3: 항상 노출 ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {top3.map((e, i) => (
                    <div key={e.id} onClick={() => setSelectedEvent(selectedEvent?.id === e.id ? null : e)}
                        style={{
                            ...card(),
                            padding: '14px 16px',
                            borderColor: selectedEvent?.id === e.id ? e.color + '55' : 'rgba(255,255,255,0.07)',
                            background: selectedEvent?.id === e.id ? e.color + '0a' : 'rgba(255,255,255,0.02)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            overflow: 'visible',
                        }}>
                        {/* 순위 */}
                        <div style={{
                            position: 'absolute', top: -6, left: 12,
                            fontSize: 10, fontWeight: 800, color: i === 0 ? '#f5c842' : i === 1 ? '#aaa' : '#cd7f32',
                            background: 'var(--bg)', padding: '1px 6px', borderRadius: 4,
                        }}>
                            #{i + 1}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span style={{ fontSize: 18 }}>{e.icon}</span>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: e.color }}>{e.asset}</span>
                                    <ScoreBadge score={e.score} />
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{e.title}</div>
                                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{e.body}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: e.color, fontFamily: "'DM Mono', monospace" }}>
                                    {e.score}
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--muted)' }}>점수</div>
                            </div>
                        </div>

                        {/* 스파크라인 */}
                        <div style={{ marginBottom: 8 }}>
                            <Sparkline data={e.raw.priceArr} color={e.color} width={240} height={24} />
                        </div>

                        <ScoreBar score={e.score} color={e.color} animated />

                        {/* 왜 중요한가 */}
                        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: e.color }}>⬤</span> {e.why}
                        </div>

                        {/* 신호 태그 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                            {e.signals.map((s, si) => (
                                <span key={si} style={{ fontSize: 9, color: e.color, background: e.color + '18', padding: '1px 6px', borderRadius: 3, border: `1px solid ${e.color}22` }}>
                                    {s}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── 메인 바디 ── */}
            <div style={{ display: 'grid', gridTemplateColumns: showBuilder ? '300px 1fr' : '1fr', gap: 16 }}>

                {/* ── 이벤트 빌더 (접을 수 있음) ── */}
                {showBuilder && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={card()}>
                            <div style={cardHeader}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🧩 이벤트 빌더</span>
                                <span style={{ fontSize: 10, color: 'var(--muted)' }}>트리거 조건</span>
                            </div>
                            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {['price', 'volume', 'indicator', 'market', 'sentiment'].map(group => {
                                    const groupRules = rules.filter(r => r.group === group);
                                    const label = { price: '가격', volume: '거래량', indicator: '기술지표', market: '시장', sentiment: '심리' }[group];
                                    const gc = groupColors[group];
                                    return (
                                        <div key={group}>
                                            <div style={{ fontSize: 9, color: gc, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 4 }}>
                                                {label}
                                            </div>
                                            {groupRules.map(rule => (
                                                <div key={rule.id} style={{
                                                    padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                                                    background: rule.enabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                                                    border: `1px solid ${rule.enabled ? gc + '33' : 'rgba(255,255,255,0.04)'}`,
                                                    transition: 'all 0.2s',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {/* 토글 */}
                                                        <div onClick={() => toggleRule(rule.id)} style={{
                                                            width: 28, height: 16, borderRadius: 8, flexShrink: 0,
                                                            background: rule.enabled ? gc : 'rgba(255,255,255,0.1)',
                                                            cursor: 'pointer', position: 'relative', transition: 'all 0.2s',
                                                        }}>
                                                            <div style={{
                                                                position: 'absolute', top: 2,
                                                                left: rule.enabled ? 13 : 2,
                                                                width: 12, height: 12, borderRadius: '50%',
                                                                background: '#fff', transition: 'all 0.2s',
                                                            }} />
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: rule.enabled ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {rule.label}
                                                            </div>
                                                            <div style={{ fontSize: 9, color: 'var(--muted)' }}>{rule.desc}</div>
                                                        </div>
                                                        {/* 값 편집 */}
                                                        {rule.enabled && rule.type !== 'CROSS_MARKET' && (
                                                            <input type="number" value={rule.value}
                                                                onChange={e => updateRuleVal(rule.id, e.target.value)}
                                                                style={{
                                                                    width: 48, padding: '2px 5px', borderRadius: 4,
                                                                    border: `1px solid ${gc}33`, background: 'rgba(255,255,255,0.05)',
                                                                    color: 'var(--text)', fontSize: 11, textAlign: 'right',
                                                                }} />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 통계 카드 */}
                        <div style={card()}>
                            <div style={cardHeader}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>📊 시장 통계</span>
                                <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#10d9a0' }}>{stats.avgScore}점 평균</span>
                            </div>
                            <div style={{ padding: '8px 12px' }}>
                                {[
                                    { label: '전체 자산',    value: stats.total + '개',     color: 'var(--text)' },
                                    { label: '상승 중',      value: stats.rising + '개',    color: '#10d9a0' },
                                    { label: '하락 중',      value: stats.falling + '개',   color: '#f05a5a' },
                                    { label: '고강도 (70+)', value: stats.high + '개',      color: '#f05a5a' },
                                    { label: '중강도 (40+)', value: stats.mid + '개',       color: '#f5c842' },
                                    { label: '저강도',       value: stats.low + '개',       color: '#7a8b9a' },
                                ].map((s, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.label}</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── 오른쪽: 피드/로그/통계 ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* 탭 + 필터 */}
                    <div style={card({ padding: '10px 14px' })}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            {/* 탭 */}
                            <div style={{ display: 'flex', gap: 4 }}>
                                {[['feed', '📡 피드'], ['log', '📝 로그'], ['stats', '📊 분석']].map(([t, l]) => (
                                    <button key={t} onClick={() => setTab(t)} style={pill(tab === t)}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
                            {/* 유형 필터 */}
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {['전체', ...Object.keys(typeLabels)].filter((v, i, a) => a.indexOf(v) === i).map(t => (
                                    <button key={t} onClick={() => setFilterType(t)} style={pill(filterType === t, typeColors[t] ?? '#4f8eff')}>
                                        {t === '전체' ? '전체' : typeLabels[t]}
                                    </button>
                                ))}
                            </div>
                            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
                            {/* 방향 필터 */}
                            <div style={{ display: 'flex', gap: 4 }}>
                                {['전체', '상승', '하락'].map(d => (
                                    <button key={d} onClick={() => setFilterDir(d)} style={pill(filterDir === d, d === '상승' ? '#10d9a0' : '#f05a5a')}>
                                        {d}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                                <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>강도 {filterScore}+</span>
                                <input type="range" min={0} max={80} step={10} value={filterScore}
                                    onChange={e => setFilterScore(Number(e.target.value))}
                                    style={{ width: 70 }} />
                                <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>상위</span>
                                <select value={topN} onChange={e => setTopN(Number(e.target.value))}
                                    style={{ padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 11 }}>
                                    {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}개</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ── 피드 탭 ── */}
                    {tab === 'feed' && (
                        <div style={card()}>
                            <div style={cardHeader}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>📡 실시간 이벤트 스트림</span>
                                <span style={{ fontSize: 11, color: '#10d9a0', fontFamily: "'DM Mono', monospace" }}>
                                    {filteredEvents.length}개 표시
                                </span>
                            </div>
                            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {filteredEvents.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                                        <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                                        <div style={{ fontSize: 13 }}>조건을 완화하거나 필터를 조정하세요</div>
                                    </div>
                                ) : filteredEvents.map((e, i) => (
                                    <div key={e.id}
                                        onClick={() => setSelectedEvent(selectedEvent?.id === e.id ? null : e)}
                                        style={{
                                            padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                                            background: selectedEvent?.id === e.id ? e.color + '0d' : i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                                            border: `1px solid ${selectedEvent?.id === e.id ? e.color + '44' : 'rgba(255,255,255,0.05)'}`,
                                            transition: 'all 0.15s',
                                        }}>
                                        {/* 메인 행 */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {/* 순위 */}
                                            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'DM Mono', monospace", minWidth: 20, textAlign: 'right' }}>
                                                {(i + 1).toString().padStart(2, '0')}
                                            </span>

                                            {/* 아이콘 + 점수 */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 32 }}>
                                                <span style={{ fontSize: 16 }}>{e.icon}</span>
                                                <span style={{ fontSize: 9, fontWeight: 700, color: e.score >= 70 ? '#f05a5a' : e.score >= 40 ? '#f5c842' : '#7a8b9a', fontFamily: "'DM Mono', monospace" }}>
                                                    {e.score}
                                                </span>
                                            </div>

                                            {/* 핵심 정보 */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                    <span style={{ fontSize: 12, fontWeight: 800, color: e.color, letterSpacing: '-0.01em' }}>{e.asset}</span>
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)' }}>{e.title.replace(`${e.asset} `, '')}</span>
                                                    <span style={{ fontSize: 9, color: typeColors[e.type], background: typeColors[e.type] + '18', padding: '1px 5px', borderRadius: 3 }}>
                                                        {typeLabels[e.type]}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{e.body}</div>
                                            </div>

                                            {/* 왜 중요한가 */}
                                            <div style={{ minWidth: 80, textAlign: 'right' }}>
                                                <div style={{ fontSize: 10, color: e.color, fontWeight: 600 }}>{e.why}</div>
                                                <TrendIcon trend={e.trend} />
                                            </div>

                                            {/* 스파크라인 */}
                                            <div style={{ minWidth: 70, opacity: 0.8 }}>
                                                <Sparkline data={e.raw.priceArr} color={e.color} width={70} height={22} />
                                            </div>
                                        </div>

                                        {/* 점수바 */}
                                        <div style={{ marginTop: 8 }}>
                                            <ScoreBar score={e.score} color={e.color} animated />
                                        </div>

                                        {/* 드릴다운 */}
                                        {selectedEvent?.id === e.id && (
                                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${e.color}22` }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                                                    {[
                                                        { k: '1분 변화',  v: pct(e.detail.chg1m),              c: cl(e.detail.chg1m) },
                                                        { k: '5분 변화',  v: pct(e.detail.chg5m),              c: cl(e.detail.chg5m) },
                                                        { k: '거래량',    v: `${fmt(e.detail.volSpike, 1)}배`,  c: e.detail.volSpike >= 2 ? '#f5c842' : 'var(--text)' },
                                                        { k: 'RSI',       v: e.detail.rsi != null ? fmt(e.detail.rsi) : '--', c: e.detail.rsi >= 70 ? '#f05a5a' : e.detail.rsi <= 30 ? '#4f8eff' : 'var(--text)' },
                                                        { k: 'MACD',      v: e.detail.macd != null ? fmt(e.detail.macd) : '--', c: e.detail.macd > 0 ? '#10d9a0' : '#f05a5a' },
                                                        { k: 'BB %B',     v: e.detail.bbPctB != null ? fmt(e.detail.bbPctB, 0) : '--', c: e.detail.bbPctB > 80 ? '#f05a5a' : e.detail.bbPctB < 20 ? '#4f8eff' : 'var(--text)' },
                                                        { k: 'ATR',       v: e.detail.atr != null ? fmt(e.detail.atr) : '--', c: 'var(--text)' },
                                                        { k: '속도',      v: fmt(e.detail.velocity, 3),         c: 'var(--text)' },
                                                    ].map((item, di) => (
                                                        <div key={di} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                                                            <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.k}</div>
                                                            <div style={{ fontSize: 13, fontWeight: 700, color: item.c, fontFamily: "'DM Mono', monospace" }}>{item.v}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* 활성 신호 */}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                                                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>신호:</span>
                                                    {e.signals.map((s, si) => (
                                                        <span key={si} style={{ fontSize: 10, color: e.color, background: e.color + '18', padding: '2px 8px', borderRadius: 4, border: `1px solid ${e.color}22` }}>
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* 즉시 액션 */}
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>즉시 액션</span>
                                                    <button style={{ padding: '6px 18px', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none', background: '#10d9a0', color: '#000' }}
                                                        onClick={ev => { ev.stopPropagation(); router.push(`/simulator?symbol=${e.asset}&action=buy`); }}>
                                                        🟢 매수
                                                    </button>
                                                    <button style={{ padding: '6px 18px', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none', background: '#f05a5a', color: '#fff' }}
                                                        onClick={ev => { ev.stopPropagation(); router.push(`/simulator?symbol=${e.asset}&action=sell`); }}>
                                                        🔴 매도
                                                    </button>
                                                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <ScoreBadge score={e.score} />
                                                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                            강도 {e.score >= 70 ? '높음' : e.score >= 40 ? '중간' : '낮음'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── 로그 탭 ── */}
                    {tab === 'log' && (
                        <div style={card()}>
                            <div style={cardHeader}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>📝 이벤트 로그</span>
                                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{eventLog.length}건 기록</span>
                            </div>
                            <div style={{ padding: 12, maxHeight: 600, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                            {['#', '유형', '자산', '제목', '강도', '이유'].map(h => (
                                                <th key={h} style={{ padding: '6px 10px', fontSize: 10, color: 'var(--muted)', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {eventLog.slice(0, 50).map((e, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}>
                                                <td style={{ padding: '7px 10px', fontSize: 10, color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>{(i + 1).toString().padStart(2, '0')}</td>
                                                <td style={{ padding: '7px 10px' }}>
                                                    <span style={{ fontSize: 10, color: typeColors[e.type], background: typeColors[e.type] + '18', padding: '1px 5px', borderRadius: 3 }}>{typeLabels[e.type]}</span>
                                                </td>
                                                <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 800, color: e.color }}>{e.asset}</td>
                                                <td style={{ padding: '7px 10px', fontSize: 11, color: 'var(--text2)', maxWidth: 200 }}>{e.title}</td>
                                                <td style={{ padding: '7px 10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: e.score >= 70 ? '#f05a5a' : e.score >= 40 ? '#f5c842' : '#7a8b9a', fontFamily: "'DM Mono', monospace" }}>
                                                            {e.score}
                                                        </span>
                                                        <ScoreBadge score={e.score} />
                                                    </div>
                                                </td>
                                                <td style={{ padding: '7px 10px', fontSize: 10, color: 'var(--muted)' }}>{e.why}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── 분석 탭 ── */}
                    {tab === 'stats' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {/* 이벤트 유형 분포 */}
                            <div style={card()}>
                                <div style={cardHeader}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>유형별 분포</span>
                                </div>
                                <div style={{ padding: 16 }}>
                                    {Object.entries(stats.byType).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                                        <div key={type} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: 11, color: typeColors[type] }}>{typeLabels[type]}</span>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', fontFamily: "'DM Mono', monospace" }}>
                                                    {count}개 ({stats.total > 0 ? Math.round(count / stats.total * 100) : 0}%)
                                                </span>
                                            </div>
                                            <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
                                                <div style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%`, height: '100%', background: typeColors[type], borderRadius: 2, transition: 'width 0.6s ease' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 점수 분포 */}
                            <div style={card()}>
                                <div style={cardHeader}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>강도 분포</span>
                                </div>
                                <div style={{ padding: 16 }}>
                                    {[
                                        { label: '고강도 (70~100)', count: stats.high,   color: '#f05a5a', total: stats.total },
                                        { label: '중강도 (40~70)',  count: stats.mid,    color: '#f5c842', total: stats.total },
                                        { label: '저강도 (0~40)',   count: stats.low,    color: '#10d9a0', total: stats.total },
                                    ].map(({ label, count, color, total }) => (
                                        <div key={label} style={{ marginBottom: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
                                                <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>
                                                    {count}개
                                                </span>
                                            </div>
                                            <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3 }}>
                                                <div style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                                            </div>
                                        </div>
                                    ))}

                                    <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>전체 평균 강도</div>
                                        <div style={{ fontSize: 28, fontWeight: 800, color: stats.avgScore >= 70 ? '#f05a5a' : stats.avgScore >= 40 ? '#f5c842' : '#10d9a0', fontFamily: "'DM Mono', monospace" }}>
                                            {stats.avgScore}
                                            <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 4 }}>/ 100</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 상승 vs 하락 */}
                            <div style={{ ...card(), gridColumn: '1 / -1' }}>
                                <div style={cardHeader}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>방향성 분포</span>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <span style={{ fontSize: 11, color: '#10d9a0' }}>↑ 상승 {stats.rising}개 ({stats.total > 0 ? Math.round(stats.rising / stats.total * 100) : 0}%)</span>
                                        <span style={{ fontSize: 11, color: '#f05a5a' }}>↓ 하락 {stats.falling}개 ({stats.total > 0 ? Math.round(stats.falling / stats.total * 100) : 0}%)</span>
                                    </div>
                                </div>
                                <div style={{ padding: 16 }}>
                                    <div style={{ height: 20, background: 'rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden', display: 'flex' }}>
                                        <div style={{
                                            width: `${stats.total > 0 ? (stats.rising / stats.total) * 100 : 50}%`,
                                            background: 'linear-gradient(90deg, #10d9a0, #10d9a088)',
                                            transition: 'width 0.8s ease',
                                        }} />
                                        <div style={{
                                            flex: 1,
                                            background: 'linear-gradient(90deg, #f05a5a88, #f05a5a)',
                                        }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}