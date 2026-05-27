'use client';
import { useMemo } from 'react';

function typeStyle(type) {
  if (type === 'red')    return { bg:'rgba(240,90,90,0.08)',  bd:'rgba(240,90,90,0.25)',  dot:'#f05a5a' };
  if (type === 'yellow') return { bg:'rgba(245,200,66,0.08)', bd:'rgba(245,200,66,0.25)', dot:'#f5c842' };
  return                        { bg:'rgba(16,217,160,0.08)', bd:'rgba(16,217,160,0.25)', dot:'#10d9a0' };
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize:11, color:'var(--muted2)' }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:600, fontFamily:"'DM Mono',monospace", color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  );
}

export default function DecouplingAlert({ stockData, krStockData, cryptoData, corrProxy }) {
  const { signals, summary } = useMemo(() => {
    const cryptos  = cryptoData  || [];
    const stocks   = stockData   || [];
    const krStocks = krStockData || [];

    const btcChg = cryptos.find(c => c.symbol === 'BTC')?.price_change_percentage_24h ?? null;
    if (btcChg === null) return { signals: [], summary: null };

    const allChanges = [
      ...stocks.map(s => s.change ?? 0),
      ...krStocks.map(s => s.change ?? 0),
    ];
    if (!allChanges.length) return { signals: [], summary: null };

    const stockAvg = allChanges.reduce((a, b) => a + b, 0) / allChanges.length;
    const btcDir   = btcChg   > 0 ? 1 : -1;
    const stDir    = stockAvg > 0 ? 1 : -1;
    const sameDir  = btcDir === stDir;
    const diff     = Math.abs(btcChg - stockAvg);

    const summary = { btcChg, stockAvg, sameDir, diff };
    const signals = [];

    // ── 강한 디커플링: 방향 반대 + 차이 > 3%
    if (!sameDir && diff > 3) {
      const msg = stockAvg > 0
        ? `반도체 강세(${stockAvg.toFixed(1)}%), BTC 약세(${btcChg.toFixed(1)}%) — 주식 우선 포지션 유리`
        : `BTC 강세(${btcChg.toFixed(1)}%), 주식 약세(${stockAvg.toFixed(1)}%) — 코인 단기 트레이딩 고려`;
      signals.push({
        type: 'red',
        title: '강한 디커플링',
        msg,
        corr: (-(diff * 0.05)).toFixed(2),
      });
    }

    // ── 약한 분리: 방향 같지만 차이 > 5%
    if (sameDir && diff > 5) {
      signals.push({
        type: 'yellow',
        title: '약한 분리',
        msg: `방향 동일하나 강도 격차 큼 — BTC ${btcChg.toFixed(1)}% vs 주식 ${stockAvg.toFixed(1)}% (${diff.toFixed(1)}%p 차이)`,
        corr: Math.max(0, 0.3 - diff * 0.02).toFixed(2),
      });
    }

    // ── 동조 복귀: 방향 같고 차이 ≤ 2%
    if (sameDir && diff <= 2) {
      signals.push({
        type: 'green',
        title: '동조 구간',
        msg: `BTC(${btcChg.toFixed(1)}%)·주식(${stockAvg.toFixed(1)}%) 함께 움직임 — 포트폴리오 분산 효과 제한적`,
        corr: Math.min(0.99, 0.6 + (2 - diff) * 0.05).toFixed(2),
      });
    }

    // ── 개별 코인 강한 이탈
    cryptos.forEach(c => {
      const cChg = c.price_change_percentage_24h ?? 0;
      const d    = Math.abs(cChg - stockAvg);
      if (d > 8 && ((cChg > 0) !== (stockAvg > 0)) && c.symbol !== 'BTC') {
        signals.push({
          type: 'yellow',
          title: `${c.symbol} 강한 이탈`,
          msg: `${c.symbol} ${cChg >= 0 ? '+' : ''}${cChg.toFixed(1)}% — 주식 섹터와 ${d.toFixed(1)}%p 격차 발생`,
          corr: null,
        });
      }
    });

    return { signals, summary };
  }, [stockData, krStockData, cryptoData]);

  const loading = !stockData?.length && !cryptoData?.length;
  if (loading) {
    return <div style={{ textAlign:'center', padding:'32px 0', color:'var(--muted2)', fontSize:13 }}>로딩 중...</div>;
  }

  // 신호 없음 → 현재 상태 요약 표시
  if (!signals.length && summary) {
    const corrAbs   = Math.abs(corrProxy ?? 0);
    const { btcChg, stockAvg, sameDir, diff } = summary;
    const corrColor = corrAbs > 0.7 ? '#f87171' : corrAbs > 0.4 ? '#f5c842' : '#4ade80';

    return (
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:14 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#10d9a0', display:'inline-block', flexShrink:0 }} />
          <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>최근 24h 특이 신호 없음</span>
        </div>

        <StatRow
          label="BTC 24h"
          value={`${btcChg >= 0 ? '+' : ''}${btcChg.toFixed(2)}%`}
          color={btcChg >= 0 ? '#4ade80' : '#f87171'}
        />
        <StatRow
          label="주식 평균 24h"
          value={`${stockAvg >= 0 ? '+' : ''}${stockAvg.toFixed(2)}%`}
          color={stockAvg >= 0 ? '#4ade80' : '#f87171'}
        />
        <StatRow
          label="방향 차이"
          value={`${diff.toFixed(2)}%p`}
          color={diff > 3 ? '#f5c842' : 'var(--muted2)'}
        />
        <StatRow
          label="현재 상관계수 (BTC×NVDA proxy)"
          value={`r = ${corrAbs.toFixed(2)}`}
          color={corrColor}
        />

        <div style={{
          marginTop:14, padding:'10px 12px', borderRadius:8,
          background: sameDir ? 'rgba(16,217,160,0.06)' : 'rgba(245,200,66,0.06)',
          border: `1px solid ${sameDir ? 'rgba(16,217,160,0.2)' : 'rgba(245,200,66,0.2)'}`,
          fontSize:12, color:'var(--text)',
        }}>
          {sameDir ? '✅ 현재 동조 중 — 주식과 코인이 같은 방향으로 움직이는 중' : '⚠️ 현재 분리 중 — 방향 다르지만 임계값 미달'}
        </div>
      </div>
    );
  }

  if (!signals.length) {
    return (
      <div style={{ textAlign:'center', padding:'32px 0', color:'var(--muted2)', fontSize:13 }}>
        🟢 신호 없음 — 데이터 로딩 중
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
