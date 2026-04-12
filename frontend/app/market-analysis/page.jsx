'use client';
import { useEffect, useState } from 'react';
import { useMarketData } from '../hooks/useMarketData';
import CrossMarketChart from '../components/CrossMarketChart';
import HeatmapCard from '../components/HeatmapCard';
import TickerTable from '../components/TickerTable';

const fmt  = (n, dec = 0) => n == null ? '--' : Number(n).toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct  = n => n == null ? '--' : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const cl   = n => n == null ? 'var(--muted)' : n >= 0 ? '#10d9a0' : '#f05a5a';

function buildMarketSummary(cryptoData, fearGreed, kospiData, history7d) {
    const btc      = cryptoData.find(c => c.symbol === 'BTC');
    const fg       = Number(fearGreed?.value ?? 50);
    const btcChg   = btc?.price_change_percentage_24h ?? 0;
    const kospiChg = kospiData?.change ?? 0;

    let btcTrend = '횡보';
    if (history7d?.btc?.length >= 2) {
        const chg = ((history7d.btc[history7d.btc.length-1][1] - history7d.btc[0][1]) / history7d.btc[0][1]) * 100;
        btcTrend = chg > 3 ? '상승' : chg < -3 ? '하락' : '횡보';
    }
    let nasdaqTrend = '횡보';
    if (history7d?.nasdaq?.length >= 2) {
        const chg = ((history7d.nasdaq[history7d.nasdaq.length-1][1] - history7d.nasdaq[0][1]) / history7d.nasdaq[0][1]) * 100;
        nasdaqTrend = chg > 2 ? '상승' : chg < -2 ? '하락' : '횡보';
    }

    let regime = 'Mixed', regimeKo = '혼조', badgeColor = '#f5c842';
    if (fg >= 60 && btcChg > 0 && kospiChg > 0)         { regime = 'Risk-On';         regimeKo = '위험자산 선호'; badgeColor = '#10d9a0'; }
    else if (fg <= 35 || (btcChg < -3 && kospiChg < -1)) { regime = 'Risk-Off';        regimeKo = '위험 회피';    badgeColor = '#f05a5a'; }
    else if (Math.abs(btcChg) > 5)                        { regime = 'High Volatility'; regimeKo = '고변동성';     badgeColor = '#f0a500'; }
    else if (btcChg > 2 && nasdaqTrend === '상승')         { regime = 'Risk-On';         regimeKo = '강세';         badgeColor = '#10d9a0'; }
    else if (btcChg < -2 && nasdaqTrend === '하락')        { regime = 'Risk-Off';        regimeKo = '약세';         badgeColor = '#f05a5a'; }

    let summary = '';
    if (regimeKo === '위험자산 선호') summary = '미국 기술주 강세가 코인 투자심리 회복으로 연결되며 위험자산 선호가 확대되는 흐름입니다.';
    else if (regimeKo === '강세')      summary = `BTC가 ${pct(btcChg)} 상승하며 나스닥 ${nasdaqTrend} 흐름과 동조화되고 있습니다.`;
    else if (regimeKo === '약세')      summary = '글로벌 위험자산 전반에 걸쳐 매도 압력이 확대되는 흐름입니다.';
    else if (regimeKo === '위험 회피') summary = '공포 심리가 우세하며 투자자들이 안전자산으로 이동하는 흐름입니다.';
    else if (regimeKo === '고변동성') summary = `BTC ${pct(btcChg)} 등 급격한 변동성 확대 구간입니다. 포지션 관리에 주의하세요.`;
    else summary = `BTC ${pct(btcChg)}, 코스피 ${pct(kospiChg)} 등 주요 자산이 혼조세를 보이고 있습니다.`;

    const reasons = [];
    if (nasdaqTrend === '상승') reasons.push('나스닥 7일 상승 추세 유지');
    else if (nasdaqTrend === '하락') reasons.push('나스닥 7일 하락 압력');
    reasons.push(btcChg > 0 ? `BTC 24h ${pct(btcChg)} 상승` : `BTC 24h ${pct(btcChg)} 하락`);
    if (fg >= 60)      reasons.push(`공포탐욕지수 ${fg} (탐욕 구간)`);
    else if (fg <= 35) reasons.push(`공포탐욕지수 ${fg} (공포 구간)`);
    else               reasons.push(`공포탐욕지수 ${fg} (중립 구간)`);
    reasons.push(kospiChg > 0 ? `코스피 ${pct(kospiChg)} 상승` : `코스피 ${pct(kospiChg)} 하락`);

    const warnings = [];
    if (fg >= 70)                          warnings.push('단기 과열 구간 — 조정 가능성 존재');
    if (fg <= 30)                          warnings.push('극단적 공포 — 추가 하락 가능성');
    if (btcTrend === '상승' && btcChg > 5) warnings.push('단기 급등 후 차익실현 매물 주의');
    if (btcTrend === '하락')               warnings.push('BTC 7일 하락 추세 — 추가 지지선 확인 필요');
    warnings.push('주요 경제 지표 발표 전후 변동성 확대 가능성');

    return { summary, regime, regimeKo, badgeColor, reasons: reasons.slice(0,3), warnings: warnings.slice(0,2), btcTrend, nasdaqTrend, fg, btcChg, kospiChg };
}

// ─── Market Drivers (단순화) ─────────────────────────────
function buildMarketDrivers(cryptoData, fearGreed, kospiData, history7d) {
    const btc    = cryptoData.find(c => c.symbol === 'BTC');
    const fg     = Number(fearGreed?.value ?? 50);
    const btcVol = btc?.total_volume ?? 0;
    const btcChg = btc?.price_change_percentage_24h ?? 0;

    // 유동성 (거래량 기반)
    const liquidity = [];
    if (btcVol > 1e12)
        liquidity.push({ text: `BTC 거래대금 ${(btcVol/1e12).toFixed(1)}조 — 대규모 자금 활발`, dir: 'up' });
    else if (btcVol > 5e11)
        liquidity.push({ text: `BTC 거래대금 ${(btcVol/1e8).toFixed(0)}억 — 보통 수준`, dir: 'neutral' });
    else
        liquidity.push({ text: `BTC 거래대금 저조 — 관망 심리 우세`, dir: 'down' });

    const topVol = [...cryptoData].sort((a,b) => (b.total_volume??0)-(a.total_volume??0)).slice(0,1);
    topVol.forEach(c => {
        const chg = c.price_change_percentage_24h ?? 0;
        if (chg > 3)       liquidity.push({ text: `${c.symbol} 거래량 급증 + 상승 — 매수 주도`, dir: 'up' });
        else if (chg < -3) liquidity.push({ text: `${c.symbol} 거래량 급증 + 하락 — 매도 주도`, dir: 'down' });
    });

    // 심리 (fearGreed 기반)
    const sentiment = [];
    if (fg <= 20)       sentiment.push({ text: `극단적 공포 (${fg}) — 투매 심리, 역발상 매수 구간 가능성`, dir: 'down' });
    else if (fg <= 35)  sentiment.push({ text: `공포 구간 (${fg}) — 안전자산 선호, 위험자산 회피`, dir: 'down' });
    else if (fg <= 50)  sentiment.push({ text: `중립 구간 (${fg}) — 방향성 탐색 중, 관망세`, dir: 'neutral' });
    else if (fg <= 65)  sentiment.push({ text: `탐욕 구간 (${fg}) — 위험자산 선호 확대`, dir: 'up' });
    else if (fg <= 80)  sentiment.push({ text: `과열 구간 (${fg}) — 단기 차익실현 가능성`, dir: 'neutral' });
    else                sentiment.push({ text: `극단적 탐욕 (${fg}) — 과열 주의, 조정 가능성`, dir: 'down' });

    if (btcChg > 5)       sentiment.push({ text: `BTC ${pct(btcChg)} 급등 — 심리 과열 신호`, dir: 'neutral' });
    else if (btcChg < -5) sentiment.push({ text: `BTC ${pct(btcChg)} 급락 — 패닉셀 가능성`, dir: 'down' });
    else if (btcChg > 2)  sentiment.push({ text: `BTC ${pct(btcChg)} 상승 — 심리 회복 중`, dir: 'up' });
    else if (btcChg < -2) sentiment.push({ text: `BTC ${pct(btcChg)} 하락 — 심리 위축`, dir: 'down' });

    return { liquidity: liquidity.slice(0,2), sentiment: sentiment.slice(0,2) };
}

function buildCrossAssetFlow(cryptoData, kospiData, kosdaqData, history7d) {
    const btc      = cryptoData.find(c => c.symbol === 'BTC');
    const eth      = cryptoData.find(c => c.symbol === 'ETH');
    const btcChg   = btc?.price_change_percentage_24h ?? 0;
    const ethChg   = eth?.price_change_percentage_24h ?? 0;
    const kospiChg = kospiData?.change ?? 0;

    const nasdaq7dChg = history7d?.nasdaq?.length >= 2
        ? ((history7d.nasdaq[history7d.nasdaq.length-1][1] - history7d.nasdaq[0][1]) / history7d.nasdaq[0][1]) * 100
        : null;

    let flowInterpretation = '', flowColor = '#f5c842';
    if (btcChg < -1 && nasdaq7dChg != null && nasdaq7dChg > 0)     { flowInterpretation = '코인 ↓ / 나스닥 ↑ → 위험자산 내 자금 이동 발생. 기술주로 자본 집중 중.'; flowColor = '#4f8eff'; }
    else if (btcChg > 1 && nasdaq7dChg != null && nasdaq7dChg > 0) { flowInterpretation = '코인 ↑ / 나스닥 ↑ → 전체 위험자산 동반 상승. Risk-On 국면.'; flowColor = '#10d9a0'; }
    else if (btcChg < -1 && kospiChg < -0.5)                        { flowInterpretation = '코인 ↓ / 한국 증시 ↓ → 전체 위험자산 동반 하락. 안전자산 선호.'; flowColor = '#f05a5a'; }
    else if (btcChg > 1 && kospiChg < -0.5)                         { flowInterpretation = '코인 ↑ / 한국 증시 ↓ → 글로벌 자금의 코인 시장 집중 가능성.'; flowColor = '#f5c842'; }
    else                                                              { flowInterpretation = '주요 자산 간 뚜렷한 방향성 없음. 혼조 흐름 지속 중.'; flowColor = '#f5c842'; }

    const flowItems = [
        { name: '코인 (BTC/ETH)', chg: (btcChg + ethChg) / 2, label: btcChg > 1 ? '자금 유입' : btcChg < -1 ? '자금 유출' : '관망' },
        { name: '미국 주식',      chg: nasdaq7dChg,            label: nasdaq7dChg == null ? '--' : nasdaq7dChg > 0 ? '매수 우위' : '매도 우위' },
        { name: '한국 증시',      chg: kospiChg,               label: kospiChg > 0.5 ? '외국인 매수' : kospiChg < -0.5 ? '외국인 매도' : '관망' },
    ];

    return { flowInterpretation, flowColor, flowItems };
}

function buildAssetComparison(cryptoData, history7d, kospiData) {
    const btc = cryptoData.find(c => c.symbol === 'BTC');
    const eth = cryptoData.find(c => c.symbol === 'ETH');
    const sol = cryptoData.find(c => c.symbol === 'SOL');

    const calc7d = (arr) => {
        if (!arr || arr.length < 2) return null;
        return ((arr[arr.length-1][1] - arr[0][1]) / arr[0][1]) * 100;
    };
    const calcVol = (arr) => {
        if (!arr || arr.length < 5) return null;
        const returns = [];
        for (let i = 1; i < arr.length; i++) returns.push((arr[i][1] - arr[i-1][1]) / arr[i-1][1] * 100);
        const mean = returns.reduce((a,b) => a+b, 0) / returns.length;
        return Math.sqrt(returns.reduce((a,b) => a + Math.pow(b-mean,2), 0) / returns.length);
    };

    const btc7d     = calc7d(history7d?.btc);
    const nasdaq7d  = calc7d(history7d?.nasdaq);
    const kospi7d   = calc7d(history7d?.kospi);
    const btcVol    = calcVol(history7d?.btc);
    const nasdaqVol = calcVol(history7d?.nasdaq);

    return [
        { name: 'BTC',    color: '#f5c842', chg24h: btc?.price_change_percentage_24h, chg7d: btc7d,    vol: btcVol,    type: '코인' },
        { name: 'ETH',    color: '#4f8eff', chg24h: eth?.price_change_percentage_24h, chg7d: null,     vol: null,      type: '코인' },
        { name: 'SOL',    color: '#9945ff', chg24h: sol?.price_change_percentage_24h, chg7d: null,     vol: null,      type: '코인' },
        { name: '나스닥', color: '#10d9a0', chg24h: history7d?.nasdaq?.length >= 2 ? ((history7d.nasdaq[history7d.nasdaq.length-1][1] - history7d.nasdaq[history7d.nasdaq.length-2][1]) / history7d.nasdaq[history7d.nasdaq.length-2][1]) * 100 : null, chg7d: nasdaq7d, vol: nasdaqVol, type: '미국주식' },
        { name: '코스피', color: '#f0a500', chg24h: kospiData?.change, chg7d: kospi7d, vol: null,      type: '한국주식' },
    ].sort((a, b) => (b.chg7d ?? b.chg24h ?? 0) - (a.chg7d ?? a.chg24h ?? 0));
}

function buildLeadingAssets(cryptoData, stockData) {
    const all = [
        ...cryptoData.map(c => ({ name: c.symbol, chg: c.price_change_percentage_24h, vol: c.total_volume, type: '코인' })),
        ...stockData.map(s  => ({ name: s.symbol,  chg: s.change,                     vol: s.volume,       type: '주식' })),
    ].filter(a => a.chg != null);

    const scored = all.map(a => ({
        ...a,
        score: Math.abs(a.chg ?? 0) * 0.6 + (a.vol ? Math.log(a.vol + 1) * 0.4 : 0)
    })).sort((a, b) => b.score - a.score);

    return {
        top:    scored.filter(a => a.chg > 0).slice(0, 3),
        bottom: scored.filter(a => a.chg < 0).slice(0, 2),
        volTop: [...all].sort((a, b) => (b.vol ?? 0) - (a.vol ?? 0)).slice(0, 3),
    };
}

// ─── 기술적 상태 (ETH/SOL 참고 자산으로 격하) ───────────
function buildTechnical(cryptoData, history7d) {
    const calcRSI = (prices, period = 14) => {
        if (!prices || prices.length < period + 1) return null;
        const closes = prices.map(p => p[1]);
        let gains = 0, losses = 0;
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i-1];
            if (diff > 0) gains += diff;
            else losses += Math.abs(diff);
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + avgGain / avgLoss));
    };
    const calcMA = (prices, n) => {
        if (!prices || prices.length < n) return null;
        return prices.slice(-n).reduce((s, p) => s + p[1], 0) / n;
    };
    const calcBollingerWidth = (prices, n = 20) => {
        if (!prices || prices.length < n) return null;
        const slice = prices.slice(-n).map(p => p[1]);
        const mean  = slice.reduce((a, b) => a + b, 0) / n;
        const std   = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b-mean, 2), 0) / n);
        return (std * 2) / mean * 100;
    };
    const calc7dMomentum = (arr) => {
        if (!arr || arr.length < 2) return null;
        return ((arr[arr.length-1][1] - arr[0][1]) / arr[0][1]) * 100;
    };
    const calcRecentBias = (arr) => {
        if (!arr || arr.length < 3) return null;
        const recent = arr.slice(-3);
        let up = 0, down = 0;
        for (let i = 1; i < recent.length; i++) recent[i][1] > recent[i-1][1] ? up++ : down++;
        return up > down ? '상승 우위' : down > up ? '하락 우위' : '중립';
    };
    const calcRange = (arr) => {
        if (!arr || arr.length < 2) return null;
        const prices = arr.map(p => p[1]);
        const high = Math.max(...prices), low = Math.min(...prices);
        return ((high - low) / (prices.reduce((a,b) => a+b,0)/prices.length)) * 100;
    };
    const calcVolSpike = () => {
        const btc = cryptoData.find(c => c.symbol === 'BTC');
        if (!btc?.total_volume) return null;
        return btc.total_volume > 1e12 ? '급증' : btc.total_volume > 5e11 ? '보통' : '감소';
    };

    const btcPrices = history7d?.btc    ?? [];
    const nasdaqArr = history7d?.nasdaq ?? [];
    const kospiArr  = history7d?.kospi  ?? [];

    const rsi        = calcRSI(btcPrices);
    const ma7        = calcMA(btcPrices, Math.min(7*24,  btcPrices.length));
    const ma25       = calcMA(btcPrices, Math.min(25*24, btcPrices.length));
    const bollWidth  = calcBollingerWidth(btcPrices);
    const volSpike   = calcVolSpike();
    const nasdaq7dMom = calc7dMomentum(nasdaqArr);
    const kospi7dMom  = calc7dMomentum(kospiArr);
    const nasdaqRange = calcRange(nasdaqArr);
    const kospiRange  = calcRange(kospiArr);
    const nasdaqBias  = calcRecentBias(nasdaqArr);
    const kospiBias   = calcRecentBias(kospiArr);
    const btcMaTrend  = ma7 && ma25 ? (ma7 > ma25 ? '상승' : '하락') : '--';
    const btcVolState = bollWidth != null ? (bollWidth > 4 ? '높음' : bollWidth > 2 ? '보통' : '낮음') : '--';

    // 핵심 자산 3개 (BTC, 나스닥, 코스피)
    const main = [
        {
            asset: 'BTC', color: '#f5c842', dataType: '시간별 데이터', quality: '데이터 기반',
            metrics: [
                { label: 'RSI(14)',  value: rsi != null ? rsi.toFixed(1) : '--',                         state: rsi == null ? '--' : rsi >= 70 ? '과열' : rsi <= 30 ? '과매도' : '정상', color: rsi == null ? 'var(--muted)' : rsi >= 70 ? '#f05a5a' : rsi <= 30 ? '#4f8eff' : '#10d9a0' },
                { label: 'MA 추세', value: ma7 && ma25 ? `MA7 ${ma7 > ma25 ? '>' : '<'} MA25` : '--',   state: btcMaTrend, color: btcMaTrend === '상승' ? '#10d9a0' : btcMaTrend === '하락' ? '#f05a5a' : '#f5c842' },
                { label: '변동성',  value: bollWidth != null ? `밴드폭 ${bollWidth.toFixed(1)}%` : '--', state: btcVolState, color: btcVolState === '높음' ? '#f05a5a' : btcVolState === '낮음' ? '#4f8eff' : '#f5c842' },
                { label: '거래량',  value: volSpike ?? '--',                                              state: volSpike,    color: volSpike === '급증' ? '#10d9a0' : volSpike === '감소' ? '#f05a5a' : '#f5c842' },
            ],
        },
        {
            asset: '나스닥', color: '#10d9a0', dataType: '일별 데이터', quality: '일별 데이터 기반',
            metrics: [
                { label: '7일 모멘텀', value: nasdaq7dMom != null ? (nasdaq7dMom >= 0 ? '+' : '') + nasdaq7dMom.toFixed(2) + '%' : '--', state: nasdaq7dMom == null ? '--' : nasdaq7dMom > 2 ? '상승' : nasdaq7dMom < -2 ? '하락' : '중립', color: nasdaq7dMom == null ? 'var(--muted)' : nasdaq7dMom > 0 ? '#10d9a0' : '#f05a5a' },
                { label: '최근 방향', value: nasdaqBias ?? '--', state: nasdaqBias, color: nasdaqBias === '상승 우위' ? '#10d9a0' : nasdaqBias === '하락 우위' ? '#f05a5a' : '#f5c842' },
                { label: '변동성',   value: nasdaqRange != null ? `Range ${nasdaqRange.toFixed(1)}%` : '--', state: nasdaqRange == null ? '--' : nasdaqRange > 3 ? '높음' : nasdaqRange > 1.5 ? '보통' : '낮음', color: nasdaqRange == null ? 'var(--muted)' : nasdaqRange > 3 ? '#f05a5a' : nasdaqRange > 1.5 ? '#f5c842' : '#10d9a0' },
            ],
        },
        {
            asset: '코스피', color: '#f0a500', dataType: '일별 데이터', quality: '일별 데이터 기반',
            metrics: [
                { label: '7일 모멘텀', value: kospi7dMom != null ? (kospi7dMom >= 0 ? '+' : '') + kospi7dMom.toFixed(2) + '%' : '--', state: kospi7dMom == null ? '--' : kospi7dMom > 1.5 ? '상승' : kospi7dMom < -1.5 ? '하락' : '중립', color: kospi7dMom == null ? 'var(--muted)' : kospi7dMom > 0 ? '#10d9a0' : '#f05a5a' },
                { label: '최근 방향', value: kospiBias ?? '--', state: kospiBias, color: kospiBias === '상승 우위' ? '#10d9a0' : kospiBias === '하락 우위' ? '#f05a5a' : '#f5c842' },
                { label: '변동성',   value: kospiRange != null ? `Range ${kospiRange.toFixed(1)}%` : '--', state: kospiRange == null ? '--' : kospiRange > 2 ? '높음' : kospiRange > 1 ? '보통' : '낮음', color: kospiRange == null ? 'var(--muted)' : kospiRange > 2 ? '#f05a5a' : kospiRange > 1 ? '#f5c842' : '#10d9a0' },
            ],
        },
    ];

    // 참고 자산 (ETH/SOL) - 단기 방향만
    const ref = ['ETH', 'SOL'].map(sym => {
        const c   = cryptoData.find(x => x.symbol === sym);
        const chg = c?.price_change_percentage_24h ?? null;
        return {
            name:  sym,
            color: sym === 'ETH' ? '#4f8eff' : '#9945ff',
            chg,
            state: chg == null ? '--' : chg > 2 ? '상승' : chg < -2 ? '하락' : '중립',
            stateColor: chg == null ? 'var(--muted)' : chg > 0 ? '#10d9a0' : '#f05a5a',
        };
    });

    return { main, ref };
}

// ─── Scenario (조건 개수 표시 제거) ──────────────────────
function buildScenario(cryptoData, fearGreed, kospiData, kosdaqData, history7d, usdKrw) {
    const btc    = cryptoData.find(c => c.symbol === 'BTC');
    const fg     = Number(fearGreed?.value ?? 50);
    const btcChg = btc?.price_change_percentage_24h ?? 0;
    const btcVol = btc?.total_volume ?? 0;

    const calc7dRet = (arr) => {
        if (!arr || arr.length < 2) return null;
        return ((arr[arr.length-1][1] - arr[0][1]) / arr[0][1]) * 100;
    };
    const calcRange7d = (arr) => {
        if (!arr || arr.length < 2) return null;
        const prices = arr.map(p => p[1]);
        const high = Math.max(...prices), low = Math.min(...prices);
        return ((high - low) / (prices.reduce((a,b)=>a+b,0)/prices.length)) * 100;
    };
    const calcTrend3d = (arr) => {
        if (!arr || arr.length < 3) return null;
        const recent = arr.slice(-3);
        let up = 0, down = 0;
        for (let i = 1; i < recent.length; i++) recent[i][1] > recent[i-1][1] ? up++ : down++;
        return up > down ? 'up' : down > up ? 'down' : 'neutral';
    };

    const btcRet7d      = calc7dRet(history7d?.btc);
    const nasdaqRet7d   = calc7dRet(history7d?.nasdaq);
    const kospiRet7d    = calc7dRet(history7d?.kospi);
    const nasdaqRange   = calcRange7d(history7d?.nasdaq);
    const nasdaqTrend3d = calcTrend3d(history7d?.nasdaq);
    const kospiTrend3d  = calcTrend3d(history7d?.kospi);

    const btcRet7dStr    = btcRet7d    != null ? (btcRet7d    >= 0 ? '+' : '') + btcRet7d.toFixed(2)    + '%' : '--';
    const nasdaqRet7dStr = nasdaqRet7d != null ? (nasdaqRet7d >= 0 ? '+' : '') + nasdaqRet7d.toFixed(2) + '%' : '--';
    const nasdaqRangeStr = nasdaqRange != null ? nasdaqRange.toFixed(1) + '%' : '--';
    const kospiRet7dStr  = kospiRet7d  != null ? (kospiRet7d  >= 0 ? '+' : '') + kospiRet7d.toFixed(2)  + '%' : '--';

    // ── BTC ──
    const btcBase = btcRet7d != null && btcRet7d > 3 && fg > 40
        ? `7일 ${btcRet7dStr} 상승, 공포탐욕 ${fg} — 상승 추세 유지 구간`
        : btcRet7d != null && btcRet7d < -3 && fg < 40
        ? `7일 ${btcRet7dStr} 하락, 공포탐욕 ${fg} — 하락 추세 지속 구간`
        : `7일 ${btcRet7dStr}, 공포탐욕 ${fg} — 방향성 탐색 중`;

    // 조건은 내부 계산만, 화면엔 결과 문장만
    const btcBullMet = [btcRet7d != null && btcRet7d > 0, btcVol > 5e11, fg > 50, nasdaqRet7d != null && nasdaqRet7d > 0].filter(Boolean).length;
    const btcBull = btcBullMet >= 3
        ? '거래량 증가 + 나스닥 동반 상승 시 추가 상승 탄력 가능'
        : btcBullMet >= 2
        ? '거래량 회복 + 공포탐욕 개선 시 돌파 시도 가능'
        : '나스닥 강세 + 거래량 급증 전환 시 반등 가능';

    const btcBearMet = [btcRet7d != null && btcRet7d < 0, fg < 30, btcVol < 3e11, nasdaqRet7d != null && nasdaqRet7d < 0].filter(Boolean).length;
    const btcBear = btcBearMet >= 3
        ? '공포 심리 지속 + 나스닥 약세 시 추가 하락 가능'
        : btcBearMet >= 2
        ? '주요 지지선 이탈 시 변동성 확대 가능'
        : '규제 이슈 또는 나스닥 급락 시 연동 하락 가능';

    // ── 나스닥 ──
    const nasdaqBase = nasdaqRet7d != null && nasdaqRet7d > 2 && nasdaqTrend3d === 'up'
        ? `7일 ${nasdaqRet7dStr} 상승 + 최근 3일 상승 — 상승 추세 유지 구간`
        : nasdaqRet7d != null && nasdaqRet7d < -2 && nasdaqTrend3d === 'down'
        ? `7일 ${nasdaqRet7dStr} 하락 + 최근 3일 하락 — 하락 추세 지속 구간`
        : `7일 ${nasdaqRet7dStr}, 변동성 ${nasdaqRangeStr} — 방향성 부재 / 박스권`;

    const nasdaqBullMet = [nasdaqRet7d != null && nasdaqRet7d > 0, nasdaqRange != null && nasdaqRange < 3, nasdaqTrend3d === 'up'].filter(Boolean).length;
    const nasdaqBull = nasdaqBullMet >= 2
        ? `매수세 유지 + 변동성 안정(${nasdaqRangeStr}) 시 상승 지속`
        : '빅테크 실적 서프라이즈 + 금리 인하 기대 시 반등 가능';

    const nasdaqBearMet = [nasdaqRet7d != null && nasdaqRet7d < 0, nasdaqRange != null && nasdaqRange > 3, nasdaqTrend3d === 'down'].filter(Boolean).length;
    const nasdaqBear = nasdaqBearMet >= 2
        ? `변동성 확대(${nasdaqRangeStr}) + 매도세 지속 시 하락 압력`
        : 'CPI 쇼크 또는 FOMC 매파 발언 시 급락 가능';

    // ── 코스피 (환율 proxy) ──
    const fxState = usdKrw == null ? 'neutral' : usdKrw > 1380 ? 'weak' : usdKrw < 1320 ? 'strong' : 'neutral';
    const fxStr   = usdKrw != null ? `USD/KRW ${usdKrw.toFixed(0)}` : '환율 로딩 중';
    const fxLabel = fxState === 'weak' ? '원화 약세' : fxState === 'strong' ? '원화 강세' : '환율 중립';
    const relative = (kospiRet7d ?? 0) - (nasdaqRet7d ?? 0);
    const relativeStr = (relative >= 0 ? '+' : '') + relative.toFixed(2) + '%';

    const kospiBase = nasdaqRet7d != null && nasdaqRet7d > 2
        ? `나스닥 ${nasdaqRet7dStr} 상승 연동 — 글로벌 상승 흐름 반영 중 | 코스피 ${kospiRet7dStr} | ${fxStr}(${fxLabel})`
        : nasdaqRet7d != null && nasdaqRet7d < -2
        ? `나스닥 ${nasdaqRet7dStr} 하락 영향 — 글로벌 약세 영향권 | 코스피 ${kospiRet7dStr} | ${fxStr}(${fxLabel})`
        : `나스닥 혼조 속 코스피 ${kospiRet7dStr} — 방향성 제한 | ${fxStr}(${fxLabel}) | 상대강도 ${relativeStr}`;

    const kospiBullMet = [nasdaqRet7d != null && nasdaqRet7d > 0, fxState === 'strong', relative >= 0].filter(Boolean).length;
    const kospiBull = kospiBullMet >= 2
        ? `글로벌 강세(나스닥 ${nasdaqRet7dStr}) + ${fxStr} 원화 강세 — 수급 우호 시 상승 탄력`
        : `나스닥 반등 + 원화 강세 전환 시 상승 가능`;

    const kospiBearMet = [nasdaqRet7d != null && nasdaqRet7d < 0, fxState === 'weak', relative <= 0].filter(Boolean).length;
    const kospiBear = kospiBearMet >= 2
        ? `나스닥 약세 + ${fxStr} 원화 약세 — 글로벌 + 환율 부담 시 하락 압력`
        : `달러 강세 + 나스닥 급락 시 연동 하락 가능`;

    return [
        { asset: 'BTC',    color: '#f5c842', base: btcBase,    bull: btcBull,    bear: btcBear    },
        { asset: '나스닥', color: '#10d9a0', base: nasdaqBase, bull: nasdaqBull, bear: nasdaqBear },
        { asset: '코스피', color: '#f0a500', base: kospiBase,  bull: kospiBull,  bear: kospiBear  },
    ];
}

function buildRiskDashboard(cryptoData, fearGreed, history7d) {
    const btc    = cryptoData.find(c => c.symbol === 'BTC');
    const fg     = Number(fearGreed?.value ?? 50);
    const btcChg = btc?.price_change_percentage_24h ?? 0;
    const btcVol = btc?.total_volume ?? 0;

    const btcPrices = history7d?.btc ?? [];
    let volatility = 0;
    if (btcPrices.length >= 5) {
        const returns = [];
        for (let i = 1; i < btcPrices.length; i++) returns.push(Math.abs((btcPrices[i][1] - btcPrices[i-1][1]) / btcPrices[i-1][1] * 100));
        volatility = returns.reduce((a,b) => a+b,0) / returns.length;
    }

    return [
        { label: '변동성',       level: volatility > 1.5 ? '높음' : volatility > 0.7 ? '보통' : '낮음', score: volatility > 1.5 ? 80 : volatility > 0.7 ? 50 : 25, desc: `7일 평균 시간당 변동 ${volatility.toFixed(2)}%`, icon: '📊' },
        { label: '과열도',       level: fg >= 75 ? '과열' : fg >= 60 ? '주의' : fg <= 25 ? '과매도' : '정상', score: fg >= 75 ? 85 : fg >= 60 ? 60 : fg <= 25 ? 20 : fg <= 40 ? 35 : 50, desc: `공포탐욕지수 ${fg} (${fearGreed?.value_classification ?? '--'})`, icon: '🌡️' },
        { label: '유동성',       level: btcVol > 1e12 ? '활발' : btcVol > 5e11 ? '보통' : '저조', score: btcVol > 1e12 ? 80 : btcVol > 5e11 ? 55 : 30, desc: `BTC 거래대금 ${btcVol > 1e8 ? (btcVol/1e8).toFixed(0)+'억' : '--'}`, icon: '💧' },
        { label: '이벤트 리스크',level: Math.abs(btcChg) > 5 ? '높음' : Math.abs(btcChg) > 3 ? '주의' : '낮음', score: Math.abs(btcChg) > 5 ? 75 : Math.abs(btcChg) > 3 ? 50 : 25, desc: `24h 최대 변동 ${pct(btcChg)}`, icon: '⚡' },
    ];
}

// ─── 컴포넌트 ─────────────────────────────────────────────
export default function MarketAnalysisPage() {
    const { cryptoData, stockData, kospiData, kosdaqData, fearGreed, fetchCrossMarketHistory } = useMarketData();
    const [chartsReady, setChartsReady] = useState(false);
    const [history7d, setHistory7d]     = useState(null);
    const [usdKrw, setUsdKrw]           = useState(null);

    useEffect(() => {
        if (window.Chart) { setChartsReady(true); }
        else {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            s.onload = () => setChartsReady(true);
            document.head.appendChild(s);
        }
    }, []);

    useEffect(() => { fetchCrossMarketHistory(7).then(setHistory7d); }, []);

    useEffect(() => {
        fetch('https://api.exchangerate-api.com/v4/latest/USD')
            .then(r => r.json())
            .then(d => setUsdKrw(d.rates.KRW))
            .catch(() => setUsdKrw(null));
    }, []);

    if (!cryptoData.length) return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>데이터 로딩 중...</div>
    );

    const summary   = buildMarketSummary(cryptoData, fearGreed, kospiData, history7d);
    const drivers   = buildMarketDrivers(cryptoData, fearGreed, kospiData, history7d);
    const crossFlow = buildCrossAssetFlow(cryptoData, kospiData, kosdaqData, history7d);
    const assets    = buildAssetComparison(cryptoData, history7d, kospiData);
    const leading   = buildLeadingAssets(cryptoData, stockData);
    const technical = buildTechnical(cryptoData, history7d);
    const scenarios = buildScenario(cryptoData, fearGreed, kospiData, kosdaqData, history7d, usdKrw);
    const riskItems = buildRiskDashboard(cryptoData, fearGreed, history7d);

    const dirIcon  = d => d === 'up' ? '↑' : d === 'down' ? '↓' : '→';
    const dirColor = d => d === 'up' ? '#10d9a0' : d === 'down' ? '#f05a5a' : '#f5c842';

    const ScoreBar = ({ score, color }) => (
        <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 6 }}>
            <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
        </div>
    );

    return (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1400 }}>

            {/* ══ 상단: Market Regime ══ */}
            <div className="card" style={{ borderLeft: `3px solid ${summary.badgeColor}` }}>
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="card-title">🧭 오늘의 시장</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: summary.badgeColor, background: summary.badgeColor + '18', border: `1px solid ${summary.badgeColor}44`, padding: '2px 10px', borderRadius: 20 }}>{summary.regime}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted2)', background: 'rgba(255,255,255,0.05)', padding: '2px 10px', borderRadius: 20 }}>{summary.regimeKo}</span>
                        {usdKrw && (
                            <span style={{ fontSize: 11, color: usdKrw > 1380 ? '#f05a5a' : usdKrw < 1320 ? '#10d9a0' : '#f5c842', background: 'rgba(255,255,255,0.05)', padding: '2px 10px', borderRadius: 20, fontFamily: "'DM Mono', monospace" }}>
                                USD/KRW {usdKrw.toFixed(0)} ({usdKrw > 1380 ? '원화 약세' : usdKrw < 1320 ? '원화 강세' : '중립'})
                            </span>
                        )}
                    </div>
                </div>
                <div className="card-body">
                    <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, marginBottom: 20, padding: '14px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: `2px solid ${summary.badgeColor}` }}>
                        "{summary.summary}"
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>핵심 근거</div>
                            {summary.reasons.map((r, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: summary.badgeColor, flexShrink: 0 }} />
                                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>{r}</span>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>주의 포인트</div>
                            {summary.warnings.map((w, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f5c842', flexShrink: 0 }} />
                                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>{w}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ══ 섹션1: Market Drivers (단순화) ══ */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">🔍 Market Drivers</span>
                    <span className="card-badge badge-blue">시장 움직인 원인</span>
                </div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {[
                            { title: '유동성', items: drivers.liquidity, icon: '💧' },
                            { title: '심리',   items: drivers.sentiment, icon: '🧠' },
                        ].map((cat, ci) => (
                            <div key={ci} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>{cat.icon}</span>
                                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat.title}</span>
                                </div>
                                {cat.items.map((item, ii) => (
                                    <div key={ii} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: dirColor(item.dir), flexShrink: 0, marginTop: 1 }}>{dirIcon(item.dir)}</span>
                                        <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══ 섹션2: Cross Asset Flow ══ */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">🔄 Cross-Asset Flow</span>
                    <span className="card-badge badge-purple">자산 간 흐름</span>
                </div>
                <div className="card-body">
                    <div style={{ padding: '14px 18px', background: crossFlow.flowColor + '12', borderRadius: 10, border: `1px solid ${crossFlow.flowColor}33`, marginBottom: 16 }}>
                        <span style={{ fontSize: 14, color: crossFlow.flowColor, fontWeight: 600 }}>{crossFlow.flowInterpretation}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {crossFlow.flowItems.map((item, i) => (
                            <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{item.name}</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: cl(item.chg), fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>
                                    {item.chg != null ? pct(item.chg) : '--'}
                                </div>
                                <div style={{ fontSize: 11, color: cl(item.chg), background: cl(item.chg) + '18', padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
                                    {item.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══ 크로스마켓 차트 ══ */}
            <CrossMarketChart
                fetchCrossMarketHistory={fetchCrossMarketHistory}
                chartsReady={chartsReady}
                chartId="priceChart-market"
            />

            {/* ══ 섹션3: Leadership + Risk Dashboard ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">🚀 Leadership</span>
                        <span className="card-badge badge-amber">주도 자산</span>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {[
                            { label: '상승 주도', items: leading.top,    color: '#10d9a0' },
                            { label: '약세 주도', items: leading.bottom, color: '#f05a5a' },
                        ].map((group, gi) => (
                            <div key={gi}>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group.label}</div>
                                {group.items.map((a, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 11, color: 'var(--muted)', width: 16 }}>{i+1}</span>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.name}</span>
                                            <span style={{ fontSize: 10, color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>{a.type}</span>
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: group.color, fontFamily: "'DM Mono', monospace" }}>{pct(a.chg)}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>거래량 급증</div>
                            {leading.volTop.map((a, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.name}</span>
                                    <span style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: "'DM Mono', monospace" }}>
                                        {a.vol ? '₩' + (a.vol/1e8).toFixed(0) + '억' : '--'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <span className="card-title">⚠️ Risk Dashboard</span>
                        <span className="card-badge" style={{ background: '#f05a5a22', color: '#f05a5a', border: '1px solid #f05a5a44' }}>리스크 구조</span>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {riskItems.map((r, i) => {
                            const barColor = r.score >= 70 ? '#f05a5a' : r.score >= 45 ? '#f5c842' : '#10d9a0';
                            return (
                                <div key={i} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 14 }}>{r.icon}</span>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.label}</span>
                                        </div>
                                        <span style={{ fontSize: 12, color: barColor, background: barColor + '18', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{r.level}</span>
                                    </div>
                                    <ScoreBar score={r.score} color={barColor} />
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{r.desc}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ══ 섹션4: Scenario / Outlook ══ */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">🎯 Scenario / Outlook</span>
                    <span className="card-badge badge-purple">Base · Bull · Bear</span>
                </div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        {scenarios.map((s, i) => (
                            <div key={i} style={{ border: `1px solid ${s.color}33`, borderRadius: 12, overflow: 'hidden' }}>
                                <div style={{ padding: '10px 16px', background: s.color + '15', borderBottom: `1px solid ${s.color}22` }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.asset}</span>
                                </div>
                                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {[
                                        { label: 'Base',   text: s.base, color: '#f5c842' },
                                        { label: 'Bull ↑', text: s.bull, color: '#10d9a0' },
                                        { label: 'Bear ↓', text: s.bear, color: '#f05a5a' },
                                    ].map((sc, si) => (
                                        <div key={si}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{sc.label}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{sc.text}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══ 섹션5: 기술적 상태 ══ */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">📐 기술적 상태 요약</span>
                    <span className="card-badge badge-purple">혼합 지표</span>
                </div>
                <div className="card-body">
                    {/* 핵심 자산 3개 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                        {technical.main.map((t, i) => (
                            <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: `1px solid ${t.color}33` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{t.asset}</span>
                                    <span style={{ fontSize: 9, color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>{t.quality}</span>
                                </div>
                                {t.metrics.map((m, mi) => (
                                    <div key={mi} style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{m.label}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: "'DM Mono', monospace" }}>{m.value}</span>
                                            <span style={{ fontSize: 11, fontWeight: 600, color: m.color, background: m.color + '18', padding: '1px 6px', borderRadius: 4 }}>{m.state}</span>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 9, color: 'var(--muted)' }}>{t.dataType}</div>
                            </div>
                        ))}
                    </div>
                    {/* 참고 자산 (ETH/SOL) */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>참고 자산 (24h 기준)</div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {technical.ref.map((r, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${r.color}22` }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: r.color }}>{r.name}</span>
                                    <span style={{ fontSize: 12, color: r.stateColor, fontFamily: "'DM Mono', monospace" }}>
                                        {r.chg != null ? (r.chg >= 0 ? '+' : '') + r.chg.toFixed(2) + '%' : '--'}
                                    </span>
                                    <span style={{ fontSize: 11, color: r.stateColor, background: r.stateColor + '18', padding: '1px 6px', borderRadius: 4 }}>{r.state}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ══ 섹션6: 자산군 비교 + 히트맵 ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">⚖️ 자산군 비교</span>
                        <span className="card-badge badge-blue">7일 기준</span>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {assets.map((a, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${a.color}22` }}>
                                    <div style={{ width: 3, height: 36, background: a.color, borderRadius: 2, flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: a.color }}>{a.name}</span>
                                                <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>{a.type}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, textAlign: 'right' }}>
                                                <div>
                                                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>24h</div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: cl(a.chg24h), fontFamily: "'DM Mono', monospace" }}>{a.chg24h != null ? pct(a.chg24h) : '--'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>7일</div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: cl(a.chg7d), fontFamily: "'DM Mono', monospace" }}>{a.chg7d != null ? pct(a.chg7d) : '--'}</div>
                                                </div>
                                                {a.vol != null && (
                                                    <div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>변동성</div>
                                                        <div style={{ fontSize: 13, color: 'var(--muted2)', fontFamily: "'DM Mono', monospace" }}>{a.vol.toFixed(1)}%</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {i === 0 && <div style={{ fontSize: 10, color: '#f5c842', marginTop: 4 }}>🏆 7일 최강 자산</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <HeatmapCard cryptoData={cryptoData} />
            </div>

        </div>
    );
}