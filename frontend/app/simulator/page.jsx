'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMarketData } from '../hooks/useMarketData';

const pct = n => n == null ? '--' : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const cl  = n => n == null ? 'var(--muted)' : n >= 0 ? '#10d9a0' : '#f05a5a';
const krw = n => n == null ? '--' : '₩' + Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 0 });

const calcRSI = (prices, period = 14) => {
    const result = new Array(period).fill(null);
    for (let i = period; i < prices.length; i++) {
        let gains = 0, losses = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const diff = prices[j] - prices[j-1];
            if (diff > 0) gains += diff;
            else losses += Math.abs(diff);
        }
        const avgLoss = losses / period;
        if (avgLoss === 0) { result.push(100); continue; }
        result.push(100 - (100 / (1 + (gains / period) / avgLoss)));
    }
    return result;
};

const calcMA = (prices, period) =>
    prices.map((_, i) => {
        if (i < period - 1) return null;
        return prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    });

function calcCurrentSignal(prices, strategy) {
    const { indicator, rsiPeriod, buyThreshold, sellThreshold, maShort, maLong } = strategy;
    if (prices.length < 30) return { signal: 'NONE', value: null, label: '데이터 부족' };

    if (indicator === 'RSI') {
        const rsi  = calcRSI(prices, rsiPeriod);
        const cur  = rsi[rsi.length - 1];
        const prev = rsi[rsi.length - 2];
        if (cur == null) return { signal: 'NONE', value: null, label: '계산 중' };
        const signal = cur < buyThreshold ? 'BUY' : cur > sellThreshold ? 'SELL' : 'HOLD';
        return { signal, value: cur.toFixed(1), label: `RSI(${rsiPeriod}) = ${cur.toFixed(1)}`, prev };
    } else {
        const maS  = calcMA(prices, maShort);
        const maL  = calcMA(prices, maLong);
        const cur  = maS[maS.length-1] - maL[maL.length-1];
        const prev = maS[maS.length-2] - maL[maL.length-2];
        if (cur == null || prev == null) return { signal: 'NONE', value: null, label: '계산 중' };
        const signal = prev <= 0 && cur > 0 ? 'BUY' : prev >= 0 && cur < 0 ? 'SELL' : 'HOLD';
        return {
            signal,
            value: cur.toFixed(0),
            label: `MA${maShort}=${maS[maS.length-1]?.toFixed(0)} / MA${maLong}=${maL[maL.length-1]?.toFixed(0)}`,
        };
    }
}

// ─── 실제 컴포넌트 (searchParams 사용) ───────────────────
function SimulatorInner() {
    const searchParams = useSearchParams();
    const { cryptoData, fetchCrossMarketHistory } = useMarketData();

    const [indicator,     setIndicator]     = useState('RSI');
    const [rsiPeriod,     setRsiPeriod]     = useState(14);
    const [maShort,       setMaShort]       = useState(7);
    const [maLong,        setMaLong]        = useState(25);
    const [buyThreshold,  setBuyThreshold]  = useState(30);
    const [sellThreshold, setSellThreshold] = useState(70);
    const [addCash,       setAddCash]       = useState('10000000');

    const [initialCash,   setInitialCash]   = useState(100000000);
    const [inputCash,     setInputCash]     = useState('100000000');
    const [isStarted,     setIsStarted]     = useState(false);
    const [cash,          setCash]          = useState(100000000);
    const [holding,       setHolding]       = useState(0);
    const [buyPrice,      setBuyPrice]      = useState(0);
    const [trades,        setTrades]        = useState([]);
    const [pendingAction, setPendingAction] = useState(null);

    const [currentSignal, setCurrentSignal] = useState(null);
    const [priceHistory,  setPriceHistory]  = useState([]);
    const [isLoading,     setIsLoading]     = useState(false);

    // ── 이벤트 감지 페이지에서 넘어온 파라미터 처리 ──────
    useEffect(() => {
        const action = searchParams.get('action');  // 'buy' | 'sell'
        const symbol = searchParams.get('symbol');  // 'BTC'
        if (action && symbol) {
            // 자동 시뮬레이션 시작
            setIsStarted(true);
            setPendingAction(action);
        }
    }, [searchParams]);

    const btc          = cryptoData.find(c => c.symbol === 'BTC');
    const currentPrice = btc?.current_price ?? null;

    useEffect(() => {
        if (!isStarted) return;
        const load = async () => {
            setIsLoading(true);
            const data = await fetchCrossMarketHistory(90);
            if (data?.btc) setPriceHistory(data.btc.map(p => p[1]));
            setIsLoading(false);
        };
        load();
    }, [isStarted]);

    useEffect(() => {
        if (!isStarted || priceHistory.length === 0 || currentPrice == null) return;
        const prices   = [...priceHistory, currentPrice];
        const strategy = { indicator, rsiPeriod, buyThreshold, sellThreshold, maShort, maLong };
        setCurrentSignal(calcCurrentSignal(prices, strategy));
    }, [priceHistory, currentPrice, isStarted, indicator, rsiPeriod, buyThreshold, sellThreshold, maShort, maLong]);

    // ── pendingAction: 데이터 로드 완료 후 자동 매수/매도 ─
    useEffect(() => {
        if (!pendingAction || priceHistory.length === 0 || currentPrice == null) return;
        if (pendingAction === 'buy')  handleBuy();
        if (pendingAction === 'sell') handleSell();
        setPendingAction(null);
    }, [priceHistory, currentPrice, pendingAction]);

    const handleStart = () => {
        const parsed = Number(String(inputCash).replace(/,/g, '').trim());
        if (isNaN(parsed) || parsed < 1000000) { alert('최소 100만원 이상 입력해주세요.'); return; }
        setInitialCash(parsed);
        setCash(parsed);
        setHolding(0);
        setBuyPrice(0);
        setTrades([]);
        setIsStarted(true);
    };

    const handleReset = () => {
        setIsStarted(false);
        setCash(initialCash);
        setHolding(0);
        setBuyPrice(0);
        setTrades([]);
        setCurrentSignal(null);
        setPriceHistory([]);
    };

    const handleBuy = () => {
        if (!currentPrice || cash <= 0) return;
        const newHolding = cash / currentPrice;
        setHolding(newHolding);
        setBuyPrice(currentPrice);
        setCash(0);
        setTrades(prev => [{ type: 'BUY', price: currentPrice, ts: Date.now(), value: newHolding * currentPrice, profit: null }, ...prev]);
    };

    const handleSell = () => {
        if (!currentPrice || holding <= 0) return;
        const sellValue = holding * currentPrice;
        const profit    = ((currentPrice - buyPrice) / buyPrice) * 100;
        setCash(sellValue);
        setHolding(0);
        setBuyPrice(0);
        setTrades(prev => [{ type: 'SELL', price: currentPrice, ts: Date.now(), value: sellValue, profit }, ...prev]);
    };

    const handleAddCash = () => {
        const amount = Number(String(addCash).replace(/,/g, '').trim());
        if (isNaN(amount) || amount < 100000) { alert('최소 10만원 이상 입력해주세요.'); return; }
        setCash(prev => prev + amount);
        setInitialCash(prev => prev + amount);
        setTrades(prev => [{ type: 'ADD', price: currentPrice, ts: Date.now(), value: amount, profit: null }, ...prev]);
        setAddCash('10000000');
    };

    const evalValue     = holding > 0 ? holding * (currentPrice ?? 0) : cash;
    const totalReturn   = initialCash > 0 ? ((evalValue - initialCash) / initialCash) * 100 : 0;
    const unrealizedPnL = holding > 0 && currentPrice ? (currentPrice - buyPrice) / buyPrice * 100 : null;

    const btnStyle = (active, activeColor = '#10d9a0') => ({
        padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
        cursor: 'pointer', border: 'none', transition: 'all 0.2s',
        background: active ? activeColor : 'rgba(255,255,255,0.06)',
        color: active ? (activeColor === '#10d9a0' ? '#000' : '#fff') : 'var(--muted)',
    });

    const signalConfig = {
        BUY:  { color: '#10d9a0', bg: '#10d9a018', border: '#10d9a044', icon: '🟢', text: '매수 신호 발생' },
        SELL: { color: '#f05a5a', bg: '#f05a5a18', border: '#f05a5a44', icon: '🔴', text: '매도 신호 발생' },
        HOLD: { color: '#f5c842', bg: '#f5c84218', border: '#f5c84244', icon: '🟡', text: '관망 — 조건 미충족' },
        NONE: { color: 'var(--muted)', bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.06)', icon: '⚪', text: '신호 없음' },
    };

    // ── 이벤트 감지에서 넘어온 경우 배너 표시 ────────────
    const fromEvent = searchParams.get('action') && searchParams.get('symbol');
    const fromSymbol = searchParams.get('symbol');
    const fromAction = searchParams.get('action');

    return (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200 }}>

            {/* 이벤트 감지에서 넘어온 경우 안내 배너 */}
            {fromEvent && (
                <div style={{
                    padding: '12px 16px', borderRadius: 10,
                    background: fromAction === 'buy' ? '#10d9a012' : '#f05a5a12',
                    border: `1px solid ${fromAction === 'buy' ? '#10d9a044' : '#f05a5a44'}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    <span style={{ fontSize: 18 }}>{fromAction === 'buy' ? '🟢' : '🔴'}</span>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: fromAction === 'buy' ? '#10d9a0' : '#f05a5a' }}>
                            이벤트 감지에서 연결됨 — {fromSymbol} {fromAction === 'buy' ? '매수' : '매도'} 신호
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            시뮬레이션이 자동으로 시작되었습니다. 아래에서 포지션을 확인하세요.
                        </div>
                    </div>
                </div>
            )}

            {/* 타이틀 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>🎮 Live Simulator</h2>
                <span className="card-badge badge-green">실시간</span>
                {isStarted && <span className="card-badge" style={{ background: '#10d9a022', color: '#10d9a0', border: '1px solid #10d9a044' }}>● 실행 중</span>}
            </div>

            {/* 전략 설정 */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">⚙️ 전략 설정</span>
                    {isStarted && <span style={{ fontSize: 11, color: '#f5c842' }}>실행 중에는 설정 변경 시 신호가 즉시 재계산됩니다</span>}
                </div>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>지표</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {['RSI', 'MA'].map(ind => (
                                    <button key={ind} onClick={() => setIndicator(ind)} style={{
                                        padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                        cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                                        background: indicator === ind ? '#10d9a0' : 'rgba(255,255,255,0.06)',
                                        color: indicator === ind ? '#000' : 'var(--muted)',
                                    }}>{ind}</button>
                                ))}
                            </div>
                        </div>

                        {indicator === 'RSI' && (<>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>RSI 기간</div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {[7, 14, 21].map(p => <button key={p} onClick={() => setRsiPeriod(p)} style={btnStyle(rsiPeriod === p)}>{p}</button>)}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>현재: RSI({rsiPeriod})</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>매수 (RSI &lt;)</div>
                                <input type="number" value={buyThreshold} onChange={e => setBuyThreshold(Number(e.target.value))} min={1} max={100}
                                    style={{ width: 70, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 13 }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>매도 (RSI &gt;)</div>
                                <input type="number" value={sellThreshold} onChange={e => setSellThreshold(Number(e.target.value))} min={1} max={100}
                                    style={{ width: 70, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 13 }} />
                            </div>
                        </>)}

                        {indicator === 'MA' && (<>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>단기 MA</div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {[5, 7, 10, 20].map(p => <button key={p} onClick={() => setMaShort(p)} style={btnStyle(maShort === p)}>{p}</button>)}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>MA{maShort}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>장기 MA</div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {[25, 50, 100].map(p => <button key={p} onClick={() => setMaLong(p)} style={btnStyle(maLong === p, '#4f8eff')}>{p}</button>)}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>MA{maLong}</div>
                            </div>
                            <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, alignSelf: 'end' }}>
                                <div style={{ fontSize: 11, color: '#10d9a0', marginBottom: 4 }}>↑ 골든크로스 매수</div>
                                <div style={{ fontSize: 11, color: '#f05a5a' }}>↓ 데드크로스 매도</div>
                            </div>
                        </>)}
                    </div>

                    {!isStarted ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>초기 투자금</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>₩</span>
                                    <input type="text" value={inputCash} onChange={e => setInputCash(e.target.value)} placeholder="100000000"
                                        style={{ width: 160, padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 13 }} />
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {[{ label: '1천만', value: '10000000' }, { label: '5천만', value: '50000000' }, { label: '1억', value: '100000000' }].map(p => (
                                            <button key={p.value} onClick={() => setInputCash(p.value)} style={btnStyle(inputCash === p.value, '#4f8eff')}>{p.label}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleStart} style={{
                                marginTop: 20, padding: '10px 32px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                                cursor: 'pointer', border: 'none',
                                background: 'linear-gradient(135deg, #10d9a0, #4f8eff)', color: '#000',
                            }}>▶ 시뮬레이션 시작</button>
                        </div>
                    ) : (
                        <button onClick={handleReset} style={{
                            padding: '8px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)', color: 'var(--muted)',
                        }}>⏹ 시뮬레이션 초기화</button>
                    )}
                </div>
            </div>

            {isStarted && (
                <>
                    {/* 추가 투자 */}
                    <div className="card">
                        <div className="card-header"><span className="card-title">➕ 추가 투자</span></div>
                        <div className="card-body">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>추가 금액</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>₩</span>
                                        <input type="text" value={addCash} onChange={e => setAddCash(e.target.value)} placeholder="10000000"
                                            style={{ width: 140, padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: 13 }} />
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {[{ label: '1천만', value: '10000000' }, { label: '5천만', value: '50000000' }, { label: '1억', value: '100000000' }].map(p => (
                                                <button key={p.value} onClick={() => setAddCash(p.value)} style={{
                                                    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                                    cursor: 'pointer', border: 'none',
                                                    background: addCash === p.value ? '#4f8eff' : 'rgba(255,255,255,0.06)',
                                                    color: addCash === p.value ? '#fff' : 'var(--muted)',
                                                }}>{p.label}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={handleAddCash} style={{
                                    marginTop: 20, padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                                    cursor: 'pointer', border: 'none',
                                    background: 'linear-gradient(135deg, #4f8eff, #9945ff)', color: '#fff',
                                }}>💰 추가 투자</button>
                            </div>
                            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>
                                * 추가 투자금은 현금으로 추가되며 총 투자금 및 수익률 계산에 반영됩니다.
                            </div>
                        </div>
                    </div>

                    {/* 포트폴리오 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        {[
                            { label: '총 투자금',     value: krw(initialCash),  color: 'var(--text)',   icon: '💰' },
                            { label: '현재 평가금액', value: krw(evalValue),    color: cl(totalReturn), icon: '📊' },
                            { label: '총 수익률',     value: pct(totalReturn),  color: cl(totalReturn), icon: '📈' },
                            { label: '미실현 손익',   value: unrealizedPnL != null ? pct(unrealizedPnL) : '--', color: cl(unrealizedPnL), icon: '💹' },
                        ].map((k, i) => (
                            <div key={i} className="card" style={{ padding: '16px 20px' }}>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{k.icon} {k.label}</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: k.color, fontFamily: "'DM Mono', monospace" }}>{k.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* 현재 신호 */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">📡 현재 매매 신호</span>
                            <span className="card-badge badge-green">실시간</span>
                        </div>
                        <div className="card-body">
                            {isLoading ? (
                                <div style={{ color: 'var(--muted)', fontSize: 13 }}>신호 계산 중...</div>
                            ) : currentSignal ? (() => {
                                const cfg    = signalConfig[currentSignal.signal] ?? signalConfig.NONE;
                                const rsiVal = Number(currentSignal.value);
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                            <div style={{ padding: '16px 24px', borderRadius: 12, border: `1px solid ${cfg.border}`, background: cfg.bg, textAlign: 'center', minWidth: 160 }}>
                                                <div style={{ fontSize: 28, marginBottom: 6 }}>{cfg.icon}</div>
                                                <div style={{ fontSize: 15, fontWeight: 800, color: cfg.color, marginBottom: 4 }}>{cfg.text}</div>
                                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{currentSignal.label}</div>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>현재 BTC 가격</div>
                                                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>{krw(currentPrice)}</div>
                                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>전략</div>
                                                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                                                    {indicator === 'RSI' ? `RSI(${rsiPeriod}) < ${buyThreshold} 매수 / > ${sellThreshold} 매도` : `MA${maShort} / MA${maLong} 크로스`}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <button onClick={handleBuy} disabled={cash <= 0 || holding > 0} style={{
                                                    padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                                                    cursor: cash <= 0 || holding > 0 ? 'not-allowed' : 'pointer', border: 'none',
                                                    background: cash <= 0 || holding > 0 ? 'rgba(255,255,255,0.05)' : '#10d9a0',
                                                    color: cash <= 0 || holding > 0 ? 'var(--muted)' : '#000',
                                                }}>🟢 가상 매수</button>
                                                <button onClick={handleSell} disabled={holding <= 0} style={{
                                                    padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                                                    cursor: holding <= 0 ? 'not-allowed' : 'pointer', border: 'none',
                                                    background: holding <= 0 ? 'rgba(255,255,255,0.05)' : '#f05a5a',
                                                    color: holding <= 0 ? 'var(--muted)' : '#fff',
                                                }}>🔴 가상 매도</button>
                                                <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>
                                                    {holding > 0 ? '● 보유 중' : '○ 미보유'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                                        {indicator === 'RSI' && (
                                            <div>
                                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>RSI 게이지</div>
                                                <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
                                                    <div style={{ position: 'absolute', left: 0, width: `${buyThreshold}%`, height: '100%', background: '#10d9a044', borderRadius: '4px 0 0 4px' }} />
                                                    <div style={{ position: 'absolute', left: `${buyThreshold}%`, width: `${sellThreshold - buyThreshold}%`, height: '100%', background: 'rgba(255,255,255,0.04)' }} />
                                                    <div style={{ position: 'absolute', left: `${sellThreshold}%`, right: 0, height: '100%', background: '#f05a5a44', borderRadius: '0 4px 4px 0' }} />
                                                    <div style={{ position: 'absolute', left: `${buyThreshold}%`, top: -4, bottom: -4, width: 1, background: '#10d9a0' }} />
                                                    <div style={{ position: 'absolute', left: `${sellThreshold}%`, top: -4, bottom: -4, width: 1, background: '#f05a5a' }} />
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: `${Math.min(Math.max(rsiVal, 0), 100)}%`,
                                                        top: '50%', transform: 'translate(-50%, -50%)',
                                                        width: 14, height: 14, borderRadius: '50%',
                                                        background: rsiVal < buyThreshold ? '#10d9a0' : rsiVal > sellThreshold ? '#f05a5a' : '#f5c842',
                                                        border: '2px solid #1a1d27', zIndex: 2,
                                                    }} />
                                                </div>
                                                <div style={{ position: 'relative', marginTop: 8, height: 16 }}>
                                                    <span style={{ position: 'absolute', left: 0, fontSize: 10, color: '#10d9a0' }}>0 — 매수</span>
                                                    <span style={{ position: 'absolute', left: `${buyThreshold}%`, transform: 'translateX(-50%)', fontSize: 10, color: '#10d9a0' }}>{buyThreshold}</span>
                                                    <span style={{ position: 'absolute', left: `${sellThreshold}%`, transform: 'translateX(-50%)', fontSize: 10, color: '#f05a5a' }}>{sellThreshold}</span>
                                                    <span style={{ position: 'absolute', right: 0, fontSize: 10, color: '#f05a5a' }}>100 — 매도</span>
                                                </div>
                                                <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${cfg.border}` }}>
                                                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>현재 RSI </span>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: cfg.color, fontFamily: "'DM Mono', monospace" }}>{currentSignal.value}</span>
                                                    <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>
                                                        {rsiVal < buyThreshold ? '✅ 매수 구간'
                                                            : rsiVal > sellThreshold ? '🔴 매도 구간'
                                                            : `매수 신호까지 ${(rsiVal - buyThreshold).toFixed(1)} 남음 / 매도 신호까지 ${(sellThreshold - rsiVal).toFixed(1)} 남음`}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {indicator === 'MA' && (
                                            <div>
                                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>MA 크로스 상태</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ flex: 1, padding: '12px 16px', background: 'rgba(16,217,160,0.05)', borderRadius: 8, border: '1px solid #10d9a033', textAlign: 'center' }}>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>MA{maShort} (단기)</div>
                                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#10d9a0', fontFamily: "'DM Mono', monospace" }}>
                                                            {currentSignal.label?.match(/MA\d+=(\S+)/)?.[1] ?? '--'}
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: 22, fontWeight: 700, color: cfg.color }}>
                                                        {currentSignal.signal === 'BUY' ? '>' : currentSignal.signal === 'SELL' ? '<' : '≈'}
                                                    </div>
                                                    <div style={{ flex: 1, padding: '12px 16px', background: 'rgba(79,142,255,0.05)', borderRadius: 8, border: '1px solid #4f8eff33', textAlign: 'center' }}>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>MA{maLong} (장기)</div>
                                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#4f8eff', fontFamily: "'DM Mono', monospace" }}>
                                                            {currentSignal.label?.match(/MA\d+=(\S+).*MA\d+=(\S+)/)?.[2] ?? '--'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${cfg.border}`, fontSize: 13, color: cfg.color }}>
                                                    {currentSignal.signal === 'BUY'  ? '🟢 골든크로스 — 단기 MA가 장기 MA 위에 있어요. 상승 추세 신호.' :
                                                     currentSignal.signal === 'SELL' ? '🔴 데드크로스 — 단기 MA가 장기 MA 아래에 있어요. 하락 추세 신호.' :
                                                     '🟡 크로스 없음 — 방향 전환 대기 중이에요.'}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: 'var(--muted)' }}>
                                            {holding === 0
                                                ? currentSignal.signal === 'BUY'
                                                    ? '✅ 매수 조건 충족 — 지금 가상 매수를 실행해보세요!'
                                                    : '💡 매수 신호 발생 시 오른쪽 "가상 매수" 버튼을 눌러 포지션을 진입하세요.'
                                                : currentSignal.signal === 'SELL'
                                                ? '✅ 매도 조건 충족 — 지금 가상 매도를 실행해보세요!'
                                                : '💡 매도 신호 발생 시 오른쪽 "가상 매도" 버튼을 눌러 포지션을 청산하세요.'}
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div style={{ color: 'var(--muted)', fontSize: 13 }}>신호를 계산할 수 없습니다.</div>
                            )}
                        </div>
                    </div>

                    {/* 보유 현황 */}
                    <div className="card">
                        <div className="card-header"><span className="card-title">💼 보유 현황</span></div>
                        <div className="card-body">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                {[
                                    { label: '보유 현금', value: krw(cash), color: 'var(--text)' },
                                    { label: '보유 BTC',  value: holding > 0 ? holding.toFixed(6) + ' BTC' : '0 BTC', color: '#f5c842',
                                      sub: holding > 0 ? '평가 ' + krw(holding * (currentPrice ?? 0)) : null },
                                    { label: '매수 단가', value: holding > 0 ? krw(buyPrice) : '--', color: holding > 0 ? 'var(--text)' : 'var(--muted)',
                                      sub: holding > 0 && currentPrice ? pct(unrealizedPnL) + ' 수익 중' : null, subColor: cl(unrealizedPnL) },
                                ].map((item, i) => (
                                    <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{item.label}</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontFamily: "'DM Mono', monospace" }}>{item.value}</div>
                                        {item.sub && <div style={{ fontSize: 11, color: item.subColor ?? 'var(--muted)', marginTop: 4 }}>{item.sub}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 거래 로그 */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">📝 거래 로그</span>
                            <span className="card-badge badge-blue">{trades.length}회 거래</span>
                        </div>
                        <div className="card-body">
                            {trades.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0', fontSize: 13 }}>
                                    아직 거래 내역이 없습니다. 신호에 따라 가상 매수/매도를 실행해보세요.
                                </div>
                            ) : (
                                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                                {['유형', '시간', '가격', '금액', '수익률'].map(h => (
                                                    <th key={h} style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted)', textAlign: 'left', fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {trades.map((t, i) => {
                                                const d = new Date(t.ts);
                                                const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
                                                return (
                                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                        <td style={{ padding: '10px 12px' }}>
                                                            <span style={{
                                                                fontSize: 12, fontWeight: 700,
                                                                color:      t.type === 'BUY' ? '#10d9a0' : t.type === 'SELL' ? '#f05a5a' : '#4f8eff',
                                                                background: t.type === 'BUY' ? '#10d9a018' : t.type === 'SELL' ? '#f05a5a18' : '#4f8eff18',
                                                                padding: '2px 8px', borderRadius: 4,
                                                            }}>
                                                                {t.type === 'BUY' ? '매수' : t.type === 'SELL' ? '매도' : '추가투자'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text2)', fontFamily: "'DM Mono', monospace" }}>{timeStr}</td>
                                                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text)', fontFamily: "'DM Mono', monospace" }}>{t.type === 'ADD' ? '--' : krw(t.price)}</td>
                                                        <td style={{ padding: '10px 12px', fontSize: 12, color: t.type === 'ADD' ? '#4f8eff' : 'var(--text2)', fontFamily: "'DM Mono', monospace" }}>
                                                            {t.type === 'ADD' ? '+' + krw(t.value) : krw(t.value)}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                                                            {t.profit != null ? <span style={{ color: cl(t.profit) }}>{pct(t.profit)}</span> : <span style={{ color: 'var(--muted)' }}>--</span>}
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
                </>
            )}

            {!isStarted && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>전략을 설정하고 시뮬레이션을 시작하세요</div>
                    <div style={{ fontSize: 13 }}>실시간 BTC 가격 기반으로 매매 신호를 확인하고 가상 거래를 실행할 수 있어요</div>
                </div>
            )}
        </div>
    );
}

// ─── Suspense 래퍼 (useSearchParams 필수) ─────────────────
export default function SimulatorPage() {
    return (
        <Suspense fallback={<div style={{ padding: 24, color: 'var(--muted)' }}>로딩 중...</div>}>
            <SimulatorInner />
        </Suspense>
    );
}