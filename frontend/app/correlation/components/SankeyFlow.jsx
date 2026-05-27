'use client';
import { useMemo } from 'react';

const SECTOR_MAP = {
  NVDA:'Technology', AAPL:'Technology', MSFT:'Technology',
  GOOGL:'Technology', META:'Technology', AMZN:'Technology',
  TSLA:'Consumer', XOM:'Energy', CVX:'Energy',
  JPM:'Financials', BAC:'Financials',
  JNJ:'Healthcare', PFE:'Healthcare',
  CAT:'Industrials', BA:'Industrials',
  '005930':'Technology', '000660':'Technology', '005380':'Industrials',
};

const LEFT_SECTORS  = ['Technology','Consumer','Energy','Financials','Healthcare','Industrials','Crypto'];
const RIGHT_CRYPTOS = ['BTC','ETH','XRP','SOL','기타'];
const MAIN_SYMS     = ['BTC','ETH','XRP','SOL'];

const VW = 900, VH = 400, HEADER_H = 56;
const CONTENT_H = VH - HEADER_H;
const NODE_W = 140, NODE_H = 34, GAP = 9;
const LX = 4 + NODE_W;       // 144 — right edge of left nodes
const RX = VW - 4 - NODE_W;  // 756 — left edge of right nodes

function positionNodes(items) {
  const total  = items.length * NODE_H + (items.length - 1) * GAP;
  const startY = HEADER_H + (CONTENT_H - total) / 2;
  return items.map((name, i) => ({
    name,
    y:  startY + i * (NODE_H + GAP),
    cy: startY + i * (NODE_H + GAP) + NODE_H / 2,
  }));
}

export default function SankeyFlow({ stockData, krStockData, cryptoData }) {
  const { sectorAgg, cryptoFlow, cryptoAvg, edges } = useMemo(() => {
    const sectorAgg = {};
    LEFT_SECTORS.forEach(s => { sectorAgg[s] = 0; });

    const allStocks = [
      ...(stockData   || []).map(s => ({ sym: s.symbol, chg: s.change ?? 0, price: s.price ?? 1 })),
      ...(krStockData || []).map(s => ({ sym: s.symbol, chg: s.change ?? 0, price: s.price ?? 1 })),
    ];
    for (const s of allStocks) {
      const sec = SECTOR_MAP[s.sym];
      if (sec) sectorAgg[sec] += (s.chg / 100) * s.price;
    }

    const cryptos   = cryptoData || [];
    const cryptoAvg = cryptos.length
      ? cryptos.reduce((sum, c) => sum + (c.price_change_percentage_24h ?? 0), 0) / cryptos.length
      : 0;
    const btc = cryptos.find(c => c.symbol === 'BTC');
    sectorAgg['Crypto'] = btc
      ? (btc.price_change_percentage_24h / 100) * (btc.current_price ?? 60000)
      : 0;

    const cryptoFlow = {};
    MAIN_SYMS.forEach(sym => {
      const c = cryptos.find(x => x.symbol === sym);
      cryptoFlow[sym] = c ? (c.price_change_percentage_24h ?? 0) : 0;
    });
    const others = cryptos.filter(c => !MAIN_SYMS.includes(c.symbol));
    cryptoFlow['기타'] = others.length
      ? others.reduce((s, c) => s + (c.price_change_percentage_24h ?? 0), 0) / others.length
      : 0;

    const totalVol = cryptos.reduce((s, c) => s + (c.total_volume ?? 0), 0) || 1;
    const volWeight = {};
    MAIN_SYMS.forEach(sym => {
      const c = cryptos.find(x => x.symbol === sym);
      volWeight[sym] = c ? (c.total_volume ?? 0) / totalVol : 1 / RIGHT_CRYPTOS.length;
    });
    const otherVol = others.reduce((s, c) => s + (c.total_volume ?? 0), 0);
    volWeight['기타'] = otherVol / totalVol || 1 / RIGHT_CRYPTOS.length;

    const maxAbsFlow = Math.max(...Object.values(sectorAgg).map(Math.abs), 1);

    const edges = [];
    LEFT_SECTORS.forEach(sector => {
      const flow     = sectorAgg[sector];
      const normFlow = flow / maxAbsFlow; // -1 ~ 1

      RIGHT_CRYPTOS.forEach(sym => {
        const w       = volWeight[sym] ?? 1 / RIGHT_CRYPTOS.length;
        if (w < 0.005 && sym !== '기타') return;
        const coinChg = cryptoFlow[sym] ?? 0;

        // flowValue: normalized 0–100 scale for line thickness formula
        const flowValue = Math.abs(normFlow) * w * 100;
        const strokeW   = Math.max(1, flowValue * 0.3);

        // 주식→코인: 섹터 유입 > 0 AND 해당 코인 하락
        if (flow > 0 && coinChg < 0) {
          edges.push({ from: sector, to: sym, strokeW, color: '#D85A30', opacity: 0.55, yOff: 1.5 });
        }
        // 코인→주식: 해당 코인 상승 AND 섹터 유입 < 0
        if (coinChg > 0 && flow < 0) {
          edges.push({ from: sector, to: sym, strokeW, color: '#185FA5', opacity: 0.55, yOff: -1.5 });
        }
        // 방향 불명확(동조) → 얇은 neutral 선
        if (!((flow > 0 && coinChg < 0) || (coinChg > 0 && flow < 0))) {
          edges.push({ from: sector, to: sym, strokeW: Math.max(0.5, strokeW * 0.25), color: 'rgba(255,255,255,0.15)', opacity: 0.4, yOff: 0 });
        }
      });
    });

    return { sectorAgg, cryptoFlow, cryptoAvg, edges };
  }, [stockData, krStockData, cryptoData]);

  const leftNodes  = positionNodes(LEFT_SECTORS);
  const rightNodes = positionNodes(RIGHT_CRYPTOS);

  const loading = !stockData?.length && !cryptoData?.length;

  return (
    <svg
      width="100%"
      height="400"
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      {/* ── 헤더 (SVG 내부) ─────────────────────────────────── */}
      <text x="16" y="22" fill="#e8eaf0" fontSize="13" fontWeight="600">
        Sankey — 섹터 ↔ 코인 자금 이동
      </text>

      {/* 범례 */}
      <line x1="16"  y1="41" x2="38"  y2="41" stroke="#D85A30" strokeWidth="2.5" strokeLinecap="round"/>
      <text x="42"  y="45" fill="#9ca3af" fontSize="10">주식→코인 (섹터↑·코인↓)</text>
      <line x1="170" y1="41" x2="192" y2="41" stroke="#185FA5" strokeWidth="2.5" strokeLinecap="round"/>
      <text x="196" y="45" fill="#9ca3af" fontSize="10">코인→주식 (코인↑·섹터↓)</text>
      <line x1="340" y1="41" x2="362" y2="41" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
      <text x="366" y="45" fill="#9ca3af" fontSize="10">동조 (방향 일치)</text>

      {/* 코인 평균 */}
      <text
        x={VW - 12} y="45" textAnchor="end"
        fill={cryptoAvg >= 0 ? '#4ade80' : '#f87171'}
        fontSize="11" fontFamily="'DM Mono',monospace"
      >
        코인 평균 {cryptoAvg >= 0 ? '+' : ''}{cryptoAvg.toFixed(2)}%
      </text>

      {/* 구분선 */}
      <line x1="0" y1={HEADER_H} x2={VW} y2={HEADER_H} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>

      {loading ? (
        <text x={VW / 2} y={(VH + HEADER_H) / 2} textAnchor="middle" dominantBaseline="middle" fill="#6b7280" fontSize="13">
          로딩 중...
        </text>
      ) : (
        <>
          {/* ── Bezier 흐름선 ───────────────────────────────── */}
          {edges.map((e, i) => {
            const ln = leftNodes.find(n => n.name === e.from);
            const rn = rightNodes.find(n => n.name === e.to);
            if (!ln || !rn) return null;
            const x1 = LX + 6, y1 = ln.cy + e.yOff;
            const x2 = RX - 6, y2 = rn.cy + e.yOff;
            const cx1 = x1 + (x2 - x1) * 0.42;
            const cx2 = x1 + (x2 - x1) * 0.58;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={e.color}
                strokeWidth={e.strokeW}
                strokeOpacity={e.opacity}
              />
            );
          })}

          {/* ── 섹터 노드 (좌) ──────────────────────────────── */}
          {leftNodes.map(n => {
            const flow = sectorAgg[n.name] ?? 0;
            const up   = flow >= 0;
            // 변화율 표시: 섹터 flow는 raw $값이므로 부호만 표시, 퍼센트는 없음
            const sign = up ? '+' : '';
            return (
              <g key={n.name}>
                <rect
                  x={4} y={n.y} width={NODE_W} height={NODE_H} rx={5}
                  fill={up ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)'}
                  stroke={up ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)'}
                  strokeWidth={1}
                />
                <text x={14} y={n.cy} fontSize={10} dominantBaseline="middle" fill="#e8eaf0">
                  {n.name}
                </text>
                <text x={NODE_W - 2} y={n.cy} fontSize={9} textAnchor="end" dominantBaseline="middle" fill={up ? '#4ade80' : '#f87171'}>
                  {sign}{flow.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* ── 코인 노드 (우) ──────────────────────────────── */}
          {rightNodes.map(n => {
            const chg = cryptoFlow[n.name] ?? 0;
            const up  = chg >= 0;
            return (
              <g key={n.name}>
                <rect
                  x={RX + 4} y={n.y} width={NODE_W} height={NODE_H} rx={5}
                  fill={up ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)'}
                  stroke={up ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)'}
                  strokeWidth={1}
                />
                <text x={RX + 12} y={n.cy} fontSize={11} dominantBaseline="middle" fill="#e8eaf0">
                  {n.name}
                </text>
                <text x={RX + NODE_W - 2} y={n.cy} fontSize={9} textAnchor="end" dominantBaseline="middle" fill={up ? '#4ade80' : '#f87171'}>
                  {up ? '+' : ''}{chg.toFixed(1)}%
                </text>
              </g>
            );
          })}
        </>
      )}
    </svg>
  );
}
