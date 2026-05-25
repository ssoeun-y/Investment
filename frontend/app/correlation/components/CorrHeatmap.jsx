'use client';
import { useState, useMemo } from 'react';

const STOCK_ROWS = [
  { sym: 'NVDA',   label: 'NVDA',   src: 'us' },
  { sym: 'AAPL',   label: 'AAPL',   src: 'us' },
  { sym: 'TSLA',   label: 'TSLA',   src: 'us' },
  { sym: '005930', label: '삼성전자', src: 'kr' },
  { sym: 'SPY',    label: 'SPY',    src: 'us' },
];
const CRYPTO_COLS = ['BTC', 'ETH', 'XRP', 'SOL'];

// 방향 일치 여부 기반 상관도 계산 (spec 공식 그대로)
function calcCorr(chg1, chg2) {
  const sameDir = (chg1 >= 0) === (chg2 >= 0);
  return sameDir
    ? Math.max(0.3, 1 - Math.abs(chg1 - chg2) * 0.05)
    : Math.min(-0.1, -Math.abs(chg1 - chg2) * 0.05);
}

function corrBg(v) {
  if (v === null) return 'rgba(255,255,255,0.03)';
  if (v > 0.7)   return `rgba(16,217,160,${0.12 + v * 0.45})`;
  if (v > 0.3)   return `rgba(74,222,128,${0.07 + v * 0.22})`;
  if (v >= 0)    return `rgba(255,255,255,${0.02 + v * 0.06})`;
  if (v > -0.3)  return `rgba(248,113,113,${0.05 + Math.abs(v) * 0.15})`;
  return              `rgba(248,113,113,${0.12 + Math.abs(v) * 0.38})`;
}

function corrTextColor(v) {
  if (v === null) return 'var(--muted2)';
  if (v > 0.7)   return '#4ade80';
  if (v > 0.3)   return '#a3e635';
  if (v >= 0)    return 'var(--muted2)';
  if (v > -0.3)  return '#fca5a5';
  return '#f87171';
}

export default function CorrHeatmap({ stockData, krStockData, cryptoData }) {
  const [selected, setSelected] = useState(null);

  const matrix = useMemo(() => {
    const stockChg = {};
    (stockData   || []).forEach(s => { stockChg[s.symbol] = s.change ?? null; });
    (krStockData || []).forEach(s => { stockChg[s.symbol] = s.change ?? null; });

    const cryptoChg = {};
    (cryptoData || []).forEach(c => { cryptoChg[c.symbol] = c.price_change_percentage_24h ?? null; });

    return STOCK_ROWS.map(row => ({
      row,
      cells: CRYPTO_COLS.map(sym => {
        const c1 = stockChg[row.sym] ?? null;
        const c2 = cryptoChg[sym]   ?? null;
        return {
          sym,
          corr:  (c1 !== null && c2 !== null) ? calcCorr(c1, c2) : null,
          chg1:  c1,
          chg2:  c2,
        };
      }),
    }));
  }, [stockData, krStockData, cryptoData]);

  const loading = !stockData?.length && !cryptoData?.length;
  if (loading) {
    return <div style={{ textAlign:'center', padding:'48px 0', color:'var(--muted2)', fontSize:13 }}>로딩 중...</div>;
  }

  const sel = selected; // shorthand

  return (
    <div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr>
              <th style={{ padding:'6px 8px 6px 0', fontSize:10, color:'var(--muted2)', borderBottom:'1px solid var(--border)', textAlign:'right', minWidth:72 }}>
                주식↓ / 코인→
              </th>
              {CRYPTO_COLS.map(sym => (
                <th key={sym} style={{ padding:'6px 10px', fontSize:11, fontWeight:600, color:'var(--muted2)', textAlign:'center', borderBottom:'1px solid var(--border)' }}>
                  {sym}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(({ row, cells }) => (
              <tr key={row.sym}>
                <td style={{ padding:'3px 8px 3px 0', fontSize:11, color:'var(--muted2)', textAlign:'right', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                  {row.label}
                </td>
                {cells.map(cell => {
                  const isActive = sel?.sym === cell.sym && sel?.stockSym === row.sym;
                  return (
                    <td key={cell.sym} style={{ padding:'3px 4px', borderBottom:'1px solid var(--border)' }}>
                      <div
                        onClick={() => setSelected(isActive ? null : { ...cell, stockSym: row.sym, stockLabel: row.label })}
                        style={{
                          width:72, height:50, borderRadius:6,
                          background: corrBg(cell.corr),
                          border: isActive ? `1px solid ${corrTextColor(cell.corr)}` : '1px solid transparent',
                          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                          cursor:'pointer', transition:'all 0.12s', gap:2,
                        }}
                      >
                        <div style={{ fontSize:13, fontWeight:700, color:corrTextColor(cell.corr), fontFamily:"'DM Mono',monospace", lineHeight:1 }}>
                          {cell.corr !== null ? cell.corr.toFixed(2) : '--'}
                        </div>
                        <div style={{ fontSize:8, color:'var(--muted2)' }}>
                          {cell.corr !== null ? ((cell.chg1 >= 0) === (cell.chg2 >= 0) ? '동조' : '역행') : ''}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 색상 범례 */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:12 }}>
        <span style={{ fontSize:10, color:'var(--muted2)' }}>-1</span>
        <div style={{ flex:1, height:5, borderRadius:3, background:'linear-gradient(90deg, rgba(248,113,113,0.8), rgba(255,255,255,0.1), rgba(74,222,128,0.8))' }} />
        <span style={{ fontSize:10, color:'var(--muted2)' }}>+1</span>
      </div>

      {/* 선택 셀 상세 */}
      {sel && (
        <div style={{ marginTop:10, padding:'10px 14px', background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:8 }}>
          <div style={{ fontSize:13, fontWeight:700, color:corrTextColor(sel.corr), marginBottom:5 }}>
            {sel.stockLabel} ↔ {sel.sym}: {sel.corr?.toFixed(2) ?? '--'}
          </div>
          <div style={{ fontSize:11, color:'var(--muted2)', lineHeight:1.6 }}>
            {sel.stockLabel} 24h: {sel.chg1 !== null ? (sel.chg1 >= 0 ? '+' : '') + sel.chg1.toFixed(2) + '%' : '--'}<br />
            {sel.sym} 24h: {sel.chg2 !== null ? (sel.chg2 >= 0 ? '+' : '') + sel.chg2.toFixed(2) + '%' : '--'}<br />
            {sel.corr >= 0.7  ? '매우 강한 동조 — 함께 움직이는 경향'
             : sel.corr >= 0.3 ? '중간 동조'
             : sel.corr >= 0   ? '약한 상관 — 대체로 독립적'
             :                   '역행 중 — 헤지 효과 기대 가능'}
          </div>
        </div>
      )}
    </div>
  );
}
