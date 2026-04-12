'use client';
import { useEffect } from 'react';

export default function VolumeBacktest({ chartsReady }) {

    useEffect(() => {
        if (!chartsReady || typeof window === 'undefined' || !window.Chart) return;

        // 거래량 차트
        const ctx1 = document.getElementById('volumeChart');
        if (ctx1 && !window.Chart.getChart(ctx1)) {
            console.log('[CHART] 거래량 차트 렌더링');
            new window.Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
                    datasets: [
                        { label: '코인 거래량 (억₩)', data: [28,32,25,41,38,52,44], backgroundColor: 'rgba(245,200,66,0.6)', borderRadius: 3 },
                        { label: '주식 거래량 (억₩)', data: [65,72,58,80,75,61,68], backgroundColor: 'rgba(79,142,255,0.5)', borderRadius: 3 }
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
        if (ctx2 && !window.Chart.getChart(ctx2)) {
            console.log('[CHART] 백테스팅 차트 렌더링');
            new window.Chart(ctx2, {
                type: 'line',
                data: {
                    labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
                    datasets: [
                        { label: 'AI 전략 +74%',  data: [100,108,115,122,118,131,140,138,152,161,158,174], borderColor: '#10d9a0', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3 },
                        { label: '단순 보유 +42%', data: [100,104,108,106,112,120,118,125,130,127,135,142], borderColor: '#4f8eff', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4,4], pointRadius: 0, tension: 0.3 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: true, labels: { color: '#9ca3af', font: { size: 11 } } } },
                    scales: {
                        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 11 } } },
                        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 11 }, callback: v => v + '%' } }
                    }
                }
            });
        }
    }, [chartsReady]);

    return (
        <div className="grid-2">
            <div className="card">
                <div className="card-header">
                    <span className="card-title">📊 거래량 분석</span>
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