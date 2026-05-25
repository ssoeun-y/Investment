'use client';
import { useMemo } from 'react';

function typeStyle(type) {
  if (type === 'red')    return { bg:'rgba(240,90,90,0.08)',  bd:'rgba(240,90,90,0.25)',  dot:'#f05a5a' };
  if (type === 'yellow') return { bg:'rgba(245,200,66,0.08)', bd:'rgba(245,200,66,0.25)', dot:'#f5c842' };
  return                        { bg:'rgba(16,217,160,0.08)', bd:'rgba(16,217,160,0.25)', dot:'#10d9a0' };
}

export default function DecouplingAlert({ stockData, krStockData, cryptoData }) {
  const signals = useMemo(() => {
    const cryptos   = cryptoData  || [];
    const stocks    = stockData   || [];
    const krStocks  = krStockData || [];

    const btcChg = cryptos.find(c => c.symbol === 'BTC')?.price_change_percentage_24h ?? null;
    if (btcChg === null) return [];

    const allChanges = [
      ...stocks.map(s => s.change ?? 0),
      ...krStocks.map(s => s.change ?? 0),
    ];
    if (!allChanges.length) return [];

    const stockAvg = allChanges.reduce((a, b) => a + b, 0) / allChanges.length;
    const btcDir   = btcChg   > 0 ? 1 : -1;
    const stDir    = stockAvg > 0 ? 1 : -1;
    const diff     = Math.abs(btcChg - stockAvg);

    const result = [];

    // ── 강한 디커플링: 방향 반대 + 차이 > 3%
    if (btcDir !== stDir && diff > 3) {
      const msg = stockAvg > 0
        ? `반도체 강세(${stockAvg.toFixed(1)}%), BTC 약세(${btcChg.toFixed(1)}%) — 주식 우선 포지션 유리`
        : `BTC 강세(${btcChg.toFixed(1)}%), 주식 약세(${stockAvg.toFixed(1)}%) — 코인 단기 트레이딩 고려`;
      result.push({
        type: 'red',
        title: '강한 디커플링',
        msg,
        corr: (-(diff * 0.05)).toFixed(2),
      });
    }

    // ── 약한 분리: 방향 같지만 차이 > 5%
    if (btcDir === stDir && diff > 5) {
      result.push({
        type: 'yellow',
        title: '약한 분리',
        msg: `방향 동일하나 강도 격차 큼 — BTC ${btcChg.toFixed(1)}% vs 주식 ${stockAvg.toFixed(1)}% (${diff.toFixed(1)}%p 차이)`,
        corr: Math.max(0, 0.3 - diff * 0.02).toFixed(2),
      });
    }

    // ── 동조 복귀: 방향 같고 차이 ≤ 2%
    if (btcDir === stDir && diff <= 2) {
      result.push({
        type: 'green',
        title: '동조 구간',
        msg: `BTC(${btcChg.toFixed(1)}%)·주식(${stockAvg.toFixed(1)}%) 함께 움직임 — 포트폴리오 분산 효과 제한적`,
        corr: Math.min(0.99, 0.6 + (2 - diff) * 0.05).toFixed(2),
      });
    }

    // ── 개별 코인 강한 이탈 감지
    cryptos.forEach(c => {
      const cChg = c.price_change_percentage_24h ?? 0;
      const d    = Math.abs(cChg - stockAvg);
      if (d > 8 && ((cChg > 0) !== (stockAvg > 0)) && c.symbol !== 'BTC') {
        result.push({
          type: 'yellow',
          title: `${c.symbol} 강한 이탈`,
          msg: `${c.symbol} ${cChg >= 0 ? '+' : ''}${cChg.toFixed(1)}% — 주식 섹터와 ${d.toFixed(1)}%p 격차 발생`,
          corr: null,
        });
      }
    });

    return result;
  }, [stockData, krStockData, cryptoData]);

  const loading = !stockData?.length && !cryptoData?.length;
  if (loading) {
    return <div style={{ textAlign:'center', padding:'32px 0', color:'var(--muted2)', fontSize:13 }}>로딩 중...</div>;
  }

  if (!signals.length) {
    return (
      <div style={{ textAlign:'center', padding:'32px 0', color:'var(--muted2)', fontSize:13 }}>
        🟢 강한 디커플링 신호 없음<br />
        <span style={{ fontSize:11, marginTop:6, display:'block' }}>주식과 코인이 유사한 방향으로 움직이는 중</span>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {signals.map((sig, i) => {
        const s = typeStyle(sig.type);
        return (
          <div
            key={i}
            style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', borderRadius:8, background:s.bg, border:`1px solid ${s.bd}` }}
          >
            <span style={{ width:8, height:8, borderRadius:'50%', background:s.dot, flexShrink:0, marginTop:4, display:'inline-block' }} />
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:2 }}>{sig.title}</div>
              <div style={{ fontSize:11, color:'var(--muted2)', lineHeight:1.5 }}>{sig.msg}</div>
              {sig.corr !== null && (
                <div style={{ fontSize:10, color:'var(--muted)', marginTop:3, fontFamily:"'DM Mono',monospace" }}>
                  추정 상관계수: {sig.corr}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
