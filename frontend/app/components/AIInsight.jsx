'use client';
import { useState, useEffect, useRef } from 'react';

const TYPE_COLOR = {
    BULL:  '#10d9a0',
    BEAR:  '#f05a5a',
    ALERT: '#f97316',
    CORR:  '#4f8eff',
};

const FALLBACK = [
    { type: 'BULL',  text: 'AI 분석을 불러오지 못했어요', timeAgo: '--' },
    { type: 'ALERT', text: '잠시 후 다시 시도해주세요',   timeAgo: '--' },
];

export default function AIInsight({ cryptoData, stockData, fearGreed, kospiData }) {
    const [insights, setInsights] = useState([]);
    const [loading, setLoading]   = useState(false);
    const calledRef               = useRef(false);

    useEffect(() => {
        if (calledRef.current) return;
        if (!cryptoData?.length || !stockData?.length) return;

        const btc    = cryptoData.find(c => c.symbol === 'BTC');
        const eth    = cryptoData.find(c => c.symbol === 'ETH');
        const nvda   = stockData.find(s => s.symbol === 'NVDA');
        const tsla   = stockData.find(s => s.symbol === 'TSLA');
        const fg     = fearGreed ? Number(fearGreed.value) : null;
        const fgText = fearGreed?.value_classification ?? '--';

        const prompt = `
다음은 현재 실시간 시장 데이터야:
- KOSPI: ${kospiData?.price ?? '--'} (${kospiData?.change ?? '--'}%)
- BTC: $${btc?.current_price ?? '--'} (24h ${btc?.price_change_percentage_24h?.toFixed(2) ?? '--'}%)
- ETH: $${eth?.current_price ?? '--'} (24h ${eth?.price_change_percentage_24h?.toFixed(2) ?? '--'}%)
- NVDA: $${nvda?.price ?? '--'} (${nvda?.change?.toFixed(2) ?? '--'}%)
- TSLA: $${tsla?.price ?? '--'} (${tsla?.change?.toFixed(2) ?? '--'}%)
- 공포탐욕지수: ${fg ?? '--'} (${fgText})

위 데이터를 분석해서 투자 시그널 3개를 JSON 배열로만 응답해줘. 다른 텍스트 없이 JSON만.
형식:
[
  { "type": "BULL" | "BEAR" | "ALERT" | "CORR", "text": "한 줄 시그널 설명 (30자 이내)", "timeAgo": "방금 전" }
]
type은 상황에 맞게 선택: BULL(강세), BEAR(약세), ALERT(주의), CORR(상관관계)
        `.trim();

        calledRef.current = true;
        setLoading(true);

        fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 300,
            }),
        })
            .then(r => r.json())
            .then(data => {
                const text  = data.content?.[0]?.text ?? '';
                const clean = text.replace(/```json|```/g, '').trim();
                const parsed = JSON.parse(clean);
                setInsights(Array.isArray(parsed) ? parsed : FALLBACK);
            })
            .catch(() => setInsights(FALLBACK))
            .finally(() => setLoading(false));
    }, [cryptoData, stockData]);

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">🤖 AI 인사이트</span>
                <span className="card-badge badge-purple">LLM</span>
            </div>
            <div className="card-body">
                {loading ? (
                    <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 13, padding: '16px 0' }}>
                        AI 분석 중...
                    </div>
                ) : insights.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 13, padding: '16px 0' }}>
                        시장 데이터 로딩 후 AI가 분석합니다
                    </div>
                ) : (
                    insights.map((item, i) => (
                        <div key={i} className="insight-item">
                            <div className="insight-tag" style={{ color: TYPE_COLOR[item.type] ?? '#888' }}>
                                ▸ {item.type}
                            </div>
                            <div className="insight-text">{item.text}</div>
                            <div className="insight-time">{item.timeAgo}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
