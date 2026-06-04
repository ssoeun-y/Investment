'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Script from 'next/script';
import { useAuth }       from '../hooks/useAuth';
import { useMarketData } from '../hooks/useMarketData';
import Topbar            from '../components/Topbar';
import LoginModal        from '../components/LoginModal';
import styles            from './event-detection.module.css';
import                        '../styles/dashboard.css';

// ─── 유틸 ─────────────────────────────────────────────────────
const pct = n => n == null ? '--' : (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';

function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60)    return '방금 전';
  if (d < 3600)  return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  return `${Math.floor(d / 86400)}일 전`;
}

// ─── Mod 2: history 없는 종목 지표 ────────────────────────────
function getStatusFromChange(change) {
  if (change == null) return { label: '--', color: 'var(--muted)' };
  if (change <= -5)   return { label: '강한 하락 압력', color: '#f05a5a' };
  if (change <= -2)   return { label: '하락 압력',      color: '#f05a5a' };
  if (change <= -0.5) return { label: '소폭 하락',      color: '#f5c842' };
  if (change < 0.5)   return { label: '보합',           color: 'var(--muted2)' };
  if (change < 2)     return { label: '소폭 상승',      color: '#10d9a0' };
  if (change < 5)     return { label: '상승 모멘텀',    color: '#10d9a0' };
  return               { label: '강한 상승',            color: '#10d9a0' };
}

// ─── 지표 계산 ─────────────────────────────────────────────────
function calcRSI(prices, period = 14) {
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
  return al === 0 ? 100 : Math.round((100 - 100 / (1 + ag / al)) * 10) / 10;
}

function calcBB(prices, period = 20) {
  if (!prices || prices.length < period) return null;
  const slice = prices.slice(-period);
  const mean  = slice.reduce((a, b) => a + b, 0) / period;
  const std   = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
  if (std === 0) return null;
  const upper = mean + 2 * std;
  const lower = mean - 2 * std;
  const last  = prices[prices.length - 1];
  return { upper, lower, middle: mean, pct: Math.round(((last - lower) / (upper - lower)) * 100) / 100 };
}

function calcSupport(prices, period = 20) {
  if (!prices || prices.length < period) return null;
  return Math.min(...prices.slice(-period));
}

// ─── 이벤트 감지 (Mod 3 포함) ──────────────────────────────────
function detectEvents({ cryptoData, stockData, krStockData, fearGreed, history, volHistRef, tsRef }) {
  const events = [];
  const nowTs  = Date.now();

  const btcPrices    = (history?.btc    || []).map(d => d[1]);
  const nasdaqPrices = (history?.nasdaq || []).map(d => d[1]);

  const btcRSI     = calcRSI(btcPrices);
  const nasdaqRSI  = calcRSI(nasdaqPrices);
  const btcBB      = calcBB(btcPrices);
  const btcSupport = calcSupport(btcPrices);

  const btcCoin = cryptoData.find(c => c.symbol === 'BTC');
  const fg      = fearGreed ? Number(fearGreed.value) : null;

  const add = (ev) => {
    if (!tsRef.current[ev.id]) tsRef.current[ev.id] = nowTs;
    events.push({ ...ev, detectedAt: tsRef.current[ev.id] });
  };

  // ── 1. 고래 움직임 (코인 거래량 이전 대비 150%+) ─────────────
  for (const coin of cryptoData) {
    const vol  = coin.total_volume;
    const prev = volHistRef.current[coin.symbol];
    if (prev && vol && prev > 0) {
      const ratio = vol / prev;
      if (ratio >= 1.5) {
        add({
          id:           `whale_${coin.symbol}`,
          category:     'whale',
          conditionKey: 'whale',
          type:         '고래 움직임',
          symbol:       coin.symbol,
          severity:     ratio >= 2.0 ? 'red' : 'yellow',
          valueText:    `거래량 ${ratio.toFixed(1)}배`,
          price:        coin.current_price,
          change:       coin.price_change_percentage_24h,
          explanation:  coin.price_change_percentage_24h < 0
            ? '거래량 급증 + 가격 하락 조합은 거래소 대량 입금 → 매도 압력 신호입니다. 단기 추가 하락 가능성이 있습니다.'
            : '거래량 급증 + 가격 상승은 강한 매수세 유입 신호입니다. 거래소 출금이라면 장기 보유(HODLing) 신호로 해석됩니다.',
          related:   ['NVDA', '삼성전자', '하이닉스'],
          assetType: 'coin',
        });
      }
    }
    if (vol) volHistRef.current[coin.symbol] = vol;
  }

  // ── 2. 거래량 급등 (주식/코인 |변화| ≥ 3%) ── Mod 3A: 3%로 낮춤
  for (const stock of [...stockData, ...krStockData]) {
    const abs = Math.abs(stock.change ?? 0);
    if (abs >= 3) {
      add({
        id:           `vol_${stock.symbol}`,
        category:     'volume',
        conditionKey: 'volume',
        type:         '거래량 급등',
        symbol:       stock.symbol,
        severity:     abs >= 8 ? 'red' : abs >= 5 ? 'yellow' : 'yellow',
        valueText:    `${(stock.change ?? 0) >= 0 ? '+' : ''}${(stock.change ?? 0).toFixed(2)}%`,
        price:        stock.price,
        change:       stock.change,
        explanation:  (stock.change ?? 0) > 0
          ? '거래량 급등 + 가격 상승 = 기관 매집 신호. BTC와 같은 방향이면 더 강한 상승 신호입니다.'
          : '거래량 급등 + 가격 하락 = 투매 신호. 손절 라인을 재확인하거나 관망이 유효한 구간입니다.',
        related:   (stock.change ?? 0) > 0 ? ['BTC', 'ETH'] : ['BTC'],
        assetType: 'stock',
      });
    }
  }

  // 코인도 ≥ 3% 포함 (BTC는 RSI/BB로 별도 처리하므로 제외)
  for (const coin of cryptoData) {
    if (coin.symbol === 'BTC') continue;
    const abs = Math.abs(coin.price_change_percentage_24h ?? 0);
    if (abs >= 3) {
      add({
        id:           `vol_${coin.symbol}`,
        category:     'volume',
        conditionKey: 'volume',
        type:         '거래량 급등',
        symbol:       coin.symbol,
        severity:     abs >= 7 ? 'red' : 'yellow',
        valueText:    pct(coin.price_change_percentage_24h),
        price:        coin.current_price,
        change:       coin.price_change_percentage_24h,
        explanation:  (coin.price_change_percentage_24h ?? 0) > 0
          ? '코인 강한 상승 모멘텀입니다. 거래량과 BTC 방향을 함께 확인하세요.'
          : '코인 강한 하락입니다. 손절 라인을 점검하고 관망을 고려하세요.',
        related:   ['BTC', 'NVDA'],
        assetType: 'coin',
      });
    }
  }

  // ── 3. RSI 과매도/과매수 — BTC ─────────────────────────────
  if (btcRSI !== null && (btcRSI <= 30 || btcRSI >= 70)) {
    const os = btcRSI <= 30;
    add({
      id:           'rsi_btc',
      category:     'rsi',
      conditionKey: os ? 'rsiOversold' : 'rsiOverbought',
      type:         os ? 'RSI 과매도' : 'RSI 과매수',
      symbol:       'BTC',
      severity:     (btcRSI <= 20 || btcRSI >= 80) ? 'red' : 'yellow',
      valueText:    `RSI ${btcRSI.toFixed(1)}`,
      price:        btcCoin?.current_price,
      change:       btcCoin?.price_change_percentage_24h,
      explanation:  os
        ? `BTC RSI ${btcRSI.toFixed(1)} — 단기 과매도 구간입니다. 반등 가능성이 있으나 하락 추세 중이면 추가 하락도 가능합니다. 분할 매수 전략을 고려하세요.`
        : `BTC RSI ${btcRSI.toFixed(1)} — 단기 과열 구간입니다. 단기 조정 가능성이 있습니다. 보유 중이라면 익절 타이밍을 점검하세요.`,
      related:   os ? ['ETH', 'SOL', 'NVDA'] : ['ETH', 'SOL'],
      assetType: 'coin',
    });
  }

  // ── 3b. RSI — NASDAQ ────────────────────────────────────────
  if (nasdaqRSI !== null && (nasdaqRSI <= 30 || nasdaqRSI >= 70)) {
    const os = nasdaqRSI <= 30;
    add({
      id:           'rsi_nasdaq',
      category:     'rsi',
      conditionKey: os ? 'rsiOversold' : 'rsiOverbought',
      type:         os ? 'RSI 과매도' : 'RSI 과매수',
      symbol:       'NASDAQ',
      severity:     (nasdaqRSI <= 20 || nasdaqRSI >= 80) ? 'red' : 'yellow',
      valueText:    `RSI ${nasdaqRSI.toFixed(1)}`,
      price:        null,
      change:       null,
      explanation:  os
        ? `나스닥 RSI ${nasdaqRSI.toFixed(1)} — 미국 기술주 단기 과매도 구간. NVDA, AAPL 등 개별 종목도 함께 확인하세요.`
        : `나스닥 RSI ${nasdaqRSI.toFixed(1)} — 미국 기술주 단기 과열 구간. 단기 차익실현 가능성이 있습니다.`,
      related:   os ? ['NVDA', 'AAPL', 'MSFT'] : ['NVDA'],
      assetType: 'stock',
    });
  }

  // ── 4. 볼린저밴드 돌파/이탈 — BTC ───────────────────────────
  if (btcBB !== null && (btcBB.pct > 1.0 || btcBB.pct < 0)) {
    const upper = btcBB.pct > 1.0;
    add({
      id:           'bb_btc',
      category:     'bb',
      conditionKey: 'bb',
      type:         upper ? 'BB 상단 돌파' : 'BB 하단 이탈',
      symbol:       'BTC',
      severity:     'yellow',
      valueText:    `%B ${btcBB.pct.toFixed(2)}`,
      price:        btcCoin?.current_price,
      change:       btcCoin?.price_change_percentage_24h,
      explanation:  upper
        ? `BB %B ${btcBB.pct.toFixed(2)} — 상단 돌파는 강한 상승 모멘텀 신호입니다. 단, 과매수 구간 진입이므로 단기 조정 가능성도 존재합니다.`
        : `BB %B ${btcBB.pct.toFixed(2)} — 하단 이탈은 과매도 신호입니다. 지지선 확인 후 반등 시 매수 기회가 될 수 있습니다.`,
      related:   upper ? ['ETH', 'SOL'] : ['NVDA', '삼성전자'],
      assetType: 'coin',
    });
  }

  // ── 5. 지지선 이탈 — BTC ────────────────────────────────────
  if (btcSupport !== null && btcPrices.length > 0) {
    const curr = btcPrices[btcPrices.length - 1];
    if (curr < btcSupport * 0.99) {
      add({
        id:           'support_btc',
        category:     'whale',
        conditionKey: 'whale',
        type:         '지지선 이탈',
        symbol:       'BTC',
        severity:     'red',
        valueText:    `지지 $${Math.round(btcSupport).toLocaleString()}`,
        price:        btcCoin?.current_price,
        change:       btcCoin?.price_change_percentage_24h,
        explanation:  `20일 지지선 $${Math.round(btcSupport).toLocaleString()}이 뚫렸습니다. 다음 지지선까지 추가 하락 가능성이 있습니다. 손절 또는 관망을 고려하세요.`,
        related:      ['ETH', 'SOL', 'NVDA'],
        assetType:    'coin',
      });
    }
  }

  // ── 6. 동조/디커플링 — 항상 생성 (Mod 3B) ──────────────────
  const btcChg  = btcCoin?.price_change_percentage_24h ?? 0;
  const semiAll = [
    ...stockData.filter(s => ['NVDA','AMD','AAPL','MSFT','INTC'].includes(s.symbol)),
    ...krStockData.filter(s => ['005930','000660'].includes(s.symbol)),
  ];
  if (semiAll.length > 0) {
    const avgSemi = semiAll.reduce((s, st) => s + (st.change ?? 0), 0) / semiAll.length;
    const diff    = Math.abs(btcChg - avgSemi);
    const sameDir = (btcChg > 0 && avgSemi > 0) || (btcChg < 0 && avgSemi < 0);
    add({
      id:           'correlation_main',
      category:     'correlation',
      conditionKey: 'correlation',
      type:         sameDir ? (diff <= 2 ? '동조 안정' : '동조 강화') : '디커플링 감지',
      symbol:       'BTC vs 반도체',
      severity:     diff > 5 ? 'red' : diff > 2 ? 'yellow' : 'green',
      valueText:    `방향차 ${diff.toFixed(1)}%p`,
      price:        null,
      change:       null,
      explanation:  sameDir
        ? diff <= 2
          ? `BTC(${btcChg >= 0 ? '+' : ''}${btcChg.toFixed(1)}%)와 반도체(${avgSemi >= 0 ? '+' : ''}${avgSemi.toFixed(1)}%)가 유사하게 움직이고 있습니다. 동조 안정 구간입니다.`
          : `BTC(${btcChg >= 0 ? '+' : ''}${btcChg.toFixed(1)}%)와 반도체(${avgSemi >= 0 ? '+' : ''}${avgSemi.toFixed(1)}%)가 같은 방향으로 움직이고 있습니다. 글로벌 리스크온/오프 흐름에 연동된 구간입니다.`
        : `BTC(${btcChg >= 0 ? '+' : ''}${btcChg.toFixed(1)}%)와 반도체(${avgSemi >= 0 ? '+' : ''}${avgSemi.toFixed(1)}%)가 반대로 움직이고 있습니다. 각자 개별 재료로 움직이는 구간이므로 코인과 주식을 따로 판단하세요.`,
      related:      ['NVDA', '삼성전자', 'BTC'],
      assetType:    'both',
    });
  }

  // ── 7. 공포탐욕 극단값 ──────────────────────────────────────
  if (fg !== null && (fg <= 20 || fg >= 80)) {
    const fear = fg <= 20;
    add({
      id:           'fg_extreme',
      category:     'feargreed',
      conditionKey: 'fg',
      type:         fear ? '극단 공포' : '극단 탐욕',
      symbol:       '공포탐욕지수',
      severity:     (fg <= 10 || fg >= 90) ? 'red' : 'yellow',
      valueText:    `FG: ${fg}`,
      price:        null,
      change:       null,
      explanation:  fear
        ? `FG ${fg} — 역사적으로 극단 공포 구간(20 이하)은 중장기 매수 타이밍으로 알려져 있습니다. 단, 추가 하락 방어를 위해 분할 매수를 권장합니다. RSI 과매도 종목을 함께 확인하세요.`
        : `FG ${fg} — 시장이 과열되어 있습니다. 신규 진입보다 보유 자산의 익절 또는 비중 축소를 고려할 구간입니다.`,
      related:      fear ? ['BTC', 'ETH', 'SOL'] : [],
      assetType:    'coin',
    });
  }

  // ── 8. 24h 최대 상승/하락 코인 — 항상 생성 (Mod 3C) ─────────
  if (cryptoData.length > 1) {
    const sorted  = [...cryptoData].sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0));
    const topCoin = sorted[0];
    const botCoin = sorted[sorted.length - 1];

    if (topCoin) {
      add({
        id:           `extreme_up_${topCoin.symbol}`,
        category:     'volume',
        conditionKey: 'volume',
        type:         '24h 최대 상승',
        symbol:       topCoin.symbol,
        severity:     Math.abs(topCoin.price_change_percentage_24h ?? 0) >= 7 ? 'red' : 'yellow',
        valueText:    pct(topCoin.price_change_percentage_24h),
        price:        topCoin.current_price,
        change:       topCoin.price_change_percentage_24h,
        explanation:  `전체 코인 중 24시간 최대 상승 종목입니다. 강한 매수세 또는 개별 호재가 있을 수 있습니다. 거래량 동반 여부를 확인하세요.`,
        related:      ['BTC', 'ETH'],
        assetType:    'coin',
      });
    }
    if (botCoin && botCoin.symbol !== topCoin?.symbol) {
      add({
        id:           `extreme_down_${botCoin.symbol}`,
        category:     'volume',
        conditionKey: 'volume',
        type:         '24h 최대 하락',
        symbol:       botCoin.symbol,
        severity:     Math.abs(botCoin.price_change_percentage_24h ?? 0) >= 7 ? 'red' : 'yellow',
        valueText:    pct(botCoin.price_change_percentage_24h),
        price:        botCoin.current_price,
        change:       botCoin.price_change_percentage_24h,
        explanation:  `전체 코인 중 24시간 최대 하락 종목입니다. 투자심리 악화 또는 개별 악재를 확인하세요. 하락세 연장 여부에 주의하세요.`,
        related:      ['BTC'],
        assetType:    'coin',
      });
    }
  }

  // ── 9. 시장 방향성 — 항상 생성 (Mod 3D) ────────────────────
  if (cryptoData.length > 0 && stockData.length > 0) {
    const cryptoAvg = cryptoData.reduce((s, c) => s + (c.price_change_percentage_24h ?? 0), 0) / cryptoData.length;
    const stockAvg  = stockData.reduce((s, st) => s + (st.change ?? 0), 0) / stockData.length;
    const bothUp    = cryptoAvg > 0.5 && stockAvg > 0.5;
    const bothDown  = cryptoAvg < -0.5 && stockAvg < -0.5;
    const dir       = bothUp ? 'risk-on' : bothDown ? 'risk-off' : 'mixed';
    add({
      id:           'market_direction',
      category:     'correlation',
      conditionKey: 'correlation',
      type:         dir === 'risk-on' ? '리스크온 장세' : dir === 'risk-off' ? '리스크오프 장세' : '혼조세',
      symbol:       '시장 방향성',
      severity:     dir === 'risk-on' ? 'green' : dir === 'risk-off' ? 'red' : 'yellow',
      valueText:    `코인 ${cryptoAvg >= 0 ? '+' : ''}${cryptoAvg.toFixed(1)}% / 주식 ${stockAvg >= 0 ? '+' : ''}${stockAvg.toFixed(1)}%`,
      price:        null,
      change:       null,
      explanation:  dir === 'risk-on'
        ? `코인 평균 ${cryptoAvg >= 0 ? '+' : ''}${cryptoAvg.toFixed(1)}%, 주식 평균 ${stockAvg >= 0 ? '+' : ''}${stockAvg.toFixed(1)}% — 전반적 리스크온 장세입니다. 위험 자산 선호 구간입니다.`
        : dir === 'risk-off'
        ? `코인 평균 ${cryptoAvg.toFixed(1)}%, 주식 평균 ${stockAvg.toFixed(1)}% — 리스크오프 장세입니다. 안전 자산으로의 이동을 고려하세요.`
        : `코인(${cryptoAvg >= 0 ? '+' : ''}${cryptoAvg.toFixed(1)}%)과 주식(${stockAvg >= 0 ? '+' : ''}${stockAvg.toFixed(1)}%)이 혼조세입니다. 개별 종목 분석이 더 중요한 구간입니다.`,
      related:      ['BTC', 'NVDA'],
      assetType:    'both',
    });
  }

  const sevOrder = { red: 0, yellow: 1, green: 2 };
  return events.sort((a, b) => (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3));
}

// ─── Zone A 카드 정의 ──────────────────────────────────────────
const ZONE_A = [
  { key: 'whale',       icon: '🐋', label: '고래 움직임' },
  { key: 'volume',      icon: '📊', label: '거래량 급등' },
  { key: 'correlation', icon: '🔗', label: '동조/디커플링' },
  { key: 'feargreed',   icon: '😱', label: '공포탐욕' },
  { key: 'rsi',         icon: '📉', label: 'RSI 신호' },
  { key: 'bb',          icon: '📈', label: '볼린저밴드' },
];

const SEV_COLOR = { red: '#f05a5a', yellow: '#f5c842', green: '#10d9a0' };
const SEV_BG    = { red: 'rgba(240,90,90,0.08)', yellow: 'rgba(245,200,66,0.08)', green: 'rgba(16,217,160,0.06)' };

const NOTIF_CONDITIONS = [
  { key: 'whale',         label: '고래 움직임' },
  { key: 'volume',        label: '거래량 급등 (±3%+)' },
  { key: 'rsiOversold',   label: 'RSI 과매도 진입 (≤30)' },
  { key: 'rsiOverbought', label: 'RSI 과매수 진입 (≥70)' },
  { key: 'bb',            label: 'BB 상단 돌파 / 하단 이탈' },
  { key: 'fg',            label: '공포탐욕 극단값' },
  { key: 'correlation',   label: '동조/디커플링 전환' },
];

// ─── Top Signal 카드 헬퍼 (Mod 1) ─────────────────────────────
function getTopCardBorderColor(sig) {
  if (sig.category === 'rsi') {
    const rsi = parseFloat(sig.valueText.replace('RSI ', ''));
    if (rsi <= 25 || rsi >= 75) return '#f05a5a';
    if (rsi <= 35 || rsi >= 65) return '#f5c842';
    return '#10d9a0';
  }
  const abs = Math.abs(sig.change ?? 0);
  if (abs >= 7) return '#f05a5a';
  if (abs >= 3) return '#f5c842';
  return '#10d9a0';
}

// ─── 메인 ──────────────────────────────────────────────────────
export default function EventDetectionPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [now, setNow]                       = useState('');
  const [events, setEvents]                 = useState([]);
  const [historyData, setHistoryData]       = useState(null);
  const [histLoading, setHistLoading]       = useState(true);
  const [filter, setFilter]                 = useState('all');
  const [notifEnabled, setNotifEnabled]     = useState(false);
  const [notifConds, setNotifConds]         = useState({
    whale: true, volume: true, rsiOversold: true,
    rsiOverbought: true, bb: false, fg: true, correlation: true,
  });
  const [chartJsReady, setChartJsReady]     = useState(
    typeof window !== 'undefined' && !!window.Chart
  );

  const volHistRef   = useRef({});
  const tsRef        = useRef({});
  const prevEvIds    = useRef(new Set());
  const sparkInstsRef = useRef({});

  const { isLoggedIn, isLoading, handleKakaoLogin, handleLogout } = useAuth();
  const { cryptoData, stockData, krStockData, fearGreed, fetchCrossMarketHistory } = useMarketData();

  // 시계
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Chart.js 로드 감지
  useEffect(() => {
    if (chartJsReady) return;
    const id = setInterval(() => {
      if (typeof window !== 'undefined' && window.Chart) {
        setChartJsReady(true);
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [chartJsReady]);

  // 히스토리 로드
  const loadHistory = useCallback(() => {
    fetchCrossMarketHistory(30).then(data => {
      setHistoryData(data);
      setHistLoading(false);
    });
  }, [fetchCrossMarketHistory]);

  useEffect(() => {
    loadHistory();
    const id = setInterval(loadHistory, 60000);
    return () => clearInterval(id);
  }, [loadHistory]);

  // 이벤트 감지
  useEffect(() => {
    if (!cryptoData.length) return;
    const detected = detectEvents({
      cryptoData, stockData, krStockData, fearGreed,
      history: historyData, volHistRef, tsRef,
    });
    setEvents(detected);

    if (notifEnabled && typeof window !== 'undefined' && Notification.permission === 'granted') {
      detected
        .filter(e => !prevEvIds.current.has(e.id) && notifConds[e.conditionKey])
        .forEach(e => {
          new Notification('FlowSignal 이벤트 감지', {
            body: `${e.symbol} — ${e.type}: ${e.valueText}`,
            icon: '/favicon.ico',
          });
        });
    }
    prevEvIds.current = new Set(detected.map(e => e.id));
  }, [cryptoData, stockData, krStockData, fearGreed, historyData, notifEnabled, notifConds]);

  // 알림 권한
  const requestNotif = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === 'granted');
  };

  // 필터
  const filtered = useMemo(() => {
    switch (filter) {
      case 'coin':   return events.filter(e => e.assetType === 'coin' || e.assetType === 'both');
      case 'stock':  return events.filter(e => e.assetType === 'stock' || e.assetType === 'both');
      case 'strong': return events.filter(e => e.severity === 'red');
      default:       return events;
    }
  }, [events, filter]);

  // 요약 카운트
  const redCnt    = events.filter(e => e.severity === 'red').length;
  const yellowCnt = events.filter(e => e.severity === 'yellow').length;

  // Mod 1: Top 3 Signal 카드
  const topSignals = useMemo(() => {
    const priorityOf = (e) => {
      if (e.category === 'rsi') {
        const rsi = parseFloat(e.valueText.replace('RSI ', ''));
        return rsi <= 30 ? 0 : 4;
      }
      if (e.category === 'volume' && Math.abs(e.change ?? 0) >= 5) return 1;
      if (e.category === 'feargreed') return 2;
      if (e.category === 'correlation') return 3;
      return 5;
    };
    return [...events].sort((a, b) => priorityOf(a) - priorityOf(b)).slice(0, 3);
  }, [events]);

  // Mod 1: 스파크라인 렌더링
  useEffect(() => {
    if (!chartJsReady || typeof window === 'undefined' || !window.Chart) return;

    Object.values(sparkInstsRef.current).forEach(inst => inst?.destroy());
    sparkInstsRef.current = {};

    topSignals.forEach((sig, i) => {
      const canvas = document.getElementById(`top-signal-${sig.symbol}-${i}`);
      if (!canvas) return;

      let prices;
      if (sig.symbol === 'BTC' && historyData?.btc?.length) {
        prices = historyData.btc.slice(-20).map(d => d[1]);
      } else {
        const chg = sig.change ?? 0;
        prices = [100, 100 + chg / 5, 100 + chg / 3, 100 + chg / 2, 100 + chg];
      }

      const color = getTopCardBorderColor(sig);

      sparkInstsRef.current[i] = new window.Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: prices.map((_, idx) => idx),
          datasets: [{
            data: prices,
            borderColor: color,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.4,
            fill: false,
          }],
        },
        options: {
          responsive: false,
          animation: false,
          scales: { x: { display: false }, y: { display: false } },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
        },
      });
    });

    return () => {
      Object.values(sparkInstsRef.current).forEach(inst => inst?.destroy());
      sparkInstsRef.current = {};
    };
  }, [topSignals, historyData, chartJsReady]);

  // Mod 2: 종목별 지표 (history 없는 종목은 change 기반)
  const indicators = useMemo(() => {
    const btcPx    = (historyData?.btc    || []).map(d => d[1]);
    const nasdaqPx = (historyData?.nasdaq || []).map(d => d[1]);

    const btcRSI    = calcRSI(btcPx);
    const nasdaqRSI = calcRSI(nasdaqPx);
    const btcBB     = calcBB(btcPx);
    const nasdaqBB  = calcBB(nasdaqPx);

    const rsiSig = rsi => {
      if (rsi == null) return { label: '계산 중...', color: 'var(--muted)' };
      if (rsi <= 30)   return { label: `RSI ${rsi.toFixed(1)}  🔴 과매도`, color: '#f05a5a' };
      if (rsi >= 70)   return { label: `RSI ${rsi.toFixed(1)}  🔴 과매수`, color: '#f05a5a' };
      return { label: `RSI ${rsi.toFixed(1)}  🟢 정상`, color: '#10d9a0' };
    };
    const bbSig = bb => {
      if (bb == null)   return { label: '계산 중...', color: 'var(--muted)' };
      if (bb.pct > 1.0) return { label: `%B ${bb.pct.toFixed(2)}  🟡 과매수권`, color: '#f5c842' };
      if (bb.pct < 0)   return { label: `%B ${bb.pct.toFixed(2)}  🟡 과매도권`, color: '#f5c842' };
      return { label: `%B ${bb.pct.toFixed(2)}  🟢 정상`, color: '#10d9a0' };
    };

    const findC = sym => cryptoData.find(c => c.symbol === sym);
    const findS = sym => stockData.find(s => s.symbol === sym);
    const findK = sym => krStockData.find(s => s.symbol === sym);

    const chgStatus = (change) => {
      const s = getStatusFromChange(change);
      return { label: s.label, color: s.color };
    };

    return [
      { symbol: 'BTC',      rsi: rsiSig(btcRSI),    bb: bbSig(btcBB),    change: findC('BTC')?.price_change_percentage_24h },
      { symbol: 'ETH',      rsi: chgStatus(findC('ETH')?.price_change_percentage_24h),  bb: { label: '24h 기반', color: 'var(--muted)' }, change: findC('ETH')?.price_change_percentage_24h },
      { symbol: 'NASDAQ',   rsi: rsiSig(nasdaqRSI),  bb: bbSig(nasdaqBB), change: null },
      { symbol: 'NVDA',     rsi: chgStatus(findS('NVDA')?.change),    bb: { label: '24h 기반', color: 'var(--muted)' }, change: findS('NVDA')?.change },
      { symbol: '삼성전자', rsi: chgStatus(findK('005930')?.change), bb: { label: '24h 기반', color: 'var(--muted)' }, change: findK('005930')?.change },
      { symbol: 'SOL',      rsi: chgStatus(findC('SOL')?.price_change_percentage_24h),  bb: { label: '24h 기반', color: 'var(--muted)' }, change: findC('SOL')?.price_change_percentage_24h },
    ];
  }, [historyData, cryptoData, stockData, krStockData]);

  // ── 렌더 ──────────────────────────────────────────────────────
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
        activePage="event-detection"
        stockData={stockData}
        krStockData={krStockData}
        cryptoData={cryptoData}
      />

      <div className={styles.page}>

        {/* ════ Mod 1: Top Signal 카드 3개 ════════════════════ */}
        {topSignals.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {topSignals.map((sig, i) => {
              const borderColor = getTopCardBorderColor(sig);
              const rsiVal = sig.category === 'rsi' ? (parseFloat(sig.valueText.replace('RSI ', '')) || 50) : null;
              const score  = Math.round(100 - (rsiVal || 50));

              return (
                <div
                  key={`top-${sig.id}-${i}`}
                  style={{
                    background: 'var(--bg2)',
                    border: `1px solid ${borderColor}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {/* 상단: 종목명 + 스파크라인 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--text)' }}>
                        {sig.symbol}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>{sig.type}</div>
                    </div>
                    <canvas id={`top-signal-${sig.symbol}-${i}`} width={60} height={40} />
                  </div>

                  {/* 중간: 가격 + 변화율 + 점수 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {sig.price != null && (
                        <div style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: 'var(--text)' }}>
                          {sig.assetType === 'coin' ? '$' : ''}
                          {Number(sig.price).toLocaleString(sig.assetType === 'coin' ? 'en-US' : 'ko-KR', { maximumFractionDigits: 0 })}
                        </div>
                      )}
                      {sig.change != null && (
                        <div style={{ fontSize: 12, color: sig.change >= 0 ? '#10d9a0' : '#f05a5a', fontFamily: "'DM Mono', monospace" }}>
                          {pct(sig.change)}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: borderColor }}>
                      {score}
                    </div>
                  </div>

                  {/* 하단: 태그 */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, background: 'var(--bg3)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '2px 6px', color: 'var(--muted2)',
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      {sig.valueText}
                    </span>
                    <span style={{
                      fontSize: 10, background: 'var(--bg3)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '2px 6px', color: 'var(--muted2)',
                    }}>
                      {sig.assetType === 'coin' ? '코인' : sig.assetType === 'stock' ? '주식' : '코인/주식'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════ Zone A: 상단 요약 카드 ════════════════════════ */}
        <div className={styles.zoneA}>
          <div className={styles.zoneAHeader}>
            <div className={styles.zoneACount}>
              {redCnt > 0    && <span className={styles.countRed}>🔴 고위험 {redCnt}건</span>}
              {yellowCnt > 0 && <span className={styles.countYellow}>🟡 주의 {yellowCnt}건</span>}
              {redCnt === 0 && yellowCnt === 0 && (
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>감지된 이벤트 없음</span>
              )}
            </div>
            <span className={styles.liveBadge}>● LIVE</span>
          </div>

          <div className={styles.zoneACards}>
            {ZONE_A.map(card => {
              const top = events.find(e => e.category === card.key);
              const sev = top?.severity ?? 'none';
              return (
                <div
                  key={card.key}
                  className={styles.summaryCard}
                  style={{
                    borderColor: top ? SEV_COLOR[sev] : 'var(--border)',
                    background:  top ? SEV_BG[sev]   : 'var(--bg2)',
                  }}
                  onClick={() =>
                    top && document.getElementById(`ev_${top.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                >
                  <div className={styles.summaryCardIcon}>{card.icon}</div>
                  <div className={styles.summaryCardLabel}>{card.label}</div>
                  {top ? (
                    <>
                      <div className={styles.summaryCardSymbol}>{top.symbol}</div>
                      <div className={styles.summaryCardValue} style={{ color: SEV_COLOR[sev] }}>{top.valueText}</div>
                    </>
                  ) : (
                    <div className={styles.summaryCardNormal}>정상 — 이상 없음</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ════ Zone B + C ════════════════════════════════════ */}
        <div className={styles.zoneBC}>

          {/* ── Zone B: 이벤트 피드 (65%) ─────────────────── */}
          <div className={styles.zoneB}>
            <div className={styles.feedHeader}>
              <span className={styles.feedTitle}>이벤트 피드</span>
              <div className={styles.filterRow}>
                {[
                  { v: 'all',    l: '전체' },
                  { v: 'coin',   l: '코인' },
                  { v: 'stock',  l: '주식' },
                  { v: 'strong', l: '🔴 강함만' },
                ].map(({ v, l }) => (
                  <button
                    key={v}
                    className={`${styles.filterBtn}${filter === v ? ' ' + styles.filterActive : ''}`}
                    onClick={() => setFilter(v)}
                  >{l}</button>
                ))}
              </div>
            </div>

            {histLoading ? (
              <div className={styles.emptyFeed}>
                <span style={{ fontSize: 20 }}>📡</span>
                <span>지표 계산 중... (히스토리 데이터 로딩)</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.emptyFeed}>
                <span style={{ fontSize: 24 }}>✅</span>
                <span>현재 감지된 이벤트가 없어요. 시장이 안정적입니다.</span>
              </div>
            ) : (
              <div className={styles.feedList}>
                {filtered.map(ev => (
                  <div
                    key={ev.id}
                    id={`ev_${ev.id}`}
                    className={styles.eventCard}
                    style={{ borderLeft: `3px solid ${SEV_COLOR[ev.severity] ?? 'var(--border)'}` }}
                  >
                    {/* 상단 메타 */}
                    <div className={styles.eventCardTop}>
                      <span className={styles.eventSev} style={{ color: SEV_COLOR[ev.severity] ?? 'var(--muted)' }}>
                        {ev.severity === 'red' ? '🔴' : ev.severity === 'green' ? '🟢' : '🟡'} {timeAgo(ev.detectedAt)}
                      </span>
                      <span className={styles.eventAsset}>
                        {ev.assetType === 'coin' ? '코인' : ev.assetType === 'stock' ? '주식' : '코인/주식'}
                      </span>
                    </div>

                    {/* 종목 + 타입 */}
                    <div className={styles.eventTitle}>
                      <span className={styles.eventSymbol}>{ev.symbol}</span>
                      <span className={styles.eventType}>{ev.type}</span>
                    </div>

                    {/* 지표값 + 가격 + 변화율 */}
                    <div className={styles.eventStats}>
                      <span className={styles.eventValue}>{ev.valueText}</span>
                      {ev.price != null && (
                        <span className={styles.eventPrice}>
                          {ev.assetType === 'coin'
                            ? '$' + Number(ev.price).toLocaleString('en-US', { maximumFractionDigits: 0 })
                            : Number(ev.price).toLocaleString('ko-KR')}
                        </span>
                      )}
                      {ev.change != null && (
                        <span style={{ color: ev.change >= 0 ? '#10d9a0' : '#f05a5a', fontSize: 12 }}>
                          {pct(ev.change)}
                        </span>
                      )}
                    </div>

                    {/* 왜 중요한가 */}
                    <div className={styles.whyBox}>
                      <div className={styles.whyLabel}>💡 이게 왜 중요한가?</div>
                      <div className={styles.whyText}>{ev.explanation}</div>
                    </div>

                    {/* 연관 종목 */}
                    {ev.related?.length > 0 && (
                      <div className={styles.relatedRow}>
                        <span className={styles.relatedLabel}>→ 연관 종목:</span>
                        {ev.related.map(r => (
                          <span key={r} className={styles.relatedTag}>{r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Zone C: 우측 패널 (35%) ───────────────────── */}
          <div className={styles.zoneC}>

            {/* 브라우저 알림 */}
            <div className={styles.panelCard}>
              <div className={styles.panelCardTitle}>브라우저 알림 설정</div>
              {notifEnabled ? (
                <div className={styles.notifOn}>✅ 알림이 활성화되어 있습니다</div>
              ) : (
                <button className={styles.notifBtn} onClick={requestNotif}>
                  🔔 이벤트 발생 시 알림 받기
                </button>
              )}
              <div className={styles.conditionList}>
                <div className={styles.conditionTitle}>알림 조건 선택</div>
                {NOTIF_CONDITIONS.map(({ key, label }) => (
                  <label key={key} className={styles.conditionItem}>
                    <input
                      type="checkbox"
                      checked={notifConds[key]}
                      onChange={e => setNotifConds(p => ({ ...p, [key]: e.target.checked }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 시장 요약 */}
            <div className={styles.panelCard}>
              <div className={styles.panelCardTitle}>지금 시장 요약</div>
              <div className={styles.summaryRow}><span>모니터링 종목</span><span>{indicators.length}개</span></div>
              <div className={styles.summaryRow}><span>감지된 이벤트</span><span>{events.length}건</span></div>
              <div className={styles.summaryRow}>
                <span>고위험</span>
                <span style={{ color: '#f05a5a' }}>{redCnt}건</span>
              </div>
              <div className={styles.summaryRow}>
                <span>주의</span>
                <span style={{ color: '#f5c842' }}>{yellowCnt}건</span>
              </div>
            </div>

            {/* 종목별 지표 */}
            <div className={styles.panelCard}>
              <div className={styles.panelCardTitle}>종목별 현재 지표</div>
              <table className={styles.indicatorTable}>
                <thead>
                  <tr>
                    <th>종목</th>
                    <th>RSI / 상태</th>
                    <th>24h</th>
                  </tr>
                </thead>
                <tbody>
                  {indicators.map(ind => (
                    <tr key={ind.symbol}>
                      <td className={styles.indSymbol}>{ind.symbol}</td>
                      <td className={styles.indRsiCell}>
                        <div style={{ color: ind.rsi.color }}>{ind.rsi.label}</div>
                        <div style={{ color: ind.bb.color, fontSize: 10 }}>{ind.bb.label}</div>
                      </td>
                      <td style={{
                        color: ind.change == null ? 'var(--muted)' : ind.change >= 0 ? '#10d9a0' : '#f05a5a',
                        fontSize: 11,
                      }}>
                        {ind.change == null ? '--' : pct(ind.change)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
