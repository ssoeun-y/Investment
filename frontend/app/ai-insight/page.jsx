'use client';
import { useState, useEffect, useRef } from 'react';
import { useMarketData } from '../hooks/useMarketData';

export default function AIInsightPage() {
    const { cryptoData, fearGreed, kospiData, stockData, krStockData } = useMarketData();

    const [summary, setSummary]         = useState('');
    const [reasons, setReasons]         = useState([]);
    const [action, setAction]           = useState('');
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisLoaded, setAnalysisLoaded]   = useState(false);

    const [chatLog, setChatLog]         = useState([]);
    const [input, setInput]             = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);

    const QUICK_QUESTIONS = [
        '지금 BTC 들어가도 돼?',
        '반도체 vs 코인 어디가 나아?',
        '오늘 시장 한줄 요약해줘',
        '리스크가 높은 이유가 뭐야?',
    ];

    // 시장 데이터 → 텍스트
    const buildContext = () => {
        const btc     = cryptoData?.[0];
        const eth     = cryptoData?.[1];
        const xrp     = cryptoData?.[2];
        const samsung = krStockData?.find(s => s.symbol === '005930');
        const hynix   = krStockData?.find(s => s.symbol === '000660');
        const nvda    = stockData?.find(s => s.symbol === 'NVDA');
        const aapl    = stockData?.find(s => s.symbol === 'AAPL');
        const fg      = fearGreed ? Number(fearGreed.value) : null;
        const fgPhase = fg === null ? '알 수 없음' : fg >= 65 ? '탐욕' : fg >= 35 ? '중립' : '공포';

        return `
=== 현재 실시간 시장 데이터 ===

[코인]
- BTC 24h: ${btc?.price_change_percentage_24h?.toFixed(2) ?? '--'}%  (현재가: ${btc?.current_price?.toLocaleString() ?? '--'}원)
- ETH 24h: ${eth?.price_change_percentage_24h?.toFixed(2) ?? '--'}%
- XRP 24h: ${xrp?.price_change_percentage_24h?.toFixed(2) ?? '--'}%

[반도체/주식]
- 삼성전자: ${samsung?.change?.toFixed(2) ?? '--'}%
- SK하이닉스: ${hynix?.change?.toFixed(2) ?? '--'}%
- NVDA: ${nvda?.change?.toFixed(2) ?? '--'}%
- AAPL: ${aapl?.change?.toFixed(2) ?? '--'}%

[시장 지표]
- 코스피: ${kospiData?.change?.toFixed(2) ?? '--'}%
- 공포/탐욕 지수: ${fg ?? '--'} (${fgPhase})

[크로스마켓 분석]
- BTC와 반도체(삼성+하이닉스+NVDA 평균): ${
    btc && samsung && hynix && nvda
        ? (((samsung.change + hynix.change + nvda.change) / 3) - btc.price_change_percentage_24h).toFixed(2)
        : '--'
}% 차이
        `.trim();
    };

    // AI 분석 실행
    const runAnalysis = async () => {
        if (analysisLoaded) return;
        setAnalysisLoading(true);
        try {
            const context = buildContext();
            const prompt = `
당신은 전문 투자 분석 AI입니다. 아래 실시간 시장 데이터를 분석해서 반드시 아래 JSON 형식으로만 응답하세요.

${context}

응답 형식 (JSON만, 다른 텍스트 없이):
{
  "action": "관망 / 매수 / 매도 / 분할매수 중 하나",
  "summary": "한 문장 결론 (50자 이내)",
  "reasons": ["근거1", "근거2", "근거3"]
}
            `.trim();

            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1000,
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            const data = await res.json();
            const text = data.content?.[0]?.text ?? '';
            const clean = text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(clean);
            setAction(parsed.action);
            setSummary(parsed.summary);
            setReasons(parsed.reasons);
            setAnalysisLoaded(true);
        } catch (e) {
            setSummary('데이터 분석 중 오류가 발생했어요.');
            setReasons(['잠시 후 다시 시도해주세요.']);
        } finally {
            setAnalysisLoading(false);
        }
    };

    // 데이터 로드되면 자동 분석
    useEffect(() => {
        if (cryptoData?.length > 0 && krStockData?.length > 0 && !analysisLoaded) {
            runAnalysis();
        }
    }, [cryptoData, krStockData]);

    // 채팅
    const sendMessage = async (msg) => {
        const userMsg = msg || input.trim();
        if (!userMsg) return;
        setInput('');
        setChatLog(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatLoading(true);

        try {
            const context = buildContext();
            const history = chatLog.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.text
            }));

            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1000,
                    system: `당신은 Sowenix 금융 대시보드의 투자 분석 AI입니다. 아래 실시간 시장 데이터를 바탕으로 간결하고 명확하게 답변하세요. 데이터 없이 추측하지 말고 주어진 데이터만 활용하세요.\n\n${context}`,
                    messages: [
                        ...history,
                        { role: 'user', content: userMsg }
                    ]
                })
            });
            const data = await res.json();
            const reply = data.content?.[0]?.text ?? '응답을 받지 못했어요.';
            setChatLog(prev => [...prev, { role: 'ai', text: reply }]);
        } catch (e) {
            setChatLog(prev => [...prev, { role: 'ai', text: '오류가 발생했어요. 잠시 후 다시 시도해주세요.' }]);
        } finally {
            setChatLoading(false);
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog]);

    const actionColor = action === '매수' || action === '분할매수' ? 'var(--green)'
        : action === '매도' ? 'var(--red)' : 'var(--yellow)';

    return (
        <div className="content">

            {/* ① AI 판단 요약 */}
            <div className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${actionColor}` }}>
                <div className="card-header">
                    <span className="card-title">🤖 AI 오늘의 판단</span>
                    <span style={{ fontSize: 11, color: 'var(--muted2)' }}>실시간 데이터 기반</span>
                </div>
                {analysisLoading ? (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 13 }}>
                        🔄 시장 데이터 분석 중...
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0' }}>
                            <div style={{ textAlign: 'center', minWidth: 80 }}>
                                <div style={{ fontSize: 22, fontWeight: 800, color: actionColor }}>{action || '--'}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>AI 판단</div>
                            </div>
                            <div style={{ flex: 1, fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
                                {summary || '데이터 로딩 중...'}
                            </div>
                        </div>
                        {reasons.length > 0 && (
                            <div style={{ display: 'flex', gap: 8 }}>
                                {reasons.map((r, i) => (
                                    <div key={i} style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6 }}>
                                        <span style={{ color: 'var(--accent)', marginRight: 4 }}>{i === 0 ? '①' : i === 1 ? '②' : '③'}</span>{r}
                                    </div>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={() => { setAnalysisLoaded(false); runAnalysis(); }}
                            style={{ marginTop: 12, fontSize: 11, color: 'var(--muted2)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                        >
                            🔄 다시 분석
                        </button>
                    </>
                )}
            </div>

            {/* ② AI 채팅 */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                    <span className="card-title">💬 AI에게 물어보기</span>
                    <span style={{ fontSize: 11, color: 'var(--muted2)' }}>실시간 데이터 기반 답변</span>
                </div>

                {/* 추천 질문 */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 0' }}>
                    {QUICK_QUESTIONS.map(q => (
                        <button
                            key={q}
                            onClick={() => sendMessage(q)}
                            style={{ fontSize: 12, padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--muted2)', cursor: 'pointer' }}
                        >
                            {q}
                        </button>
                    ))}
                </div>

                {/* 채팅 로그 */}
                <div style={{ minHeight: 200, maxHeight: 400, overflowY: 'auto', padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {chatLog.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 13, padding: '40px 0' }}>
                            위 버튼을 누르거나 직접 질문해보세요 👆
                        </div>
                    )}
                    {chatLog.map((m, i) => (
                        <div key={i} style={{
                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '80%',
                            background: m.role === 'user' ? 'var(--accent)' : 'var(--surface2)',
                            color: m.role === 'user' ? '#fff' : 'var(--text)',
                            borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                            padding: '10px 14px', fontSize: 13, lineHeight: 1.6
                        }}>
                            {m.role === 'ai' && <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 4 }}>🤖 Sowenix AI</div>}
                            {m.text}
                        </div>
                    ))}
                    {chatLoading && (
                        <div style={{ alignSelf: 'flex-start', background: 'var(--surface2)', borderRadius: '12px 12px 12px 4px', padding: '10px 14px', fontSize: 13, color: 'var(--muted2)' }}>
                            🤖 분석 중...
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* 입력창 */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !chatLoading && sendMessage()}
                        placeholder="시장에 대해 무엇이든 물어보세요..."
                        style={{
                            flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
                            borderRadius: 8, padding: '10px 14px', fontSize: 13,
                            color: 'var(--text)', outline: 'none'
                        }}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={chatLoading || !input.trim()}
                        style={{
                            padding: '10px 18px', background: 'var(--accent)', color: '#fff',
                            opacity: chatLoading || !input.trim() ? 0.5 : 1
                        }}
                    >
                        전송
                    </button>
                </div>
            </div>

        </div>
    );
}