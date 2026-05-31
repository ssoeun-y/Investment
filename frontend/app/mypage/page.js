'use client';
import { useState, useEffect } from 'react';
import { useAuth }       from '../hooks/useAuth';
import { useMarketData } from '../hooks/useMarketData';
import Topbar            from '../components/Topbar';
import LoginModal        from '../components/LoginModal';
import Watchlist         from './components/Watchlist';
import MyPosts           from './components/MyPosts';
import Portfolio         from './components/Portfolio';
import AlertSettings     from './components/AlertSettings';
import styles            from './mypage.module.css';
import '../styles/dashboard.css';

const TABS = [
  { key: 'watchlist',  label: '관심목록' },
  { key: 'myposts',    label: '내 글' },
  { key: 'portfolio',  label: '포트폴리오' },
  { key: 'alerts',     label: '알림설정' },
];

export default function MyPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab]           = useState('watchlist');
  const [now, setNow]                       = useState('');

  const { isLoggedIn, isLoading, handleKakaoLogin, handleLogout } = useAuth();
  const { stockData, krStockData, cryptoData, fearGreed } = useMarketData();

  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {showLoginModal && (
        <LoginModal onLogin={handleKakaoLogin} onClose={() => setShowLoginModal(false)} />
      )}

      <Topbar
        isLoggedIn={isLoggedIn}
        isLoading={isLoading}
        onLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        now={now}
        stockData={stockData}
        krStockData={krStockData}
        cryptoData={cryptoData}
      />

      <div className={styles.page}>
        {/* login gate */}
        {!isLoading && !isLoggedIn ? (
          <div className={styles.loginGate}>
            <span style={{ fontSize: 32 }}>🔒</span>
            <h2>로그인이 필요합니다</h2>
            <p>마이페이지는 로그인 후 이용할 수 있습니다.</p>
            <button
              className={styles.loginGateBtn}
              onClick={() => setShowLoginModal(true)}
            >
              카카오로 로그인
            </button>
          </div>
        ) : (
          <>
            {/* profile header */}
            <div className={styles.profileHeader}>
              <div className={styles.avatar}>U</div>
              <div>
                <div className={styles.profileName}>내 계정</div>
                <div className={styles.profileEmail}>카카오 로그인</div>
              </div>
            </div>

            {/* tabs */}
            <div className={styles.tabRow}>
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`${styles.tabBtn}${activeTab === tab.key ? ' ' + styles.active : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* tab content */}
            {activeTab === 'watchlist' && (
              <Watchlist
                stockData={stockData}
                krStockData={krStockData}
                cryptoData={cryptoData}
              />
            )}
            {activeTab === 'myposts'   && <MyPosts />}
            {activeTab === 'portfolio' && <Portfolio />}
            {activeTab === 'alerts'    && (
              <AlertSettings
                stockData={stockData}
                krStockData={krStockData}
                cryptoData={cryptoData}
                fearGreed={fearGreed}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
