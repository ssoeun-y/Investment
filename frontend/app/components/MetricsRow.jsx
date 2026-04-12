const fmt = (n, dec = 0) => n == null ? '--' : Number(n).toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtKRW = n => n == null ? '--' : '₩' + fmt(n, 0);
const pct = n => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const cl = n => n >= 0 ? '#10d9a0' : '#f05a5a';

const fgColorMap = {
    'Extreme Fear': '#f05a5a',
    'Fear':         '#f05a5a',
    'Neutral':      '#f5c842',
    'Greed':        '#10d9a0',
    'Extreme Greed':'#10d9a0',
};

export default function MetricsRow({ cryptoData, fearGreed, kospiData, kosdaqData }) {
    const btc = cryptoData.find(c => c.symbol?.toUpperCase() === 'BTC');

    return (
        <div className="metrics-row">

            {/* 포트폴리오 */}
            <div className="metric-card green">
                <div className="metric-icon">📈</div>
                <div className="metric-label">포트폴리오 총액</div>
                <div className="metric-value">₩89,420,000</div>
                <div className="metric-change">
                    <span style={{ color:'#10d9a0' }}>↑ +4.8% 오늘</span>
                </div>
            </div>

            {/* BTC */}
            <div className="metric-card amber">
                <div className="metric-icon">₿</div>
                <div className="metric-label">BTC 현재가 (업비트)</div>
                <div className="metric-value" style={{ fontSize:18 }}>
                    {btc ? fmtKRW(btc.current_price) : '--'}
                </div>
                <div className="metric-change">
                    {btc && (
                        <span style={{ color: cl(btc.price_change_percentage_24h) }}>
              {btc.price_change_percentage_24h >= 0 ? '↑' : '↓'} {Math.abs(btc.price_change_percentage_24h).toFixed(2)}% (24h)
            </span>
                    )}
                </div>
            </div>

            {/* 코스피 */}
            <div className="metric-card purple">
                <div className="metric-icon">🇰🇷</div>
                <div className="metric-label">코스피</div>
                <div className="metric-value" style={{ fontSize:18 }}>
                    {kospiData ? fmt(kospiData.price) : '--'}
                </div>
                <div className="metric-change">
                    {kospiData && (
                        <span style={{ color: cl(kospiData.change) }}>
              {kospiData.change >= 0 ? '↑' : '↓'} {pct(kospiData.change)}
            </span>
                    )}
                </div>
            </div>

            {/* 코스닥 */}
            <div className="metric-card blue">
                <div className="metric-icon">📊</div>
                <div className="metric-label">코스닥</div>
                <div className="metric-value" style={{ fontSize:18 }}>
                    {kosdaqData ? fmt(kosdaqData.price) : '--'}
                </div>
                <div className="metric-change">
                    {kosdaqData && (
                        <span style={{ color: cl(kosdaqData.change) }}>
              {kosdaqData.change >= 0 ? '↑' : '↓'} {pct(kosdaqData.change)}
            </span>
                    )}
                </div>
            </div>

            {/* 공포/탐욕 */}
            <div className="metric-card blue">
                <div className="metric-icon">💹</div>
                <div className="metric-label">시장 공포/탐욕</div>
                <div className="metric-value">{fearGreed ? fearGreed.value : '--'}</div>
                <div className="metric-change">
                    {fearGreed && (
                        <span style={{ color: fgColorMap[fearGreed.value_classification] || 'var(--muted2)' }}>
              {fearGreed.value_classification}
            </span>
                    )}
                </div>
            </div>

        </div>
    );
}