'use client';
import { useEffect, useRef, useState } from 'react';

const normalize = (prices) => {
    const base = prices[0]?.[1] || 1;
    return prices.map(p => p[1] != null ? ((p[1] - base) / base) * 100 : null);
};

const buildConfig = (btc, nasdaq, kospi) => {
    const labels = btc.map(p => {
        const d = new Date(p[0]);
        return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    });
    return {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'BTC(업비트)', data: normalize(btc),    borderColor: '#f5c842', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.4 },
                { label: '나스닥',      data: normalize(nasdaq), borderColor: '#4f8eff', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.4 },
                { label: '코스피',      data: normalize(kospi),  borderColor: '#10d9a0', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.4 },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true, position: 'top', align: 'end',
                    labels: { color: '#9ca3af', font: { size: 11, family: "'DM Mono',monospace" }, boxWidth: 12, boxHeight: 2, padding: 12, usePointStyle: true, pointStyle: 'line' }
                },
                tooltip: {
                    backgroundColor: '#191c24', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                    titleColor: '#9ca3af', bodyColor: '#e8eaf0',
                    callbacks: { label: c => `${c.dataset.label}: ${c.raw >= 0 ? '+' : ''}${Number(c.raw).toFixed(2)}%` }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', maxTicksLimit: 8, font: { size: 11 } } },
                y: { position: 'right', grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 11 }, callback: v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%' } }
            }
        }
    };
};

export default function CrossMarketChart({ fetchCrossMarketHistory, chartsReady, chartId = 'priceChart' }) {
    const [activeTab, setActiveTab] = useState('1D');
    const chartRef = useRef(null);

    const drawChart = async (days) => {
        if (typeof window === 'undefined' || !window.Chart) return;
        const { btc, nasdaq, kospi } = await fetchCrossMarketHistory(days);
        if (!btc || btc.length === 0) return;
        const ctx = document.getElementById(chartId);
        if (!ctx) return;
        const existing = window.Chart.getChart(ctx);
        if (existing) existing.destroy();
        chartRef.current = new window.Chart(ctx, buildConfig(btc, nasdaq, kospi));
        console.log(`[CHART] 크로스마켓 차트 렌더링 완료 (days=${days})`);
    };

    useEffect(() => {
        if (chartsReady) drawChart(1);
    }, [chartsReady]);

    const handleTab = (t) => {
        setActiveTab(t);
        const days = { '1D': 1, '1W': 7, '1M': 30 }[t];
        drawChart(days);
    };

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">
                    📊 크로스마켓 가격 차트
                    <span className="card-badge badge-green">실시간</span>
                    <span style={{ display:'flex', gap:10, marginLeft:8 }}>
                        <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontFamily:"'DM Mono',monospace", color:'#f5c842' }}>
                            <span style={{ width:16, height:2, background:'#f5c842', display:'inline-block', borderRadius:1 }}></span>BTC
                        </span>
                        <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontFamily:"'DM Mono',monospace", color:'#4f8eff' }}>
                            <span style={{ width:16, height:2, background:'#4f8eff', display:'inline-block', borderRadius:1 }}></span>나스닥
                        </span>
                        <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontFamily:"'DM Mono',monospace", color:'#10d9a0' }}>
                            <span style={{ width:16, height:2, background:'#10d9a0', display:'inline-block', borderRadius:1 }}></span>코스피
                        </span>
                    </span>
                </span>
                <div className="tab-list">
                    {['1D', '1W', '1M'].map(t => (
                        <span
                            key={t}
                            className={`tab${activeTab === t ? ' active' : ''}`}
                            onClick={() => handleTab(t)}
                        >
                            {t}
                        </span>
                    ))}
                </div>
            </div>
            <div className="card-body">
                <div className="chart-wrap" style={{ height: 240 }}>
                    <canvas id={chartId}></canvas>
                </div>
            </div>
        </div>
    );
}