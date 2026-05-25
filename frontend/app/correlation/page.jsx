'use client';
import { useState, useEffect } from 'react';
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
  const [chartsReady, setChartsReady]       = useState(false);
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
        activePage="correlation"
      />

      <div className={styles.content}>

        {/* 페이지 헤더 */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>상관관계 분석</h1>
          <p className={styles.pageSubtitle}>
            주식↔코인 자금 흐름 · 피어슨 상관계수 · 디커플링 신호 · 투자 유리도
          </p>
        </div>

        {/* ── Section 1: Sankey 자금 흐름 ─────────────────────── */}
        <div className={styles.sectionLabel}>자금 흐름 다이어그램</div>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Sankey — 섹터 ↔ 코인 자금 이동</span>
            <span className={`${styles.cardBadge} ${styles.badgeLive}`}>실시간</span>
          </div>
          <div className={styles.cardBody}>
            <SankeyFlow
              stockData={stockData}
              krStockData={krStockData}
              cryptoData={cryptoData}
            />
          </div>
        </div>

        {/* ── Section 2: 상관계수 시계열 ──────────────────────── */}
        <div className={styles.sectionLabel}>상관계수 시계열</div>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>BTC × NASDAQ 롤링 피어슨 상관계수</span>
            <span className={`${styles.cardBadge} ${styles.badgeInfo}`}>윈도우 7</span>
          </div>
          <div className={styles.cardBody}>
            <CorrTimeline
              fetchCrossMarketHistory={fetchCrossMarketHistory}
              chartsReady={chartsReady}
            />
          </div>
        </div>

        {/* ── Section 3: 히트맵 + 디커플링 ───────────────────── */}
        <div className={styles.twoCol}>
          <div>
            <div className={styles.sectionLabel}>종목별 상관관계 매트릭스</div>
            <div className={styles.card}>
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
          </div>

          <div>
            <div className={styles.sectionLabel}>디커플링 신호 감지</div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>실시간 이탈 감지</span>
                <span className={`${styles.cardBadge} ${styles.badgeLive}`}>LIVE</span>
              </div>
              <div className={styles.cardBody}>
                <DecouplingAlert
                  stockData={stockData}
                  krStockData={krStockData}
                  cryptoData={cryptoData}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4: 투자 유리도 비교 ─────────────────────── */}
        <div className={styles.sectionLabel}>투자 유리도 비교</div>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>주식 vs 코인 — 5개 지표 실시간 비교</span>
          </div>
          <div className={styles.cardBody}>
            <AdvantageTable
              stockData={stockData}
              krStockData={krStockData}
              cryptoData={cryptoData}
              fearGreed={fearGreed}
            />
          </div>
        </div>

      </div>
    </>
  );
}
