'use client';
import { useEffect, useState } from 'react';
import { useMarketData } from '../hooks/useMarketData';

const pct = n => n == null ? '--' : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const cl  = n => n == null ? 'var(--muted)' : n >= 0 ? '#10d9a0' : '#f05a5a';

// 기술 지표 계산 부분
const calcRSI = (prices, period = 14) => {
    const result = new Array(prices.length).fill(null);
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i-1];
        if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
    }
    avgGain /= period; avgLoss /= period;
    result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i-1];
        avgGain = (avgGain * (period-1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period-1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
        result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    }
    return result;
};

const calcMA = (prices, period) =>
    prices.map((_, i) => {
        if (i < period - 1) return null;
        return prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    });

const calcEMA = (prices, period) => {
    const result = new Array(prices.length).fill(null);
    const k = 2 / (period + 1);
    let ema = prices[0];
    result[0] = ema;
    for (let i = 1; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
        result[i] = ema;
    }
    return result;
};

function evaluateCondition(cond, i, prices, indicators) {
    const { type, op, value, short, long, period } = cond;
    if (type === 'RSI') {
        const rsiArr = indicators[`rsi_${period ?? 14}`];
        const rsiVal = rsiArr?.[i];
        if (rsiVal == null) return false;
        return op === '<' ? rsiVal < value : op === '>' ? rsiVal > value : false;
    }
    if (type === 'MA_CROSS') {
        const maS = indicators[`ma_${short}`];
        const maL = indicators[`ma_${long}`];
        if (!maS || !maL || i < 1) return false;
        if (maS[i] == null || maL[i] == null) return false;
        const prev = maS[i-1] - maL[i-1];
        const curr = maS[i]   - maL[i];
        return op === 'crossover'  ? prev <= 0 && curr > 0 :
               op === 'crossunder' ? prev >= 0 && curr < 0 : false;
    }
    if (type === 'PRICE') {
        return op === '<' ? prices[i] < value : op === '>' ? prices[i] > value : false;
    }
    return false;
}

function evaluateConditions(conditions, logic, i, prices, indicators) {
    if (conditions.length === 0) return false;
    if (logic === 'AND') return conditions.every(c => evaluateCondition(c, i, prices, indicators));
    if (logic === 'OR')  return conditions.some(c  => evaluateCondition(c, i, prices, indicators));
    return false;
}


function runBacktest(prices, timestamps, strategy) {
    const { buyConditions, buyLogic, sellConditions, sellLogic, risk } = strategy;
    const { fee, stopLoss, takeProfit, positionSize } = risk;


    const indicators = {};
    const allConds   = [...buyConditions, ...sellConditions];
    const rsiPeriods = [...new Set(allConds.filter(c => c.type === 'RSI').map(c => c.period ?? 14))];
    const maPairs    = allConds.filter(c => c.type === 'MA_CROSS');

    rsiPeriods.forEach(p => { indicators[`rsi_${p}`] = calcRSI(prices, p); });

    if (rsiPeriods.length > 0) indicators.rsi = indicators[`rsi_${rsiPeriods[0]}`];

    maPairs.forEach(c => {
        indicators[`ma_${c.short}`] = indicators[`ma_${c.short}`] || calcMA(prices, c.short);
        indicators[`ma_${c.long}`]  = indicators[`ma_${c.long}`]  || calcMA(prices, c.long);
    });

    let cash = 1000000, holding = 0, buyPrice = 0;
    const trades = [], equity = [], holdEquity = [];
    const initPrice = prices[0];
    equity.push({ ts: timestamps[0], value: cash });
    holdEquity.push({ ts: timestamps[0], value: cash });

    for (let i = 1; i < prices.length; i++) {
        const price        = prices[i];
        const currentValue = holding > 0 ? holding * price : cash;
        equity.push({ ts: timestamps[i], value: currentValue });
        holdEquity.push({ ts: timestamps[i], value: 1000000 * (price / initPrice) });


        if (holding > 0 && buyPrice > 0) {
            const unrealized = ((price - buyPrice) / buyPrice) * 100;
            if ((stopLoss   && unrealized <= -Math.abs(stopLoss)) ||
                (takeProfit && unrealized >= Math.abs(takeProfit))) {
                const sellPrice  = price * (1 - fee);
                const sellValue  = holding * sellPrice;
                const profit     = ((sellPrice - buyPrice) / buyPrice) * 100;
                trades.push({ type: 'SELL', price: sellPrice, ts: timestamps[i], value: sellValue, profit, trigger: unrealized <= -Math.abs(stopLoss) ? '손절' : '익절' });
                cash = sellValue; holding = 0; buyPrice = 0;
                continue;
            }
        }

        const shouldBuy  = evaluateConditions(buyConditions,  buyLogic,  i, prices, indicators);
        const shouldSell = evaluateConditions(sellConditions, sellLogic, i, prices, indicators);

        if (shouldBuy && holding === 0 && cash > 0) {
            const buyAmt   = cash * positionSize;
            const buyPrice_ = price * (1 + fee);
            holding  = buyAmt / buyPrice_;
            buyPrice = buyPrice_;
            cash     = cash - buyAmt;
            trades.push({ type: 'BUY', price: buyPrice_, ts: timestamps[i], value: holding * buyPrice_ });
        } else if (shouldSell && holding > 0) {
            const sellPrice = price * (1 - fee);
            const sellValue = holding * sellPrice;
            const profit    = ((sellPrice - buyPrice) / buyPrice) * 100;
            trades.push({ type: 'SELL', price: sellPrice, ts: timestamps[i], value: sellValue, profit });
            cash = sellValue + cash; holding = 0; buyPrice = 0;
        }
    }

    const finalValue  = holding > 0 ? holding * prices[prices.length-1] + cash : cash;
    const totalReturn = ((finalValue - 1000000) / 1000000) * 100;
    const holdReturn  = ((prices[prices.length-1] - initPrice) / initPrice) * 100;
    const sellTrades  = trades.filter(t => t.type === 'SELL');
    const winTrades   = sellTrades.filter(t => t.profit > 0);
    const lossTrades  = sellTrades.filter(t => t.profit <= 0);
    const winRate     = sellTrades.length > 0 ? (winTrades.length / sellTrades.length) * 100 : 0;
    const avgWin      = winTrades.length  > 0 ? winTrades.reduce((s,t)  => s + t.profit, 0) / winTrades.length  : 0;
    const avgLoss_    = lossTrades.length > 0 ? lossTrades.reduce((s,t) => s + t.profit, 0) / lossTrades.length : 0;
    const grossProfit = winTrades.reduce((s,t)  => s + t.profit, 0);
    const grossLoss   = Math.abs(lossTrades.reduce((s,t) => s + t.profit, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

    // Sharpe Ratio (일별 수익률 기준)
    const returns = [];
    for (let i = 1; i < equity.length; i++) {
        returns.push((equity[i].value - equity[i-1].value) / equity[i-1].value);
    }
    const meanR = returns.reduce((a,b) => a+b, 0) / returns.length;
    const stdR  = Math.sqrt(returns.reduce((a,b) => a + Math.pow(b - meanR, 2), 0) / returns.length);
    const sharpe = stdR > 0 ? (meanR / stdR) * Math.sqrt(365 * 24) : null;

    // MDD
    let peak = 1000000, mdd = 0;
    for (const e of equity) {
        if (e.value > peak) peak = e.value;
        const dd = ((peak - e.value) / peak) * 100;
        if (dd > mdd) mdd = dd;
    }

    return { totalReturn, holdReturn, winRate, mdd, tradeCount: trades.length, trades, equity, holdEquity, finalValue, avgWin, avgLoss: avgLoss_, profitFactor, sharpe };
}

// 차트 렌더링 부분
function renderEquityChart(equity, holdEquity) {
    const ctx = document.getElementById('backtestEquityChart');
    if (!ctx || !window.Chart) return;
    const existing = window.Chart.getChart(ctx);
    if (existing) existing.destroy();
    const step   = Math.max(1, Math.floor(equity.length / 20));
    const labels = equity.map((e, i) => {
        if (i % step !== 0) return '';
        const d = new Date(e.ts);
        return `${d.getMonth()+1}/${d.getDate()}`;
    });
    new window.Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: '전략 수익률', data: equity.map(e => ((e.value-1000000)/1000000*100).toFixed(2)), borderColor: '#10d9a0', backgroundColor: 'rgba(16,217,160,0.05)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true },
                { label: 'Buy & Hold', data: holdEquity.map(e => ((e.value-1000000)/1000000*100).toFixed(2)), borderColor: '#4f8eff', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4,4], pointRadius: 0, tension: 0.3 },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: true, labels: { color: '#9ca3af', font: { size: 11 } } },
                tooltip: { backgroundColor: '#191c24', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, callbacks: { label: c => `${c.dataset.label}: ${c.raw}%` } }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 10 }, maxRotation: 0 } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 11 }, callback: v => v + '%' } }
            }
        }
    });
}


const defaultBuyConditions  = [{ id: 1, type: 'RSI', op: '<', value: 30, period: 14 }];
const defaultSellConditions = [{ id: 2, type: 'RSI', op: '>', value: 70, period: 14 }];


export default function BacktestPage() {
    const { fetchCrossMarketHistory } = useMarketData();

    const [buyConditions,  setBuyConditions]  = useState(defaultBuyConditions);
    const [sellConditions, setSellConditions] = useState(defaultSellConditions);
    const [buyLogic,       setBuyLogic]       = useState('AND');
    const [sellLogic,      setSellLogic]      = useState('OR');

    // 리스크 설정부분
    const [fee,          setFee]          = useState(0.05);
    const [stopLoss,     setStopLoss]     = useState(3);
    const [takeProfit,   setTakeProfit]   = useState(5);
    const [positionSize, setPositionSize] = useState(100);
    const [useStopLoss,  setUseStopLoss]  = useState(true);
    const [useTakeProfit,setUseTakeProfit]= useState(true);

    const [period,      setPeriod]      = useState(90);
    const [isRunning,   setIsRunning]   = useState(false);
    const [result,      setResult]      = useState(null);
    const [chartsReady, setChartsReady] = useState(false);
    const [error,       setError]       = useState(null);

    useEffect(() => {
        if (window.Chart) { setChartsReady(true); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        s.onload = () => setChartsReady(true);
        document.head.appendChild(s);
    }, []);

    useEffect(() => {
        if (result && chartsReady) setTimeout(() => renderEquityChart(result.equity, result.holdEquity), 100);
    }, [result, chartsReady]);

    const addCondition = (side) => {
        const newCond = { id: Date.now(), type: 'RSI', op: '<', value: 30, period: 14 };
        if (side === 'buy')  setBuyConditions(prev  => [...prev,  newCond]);
        else                 setSellConditions(prev => [...prev, newCond]);
    };

    const removeCondition = (side, id) => {
        if (side === 'buy')  setBuyConditions(prev  => prev.filter(c => c.id !== id));
        else                 setSellConditions(prev => prev.filter(c => c.id !== id));
    };

    const updateCondition = (side, id, field, value) => {
        const updater = prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c);
        if (side === 'buy')  setBuyConditions(updater);
        else                 setSellConditions(updater);
    };

    const handleRun = async () => {
        if (buyConditions.length === 0)  { setError('매수 조건을 최소 1개 추가해주세요.'); return; }
        if (sellConditions.length === 0) { setError('매도 조건을 최소 1개 추가해주세요.'); return; }
        setIsRunning(true); setError(null); setResult(null);
        try {
            const data = await fetchCrossMarketHistory(period);
            if (!data?.btc || data.btc.length < 30) { setError('데이터가 부족합니다.'); return; }
            const prices     = data.btc.map(p => p[1]);
            const timestamps = data.btc.map(p => p[0]);
            const res = runBacktest(prices, timestamps, {
                buyConditions, buyLogic, sellConditions, sellLogic,
                risk: {
                    fee:          fee / 100,
                    stopLoss:     useStopLoss   ? stopLoss   : null,
                    takeProfit:   useTakeProfit ? takeProfit : null,
                    positionSize: positionSize  / 100,
                },
            });
            setResult(res);
        } catch (e) {
            setError('백테스트 실행 중 오류가 발생했습니다: ' + e.message);
        } finally {
            setIsRunning(false);
        }
    };

    const btnStyle = (active, activeColor = '#10d9a0') => ({
        padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
        cursor: 'pointer', border: 'none', transition: 'all 0.2s',
        background: active ? activeColor : 'rgba(255,255,255,0.06)',
        color: active ? (activeColor === '#10d9a0' ? '#000' : '#fff') : 'var(--muted)',
    });

    const ConditionRow = ({ cond, side }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>

            <select value={cond.type} onChange={e => updateCondition(side, cond.id, 'type', e.target.value)}
                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
                <option value="RSI">RSI</option>
                <option value="MA_CROSS">MA 크로스</option>
                <option value="PRICE">가격</option>
            </select>


            {cond.type === 'RSI' && (<>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>기간</span>
                <select value={cond.period ?? 14} onChange={e => updateCondition(side, cond.id, 'period', Number(e.target.value))}
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
                    {[7, 14, 21].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={cond.op} onChange={e => updateCondition(side, cond.id, 'op', e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
                    <option value="<">&lt;</option>
                    <option value=">">&gt;</option>
                </select>
                <input type="number" value={cond.value} min={1} max={100}
                    onChange={e => updateCondition(side, cond.id, 'value', Number(e.target.value))}
                    style={{ width: 60, padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 12 }} />
                <span style={{ fontSize: 11, color: side === 'buy' ? '#10d9a0' : '#f05a5a' }}>
                    RSI({cond.period ?? 14}) {cond.op} {cond.value}
                </span>
            </>)}


            {cond.type === 'MA_CROSS' && (<>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>단기</span>
                <select value={cond.short ?? 7} onChange={e => updateCondition(side, cond.id, 'short', Number(e.target.value))}
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
                    {[5, 7, 10, 20].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>장기</span>
                <select value={cond.long ?? 25} onChange={e => updateCondition(side, cond.id, 'long', Number(e.target.value))}
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
                    {[25, 50, 100].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={cond.op} onChange={e => updateCondition(side, cond.id, 'op', e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
                    <option value="crossover">골든크로스 ↑</option>
                    <option value="crossunder">데드크로스 ↓</option>
                </select>
                <span style={{ fontSize: 11, color: side === 'buy' ? '#10d9a0' : '#f05a5a' }}>
                    MA{cond.short ?? 7} {cond.op === 'crossover' ? '>' : '<'} MA{cond.long ?? 25}
                </span>
            </>)}


            {cond.type === 'PRICE' && (<>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>가격</span>
                <select value={cond.op} onChange={e => updateCondition(side, cond.id, 'op', e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
                    <option value="<">&lt;</option>
                    <option value=">">&gt;</option>
                </select>
                <input type="number" value={cond.value}
                    onChange={e => updateCondition(side, cond.id, 'value', Number(e.target.value))}
                    style={{ width: 120, padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 12 }} />
            </>)}


            <button onClick={() => removeCondition(side, cond.id)} style={{
                marginLeft: 'auto', padding: '4px 8px', borderRadius: 4, border: 'none',
                background: '#f05a5a18', color: '#f05a5a', fontSize: 11, cursor: 'pointer',
            }}>✕</button>
        </div>
    );

    const kpiCards = result ? [
        { label: '누적 수익률',    value: pct(result.totalReturn),                   color: cl(result.totalReturn),                       icon: '📈' },
        { label: 'Buy & Hold',    value: pct(result.holdReturn),                    color: cl(result.holdReturn),                        icon: '📊' },
        { label: 'MDD',           value: '-' + result.mdd.toFixed(2) + '%',         color: '#f05a5a',                                    icon: '📉' },
        { label: '승률',          value: result.winRate.toFixed(1) + '%',           color: result.winRate >= 50 ? '#10d9a0' : '#f05a5a',  icon: '🎯' },
        { label: '거래 횟수',     value: result.tradeCount + '회',                  color: 'var(--text)',                                 icon: '🔄' },
        { label: 'Sharpe Ratio',  value: result.sharpe != null ? result.sharpe.toFixed(2) : '--', color: result.sharpe > 1 ? '#10d9a0' : result.sharpe > 0 ? '#f5c842' : '#f05a5a', icon: '⚡' },
        { label: '평균 수익',     value: pct(result.avgWin),                        color: '#10d9a0',                                    icon: '✅' },
        { label: '평균 손실',     value: pct(result.avgLoss),                       color: '#f05a5a',                                    icon: '❌' },
        { label: 'Profit Factor', value: result.profitFactor != null ? result.profitFactor.toFixed(2) : '--', color: result.profitFactor > 1.5 ? '#10d9a0' : result.profitFactor > 1 ? '#f5c842' : '#f05a5a', icon: '💡' },
    ] : [];

    return (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200 }}>


            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>💼 Strategy Lab</h2>
                <span className="card-badge badge-purple">백테스팅</span>
            </div>


            <div className="card">
                <div className="card-header">
                    <span className="card-title">🧩 전략 빌더</span>
                </div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>


                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#10d9a0' }}>🟢 매수 조건</span>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {['AND', 'OR'].map(l => (
                                            <button key={l} onClick={() => setBuyLogic(l)} style={{
                                                ...btnStyle(buyLogic === l),
                                                padding: '3px 10px', fontSize: 10,
                                            }}>{l}</button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={() => addCondition('buy')} style={{
                                    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                    cursor: 'pointer', border: '1px solid #10d9a044',
                                    background: '#10d9a018', color: '#10d9a0',
                                }}>+ 조건 추가</button>
                            </div>
                            {buyConditions.length === 0 ? (
                                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8 }}>
                                    조건을 추가해주세요
                                </div>
                            ) : (
                                <>
                                    {buyConditions.map((cond, idx) => (
                                        <div key={cond.id}>
                                            <ConditionRow cond={cond} side="buy" />
                                            {idx < buyConditions.length - 1 && (
                                                <div style={{ textAlign: 'center', fontSize: 11, color: '#10d9a0', fontWeight: 700, marginBottom: 8 }}>{buyLogic}</div>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>


                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#f05a5a' }}>🔴 매도 조건</span>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {['AND', 'OR'].map(l => (
                                            <button key={l} onClick={() => setSellLogic(l)} style={{
                                                ...btnStyle(sellLogic === l, '#f05a5a'),
                                                padding: '3px 10px', fontSize: 10,
                                            }}>{l}</button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={() => addCondition('sell')} style={{
                                    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                    cursor: 'pointer', border: '1px solid #f05a5a44',
                                    background: '#f05a5a18', color: '#f05a5a',
                                }}>+ 조건 추가</button>
                            </div>
                            {sellConditions.length === 0 ? (
                                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8 }}>
                                    조건을 추가해주세요
                                </div>
                            ) : (
                                <>
                                    {sellConditions.map((cond, idx) => (
                                        <div key={cond.id}>
                                            <ConditionRow cond={cond} side="sell" />
                                            {idx < sellConditions.length - 1 && (
                                                <div style={{ textAlign: 'center', fontSize: 11, color: '#f05a5a', fontWeight: 700, marginBottom: 8 }}>{sellLogic}</div>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>


            <div className="card">
                <div className="card-header">
                    <span className="card-title">⚠️ 리스크 설정</span>
                </div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>수수료 (%)</div>
                            <input type="number" value={fee} step={0.01} min={0} max={1}
                                onChange={e => setFee(Number(e.target.value))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 13 }} />
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>매수/매도 각 {fee}%</div>
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <input type="checkbox" checked={useStopLoss} onChange={e => setUseStopLoss(e.target.checked)} style={{ cursor: 'pointer' }} />
                                <span style={{ fontSize: 11, color: useStopLoss ? '#f05a5a' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>손절 (%)</span>
                            </div>
                            <input type="number" value={stopLoss} step={0.5} min={0.5} max={50} disabled={!useStopLoss}
                                onChange={e => setStopLoss(Number(e.target.value))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${useStopLoss ? '#f05a5a44' : 'rgba(255,255,255,0.1)'}`, background: 'rgba(255,255,255,0.05)', color: useStopLoss ? 'var(--text)' : 'var(--muted)', fontSize: 13 }} />
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>-{stopLoss}% 하락 시 매도</div>
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <input type="checkbox" checked={useTakeProfit} onChange={e => setUseTakeProfit(e.target.checked)} style={{ cursor: 'pointer' }} />
                                <span style={{ fontSize: 11, color: useTakeProfit ? '#10d9a0' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>익절 (%)</span>
                            </div>
                            <input type="number" value={takeProfit} step={0.5} min={0.5} max={100} disabled={!useTakeProfit}
                                onChange={e => setTakeProfit(Number(e.target.value))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${useTakeProfit ? '#10d9a044' : 'rgba(255,255,255,0.1)'}`, background: 'rgba(255,255,255,0.05)', color: useTakeProfit ? 'var(--text)' : 'var(--muted)', fontSize: 13 }} />
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>+{takeProfit}% 상승 시 매도</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>포지션 크기 (%)</div>
                            <input type="number" value={positionSize} step={10} min={10} max={100}
                                onChange={e => setPositionSize(Number(e.target.value))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 13 }} />
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>보유 현금의 {positionSize}% 매수</div>
                        </div>
                    </div>
                </div>
            </div>


            <div className="card">
                <div className="card-header">
                    <span className="card-title">▶ 실행 설정</span>
                </div>
                <div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>테스트 기간</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[{ label: '3개월', value: 90 }, { label: '6개월', value: 180 }, { label: '1년', value: 365 }].map(p => (
                                    <button key={p.value} onClick={() => setPeriod(p.value)} style={btnStyle(period === p.value, '#4f8eff')}>{p.label}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>종목</div>
                            <div style={{ padding: '6px 14px', background: '#f5c84218', border: '1px solid #f5c84244', borderRadius: 6, fontSize: 12, color: '#f5c842' }}>
                                BTC (업비트)
                            </div>
                        </div>
                        <button onClick={handleRun} disabled={isRunning} style={{
                            marginTop: 20, padding: '10px 40px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                            cursor: isRunning ? 'not-allowed' : 'pointer', border: 'none',
                            background: isRunning ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #10d9a0, #4f8eff)',
                            color: isRunning ? 'var(--muted)' : '#000',
                        }}>
                            {isRunning ? '⏳ 실행 중...' : '▶ 백테스트 실행'}
                        </button>
                    </div>
                    {error && (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: '#f05a5a18', border: '1px solid #f05a5a44', borderRadius: 8, fontSize: 13, color: '#f05a5a' }}>
                            ⚠️ {error}
                        </div>
                    )}
                </div>
            </div>


            {result && (<>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {kpiCards.slice(0, 3).map((k, i) => (
                        <div key={i} className="card" style={{ padding: '16px 20px' }}>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{k.icon} {k.label}</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: k.color, fontFamily: "'DM Mono', monospace" }}>{k.value}</div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {kpiCards.slice(3, 6).map((k, i) => (
                        <div key={i} className="card" style={{ padding: '16px 20px' }}>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{k.icon} {k.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, fontFamily: "'DM Mono', monospace" }}>{k.value}</div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {kpiCards.slice(6, 9).map((k, i) => (
                        <div key={i} className="card" style={{ padding: '16px 20px' }}>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{k.icon} {k.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, fontFamily: "'DM Mono', monospace" }}>{k.value}</div>
                        </div>
                    ))}
                </div>


                <div className="card">
                    <div className="card-header">
                        <span className="card-title">📈 수익률 곡선 (Equity Curve)</span>
                        <span className="card-badge badge-green">전략 vs Buy & Hold</span>
                    </div>
                    <div className="card-body">
                        <div style={{ height: 300 }}>
                            <canvas id="backtestEquityChart"></canvas>
                        </div>
                    </div>
                </div>


                <div className="card">
                    <div className="card-header"><span className="card-title">📋 전략 요약</span></div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>매수 조건 ({buyLogic})</div>
                                {buyConditions.map((c, i) => (
                                    <div key={i} style={{ fontSize: 12, color: '#10d9a0', marginBottom: 4 }}>
                                        • {c.type === 'RSI' ? `RSI(${c.period}) ${c.op} ${c.value}` :
                                           c.type === 'MA_CROSS' ? `MA${c.short} ${c.op === 'crossover' ? '>' : '<'} MA${c.long}` :
                                           `가격 ${c.op} ${c.value}`}
                                    </div>
                                ))}
                            </div>
                            <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>결과 요약</div>
                                <div style={{ fontSize: 13, color: result.totalReturn > result.holdReturn ? '#10d9a0' : '#f05a5a' }}>
                                    {result.totalReturn > result.holdReturn
                                        ? `✅ 전략이 Buy & Hold 대비 ${pct(result.totalReturn - result.holdReturn)} 초과 수익`
                                        : `❌ 전략이 Buy & Hold 대비 ${pct(result.totalReturn - result.holdReturn)} 미달`}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                                    수수료 {fee}% · {useStopLoss ? `손절 -${stopLoss}%` : '손절 없음'} · {useTakeProfit ? `익절 +${takeProfit}%` : '익절 없음'} · 포지션 {positionSize}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                <div className="card">
                    <div className="card-header">
                        <span className="card-title">📝 거래 로그</span>
                        <span className="card-badge badge-blue">{result.tradeCount}회 거래</span>
                    </div>
                    <div className="card-body">
                        {result.trades.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: 13 }}>
                                조건에 맞는 거래 신호가 없습니다. 조건을 조정해보세요.
                            </div>
                        ) : (
                            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                            {['유형', '날짜', '가격', '평가금액', '수익률', '트리거'].map(h => (
                                                <th key={h} style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)', textAlign: 'left', fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.trades.map((t, i) => {
                                            const d = new Date(t.ts);
                                            const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
                                            return (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                    <td style={{ padding: '10px 12px' }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: t.type === 'BUY' ? '#10d9a0' : '#f05a5a', background: t.type === 'BUY' ? '#10d9a018' : '#f05a5a18', padding: '2px 8px', borderRadius: 4 }}>
                                                            {t.type === 'BUY' ? '매수' : '매도'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text2)', fontFamily: "'DM Mono', monospace" }}>{dateStr}</td>
                                                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text)', fontFamily: "'DM Mono', monospace" }}>₩{Number(t.price).toLocaleString('ko-KR')}</td>
                                                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text2)', fontFamily: "'DM Mono', monospace" }}>₩{Number(t.value).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</td>
                                                    <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                                                        {t.profit != null ? <span style={{ color: cl(t.profit) }}>{pct(t.profit)}</span> : <span style={{ color: 'var(--muted)' }}>--</span>}
                                                    </td>
                                                    <td style={{ padding: '10px 12px', fontSize: 11, color: t.trigger === '손절' ? '#f05a5a' : t.trigger === '익절' ? '#10d9a0' : 'var(--muted)' }}>
                                                        {t.trigger ?? '신호'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </>)}

            {!result && !isRunning && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>전략을 설정하고 백테스트를 실행해보세요</div>
                    <div style={{ fontSize: 13 }}>조건 빌더로 매수/매도 전략을 직접 설계하고 BTC 과거 데이터로 검증할 수 있어요</div>
                </div>
            )}
        </div>
    );
}