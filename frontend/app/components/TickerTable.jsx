const fmt    = (n, dec = 0) => n == null ? '--' : Number(n).toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtKRW = n => n == null ? '--' : '₩' + fmt(n, 0);
const fmtUSD = n => n == null ? '--' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct    = n => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const cl     = n => n >= 0 ? '#10d9a0' : '#f05a5a';

export default function TickerTable({ cryptoData, stockData, kospiData, kosdaqData }) {
    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">💹 주식 + 코인 통합 시세</span>
                <span className="card-badge badge-blue">업비트 기준</span>
            </div>
            <table className="ticker-table">
                <thead>
                <tr>
                    <th>종목</th>
                    <th>현재가</th>
                    <th>변동</th>
                    <th>거래량</th>
                </tr>
                </thead>
                <tbody>
                {/* 코인 */}
                {cryptoData.slice(0, 5).map((c, i) => (
                    <tr key={'c' + i}>
                        <td>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span className="asset-dot" style={{ background:'var(--amber)' }}></span>
                                <div>
                                    <div className="asset-name">{(c.symbol || '').toUpperCase()}</div>
                                    <div className="asset-sub">업비트 KRW</div>
                                </div>
                            </div>
                        </td>
                        <td>{fmtKRW(c.current_price)}</td>
                        <td style={{ color: cl(c.price_change_percentage_24h) }}>{pct(c.price_change_percentage_24h)}</td>
                        <td style={{ color:'var(--muted2)', fontSize:11 }}>
                            {c.total_volume ? '₩' + (c.total_volume / 1e8).toFixed(0) + '억' : '--'}
                        </td>
                    </tr>
                ))}

                {/* 주식 */}
                {stockData.map((s, i) => (
                    <tr key={'s' + i}>
                        <td>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span className="asset-dot" style={{ background:'var(--blue)' }}></span>
                                <div>
                                    <div className="asset-name">{s.symbol}</div>
                                    <div className="asset-sub">주식 USD</div>
                                </div>
                            </div>
                        </td>
                        <td>{fmtUSD(s.price)}</td>
                        <td style={{ color: cl(s.change) }}>{pct(s.change)}</td>
                        <td style={{ color:'var(--muted2)', fontSize:11 }}>
                            {s.volume ? (s.volume / 1e6).toFixed(0) + 'M' : '--'}
                        </td>
                    </tr>
                ))}

                {/* 한국 지수 */}
                {[kospiData, kosdaqData].filter(Boolean).map((k, i) => (
                    <tr key={'k' + i}>
                        <td>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span className="asset-dot" style={{ background:'var(--purple)' }}></span>
                                <div>
                                    <div className="asset-name">{k.label || k.name}</div>
                                    <div className="asset-sub">한국 지수</div>
                                </div>
                            </div>
                        </td>
                        <td>{fmt(k.price)}</td>
                        <td style={{ color: cl(k.change) }}>{pct(k.change)}</td>
                        <td style={{ color:'var(--muted2)', fontSize:11 }}>--</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}