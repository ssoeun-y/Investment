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
        <Script
          src="https://cdn.jsdelivr.net/npm/chart.js"
          onLoad={() => setChartsReady(true)}
        />

        {showLoginModal && (
          <LoginModal
            onLogin={handleKakaoLogin}
            onClose={() => setShowLoginModal(false)}
          />
        )}

        <div className="dashboard-content">

          {/* ① 시장 상태 + 포트폴리오 */}
          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* 시장 상태 */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">🌐 시장 상태</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '8px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: fearGreed
                      ? fearGreed.value >= 60 ? 'var(--green)' : fearGreed.value <= 35 ? 'var(--red)' : 'var(--yellow)'
                      : 'var(--muted2)'
                  }}>
                    {fearGreed
                      ? fearGreed.value >= 60 ? 'BULL 🐂' : fearGreed.value <= 35 ? 'BEAR 🐻' : 'SIDEWAYS ↔'
                      : '--'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 4 }}>시장 국면</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--muted2)' }}>공포/탐욕 지수</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {fearGreed ? fearGreed.value : '--'}
                    </span>
                  </div>
                  <div style={{ background: 'var(--border)', borderRadius: 4, height: 6 }}>
                    <div style={{
                      width: `${fearGreed ? fearGreed.value : 0}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: fearGreed
                        ? fearGreed.value >= 60 ? 'var(--green)' : fearGreed.value <= 35 ? 'var(--red)' : 'var(--yellow)'
                        : 'var(--muted2)',
                      transition: 'width 0.5s'
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 8 }}>
                    {fearGreed
                      ? fearGreed.value >= 60
                        ? '📈 투자 심리가 과열 상태예요. 추격 매수는 주의하세요.'
                        : fearGreed.value <= 35
                        ? '📉 시장이 공포에 잠겨 있어요. 저점 분할 매수 구간일 수 있어요.'
                        : '⚖️ 관망 구간이에요. 방향성 확인 후 진입을 권장해요.'
                      : '데이터 로딩 중...'}
                  </div>
                </div>
              </div>
            </div>

            {/* 포트폴리오 요약 */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">💼 포트폴리오 요약</span>
                {!isLoggedIn && (
                  <span
                    style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}
                    onClick={() => setShowLoginModal(true)}
                  >
                    로그인 후 확인
                  </span>
                )}
              </div>
              {isLoggedIn ? (
                <div style={{ display: 'flex', gap: 24, padding: '8px 0' }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>₩89,420,000</div>
                    <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 4 }}>총 자산</div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>+12.4%</div>
                    <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 4 }}>총 수익률</div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>+₩340,000</div>
                    <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 4 }}>오늘 변화</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 14 }}>
                  🔒 로그인하면 내 포트폴리오를 확인할 수 있어요
                </div>
              )}
            </div>
          </div>

          {/* ② 크로스마켓 차트 */}
          <div className="card" style={{ marginBottom: 16 }}>
            <CrossMarketChart chartsReady={chartsReady} />
          </div>

          {/* ③ AI 인사이트 */}
          <div className="card" style={{ marginBottom: 16 }}>
            <AIInsight cryptoData={cryptoData} stockData={stockData} fearGreed={fearGreed} />
          </div>

          {/* ④ 이벤트 감지 + 리스크 */}
          <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <EventAlert cryptoData={cryptoData} stockData={stockData} />
            </div>
            <div className="card">
              <RiskScore cryptoData={cryptoData} />
            </div>
          </div>

        </div>
      </>
    );
}