'use client';
import { useState } from 'react';
import Script from 'next/script';
import { useAuth }       from './hooks/useAuth';
import { useMarketData } from './hooks/useMarketData';
import Topbar            from './components/Topbar';
import LoginModal        from './components/LoginModal';
import MetricsRow        from './components/MetricsRow';
import CrossMarketChart  from './components/CrossMarketChart';
import RiskScore         from './components/RiskScore';
import AIInsight         from './components/AIInsight';
import EventAlert        from './components/EventAlert';
import VolumeBacktest    from './components/VolumeBacktest';
import CorrMatrix        from './components/CorrMatrix';
import HeatmapCard       from './components/HeatmapCard';
import TickerTable       from './components/TickerTable';
import './styles/dashboard.css';

export default function Home() {
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [chartsReady, setChartsReady]       = useState(false);
    const { cryptoData, fearGreed, kospiData, kosdaqData, stockData, krStockData, fetchCrossMarketHistory } = useMarketData();
    const { isLoggedIn, isLoading, handleKakaoLogin, handleLogout } = useAuth();

    const fgValue = fearGreed ? Number(fearGreed.value) : null;

    const marketPhase = fgValue === null ? '--' : fgValue >= 65 ? '🐂 BULL' : fgValue >= 35 ? '↔ SIDE' : '🐻 BEAR';
    const marketColor = fgValue === null ? 'var(--muted2)' : fgValue >= 65 ? 'var(--green)' : fgValue >= 35 ? 'var(--yellow)' : 'var(--red)';
    const marketDesc  = fgValue === null ? '데이터 로딩 중...'
        : fgValue >= 65 ? '📈 탐욕 구간이에요. 추격 매수 주의, 익절 고려하세요.'
        : fgValue >= 50 ? '⚖️ 중립 구간이에요. 방향성 나올 때까지 관망하세요.'
        : fgValue >= 35 ? '🟡 약한 공포 구간이에요. 분할 매수 고려해볼 만해요.'
        : '📉 극단적 공포 구간이에요. 바닥 신호일 수 있어요.';
    const marketAction = fgValue === null ? '' : fgValue >= 65 ? '→ ⚠️ 매도 고려' : fgValue >= 50 ? '→ 👀 관망' : fgValue >= 35 ? '→ 🟡 분할 매수' : '→ ✅ 적극 매수';
    const actionColor  = fgValue === null ? 'var(--muted2)' : fgValue >= 65 ? 'var(--red)' : fgValue >= 50 ? 'var(--muted2)' : fgValue >= 35 ? 'var(--yellow)' : 'var(--green)';

    const getTodayStrategy = () => {
        const btcChg     = cryptoData?.[0]?.price_change_percentage_24h || 0;
        const samsungChg = krStockData?.find(s => s.symbol === '005930')?.change || 0;
        const hynixChg   = krStockData?.find(s => s.symbol === '000660')?.change || 0;
        const nvdaChg    = stockData?.find(s => s.symbol === 'NVDA')?.change || 0;
        const semiAvg    = (samsungChg + hynixChg + nvdaChg) / 3;
        const reasons    = [];
        let action = '👀 관망', color = 'var(--yellow)';

        if (fgValue !== null) reasons.push(fgValue >= 65 ? '시장 탐욕 과열 구간' : fgValue >= 35 ? `시장 SIDE (공포/탐욕 ${fgValue})` : '시장 공포 구간 — 바닥 가능성');
        if (btcChg < -2)     reasons.push(`BTC 약세 (${btcChg.toFixed(1)}%)`);
        else if (btcChg > 2) reasons.push(`BTC 강세 (${btcChg.toFixed(1)}%)`);
        else                 reasons.push(`BTC 횡보 (${btcChg.toFixed(1)}%)`);
        if (semiAvg > 2)      reasons.push(`반도체 강세 — 삼성 ${samsungChg.toFixed(1)}% / 하이닉스 ${hynixChg.toFixed(1)}%`);
        else if (semiAvg < -2) reasons.push(`반도체 약세 — 삼성 ${samsungChg.toFixed(1)}% / 하이닉스 ${hynixChg.toFixed(1)}%`);
        else                  reasons.push(`반도체 보합 — 삼성 ${samsungChg.toFixed(1)}% / 하이닉스 ${hynixChg.toFixed(1)}%`);

        if (fgValue !== null && fgValue < 35 && btcChg < -3)  { action = '✅ 분할 매수'; color = 'var(--green)'; }
        else if (fgValue !== null && fgValue >= 65 && btcChg > 3) { action = '⚠️ 익절 고려'; color = 'var(--red)'; }
        else if (semiAvg > 3 && btcChg < 0) { action = '🔀 반도체 우선'; color = 'var(--accent)'; }
        return { action, color, reasons };
    };
    const strategy = getTodayStrategy();

    const getCryptoVsSemi = () => {
        const btcChg     = cryptoData?.[0]?.price_change_percentage_24h || 0;
        const samsungChg = krStockData?.find(s => s.symbol === '005930')?.change || 0;
        const hynixChg   = krStockData?.find(s => s.symbol === '000660')?.change || 0;
        const nvdaChg    = stockData?.find(s => s.symbol === 'NVDA')?.change || 0;
        const semiAvg    = (samsungChg + hynixChg + nvdaChg) / 3;
        const sameDir    = Math.sign(btcChg) === Math.sign(semiAvg);
        const diff       = Math.abs(btcChg - semiAvg).toFixed(1);
        return {
            btcChg, semiAvg, sameDir, diff, samsungChg, hynixChg, nvdaChg,
            corr: sameDir ? (diff < 2 ? '강한 동조' : '약한 동조') : (diff > 4 ? '강한 디커플링' : '디커플링'),
            corrColor: sameDir ? 'var(--green)' : 'var(--yellow)',
            insight: sameDir
                ? '코인과 반도체가 같은 방향이에요. 글로벌 리스크 온/오프 동반 흐름.'
                : `반도체(${semiAvg >= 0 ? '+' : ''}${semiAvg.toFixed(1)}%)와 BTC(${btcChg >= 0 ? '+' : ''}${btcChg.toFixed(1)}%)가 반대 방향이에요. 개별 재료 각각 판단 필요.`,
            warning: !sameDir && semiAvg > 2 ? '⚠️ 반도체 강세인데 BTC 약세 — 코인 공격적 매수 위험' : null
        };
    };
    const cvsemi = getCryptoVsSemi();

    const getSignalItem = (symbol, label, type, chg) => {
        const absChg = Math.abs(chg);
        const priority = absChg >= 5 ? '🔥' : absChg >= 2 ? '⚡' : 'ℹ️';
        const action   = chg >= 3 ? '⚠️ 과열' : chg >= 0.5 ? '✅ 매수' : chg >= -2 ? '👀 관망' : '🔴 주의';
        const color    = chg >= 3 ? 'var(--yellow)' : chg >= 0.5 ? 'var(--green)' : chg >= -2 ? 'var(--muted2)' : 'var(--red)';
        return { symbol, label, type, change: chg, priority, action, color };
    };

    const cryptoSignals = (cryptoData || []).map(c =>
        getSignalItem(c.symbol, c.symbol, '코인', c.price_change_percentage_24h || 0)
    ).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    const semiSignals = [
        ...(krStockData || []).map(s => getSignalItem(s.symbol, s.name, '한국주식', s.change || 0)),
        ...(stockData   || []).filter(s => s.symbol === 'NVDA').map(s => getSignalItem(s.symbol, s.symbol, '미국주식', s.change || 0)),
    ].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    const SignalCard = ({ s }) => (
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 14px', minWidth: 90, textAlign: 'center', borderTop: `2px solid ${s.color}` }}>
            <div style={{ fontSize: 11, marginBottom: 2 }}>{s.priority}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--muted2)' }}>{s.type}</div>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginTop: 4 }}>{s.action}</div>
            <div style={{ fontSize: 11, color: 'var(--muted2)' }}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</div>
        </div>
    );

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
            <Script
                src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"
                onLoad={() => { console.log('[CHART.JS] 로드 완료'); setChartsReady(true); }}
            />
            {showLoginModal && (
                <LoginModal onLogin={handleKakaoLogin} onClose={() => setShowLoginModal(false)} />
            )}
            <Topbar isLoggedIn={isLoggedIn} isLoading={isLoading} onLogin={() => setShowLoginModal(true)} onLogout={handleLogout} />

            <div className="content">

                {/* ① 오늘의 전략 */}
                <div className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${strategy.color}` }}>
                    <div className="card-header">
                        <span className="card-title">🔥 오늘의 전략</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: strategy.color }}>{strategy.action}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                        {strategy.reasons.map((r, i) => (
                            <div key={i} style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6 }}>
                                <span style={{ color: 'var(--accent)', marginRight: 4 }}>{i === 0 ? '①' : i === 1 ? '②' : '③'}</span>{r}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ② 시장 상태 */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header">
                        <span className="card-title">🌐 시장 상태</span>
                        <span className="card-badge badge-green">실시간</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 0' }}>
                        <div style={{ textAlign: 'center', minWidth: 90 }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: marketColor }}>{marketPhase}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>시장 국면</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: 'var(--muted2)' }}>공포/탐욕 지수</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{fgValue ?? '--'}</span>
                            </div>
                            <div style={{ background: 'var(--border)', borderRadius: 4, height: 5, marginBottom: 8 }}>
                                <div style={{ width: `${fgValue ?? 0}%`, height: '100%', borderRadius: 4, background: marketColor, transition: 'width 0.6s' }} />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--muted2)', lineHeight: 1.6, marginBottom: 6 }}>{marketDesc}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: actionColor }}>{marketAction}</div>
                        </div>
                    </div>
                </div>

                {/* ③ 코인 vs 반도체 인사이트 */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header">
                        <span className="card-title">🧠 코인 vs 반도체</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: cvsemi.corrColor }}>{cvsemi.corr}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, padding: '10px 0' }}>
                        <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 6 }}>🪙 코인</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: cvsemi.btcChg >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                BTC {cvsemi.btcChg >= 0 ? '+' : ''}{cvsemi.btcChg.toFixed(2)}%
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', fontSize: 18, color: cvsemi.corrColor }}>
                            {cvsemi.sameDir ? '↔' : '✕'}
                        </div>
                        <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 6 }}>💾 반도체</div>
                            <div style={{ fontSize: 12, color: 'var(--text)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                <span style={{ color: cvsemi.samsungChg >= 0 ? 'var(--green)' : 'var(--red)' }}>삼성 {cvsemi.samsungChg >= 0 ? '+' : ''}{cvsemi.samsungChg.toFixed(1)}%</span>
                                <span style={{ color: cvsemi.hynixChg >= 0 ? 'var(--green)' : 'var(--red)' }}>하이닉스 {cvsemi.hynixChg >= 0 ? '+' : ''}{cvsemi.hynixChg.toFixed(1)}%</span>
                                <span style={{ color: cvsemi.nvdaChg >= 0 ? 'var(--green)' : 'var(--red)' }}>NVDA {cvsemi.nvdaChg >= 0 ? '+' : ''}{cvsemi.nvdaChg.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted2)', paddingTop: 4, lineHeight: 1.6 }}>{cvsemi.insight}</div>
                    {cvsemi.warning && (
                        <div style={{ marginTop: 8, padding: '6px 12px', background: 'rgba(245,200,66,0.1)', borderRadius: 6, fontSize: 12, color: 'var(--yellow)' }}>
                            {cvsemi.warning}
                        </div>
                    )}
                </div>

                {/* ④ 종목 시그널 + 리스크 스코어 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">⚡ 종목 시그널</span>
                            <span className="card-badge badge-green">실시간</span>
                        </div>
                        <div style={{ paddingTop: 8 }}>
                            <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 8, fontWeight: 600 }}>🪙 CRYPTO</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                                {cryptoSignals.map(s => <SignalCard key={s.symbol} s={s} />)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 8, fontWeight: 600 }}>💾 SEMICONDUCTOR</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {semiSignals.map(s => <SignalCard key={s.symbol} s={s} />)}
                            </div>
                        </div>
                    </div>
                    <RiskScore />
                </div>

                {/* ⑤ 크로스마켓 차트 */}
                <div style={{ marginBottom: 16 }}>
                    <CrossMarketChart
                        fetchCrossMarketHistory={fetchCrossMarketHistory}
                        chartsReady={chartsReady}
                        chartId="priceChart-dashboard"
                    />
                </div>

                {/* ⑥ 주요 지표 */}
                <MetricsRow
                    cryptoData={cryptoData}
                    fearGreed={fearGreed}
                    kospiData={kospiData}
                    kosdaqData={kosdaqData}
                />

                {/* ⑦ 이벤트 감지 */}
                <div style={{ marginTop: 16 }}>
                    <EventAlert cryptoData={cryptoData} />
                </div>
                
                {/* ⑦-1 거래량 + 백테스팅 */}
                <div style={{ marginTop: 16 }}>
                    <VolumeBacktest chartsReady={chartsReady} />
                </div>

                {/* ⑦-2 상관관계 */}
                <div style={{ marginTop: 16 }}>
                    <CorrMatrix />
                </div>
                
                {/* ⑧ AI 인사이트 */}
                <div style={{ marginTop: 16 }}>
                    <AIInsight />
                </div>

                {/* ⑨ 포트폴리오 */}
                <div className="card" style={{ marginTop: 16, marginBottom: 24 }}>
                    <div className="card-header">
                        <span className="card-title">💼 내 포트폴리오</span>
                        {!isLoggedIn && (
                            <span style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setShowLoginModal(true)}>
                                로그인 후 확인 →
                            </span>
                        )}
                    </div>
                    {isLoggedIn ? (
                        <div style={{ display: 'flex', gap: 12, padding: '12px 0' }}>
                            {[
                                { label: '총 자산', value: '₩89,420,000', color: 'var(--text)' },
                                { label: '총 수익률', value: '+12.4%', color: 'var(--green)' },
                                { label: '오늘 변화', value: '+₩340,000', color: 'var(--green)' },
                            ].map(item => (
                                <div key={item.label} style={{ flex: 1, textAlign: 'center', padding: 8, background: 'var(--surface2)', borderRadius: 8 }}>
                                    <div style={{ fontSize: 17, fontWeight: 700, color: item.color }}>{item.value}</div>
                                    <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>{item.label}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 13 }}>
                            🔒 로그인하면 내 포트폴리오를 볼 수 있어요
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}