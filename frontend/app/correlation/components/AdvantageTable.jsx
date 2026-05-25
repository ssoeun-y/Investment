'use client';
import { useMemo } from 'react';

function stddev(arr) {
  if (!arr.length) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
}

function WinnerBadge({ winner, label }) {
  const styles = {
    crypto: { bg:'rgba(249,115,22,0.15)', color:'#f97316' },
    stock:  { bg:'rgba(96,165,250,0.15)',  color:'#60a5fa' },
    tie:    { bg:'rgba(107,114,128,0.15)', color:'var(--muted2)' },
    info:   { bg:'rgba(255,255,255,0.06)', color:'var(--muted2)' },
  };
  const s = styles[winner] ?? styles.tie;
  return (
    <span style={{ fontSize:9, padding:'2px 7px', borderRadius:3, fontWeight:700, whiteSpace:'nowrap', background:s.bg, color:s.color }}>
      {label}
    </span>
  );
}

function MiniBar({ value, max, color }) {
  if (value === null || max === 0) return null;
  const pct = Math.min(100, (Math.abs(value) / max) * 100);
  return (
    <div style={{ height:3, borderRadius:2, background:'var(--border)', overflow:'hidden', marginTop:4, width:'100%' }}>
      <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:2 }} />
    </div>
  );
}

export default function AdvantageTable({ stockData, krStockData, cryptoData, fearGreed }) {
  const { metrics, verdict } = useMemo(() => {
    const cryptos   = cryptoData  || [];
    const stocks    = stockData   || [];
    const krStocks  = krStockData || [];

    const cryptoChgs = cryptos.map(c => c.price_change_percentage_24h ?? 0);
    const stockChgs  = [
      ...stocks.map(s => s.change ?? 0),
      ...krStocks.map(s => s.change ?? 0),
    ];

    const cryptoAvg = cryptoChgs.length ? cryptoChgs.reduce((a, b) => a + b, 0) / cryptoChgs.length : 0;
    const stockAvg  = stockChgs.length  ? stockChgs.reduce((a, b) => a + b, 0) / stockChgs.length   : 0;
    const cryptoVol = stddev(cryptoChgs);
    const stockVol  = stddev(stockChgs);

    // 거래량 (USD 환산 근사)
    const cryptoVolUSD = cryptos.reduce((s, c) => s + (c.total_volume ?? 0), 0);
    const stockVolUSD  = stocks.reduce((s, s2) => s + (s2.volume ?? 0) * (s2.price ?? 1), 0);

    // BTC×NVDA 상관계수 (일중 방향 기반 근사)
    const btcChg  = cryptos.find(c => c.symbol === 'BTC')?.price_change_percentage_24h ?? 0;
    const nvdaChg = stocks.find(s => s.symbol === 'NVDA')?.change ?? 0;
    const rawCorr = btcChg * nvdaChg > 0
      ? Math.min(0.4 + (1 - Math.abs(btcChg - nvdaChg) * 0.02), 0.99)
      : Math.max(-0.4 - Math.abs(btcChg - nvdaChg) * 0.02, -0.99);
    const corrAbs = Math.abs(isNaN(rawCorr) ? 0 : rawCorr);

    const fgVal = fearGreed ? Number(fearGreed.value) : null;

    const metrics = [
      {
        label:    '24h 수익률',
        note:     null,
        stockVal: stockAvg,
        cryptoVal: cryptoAvg,
        stockDisplay:  `${stockAvg  >= 0 ? '+' : ''}${stockAvg.toFixed(2)}%`,
        cryptoDisplay: `${cryptoAvg >= 0 ? '+' : ''}${cryptoAvg.toFixed(2)}%`,
        barMax: Math.max(Math.abs(stockAvg), Math.abs(cryptoAvg), 0.01),
        winner: Math.abs(cryptoAvg) > Math.abs(stockAvg) && cryptoAvg > 0
                  ? 'crypto'
                  : Math.abs(stockAvg) > Math.abs(cryptoAvg) && stockAvg > 0
                  ? 'stock' : 'tie',
        winLabel: null,
      },
      {
        label:    '변동성 (σ)',
        note:     '낮을수록 안정적',
        stockVal: stockVol,
        cryptoVal: cryptoVol,
        stockDisplay:  `${stockVol.toFixed(2)}%`,
        cryptoDisplay: `${cryptoVol.toFixed(2)}%`,
        barMax: Math.max(stockVol, cryptoVol, 0.01),
        winner: stockVol < cryptoVol ? 'stock' : stockVol > cryptoVol ? 'crypto' : 'tie',
        winLabel: stockVol < cryptoVol ? '낮은 변동성' : '높은 변동성',
      },
      {
        label:    '거래량',
        note:     '24h 총 거래량',
        stockVal: stockVolUSD,
        cryptoVal: cryptoVolUSD,
        stockDisplay:  `$${(stockVolUSD / 1e9).toFixed(1)}B`,
        cryptoDisplay: `$${(cryptoVolUSD / 1e9).toFixed(1)}B`,
        barMax: Math.max(stockVolUSD, cryptoVolUSD, 1),
        winner: cryptoVolUSD > stockVolUSD ? 'crypto' : 'stock',
        winLabel: null,
      },
      {
        label:    '상관계수 (BTC × NVDA)',
        note:     corrAbs > 0.7 ? '분산 효과 낮음 — 동조 중' : '분산 유효 — 헤지 가능',
        stockVal: null,
        cryptoVal: null,
        stockDisplay:  null,
        cryptoDisplay: `r = ${corrAbs.toFixed(2)}`,
        barMax: null,
        winner: 'info',
        winLabel: corrAbs > 0.7 ? '동조' : '분산 유효',
      },
      {
        label:    '공포/탐욕',
        note:     fgVal !== null ? fearGreed?.value_classification ?? null : null,
        stockVal: null,
        cryptoVal: null,
        stockDisplay:  null,
        cryptoDisplay: fgVal !== null ? `${fgVal}` : '--',
        barMax: null,
        winner: fgVal !== null
          ? (fgVal < 35 ? 'crypto' : fgVal > 65 ? 'stock' : 'tie')
          : 'tie',
        winLabel: fgVal !== null
          ? (fgVal < 35 ? '코인 매수 타이밍' : fgVal > 65 ? '차익실현 고려' : '중립')
          : '로딩 중',
      },
    ];

    // ── 종합 판단
    let verdict;
    if (cryptoAvg > stockAvg && cryptoAvg > 0 && cryptoVolUSD > stockVolUSD) {
      verdict = { text:'단기 코인 유리 — 수익률·거래량 앞서고 있음', color:'#f97316', border:'rgba(249,115,22,0.3)' };
    } else if (stockAvg > cryptoAvg && stockAvg > 0 && fgVal !== null && fgVal > 60) {
      verdict = { text:'주식 우선 — 수익률 우위 + 시장 탐욕 구간', color:'#60a5fa', border:'rgba(96,165,250,0.3)' };
    } else if (fgVal !== null && fgVal < 35) {
      verdict = { text:'양쪽 분할 매수 고려 — 공포 구간 = 저가 매수 기회', color:'#10d9a0', border:'rgba(16,217,160,0.3)' };
    } else {
      verdict = { text:'중립 — 명확한 우위 없음, 관망 권장', color:'var(--muted2)', border:'var(--border)' };
    }

    return { metrics, verdict };
  }, [stockData, krStockData, cryptoData, fearGreed]);

  const loading = !stockData?.length && !cryptoData?.length;
  if (loading) {
    return <div style={{ textAlign:'center', padding:'32px 0', color:'var(--muted2)', fontSize:13 }}>로딩 중...</div>;
  }

  return (
    <div>
      {/* 범례 */}
      <div style={{ display:'flex', gap:16, marginBottom:12, fontSize:11, color:'var(--muted2)' }}>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:10, height:10, background:'rgba(96,165,250,0.35)', borderRadius:2, display:'inline-block' }} />주식
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:10, height:10, background:'rgba(249,115,22,0.35)', borderRadius:2, display:'inline-block' }} />코인
        </span>
      </div>

      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr>
            {['지표', '주식', '코인', '판정'].map(h => (
              <th key={h} style={{ padding:'7px 12px', fontSize:10, color:'var(--muted2)', fontWeight:500, textAlign: h === '지표' ? 'left' : 'center', borderBottom:'1px solid var(--border)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, i) => (
            <tr key={i}>
              {/* 지표명 */}
              <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', verticalAlign:'middle' }}>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{m.label}</div>
                {m.note && <div style={{ fontSize:10, color:'var(--muted2)', marginTop:2 }}>{m.note}</div>}
              </td>

              {/* 주식 값 */}
              <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', textAlign:'center', verticalAlign:'middle' }}>
                {m.stockDisplay && (
                  <>
                    <div style={{ fontSize:13, fontWeight:600, color: m.stockVal !== null && m.stockVal >= 0 ? '#4ade80' : m.stockVal !== null ? '#f87171' : 'var(--text)', fontFamily:"'DM Mono',monospace" }}>
                      {m.stockDisplay}
                    </div>
                    <MiniBar value={m.stockVal} max={m.barMax} color="rgba(96,165,250,0.6)" />
                  </>
                )}
              </td>

              {/* 코인 값 */}
              <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', textAlign:'center', verticalAlign:'middle' }}>
                {m.cryptoDisplay && (
                  <>
                    <div style={{ fontSize:13, fontWeight:600, color: m.cryptoVal !== null && m.cryptoVal >= 0 ? '#4ade80' : m.cryptoVal !== null ? '#f87171' : 'var(--text)', fontFamily:"'DM Mono',monospace" }}>
                      {m.cryptoDisplay}
                    </div>
                    <MiniBar value={m.cryptoVal} max={m.barMax} color="rgba(249,115,22,0.6)" />
                  </>
                )}
              </td>

              {/* 판정 */}
              <td style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', textAlign:'center', verticalAlign:'middle' }}>
                <WinnerBadge
                  winner={m.winner}
                  label={
                    m.winLabel ?? (
                      m.winner === 'crypto' ? '코인 우위'
                      : m.winner === 'stock'  ? '주식 우위'
                      : m.winner === 'info'   ? '참고'
                      :                         '동등'
                    )
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 종합 판단 */}
      <div style={{ marginTop:16, padding:'14px 16px', borderRadius:10, border:`1px solid ${verdict.border}`, background:'rgba(255,255,255,0.01)' }}>
        <div style={{ fontSize:10, color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>종합 판단</div>
        <div style={{ fontSize:15, fontWeight:700, color:verdict.color }}>{verdict.text}</div>
      </div>
    </div>
  );
}
