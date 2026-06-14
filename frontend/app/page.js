'use client';
import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { useAuth }       from './hooks/useAuth';
import { useMarketData } from './hooks/useMarketData';
import Topbar            from './components/Topbar';
import LoginModal        from './components/LoginModal';
import CrossMarketChart  from './components/CrossMarketChart';
import AIInsight         from './components/AIInsight';
import VolumeBacktest    from './components/VolumeBacktest';
import CorrMatrix        from './components/CorrMatrix';
import HeatmapCard       from './components/HeatmapCard';
import styles            from './page.module.css';
import                        './styles/dashboard.css';

// ─── 섹터 매핑 (stockData 종목 → 섹터)
const SECTOR_MAP = {
  NVDA: 'Technology', AAPL: 'Technology', MSFT: 'Technology',
  GOOGL: 'Technology', META: 'Technology', AMZN: 'Technology',
  TSLA: 'Consumer', F: 'Consumer', GM: 'Consumer',
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy',
  JPM: 'Financials', BAC: 'Financials', GS: 'Financials',
  JNJ: 'Healthcare', PFE: 'Healthcare', UNH: 'Healthcare',
  CAT: 'Industrials', BA: 'Industrials', GE: 'Industrials',
  AMT: 'Real Estate', PLD: 'Real Estate',
  '005930': 'Technology',  // 삼성전자
  '000660': 'Technology',  // SK하이닉스
  '035420': 'Technology',  // NAVER
  '051910': 'Consumer',    // LG화학
  '005380': 'Industrials', // 현대차
};

// ─── 스파크바 (실제 누적 변화율 배열 → 유니코드 블록 문자열)
const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
function valuesToSparkBar(values) {
  if (!values || values.length === 0) return '─';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map(v => SPARK_CHARS[Math.max(0, Math.min(7, Math.round(((v - min) / range) * 7)))]).join('');
}

// ─── 강도 점수 (1-5)
function dotScore(volChg) {
  const abs = Math.abs(parseFloat(volChg));
  if (abs >= 5)  return 5;
  if (abs >= 3)  return 4;
  if (abs >= 1.5) return 3;
  if (abs >= 0.5) return 2;
  return 1;
}

// ─── 섹터 집계
// stockData:  { symbol, change, price, volume }
// krStockData:{ symbol, name, change, price }
// cryptoData: { symbol, price_change_percentage_24h, current_price, total_volume }
function buildSectorData(stockData, krStockData, cryptoData) {
  const sectorMap = {};

  const allStocks = [
    ...(stockData   || []).map(s => ({ symbol: s.symbol, chg: s.change ?? 0, price: s.price ?? 1 })),
    ...(krStockData || []).map(s => ({ symbol: s.symbol, chg: s.change ?? 0, price: s.price ?? 1 })),
  ];

  for (const s of allStocks) {
    const sector = SECTOR_MAP[s.symbol] || 'Other';
    if (sector === 'Other') continue;
    if (!sectorMap[sector]) sectorMap[sector] = { flowSum: 0, volSum: 0, count: 0 };
    sectorMap[sector].flowSum += (s.chg / 100) * s.price;
    sectorMap[sector].volSum  += s.chg;
    sectorMap[sector].count   += 1;
  }

  if ((cryptoData || []).length > 0) {
    const cryptoAvg   = cryptoData.reduce((sum, c) => sum + (c.price_change_percentage_24h ?? 0), 0) / cryptoData.length;
    const cryptoPrice = cryptoData.find(c => c.symbol === 'BTC')?.current_price ?? 60000;
    sectorMap['Crypto'] = {
      flowSum: (cryptoAvg / 100) * cryptoPrice,
      volSum:  cryptoAvg * cryptoData.length,
      count:   cryptoData.length,
    };
  }

  return Object.entries(sectorMap)
    .map(([name, d]) => ({
      name,
      flowDisplay: d.flowSum >= 0 ? `+${d.flowSum.toFixed(0)}` : `${d.flowSum.toFixed(0)}`,
      volChg: d.count > 0 ? (d.volSum / d.count).toFixed(1) : '0.0',
      isUp:   d.flowSum >= 0,
    }))
    .sort((a, b) => parseFloat(b.flowDisplay) - parseFloat(a.flowDisplay));
}

// ─── 거래량 기반 시그널 계산
function buildSignals(stockData, krStockData, cryptoData) {
  const all = [
    ...(cryptoData  || []).map(c => ({
      symbol: c.symbol,
      name:   c.symbol,
      type:   '코인',
      chg:    c.price_change_percentage_24h ?? 0,
      vol:    c.total_volume ?? 0,
    })),
    ...(stockData   || []).map(s => ({
      symbol: s.symbol,
      name:   s.symbol,
      type:   '미국주식',
      chg:    s.change ?? 0,
      vol:    s.volume ?? 0,
    })),
    ...(krStockData || []).map(s => ({
      symbol: s.symbol,
      name:   s.name || s.symbol,
      type:   '한국주식',
      chg:    s.change ?? 0,
      vol:    s.volume ?? 0,
    })),
  ];

  return all
    .map(item => {
      const absChg = Math.abs(item.chg);
      let trigger, signal, strength;

      if      (absChg >= 5) { trigger = `급변동 ${absChg.toFixed(1)}%`;     strength = 90; }
      else if (absChg >= 3) { trigger = `거래량 급등 ${absChg.toFixed(1)}%`; strength = 72; }
      else if (absChg >= 1) { trigger = `변동 감지 ${absChg.toFixed(1)}%`;   strength = 45; }
      else                  { trigger = `보합 ${item.chg.toFixed(1)}%`;      strength = 20; }

      if      (item.chg >=  3) signal = '매수';
      else if (item.chg <= -3) signal = '매도';
      else                     signal = '관망';

      return { ...item, trigger, signal, strength };
    })
    .filter(s => Math.abs(s.chg) >= 1)
    .sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg))
    .slice(0, 6);
}

// ─── 자금 이동 방향 계산
function calcFlowDirection(cryptoData, stockData, krStockData) {
  const cryptoList = cryptoData || [];
  const usList     = stockData   || [];
  const krList     = krStockData || [];

  const btcChg = cryptoList.find(c => c.symbol === 'BTC')?.price_change_percentage_24h ?? 0;

  const cryptoAvg = cryptoList.length
    ? cryptoList.reduce((s, c) => s + (c.price_change_percentage_24h ?? 0), 0) / cryptoList.length
    : 0;

  const allStocks = [...usList, ...krList];
  const stockAvg  = allStocks.length
    ? allStocks.reduce((s, x) => s + (x.change ?? 0), 0) / allStocks.length
    : 0;

  const samsungChg = krList.find(s => s.symbol === '005930')?.change ?? 0;
  const hynixChg   = krList.find(s => s.symbol === '000660')?.change ?? 0;
  const nvdaChg    = usList.find(s => s.symbol === 'NVDA')?.change   ?? 0;

  const cryptoStrong = cryptoAvg >= stockAvg;
  const diff         = Math.abs(cryptoAvg - stockAvg);
  const intensity    = Math.min(Math.round(50 + diff * 4), 90);

  return {
    direction:  cryptoStrong ? '주식 → 코인' : '코인 → 주식',
    toCrypto:   cryptoStrong ? intensity : 100 - intensity,
    toStock:    cryptoStrong ? 100 - intensity : intensity,
    btcChg,
    samsungChg,
    hynixChg,
    nvdaChg,
    stockAvg:   stockAvg.toFixed(2),
    cryptoAvg:  cryptoAvg.toFixed(2),
    sameDir:    Math.sign(cryptoAvg) === Math.sign(stockAvg),
    diff:       diff.toFixed(1),
  };
}

export default function Home() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [chartsReady, setChartsReady]       = useState(false);
  const [now, setNow]                       = useState('');

  // 섹터별 변화율 실제 누적 히스토리 (최대 5개, 60초마다 append)
  const sectorHistoryRef = useRef({});

  const {
    cryptoData, fearGreed, kospiData, kosdaqData,
    stockData, krStockData, fetchCrossMarketHistory,
  } = useMarketData();

  const { isLoggedIn, isLoading, handleKakaoLogin, handleLogout } = useAuth();

  // 실시간 시계
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 60초마다 갱신되는 실제 섹터 변화율을 최대 5개 누적
  useEffect(() => {
    if (!stockData.length && !krStockData.length && !cryptoData.length) return;
    const currentSectors = buildSectorData(stockData, krStockData, cryptoData);
    const hist = sectorHistoryRef.current;
    currentSectors.forEach(sec => {
      if (!hist[sec.name]) hist[sec.name] = [];
      hist[sec.name] = [...hist[sec.name], parseFloat(sec.volChg)].slice(-5);
    });
  }, [stockData, krStockData, cryptoData]);

  // ─── 파생값 계산
  const fgValue  = fearGreed ? Number(fearGreed.value) : null;
  const flow     = calcFlowDirection(cryptoData, stockData, krStockData);
  const signals  = buildSignals(stockData, krStockData, cryptoData);
  const sectors  = buildSectorData(stockData, krStockData, cryptoData);

  // BTC / NVDA 변화율
  const btcChg  = cryptoData?.find(c => c.symbol === 'BTC')?.price_change_percentage_24h ?? 0;
  const nvdaChg = stockData?.find(s => s.symbol === 'NVDA')?.change ?? 0;

  // 간이 상관계수 (BTC × NVDA, 일중 방향 기반)
  const rawCorr = (btcChg * nvdaChg > 0)
    ? Math.min(0.4 + (1 - Math.abs(btcChg - nvdaChg) * 0.02), 0.99)
    : Math.max(-0.4 - (Math.abs(btcChg - nvdaChg) * 0.02), -0.99);
  const corrProxy = isNaN(rawCorr) ? 0 : rawCorr;
  const corrAbs   = Math.abs(corrProxy).toFixed(2);

  // 시장 국면 색상 (공포탐욕 게이지·카드에 사용)
  const phaseColor = fgValue === null ? '#888' : fgValue >= 65 ? '#4ade80' : fgValue >= 35 ? '#facc15' : '#f87171';

  // 코스피/코스닥 — 훅에서 { label, price, change }
  const kospiVal  = kospiData?.price  ?? '--';
  const kospiChg  = kospiData?.change ?? 0;
  const kosdaqVal = kosdaqData?.price ?? '--';
  const kosdaqChg = kosdaqData?.change ?? 0;

  // 공포/탐욕 게이지 바늘 좌표
  const fgAngle = fgValue !== null ? ((fgValue / 100) * 180 - 180) * (Math.PI / 180) : null;
  const fgX2    = fgAngle !== null ? (60 + 42 * Math.cos(fgAngle)).toFixed(1) : null;
  const fgY2    = fgAngle !== null ? (65 + 42 * Math.sin(fgAngle)).toFixed(1) : null;

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"
        onLoad={() => setChartsReady(true)}
      />
      {showLoginModal && (
        <LoginModal onLogin={handleKakaoLogin} onClose={() => setShowLoginModal(false)} />
      )}

      <Topbar
        isLoggedIn={isLoggedIn}
        isLoading={isLoading}
        onLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        now={now}
        activePage="dashboard"
        stockData={stockData}
        krStockData={krStockData}
        cryptoData={cryptoData}
      />

      <div className={styles.content}>

        {/* ══ 티커 테이프 ═══════════════════════════════════════════ */}
        <div className={styles.tickerTape}>
          {[
            { label: 'KOSPI',  val: kospiVal  !== '--' ? Number(kospiVal).toLocaleString()  : '--', chg: kospiChg },
            { label: 'KOSDAQ', val: kosdaqVal !== '--' ? Number(kosdaqVal).toLocaleString() : '--', chg: kosdaqChg },
            ...(stockData  || []).slice(0, 4).map(s => ({ label: s.symbol, val: s.price?.toLocaleString() ?? '--', chg: s.change ?? 0 })),
            ...(cryptoData || []).slice(0, 3).map(c => ({ label: c.symbol, val: c.current_price ? `$${c.current_price.toLocaleString()}` : '--', chg: c.price_change_percentage_24h ?? 0 })),
            { label: 'F&G', val: fgValue ?? '--', chg: 0 },
          ].map((t, i, arr) => (
            <span key={i} className={styles.tickerItem}>
              <span className={styles.tickerName}>{t.label}</span>
              <span className={styles.tickerVal}>{t.val}</span>
              {t.chg !== 0 && (
                <span className={Number(t.chg) >= 0 ? styles.tickerUp : styles.tickerDn}>
                  {Number(t.chg) >= 0 ? '+' : ''}{Number(t.chg).toFixed(2)}%
                </span>
              )}
              {i < arr.length - 1 && <span className={styles.tickerDiv} />}
            </span>
          ))}
        </div>

        {/* ══ ZONE A — 시장 체온계 (4 KPI 카드) ════════════════════ */}
        <div className={styles.zoneLabel}>시장 체온계</div>
        <div className={styles.kpiRow}>

          {/* KOSPI / KOSDAQ */}
          <div className={styles.kpiCard} style={{ cursor: 'pointer' }}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>KOSPI / KOSDAQ</span>
              <span className={styles.kpiSource}>KRX</span>
            </div>
            <div className={styles.kpiDual}>
              <div>
                <div className={styles.kpiVal}>
                  {kospiVal !== '--' ? Number(kospiVal).toLocaleString() : '--'}
                </div>
                <div className={styles.kpiSub} style={{ color: kospiChg >= 0 ? '#4ade80' : '#f87171' }}>
                  KOSPI {typeof kospiChg === 'number' ? (kospiChg >= 0 ? '+' : '') + kospiChg.toFixed(2) + '%' : '--'}
                </div>
              </div>
              <div className={styles.kpiDualDiv} />
              <div>
                <div className={styles.kpiVal} style={{ fontSize: 16 }}>
                  {kosdaqVal !== '--' ? Number(kosdaqVal).toLocaleString() : '--'}
                </div>
                <div className={styles.kpiSub} style={{ color: kosdaqChg >= 0 ? '#4ade80' : '#f87171' }}>
                  KOSDAQ {typeof kosdaqChg === 'number' ? (kosdaqChg >= 0 ? '+' : '') + kosdaqChg.toFixed(2) + '%' : '--'}
                </div>
              </div>
            </div>
          </div>

          {/* BTC / USD */}
          <div className={styles.kpiCard} style={{ cursor: 'pointer' }}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>BTC / USD</span>
              <span className={styles.kpiSource}>CoinGecko</span>
            </div>
            <div className={styles.kpiVal} style={{ fontSize: 18 }}>
              {cryptoData?.find(c => c.symbol === 'BTC')?.current_price
                ? `$${cryptoData.find(c => c.symbol === 'BTC').current_price.toLocaleString()}`
                : '--'}
            </div>
            <div className={styles.kpiSub} style={{ color: btcChg >= 0 ? '#4ade80' : '#f87171' }}>
              {btcChg >= 0 ? '+' : ''}{btcChg.toFixed(2)}% (24h)
            </div>
          </div>

          {/* 주식↔코인 상관도 */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>주식↔코인 상관도</span>
              <span className={styles.kpiSource}>BTC × NVDA</span>
            </div>
            <div className={styles.kpiVal}>{corrAbs}</div>
            <div className={styles.kpiSub} style={{ color: Number(corrAbs) >= 0.6 ? '#facc15' : '#4ade80' }}>
              {Number(corrAbs) >= 0.7 ? '강한 동조 — 분산 효과 낮음'
               : Number(corrAbs) >= 0.4 ? '중간 동조'
               : '낮은 상관 — 분산 효과 있음'}
            </div>
          </div>

          {/* 공포/탐욕 */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiLabel}>공포/탐욕 지수</span>
              <span className={styles.kpiSource}>alt.me</span>
            </div>
            <div className={styles.kpiVal} style={{ color: phaseColor }}>{fgValue ?? '--'}</div>
            <div className={styles.kpiSub} style={{ color: phaseColor }}>
              {fgValue === null ? '로딩 중'
               : fgValue >= 65 ? '탐욕 — 추격 매수 주의'
               : fgValue >= 35 ? '중립 — 방향성 대기'
               : '공포 — 분할 매수 고려'}
            </div>
          </div>

        </div>

        {/* ══ ZONE B — 차트 + 자금 이동 패널 ══════════════════════════ */}
        <div className={styles.zoneLabel}>자금 흐름 차트</div>
        <div className={styles.zoneB}>

          <div className={styles.chartMain}>
            <CrossMarketChart
              fetchCrossMarketHistory={fetchCrossMarketHistory}
              chartsReady={chartsReady}
              chartId="priceChart-dashboard"
            />
          </div>

          <div className={`${styles.flowPanel} ${styles.card}`}>

            <div className={styles.fpSection}>
              <div className={styles.fpLabel}>
                오늘 방향성 <span style={{ color: '#4ade80' }}>● LIVE</span>
              </div>
              <div className={styles.flowBarRow}>
                <span className={styles.flowName}>주식 → 코인</span>
                <div className={styles.flowTrack}>
                  <div className={styles.flowFill} style={{ width: `${flow.toCrypto}%`, background: '#f97316' }} />
                </div>
                <span className={styles.flowPct} style={{ color: '#f97316' }}>{flow.toCrypto}%</span>
              </div>
              <div className={styles.flowBarRow}>
                <span className={styles.flowName}>코인 → 주식</span>
                <div className={styles.flowTrack}>
                  <div className={styles.flowFill} style={{ width: `${flow.toStock}%`, background: '#60a5fa' }} />
                </div>
                <span className={styles.flowPct} style={{ color: '#60a5fa' }}>{flow.toStock}%</span>
              </div>
            </div>

            <div className={styles.fpSection}>
              <div className={styles.fpLabel}>섹터별 유입 Top 3</div>
              {sectors.slice(0, 3).map((sec, i) => {
                const maxFlow = Math.abs(parseFloat(sectors[0]?.flowDisplay ?? 1)) || 1;
                const barW = Math.min(100, (Math.abs(parseFloat(sec.flowDisplay)) / maxFlow) * 100);
                return (
                  <div key={sec.name} className={styles.sectorTopRow}>
                    <span className={styles.sectorTopRank}>{i + 1}</span>
                    <span className={styles.sectorTopName}>{sec.name}</span>
                    <div className={styles.sectorTopTrack}>
                      <div
                        className={styles.sectorTopFill}
                        style={{
                          width: `${barW}%`,
                          background: sec.isUp ? '#4ade80' : '#f87171',
                        }}
                      />
                    </div>
                    <span className={styles.sectorTopChg} style={{ color: sec.isUp ? '#4ade80' : '#f87171' }}>
                      {Number(sec.volChg) >= 0 ? '+' : ''}{sec.volChg}%
                    </span>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* ══ ZONE C — 히트맵 + 시그널 + 공포탐욕 ═══════════════════ */}
        <div className={styles.zoneLabel}>거래량 분석</div>
        <div className={styles.zoneC}>

          {/* 히트맵 */}
          <div className={`${styles.card} ${styles.flex1}`}>
            <HeatmapCard cryptoData={cryptoData || []} />
          </div>

          {/* 시그널 테이블 */}
          <div className={`${styles.card} ${styles.signalPanel} ${styles.flex1}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>거래량 시그널</span>
              <span className={`${styles.cardBadge} ${styles.badgeGreen}`}>{signals.length} active</span>
            </div>
            <table className={styles.signalTable}>
              <thead>
                <tr>
                  <th>종목</th>
                  <th>타입</th>
                  <th>트리거</th>
                  <th>강도</th>
                  <th>시그널</th>
                </tr>
              </thead>
              <tbody>
                {signals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.tdEmpty}>데이터 로딩 중...</td>
                  </tr>
                ) : signals.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td><span className={styles.typeBadge}>{s.type}</span></td>
                    <td className={styles.tdMuted}>{s.trigger}</td>
                    <td>
                      <div className={styles.strengthTrack}>
                        <div
                          className={styles.strengthFill}
                          style={{ width: `${s.strength}%`, background: s.chg >= 0 ? '#4ade80' : '#f87171' }}
                        />
                      </div>
                    </td>
                    <td>
                      <span className={
                        s.signal === '매수' ? styles.sigBuy
                        : s.signal === '매도' ? styles.sigSell
                        : styles.sigWatch
                      }>{s.signal}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 공포/탐욕 패널 */}
          <div className={`${styles.card} ${styles.fgPanel}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>시장 심리</span>
            </div>
            <div className={styles.fgGaugeWrap}>
              <svg viewBox="0 0 120 70" width="120" height="70">
                <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke="var(--border)" strokeWidth="12" strokeLinecap="round"/>
                <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeDasharray="157" strokeDashoffset="0" opacity="0.5"/>
                <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" strokeDasharray="157" strokeDashoffset="78" opacity="0.7"/>
                <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" strokeDasharray="157" strokeDashoffset="118" opacity="0.9"/>
                {fgX2 && fgY2 && (
                  <line x1="60" y1="65" x2={fgX2} y2={fgY2} stroke="var(--text)" strokeWidth="2" strokeLinecap="round"/>
                )}
                <circle cx="60" cy="65" r="4" fill="var(--text)"/>
              </svg>
              <div className={styles.fgNum}>{fgValue ?? '--'}</div>
              <div className={styles.fgLabel} style={{ color: phaseColor }}>
                {fgValue === null ? '--' : fgValue >= 65 ? '탐욕' : fgValue >= 35 ? '중립' : '공포'}
              </div>
              <div className={styles.fgPrev}>{fearGreed?.value_classification ?? '--'}</div>
            </div>
            <div className={styles.actionBox} style={{ borderColor: phaseColor }}>
              <div className={styles.actionLabel}>추천 액션</div>
              <div className={styles.actionVal} style={{ color: phaseColor }}>
                {fgValue === null ? '로딩 중'
                 : fgValue >= 65 ? '⚠️ 익절 고려'
                 : fgValue >= 50 ? '👀 관망'
                 : fgValue >= 35 ? '🟡 분할 매수'
                 : '✅ 적극 매수'}
              </div>
            </div>
          </div>

        </div>

        {/* ══ ZONE D — 섹터 로테이션 테이블 ══════════════════════════ */}
        <div className={styles.zoneLabel} id="sector">섹터 로테이션</div>
        <div className={`${styles.card} ${styles.sectorCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              섹터별 자금 유입 순위
              <span className={styles.cardTitleSub}> · 24h 변화</span>
            </span>
            <span className={`${styles.cardBadge} ${styles.badgeGreen}`}>실시간</span>
          </div>
          <table className={styles.sectorRotTable}>
            <thead>
              <tr>
                <th>섹터</th>
                <th>자금 유입</th>
                <th>거래량 변화</th>
                <th>추세</th>
                <th>강도</th>
                <th>판단</th>
              </tr>
            </thead>
            <tbody>
              {sectors.length === 0 ? (
                <tr><td colSpan={6} className={styles.tdEmpty}>데이터 집계 중...</td></tr>
              ) : sectors.map((sec, i) => {
                const history = sectorHistoryRef.current[sec.name] || [parseFloat(sec.volChg)];
                const spark = valuesToSparkBar(history);
                const sparkColor = sec.isUp ? '#4ade80' : '#f87171';
                const dots = dotScore(sec.volChg);
                const verdict =
                  i === 0 ? { label: '적극매수', cls: styles.verdictBuy2 }
                  : sec.isUp && Number(sec.volChg) > 0 ? { label: '매수', cls: styles.verdictBuy }
                  : !sec.isUp && Number(sec.volChg) < -2 ? { label: '회피', cls: styles.verdictSell }
                  : { label: '관망', cls: styles.verdictWatch };
                return (
                  <tr key={sec.name}>
                    <td className={styles.secNameCell}>
                      <span className={styles.secDot} style={{ background: sec.isUp ? '#4ade80' : '#f87171' }} />
                      {sec.name}
                    </td>
                    <td style={{ color: sec.isUp ? '#4ade80' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                      {sec.flowDisplay}
                    </td>
                    <td style={{ color: sec.isUp ? '#4ade80' : '#f87171' }}>
                      {Number(sec.volChg) >= 0 ? '+' : ''}{sec.volChg}%
                    </td>
                    <td>
                      <span className={styles.sparkBar} style={{ color: sparkColor }}>{spark}</span>
                    </td>
                    <td>
                      <span className={styles.dotRow}>
                        {Array.from({ length: 5 }, (_, d) => (
                          <span key={d} className={d < dots ? styles.dotFill : styles.dotEmpty}>●</span>
                        ))}
                      </span>
                    </td>
                    <td><span className={verdict.cls}>{verdict.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ══ 하단 상세 분석 ══════════════════════════════════════ */}
        <div style={{ marginTop: 16 }}>
          <div className={styles.zoneLabel}>상관관계 매트릭스</div>
          <CorrMatrix />
        </div>

        <div style={{ marginTop: 16 }}>
          <div className={styles.zoneLabel}>거래량 백테스팅</div>
          <VolumeBacktest chartsReady={chartsReady} />
        </div>

        <div style={{ marginTop: 16 }}>
          <div className={styles.zoneLabel}>AI 인사이트</div>
          <AIInsight
            cryptoData={cryptoData}
            stockData={stockData}
            fearGreed={fearGreed}
            kospiData={kospiData}
          />
        </div>

        {/* ══ 포트폴리오 ════════════════════════════════════════════ */}
        <div className={styles.card} style={{ marginTop: 16, marginBottom: 24 }}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>내 포트폴리오</span>
            {!isLoggedIn && (
              <span
                className={styles.loginLink}
                onClick={() => setShowLoginModal(true)}
              >
                로그인 후 확인 →
              </span>
            )}
          </div>
          {isLoggedIn ? (
            <div className={styles.portfolioRow}>
              {[
                { label: '총 자산',   value: '₩--' },
                { label: '총 수익률', value: '--%' },
                { label: '오늘 변화', value: '₩--' },
              ].map(item => (
                <div key={item.label} className={styles.portfolioCell}>
                  <div className={styles.portfolioVal}>{item.value}</div>
                  <div className={styles.portfolioLabel}>{item.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.portfolioLock}>
              🔒 로그인하면 내 포트폴리오를 볼 수 있어요
            </div>
          )}
        </div>

      </div>
    </>
  );
}