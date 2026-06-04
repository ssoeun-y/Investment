'use client';
import { useState, useEffect, useMemo } from 'react';
import Script from 'next/script';
import { useAuth }       from '../hooks/useAuth';
import { useMarketData } from '../hooks/useMarketData';
import Topbar            from '../components/Topbar';
import LoginModal        from '../components/LoginModal';
import SankeyFlow        from './components/SankeyFlow';
import CorrTimeline      from './components/CorrTimeline';
import CorrHeatmap       from './components/CorrHeatmap';
import DecouplingAlert   from './components/DecouplingAlert';
import AdvantageTable    from './components/AdvantageTable';
import styles            from './correlation.module.css';
import                        '../styles/dashboard.css';

export default function CorrelationPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [now, setNow]                       = useState('');

  const {
    cryptoData, fearGreed, stockData, krStockData, fetchCrossMarketHistory,
  } = useMarketData();

  const { isLoggedIn, isLoading, handleKakaoLogin, handleLogout } = useAuth();

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);


  // BTC×NVDA 상관계수 proxy (방향 기반 근사)
  const corrProxy = useMemo(() => {
    const btcChg  = (cryptoData || []).find(c => c.symbol === 'BTC')?.price_change_percentage_24h ?? 0;
    const nvdaChg = (stockData  || []).find(s => s.symbol === 'NVDA')?.change ?? 0;
    const raw = btcChg * nvdaChg > 0
      ? Math.min(0.4 + (1 - Math.abs(btcChg - nvdaChg) * 0.02), 0.99)
      : Math.max(-0.4 - Math.abs(btcChg - nvdaChg) * 0.02, -0.99);
    return isNaN(raw) ? 0 : raw;
  }, [cryptoData, stockData]);

  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js" />
      {showLoginModal && (
        <LoginModal onLogin={handleKakaoLogin} onClose={() => setShowLoginModal(false)} />
      )}

      <Topbar
        isLoggedIn={isLoggedIn}
        isLoading={isLoading}
        onLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        now={now}
        activePage="correlation"
        stockData={stockData}
        krStockData={krStockData}
        cryptoData={cryptoData}
      />

      <div className={styles.content}>

        {/* 페이지 헤더 */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>상관관계 분석</h1>
          <p className={styles.pageSubtitle}>
            주식↔코인 자금 흐름 · 피어슨 상관계수 · 디커플링 신호 · 투자 유리도
          </p>
        </div>

        {/* ── 1. Sankey 자금 흐름 — 카드 꽉 채움 ─────────────── */}
        <div className={styles.sankeyCard}>
          <SankeyFlow
            stockData={stockData}
            krStockData={krStockData}
            cryptoData={cryptoData}
          />
        </div>

        {/* ── 2. 상관계수 시계열 ───────────────────────────────── */}
        <div className={styles.fullCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>BTC × NASDAQ 롤링 피어슨 상관계수</span>
            <span className={`${styles.cardBadge} ${styles.badgeInfo}`}>윈도우 7</span>
          </div>
          <div className={styles.cardBody}>
            <CorrTimeline
              fetchCrossMarketHistory={fetchCrossMarketHistory}
            />
          </div>
        </div>

        {/* ── 3. 히트맵 (60%) + 디커플링 (40%) — 나란히 ─────── */}
        <div className={styles.rowTwo}>
          <div className={styles.colPanel}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>주식 × 코인 히트맵</span>
            </div>
            <div className={styles.cardBody}>
              <CorrHeatmap
                stockData={stockData}
                krStockData={krStockData}
                cryptoData={cryptoData}
              />
            </div>
          </div>

          <div className={styles.colPanel}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>실시간 이탈 감지</span>
              <span className={`${styles.cardBadge} ${styles.badgeLive}`}>LIVE</span>
            </div>
            <div className={styles.cardBody}>
              <DecouplingAlert
                stockData={stockData}
                krStockData={krStockData}
                cryptoData={cryptoData}
                corrProxy={corrProxy}
              />
            </div>
          </div>
        </div>

        {/* ── 4. 투자 유리도 ──────────────────────────────────── */}
        <div className={styles.fullCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>주식 vs 코인 — 5개 지표 실시간 비교</span>
          </div>
          <div className={styles.cardBody}>
            <AdvantageTable
              stockData={stockData}
              krStockData={krStockData}
              cryptoData={cryptoData}
              fearGreed={fearGreed}
              corrProxy={corrProxy}
            />
          </div>
        </div>

      </div>
    </>
  );
}
