'use client';
import { useEffect, useState } from 'react';

export default function VolumeBacktest({ chartsReady }) {
    const [volumeData, setVolumeData] = useState(null);
    const [backtestData, setBacktestData] = useState(null);

    useEffect(() => {
        fetch('/api/market/volume')
            .then(r => r.json())
            .then(json => setVolumeData(json.result))
            .catch(err => console.error('volume fetch 에러:', err));

        fetch('/api/market/backtest')
            .then(r => r.json())
            .then(json => setBacktestData(json.result))
            .catch(err => console.error('backtest fetch 에러:', err));
    }, []);

    useEffect(() => {
        if (!chartsReady || typeof window === 'undefined' || !window.Chart) return;
        if (!volumeData || !backtestData) return;

        // 거래량 차트
        const ctx1 = document.getElementById('volumeChart');
        if (ctx1) {
            const existing = window.Chart.getChart(ctx1);
            if (existing) existing.destroy();

            new window.Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: volumeData.labels,
                    datasets: [
                        {
                            label: 'BTC 거래대금 (억₩)',
                            data: volumeData.crypto,
                            backgroundColor: 'rgba(245,200,66,0.6)',
                            borderRadius: 3
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: true, labels: { color: '#9ca3af', font: { size: 11 } } } },
                    scales: {
                        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 11 } } },
                        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 11 } } }
                    }
                }
            });
        }

        // 백테스팅 차트
        const ctx2 = document.getElementById('backtestChart');
        if (ctx2) {
            const existing = window.Chart.getChart(ctx2);
            if (existing) existing.destroy();

            const maLabel  = `MA5 전략 ${backtestData.maReturn >= 0 ? '+' : ''}${backtestData.maReturn}%`;
            const holdLabel = `단순 보유 ${backtestData.holdReturn >= 0 ? '+' : ''}${backtestData.holdReturn}%`;

            new window.Chart(ctx2, {
                type: 'line',
                data: {
                    labels: backtestData.labels,
                    datasets: [
                        {
                            label: maLabel,
                            data: backtestData.maStrategy,
                            borderColor: '#10d9a0',
                            backgroundColor: 'transparent',
                            borderWidth: 2, pointRadius: 0, tension: 0.3
                        },
                        {
                            label: holdLabel,
                            data: backtestData.holdStrategy,
                            borderColor: '#4f8eff',
                            backgroundColor: 'transparent',
                            borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, tension: 0.3
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: true, labels: { color: '#9ca3af', font: { size: 11 } } } },
                    scales: {
                        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 11 } } },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.04)' },
                            ticks: { color: '#6b7280', font: { size: 11 }, callback: v => v + '%' }
                        }
                    }
                }
            });
        }
    }, [chartsReady, volumeData, backtestData]);

    return (
        <div className="grid-2">
            <div className="card">
                <div className="card-header">
                    <span className="card-title">📊 거래량 분석</span>
                    {volumeData && (
                        <span className="card-badge badge-amber">
                            24h {volumeData.total24h.toLocaleString()}억₩
                        </span>
                    )}
                </div>
                <div className="card-body">
                    <div className="chart-wrap" style={{ height: 180 }}>
                        <canvas id="volumeChart"></canvas>
                    </div>
                </div>
            </div>
            <div className="card">
                <div className="card-header">
                    <span className="card-title">🎮 전략 수익률 시뮬레이터</span>
                    <span className="card-badge badge-amber">백테스팅</span>
                </div>
                <div className="card-body">
                    <div className="chart-wrap" style={{ height: 180 }}>
                        <canvas id="backtestChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    );
}