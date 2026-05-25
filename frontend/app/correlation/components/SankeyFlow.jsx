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
const MAIN_SYMS = ['BTC','ETH','XRP','SOL'];

const VW = 800, VH = 400;
const NODE_W = 140, NODE_H = 36, GAP = 10;
const LX = NODE_W + 8;   // right edge of left nodes
const RX = VW - NODE_W - 8; // left edge of right nodes

function positionNodes(items, vh, nh, gap) {
  const total = items.length * nh + (items.length - 1) * gap;
  const startY = (vh - total) / 2;
  return items.map((name, i) => ({
    name,
    y:  startY + i * (nh + gap),
    cy: startY + i * (nh + gap) + nh / 2,
  }));
}

function dirColor(dir) {
  if (dir === 'stc') return '#D85A30';
  if (dir === 'cts') return '#185FA5';
  return 'rgba(255,255,255,0.06)';
}
function dirOpacity(dir) {
  return dir === 'neutral' ? 0.5 : 0.5;
}

export default function SankeyFlow({ stockData, krStockData, cryptoData }) {
  const { sectorAgg, cryptoFlow, edges, cryptoAvg } = useMemo(() => {
    const sectorAgg = {};
    LEFT_SECTORS.forEach(s => { sectorAgg[s] = 0; });

    // Stock sector aggregation
    const allStocks = [
      ...(stockData   || []).map(s => ({ sym: s.symbol,  chg: s.change ?? 0, price: s.price ?? 1 })),
      ...(krStockData || []).map(s => ({ sym: s.symbol,  chg: s.change ?? 0, price: s.price ?? 1 })),
    ];
    for (const s of allStocks) {
      const sec = SECTOR_MAP[s.sym];
      if (sec) sectorAgg[sec] += (s.chg / 100) * s.price;
    }

    // Crypto aggregate
    const cryptos  = cryptoData || [];
    const cryptoAvg = cryptos.length
      ? cryptos.reduce((sum, c) => sum + (c.price_change_percentage_24h ?? 0), 0) / cryptos.length
      : 0;
    const btc = cryptos.find(c => c.symbol === 'BTC');
    sectorAgg['Crypto'] = btc
      ? (btc.price_change_percentage_24h / 100) * (btc.current_price ?? 60000)
      : 0;

    // Per-crypto 24h change
    const cryptoFlow = {};
    MAIN_SYMS.forEach(sym => {
      const c = cryptos.find(x => x.symbol === sym);
      cryptoFlow[sym] = c ? (c.price_change_percentage_24h ?? 0) : 0;
    });
    const others = cryptos.filter(c => !MAIN_SYMS.includes(c.symbol));
    cryptoFlow['기타'] = others.length
      ? others.reduce((s, c) => s + (c.price_change_percentage_24h ?? 0), 0) / others.length
      : 0;

    // Volume weights for distributing sector flows across cryptos
    const totalVol = cryptos.reduce((s, c) => s + (c.total_volume ?? 0), 0) || 1;
    const volWeight = {};
    MAIN_SYMS.forEach(sym => {
      const c = cryptos.find(x => x.symbol === sym);
      volWeight[sym] = c ? (c.total_volume ?? 0) / totalVol : 0;
    });
    const otherVol = others.reduce((s, c) => s + (c.total_volume ?? 0), 0);
    volWeight['기타'] = otherVol / totalVol || 1 / RIGHT_CRYPTOS.length;

    const maxFlow = Math.max(...Object.values(sectorAgg).map(Math.abs), 1);
    const edges = [];

    LEFT_SECTORS.forEach(sector => {
      const flow = sectorAgg[sector];
      const isStc = flow > 0 && cryptoAvg < 0;   // 주식→코인
      const isCts = flow < 0 && cryptoAvg > 0;    // 코인→주식
      const dir   = isStc ? 'stc' : isCts ? 'cts' : 'neutral';
      const norm  = Math.abs(flow) / maxFlow;

      RIGHT_CRYPTOS.forEach(sym => {
        const w = volWeight[sym] ?? 1 / RIGHT_CRYPTOS.length;
        if (w < 0.005 && sym !== '기타') return;
        edges.push({ from: sector, to: sym, magnitude: norm * w, dir });
      });
    });

    return { sectorAgg, cryptoFlow, edges, cryptoAvg };
  }, [stockData, krStockData, cryptoData]);

  const leftNodes  = positionNodes(LEFT_SECTORS, VH, NODE_H, GAP);
  const rightNodes = positionNodes(RIGHT_CRYPTOS, VH, NODE_H, GAP);

  const maxMag = Math.max(...edges.map(e => e.magnitude), 0.01);
  const MIN_W = 0.8, MAX_W = 14;

  const loading = !stockData?.length && !cryptoData?.length;
  if (loading) {
    return <div style={{ textAlign:'center', padding:'48px 0', color:'var(--muted2)', fontSize:13 }}>로딩 중...</div>;
  }

  return (
    <div>
      {/* Legend + crypto avg */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:10, fontSize:11, color:'var(--muted2)', flexWrap:'wrap' }}>
        <span>
          <span style={{ display:'inline-block', width:20, height:3, background:'#D85A30', verticalAlign:'middle', marginRight:5, borderRadius:2 }} />
          주식 → 코인 (주식↑ + 코인↓)
        </span>
        <span>
          <span style={{ display:'inline-block', width:20, height:3, background:'#185FA5', verticalAlign:'middle', marginRight:5, borderRadius:2 }} />
          코인 → 주식 (코인↑ + 주식↓)
        </span>
        <span style={{ marginLeft:'auto', fontFamily:"'DM Mono',monospace", color: cryptoAvg >= 0 ? '#4ade80' : '#f87171' }}>
          코인 평균 {cryptoAvg >= 0 ? '+' : ''}{cryptoAvg.toFixed(2)}%
        </span>
      </div>

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width:'100%', height:'auto', display:'block', maxHeight:360 }}
      >
        {/* Bezier edges */}
        {edges.map((e, i) => {
          const ln = leftNodes.find(n => n.name === e.from);
          const rn = rightNodes.find(n => n.name === e.to);
          if (!ln || !rn) return null;
          const sw  = MIN_W + (e.magnitude / maxMag) * (MAX_W - MIN_W);
          const x1  = LX, y1 = ln.cy;
          const x2  = RX, y2 = rn.cy;
          const cx1 = x1 + (x2 - x1) * 0.42;
          const cx2 = x1 + (x2 - x1) * 0.58;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={dirColor(e.dir)}
              strokeWidth={sw}
              strokeOpacity={dirOpacity(e.dir)}
            />
          );
        })}

        {/* Left nodes — sectors */}
        {leftNodes.map(n => {
          const flow = sectorAgg[n.name] ?? 0;
          const up   = flow >= 0;
          return (
            <g key={n.name}>
              <rect
                x={LX - NODE_W - 4} y={n.y} width={NODE_W} height={NODE_H} rx={5}
                fill={up ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)'}
                stroke={up ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}
                strokeWidth={1}
              />
              <text
                x={LX - NODE_W + 2} y={n.cy} fontSize={10} dominantBaseline="middle"
                fill="var(--text, #e8eaf0)"
              >
                {n.name}
              </text>
              <text
                x={LX - 8} y={n.cy} fontSize={9} textAnchor="end" dominantBaseline="middle"
                fill={up ? '#4ade80' : '#f87171'}
              >
                {up ? '+' : ''}{flow.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Right nodes — cryptos */}
        {rightNodes.map(n => {
          const flow = cryptoFlow[n.name] ?? 0;
          const up   = flow >= 0;
          return (
            <g key={n.name}>
              <rect
                x={RX + 4} y={n.y} width={NODE_W} height={NODE_H} rx={5}
                fill={up ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)'}
                stroke={up ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}
                strokeWidth={1}
              />
              <text
                x={RX + 12} y={n.cy} fontSize={11} dominantBaseline="middle"
                fill="var(--text, #e8eaf0)"
              >
                {n.name}
              </text>
              <text
                x={RX + NODE_W - 2} y={n.cy} fontSize={9} textAnchor="end" dominantBaseline="middle"
                fill={up ? '#4ade80' : '#f87171'}
              >
                {up ? '+' : ''}{flow.toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>

      {edges.every(e => e.dir === 'neutral') && (
        <div style={{ textAlign:'center', marginTop:8, fontSize:12, color:'var(--muted2)' }}>
          현재 주식·코인 방향 동조 중 — 선 두께는 섹터별 상대 유입 규모 기준
        </div>
      )}
    </div>
  );
}
