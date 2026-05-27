'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { useAuth }       from '../../hooks/useAuth';
import { useMarketData } from '../../hooks/useMarketData';
import Topbar            from '../../components/Topbar';
import LoginModal        from '../../components/LoginModal';
import styles            from '../search.module.css';
import '../../styles/dashboard.css';

const SECTOR_MAP = {
  NVDA:'Technology', AAPL:'Technology', MSFT:'Technology', TSLA:'Technology',
  META:'Technology', GOOGL:'Technology', AMZN:'Consumer', WMT:'Consumer',
  XOM:'Energy', CVX:'Energy', JPM:'Financials', GS:'Financials',
  UNH:'Healthcare', JNJ:'Healthcare', CAT:'Industrials', GE:'Industrials',
  SPY:'Index', QQQ:'Index', '005930':'Technology', '005380':'Industrials',
};

const CRYPTO_SECTORS = ['BTC','ETH','XRP','SOL','BNB','ADA','DOGE'];

function fmtPrice(v, type) {
  if (v == null) return '--';
  if (type === 'coin') {
    if (v >= 10000)  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (v >= 1)      return `$${v.toFixed(2)}`;
    return `$${v.toFixed(6)}`;
  }
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function WatchButton({ symbol, type, isLoggedIn, onLoginRequired }) {
  const [watching, setWatching] = useState(false);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    // TODO: replace localStorage with GET /api/watchlist when endpoint is available
    try {
      const saved = JSON.parse(localStorage.getItem('watchlist') || '[]');
      setWatching(saved.some(w => w.symbol === symbol && w.type === type));
    } catch {}
  }, [symbol, type]);

  const toggle = async () => {
    if (!isLoggedIn) { onLoginRequired(); return; }
    setLoading(true);
    try {
      // TODO: call POST /api/watchlist or DELETE /api/watchlist when endpoint is available
      const saved  = JSON.parse(localStorage.getItem('watchlist') || '[]');
      const exists = saved.some(w => w.symbol === symbol && w.type === type);
      const next   = exists
        ? saved.filter(w => !(w.symbol === symbol && w.type === type))
        : [...saved, { symbol, type, addedAt: Date.now() }];
      localStorage.setItem('watchlist', JSON.stringify(next));
      setWatching(!exists);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`${styles.watchBtn}${watching ? ' ' + styles.active : ''}`}
      onClick={toggle}
      disabled={loading}
    >
      <span style={{ fontSize: 15 }}>{watching ? '♥' : '♡'}</span>
      {watching ? '관심 해제' : '관심 추가'}
    </button>
  );
}

export default function SearchDetailPage() {
  const { symbol }      = useParams();
  const searchParams    = useSearchParams();
  const type            = searchParams.get('type') || 'us';
  const router          = useRouter();
  const decodedSymbol   = decodeURIComponent(symbol);

  const [chartsReady, setChartsReady]       = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [detail, setDetail]                 = useState(null);
  const [detailLoading, setDetailLoading]   = useState(true);
  const [chartDays, setChartDays]           = useState(30);
  const [chartLabel, setChartLabel]         = useState('');
  const [chartNoData, setChartNoData]       = useState(false);
  const [now, setNow]                       = useState('');
  const canvasRef                           = useRef(null);
  const chartRef                            = useRef(null);

  const { isLoggedIn, isLoading, handleKakaoLogin, handleLogout } = useAuth();
  const { stockData, krStockData, cryptoData, fetchCrossMarketHistory } = useMarketData();

  // clock
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // real-time price from market data
  const liveItem = (() => {
    if (type === 'coin')   return cryptoData.find(c => c.symbol === decodedSymbol);
    if (type === 'kr')     return krStockData.find(s => s.symbol === decodedSymbol);
    return stockData.find(s => s.symbol === decodedSymbol);
  })();

  // fetch detail info
  useEffect(() => {
    let cancelled = false;
    setDetailLoading(true);

    const run = async () => {
      try {
        const res = await fetch(
          `/api/market/detail?symbol=${encodeURIComponent(decodedSymbol)}&type=${type}`,
          { credentials: 'include' }
        );
        if (!res.ok) throw new Error('no detail api');
        const data = await res.json();
        if (!cancelled) setDetail(data.result ?? data);
      } catch {
        // fallback: use liveItem from market data — set after market data loads
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [decodedSymbol, type]);

  // draw chart
  const drawChart = useCallback(async () => {
    if (!chartsReady || !canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    let chartPoints = null;

    // try dedicated chart endpoint
    try {
      const res = await fetch(
        `/api/market/chart?symbol=${encodeURIComponent(decodedSymbol)}&type=${type}&days=${chartDays}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        chartPoints = (data.result ?? data).prices ?? null;
      }
    } catch {}

    // fallback to cross market history
    if (!chartPoints) {
      const hist = await fetchCrossMarketHistory(chartDays);
      if (decodedSymbol === 'BTC' && hist?.btc) {
        chartPoints = hist.btc;
      } else if (decodedSymbol === 'NASDAQ' && hist?.nasdaq) {
        chartPoints = hist.nasdaq;
      } else if (['KOSPI', 'SPY'].includes(decodedSymbol) && hist?.kospi) {
        chartPoints = hist.kospi;
      } else if (type === 'kr' && hist?.kospi) {
        // KR 개별 종목 전용 차트 API 없을 때 KOSPI 지수 추이로 대체
        chartPoints = hist.kospi;
        setChartLabel('KOSPI 지수 추이 (개별 종목 차트 준비 중)');
      }
    }

    if (!chartPoints?.length) {
      setChartNoData(true);
      return;
    }
    setChartNoData(false);

    const labels = chartPoints.map(p =>
      new Date(Array.isArray(p) ? p[0] : p.t).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
    );
    const values = chartPoints.map(p => Array.isArray(p) ? p[1] : p.v);
    const isUp   = values[values.length - 1] >= values[0];
    const color  = isUp ? '#4ade80' : '#f87171';

    chartRef.current = new window.Chart(canvasRef.current.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: true,
          backgroundColor: ctx => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
            g.addColorStop(0, isUp ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            return g;
          },
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => fmtPrice(ctx.parsed.y, type) },
        }},
        scales: {
          x: { ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 8 }, grid: { display: false } },
          y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' }, position: 'right' },
        },
      },
    });
  }, [chartsReady, decodedSymbol, type, chartDays, fetchCrossMarketHistory]);

  useEffect(() => { drawChart(); }, [drawChart]);

  // related items (same sector)
  const relatedItems = (() => {
    const sector = SECTOR_MAP[decodedSymbol];
    if (!sector) return [];
    const us = stockData.filter(s => SECTOR_MAP[s.symbol] === sector && s.symbol !== decodedSymbol);
    const kr = krStockData.filter(s => SECTOR_MAP[s.symbol] === sector && s.symbol !== decodedSymbol);
    return [...us.slice(0, 3), ...kr.slice(0, 2)].slice(0, 4);
  })();

  // BTC correlation (direction-based proxy)
  const btcChg = cryptoData.find(c => c.symbol === 'BTC')?.price_change_percentage_24h ?? null;
  const ownChg = liveItem
    ? (type === 'coin' ? liveItem.price_change_percentage_24h : liveItem.change)
    : null;
  const corrProxy = (btcChg !== null && ownChg !== null && decodedSymbol !== 'BTC')
    ? (() => {
        const sameDir = (btcChg >= 0) === (ownChg >= 0);
        const d = Math.abs(btcChg - ownChg);
        return sameDir
          ? Math.min(0.99, 0.4 + (1 - d * 0.02))
          : Math.max(-0.99, -0.4 - d * 0.02);
      })()
    : null;

  const currentPrice = liveItem
    ? (type === 'coin' ? liveItem.current_price : liveItem.price)
    : (detail?.price ?? null);
  const currentChange = liveItem
    ? (type === 'coin' ? liveItem.price_change_percentage_24h : liveItem.change)
    : (detail?.change ?? null);

  const TF_OPTIONS = [
    { label: '1D', days: 1 },
    { label: '1W', days: 7 },
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
  ];

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
        stockData={stockData}
        krStockData={krStockData}
        cryptoData={cryptoData}
      />

      <div className={styles.page}>
        {/* breadcrumb */}
        <div className={styles.breadcrumb}>
          <a href="/">대시보드</a>
          <span>›</span>
          <span>검색</span>
          <span>›</span>
          <span style={{ color: 'var(--text)' }}>{decodedSymbol}</span>
        </div>

        {/* header */}
        <div className={styles.header}>
          <div className={styles.symbolBlock}>
            <div className={styles.symbolIcon}>{decodedSymbol.slice(0, 2)}</div>
            <div>
              <div className={styles.symbolName}>{decodedSymbol}</div>
              <div className={styles.symbolSub}>
                {detail?.name ?? liveItem?.name ?? decodedSymbol}
                {' · '}
                {type === 'coin' ? '암호화폐' : type === 'kr' ? '한국 주식' : '미국 주식'}
                {SECTOR_MAP[decodedSymbol] ? ` · ${SECTOR_MAP[decodedSymbol]}` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexDirection: 'column' }}>
            <div className={styles.priceBlock}>
              <div className={styles.price}>
                {detailLoading && currentPrice == null ? '로딩 중...' : fmtPrice(currentPrice, type)}
              </div>
              {currentChange != null && (
                <span className={`${styles.changeChip} ${currentChange >= 0 ? styles.changePos : styles.changeNeg}`}>
                  {currentChange >= 0 ? '+' : ''}{currentChange.toFixed(2)}%
                </span>
              )}
            </div>
            <WatchButton
              symbol={decodedSymbol}
              type={type}
              isLoggedIn={isLoggedIn}
              onLoginRequired={() => setShowLoginModal(true)}
            />
          </div>
        </div>

        {/* chart */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              가격 차트
              {chartLabel && (
                <span style={{ fontSize: 10, color: 'var(--muted2)', fontWeight: 400, marginLeft: 8 }}>
                  ({chartLabel})
                </span>
              )}
            </span>
            <div className={styles.cardBtns}>
              {TF_OPTIONS.map(tf => (
                <button
                  key={tf.label}
                  className={`${styles.tfBtn}${chartDays === tf.days ? ' ' + styles.active : ''}`}
                  onClick={() => setChartDays(tf.days)}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.cardBody}>
            {chartNoData ? (
              <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--muted2)', fontSize: 13 }}>
                <span style={{ fontSize: 22 }}>📉</span>
                <span>차트 데이터를 불러올 수 없습니다</span>
                <span style={{ fontSize: 11 }}>개별 종목 차트 API 미지원 — 백엔드 연동 후 표시됩니다</span>
              </div>
            ) : (
              <div className={styles.chartWrap}>
                <canvas ref={canvasRef} />
              </div>
            )}
          </div>
        </div>

        <div className={styles.twoCol}>
          {/* meta info */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>종목 정보</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>현재가</span>
                  <span className={styles.metaValue}>{fmtPrice(currentPrice, type)}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>24h 변동</span>
                  <span className={styles.metaValue} style={{ color: currentChange != null && currentChange >= 0 ? '#4ade80' : '#f87171' }}>
                    {currentChange != null ? `${currentChange >= 0 ? '+' : ''}${currentChange.toFixed(2)}%` : '--'}
                  </span>
                </div>
                {(liveItem?.total_volume || detail?.volume) && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>거래량</span>
                    <span className={styles.metaValue}>
                      ${((liveItem?.total_volume ?? detail?.volume ?? 0) / 1e9).toFixed(2)}B
                    </span>
                  </div>
                )}
                {corrProxy !== null && decodedSymbol !== 'BTC' && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>BTC 상관계수</span>
                    <span className={styles.metaValue}>r = {corrProxy.toFixed(2)}</span>
                  </div>
                )}
                {SECTOR_MAP[decodedSymbol] && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>섹터</span>
                    <span className={styles.metaValue}>{SECTOR_MAP[decodedSymbol]}</span>
                  </div>
                )}
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>유형</span>
                  <span className={styles.metaValue}>
                    {type === 'coin' ? '암호화폐' : type === 'kr' ? '한국 주식' : '미국 주식'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* related */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>같은 섹터 종목</span>
            </div>
            <div className={styles.cardBody}>
              {relatedItems.length === 0 ? (
                <div style={{ color: 'var(--muted2)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                  관련 종목 없음
                </div>
              ) : (
                <div className={styles.relatedList}>
                  {relatedItems.map(item => (
                    <div
                      key={item.symbol}
                      className={styles.relatedItem}
                      onClick={() => router.push(`/search/${item.symbol}?type=${SECTOR_MAP[item.symbol] ? 'us' : 'kr'}`)}
                    >
                      <div>
                        <div className={styles.relSymbol}>{item.symbol}</div>
                        {item.name && <div className={styles.relName}>{item.name}</div>}
                      </div>
                      {item.change != null && (
                        <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: item.change >= 0 ? '#4ade80' : '#f87171' }}>
                          {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
