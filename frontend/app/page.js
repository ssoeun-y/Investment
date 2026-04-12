'use client';
import { useState } from 'react';
import Script from 'next/script';
import { useAuth }       from './hooks/useAuth';
import { useMarketData } from './hooks/useMarketData';
import Topbar            from './components/Topbar';
import LoginModal        from './components/LoginModal';
import MetricsRow        from './components/MetricsRow';
import CrossMarketChart  from './components/CrossMarketChart';
import HeatmapCard       from './components/HeatmapCard';
import TickerTable       from './components/TickerTable';
import RiskScore         from './components/RiskScore';
import AIInsight         from './components/AIInsight';
import CorrMatrix        from './components/CorrMatrix';
import EventAlert        from './components/EventAlert';
import CommunityThread   from './components/CommunityThread';
import VolumeBacktest    from './components/VolumeBacktest';
import './styles/dashboard.css';

export default function Home() {
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [chartsReady, setChartsReady]       = useState(false);

    const { isLoggedIn, isLoading, handleKakaoLogin, handleLogout } = useAuth();
    const { cryptoData, fearGreed, kospiData, kosdaqData, stockData, fetchCrossMarketHistory } = useMarketData();

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
            <Script
                src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"
                onLoad={() => {
                    console.log('[CHART.JS] 로드 완료');
                    setChartsReady(true);
                }}
            />

            {showLoginModal && (
                <LoginModal
                    onLogin={handleKakaoLogin}
                    onClose={() => setShowLoginModal(false)}
                />
            )}

            <Topbar
                isLoggedIn={isLoggedIn}
                isLoading={isLoading}
                onLogin={() => setShowLoginModal(true)}
                onLogout={handleLogout}
            />

            <div className="content">
                <MetricsRow
                    cryptoData={cryptoData}
                    fearGreed={fearGreed}
                    kospiData={kospiData}
                    kosdaqData={kosdaqData}
                />
                <div className="grid-3" style={{ gridTemplateColumns:'2fr 1fr' }}>
                    <CrossMarketChart
                        fetchCrossMarketHistory={fetchCrossMarketHistory}
                        chartsReady={chartsReady}
                        chartId="priceChart-dashboard"
                    />
                    <HeatmapCard cryptoData={cryptoData} />
                </div>
                <div className="grid-3" style={{ gridTemplateColumns:'1.4fr 0.8fr 0.8fr' }}>
                    <TickerTable
                        cryptoData={cryptoData}
                        stockData={stockData}
                        kospiData={kospiData}
                        kosdaqData={kosdaqData}
                    />
                    <RiskScore />
                    <AIInsight />
                </div>
                <div className="grid-3" style={{ gridTemplateColumns:'1fr 1fr 1fr' }}>
                    <CorrMatrix />
                    <EventAlert />
                    <CommunityThread />
                </div>
                <VolumeBacktest chartsReady={chartsReady} />
            </div>
        </>
    );
}