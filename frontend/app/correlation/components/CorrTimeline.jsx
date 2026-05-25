'use client';
import { useState, useEffect, useRef } from 'react';

// ─── 피어슨 상관계수 ─────────────────────────────────────────
function pearson(arr1, arr2) {
  const n = Math.min(arr1.length, arr2.length);
  if (n < 2) return 0;
  const mean1 = arr1.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const mean2 = arr2.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const num = arr1.slice(0, n).reduce((s, v, i) => s + (v - mean1) * (arr2[i] - mean2), 0);
  const den = Math.sqrt(
    arr1.slice(0, n).reduce((s, v) => s + (v - mean1) ** 2, 0) *
    arr2.slice(0, n).reduce((s, v) => s + (v - mean2) ** 2, 0)
  );
  return den === 0 ? 0 : num / den;
}

// ─── 롤링 상관계수 ───────────────────────────────────────────
function rollingPearson(p1, p2, win = 7) {
  const n = Math.min(p1.length, p2.length);
  const corrs = [], indices = [];
  for (let i = win - 1; i < n; i++) {
    corrs.push(pearson(p1.slice(i - win + 1, i + 1), p2.slice(i - win + 1, i + 1)));
    indices.push(i);
  }
  return { corrs, indices };
}

const DAYS_CONFIG = [
  { label: '1D', value: 1 },
  { label: '1W', value: 7 },
  { label: '1M', value: 30 },
];

export default function CorrTimeline({ fetchCrossMarketHistory, chartsReady }) {
  const [days, setDays]           = useState(1);
  const [corrData, setCorrData]   = useState([]);
  const [labels, setLabels]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const chartRef   = useRef(null);
  const chartInst  = useRef(null);

  // ─── 데이터 로드 + 롤링 계산 ─────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetchCrossMarketHistory(days).then(hist => {
      const btcPrices    = (hist?.btc    || []).map(d => d[1]);
      const nasdaqPrices = (hist?.nasdaq || []).map(d => d[1]);
      const timestamps   = (hist?.btc    || []).map(d => d[0]);

      const { corrs } = rollingPearson(btcPrices, nasdaqPrices, 7);
      const lbls = timestamps.slice(6).map(ts => {
        const d = new Date(ts);
        return days === 1
          ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
      });

      setCorrData(corrs);
      setLabels(lbls);
      setLoading(false);
    });
  }, [days, fetchCrossMarketHistory]);

  // ─── Chart.js 렌더링 ─────────────────────────────────────
  useEffect(() => {
    if (loading || !chartRef.current || !chartsReady) return;
    if (typeof window === 'undefined' || !window.Chart) return;
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }

    const ctx = chartInst.current = new window.Chart(chartRef.current.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'BTC × NASDAQ 상관계수',
          data: corrData,
          borderColor: '#e8eaf0',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.35,
          fill: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: -1, max: 1,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#6b7280', stepSize: 0.5, font: { family: "'DM Mono', monospace", size: 10 } },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#6b7280', maxTicksLimit: 8, font: { size: 10 } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `r = ${ctx.raw.toFixed(3)}`,
            },
          },
        },
      },
      plugins: [{
        id: 'zones',
        beforeDatasetsDraw(chart) {
          const { ctx: c, chartArea, scales } = chart;
          if (!chartArea) return;
          const { left, right, top } = chartArea;
          const yS = scales.y;

          c.save();

          // 디커플링 구간: |r| < 0.3 → 빨간 음영
          const y03p = yS.getPixelForValue(0.3);
          const y03n = yS.getPixelForValue(-0.3);
          c.fillStyle = 'rgba(248,113,113,0.07)';
          c.fillRect(left, y03p, right - left, y03n - y03p);

          // 강한 동조 구간: r > 0.7 → 초록 음영
          const y07 = yS.getPixelForValue(0.7);
          c.fillStyle = 'rgba(74,222,128,0.06)';
          c.fillRect(left, top, right - left, y07 - top);

          // 0 기준선
          const y0 = yS.getPixelForValue(0);
          c.strokeStyle = 'rgba(255,255,255,0.15)';
          c.lineWidth = 1;
          c.setLineDash([4, 4]);
          c.beginPath();
          c.moveTo(left, y0);
          c.lineTo(right, y0);
          c.stroke();
          c.setLineDash([]);

          c.restore();
        },
      }],
    });

    // keep ref as the Chart instance
    chartInst.current = ctx;

    return () => {
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    };
  }, [corrData, labels, loading, chartsReady]);

  // ─── 사이드 통계 ─────────────────────────────────────────
  const curr     = corrData.length > 0 ? corrData[corrData.length - 1]     : null;
  const prev     = corrData.length > 1 ? corrData[corrData.length - 2]     : null;
  const change   = curr !== null && prev !== null ? curr - prev             : null;
  const decCount = corrData.filter(v => Math.abs(v) < 0.3).length;
  const corrColor =
    curr === null         ? 'var(--text)'
    : Math.abs(curr) < 0.3 ? '#f87171'
    : curr > 0.7          ? '#4ade80'
    :                       '#facc15';

  return (
    <div>
      {/* 타임프레임 버튼 */}
      <div style={{ display:'flex', gap:4, marginBottom:10 }}>
        {DAYS_CONFIG.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setDays(value)}
            style={{
              padding:'4px 12px', fontSize:11, borderRadius:6, cursor:'pointer',
              background: days === value ? 'var(--bg3)' : 'transparent',
              border: `1px solid ${days === value ? 'rgba(255,255,255,0.15)' : 'var(--border)'}`,
              color: days === value ? 'var(--text)' : 'var(--muted2)',
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 구간 범례 */}
      <div style={{ display:'flex', gap:16, fontSize:10, color:'var(--muted2)', marginBottom:8 }}>
        <span>
          <span style={{ display:'inline-block', width:12, height:12, background:'rgba(248,113,113,0.2)', borderRadius:2, marginRight:4, verticalAlign:'middle' }} />
          디커플링 구간 (|r| &lt; 0.3)
        </span>
        <span>
          <span style={{ display:'inline-block', width:12, height:12, background:'rgba(74,222,128,0.15)', borderRadius:2, marginRight:4, verticalAlign:'middle' }} />
          강한 동조 구간 (r &gt; 0.7)
        </span>
      </div>

      {/* 차트 + 사이드 통계 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 190px', gap:16 }}>
        {/* 차트 영역 */}
        <div style={{ height:240, position:'relative' }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--muted2)', fontSize:13 }}>
              로딩 중...
            </div>
          ) : (
            <canvas ref={chartRef} />
          )}
        </div>

        {/* 사이드 통계 */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* 현재 상관계수 */}
          <div>
            <div style={{ fontSize:9, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
              현재 상관계수
            </div>
            <div style={{ fontSize:42, fontWeight:700, color:corrColor, fontVariantNumeric:'tabular-nums', lineHeight:1, fontFamily:"'DM Mono',monospace" }}>
              {curr !== null ? curr.toFixed(2) : '--'}
            </div>
            {change !== null && (
              <div style={{ fontSize:11, color: change >= 0 ? '#4ade80' : '#f87171', marginTop:4, fontFamily:"'DM Mono',monospace" }}>
                {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(3)}
              </div>
            )}
            <div style={{ fontSize:11, color:'var(--muted2)', marginTop:4, lineHeight:1.4 }}>
              {curr === null          ? '--'
               : Math.abs(curr) < 0.3 ? '디커플링 — 독립 움직임'
               : curr > 0.7          ? '강한 동조 — 분산 효과 낮음'
               : curr > 0.3          ? '중간 동조'
               :                       '약한 역상관'}
            </div>
          </div>

          {/* 디커플링 횟수 */}
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:9, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
              디커플링 구간
            </div>
            <div style={{ fontSize:22, fontWeight:700, color: decCount > 5 ? '#f87171' : 'var(--text)', fontFamily:"'DM Mono',monospace" }}>
              {decCount}
              <span style={{ fontSize:10, color:'var(--muted2)', marginLeft:3 }}>건</span>
            </div>
            <div style={{ fontSize:10, color:'var(--muted2)', marginTop:2 }}>|r| &lt; 0.3 구간 수</div>
          </div>

          {/* 데이터 포인트 수 */}
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:9, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
              데이터 포인트
            </div>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--text)', fontFamily:"'DM Mono',monospace" }}>
              {corrData.length}
              <span style={{ fontSize:10, color:'var(--muted2)', marginLeft:3 }}>개</span>
            </div>
            <div style={{ fontSize:10, color:'var(--muted2)', marginTop:2 }}>BTC × NASDAQ, 윈도우 7</div>
          </div>
        </div>
      </div>
    </div>
  );
}
