import { useRef, useState } from 'react';
import SearchDropdown from './SearchDropdown';

const NAV_ITEMS = [
  { label: '대시보드', href: '/',            key: 'dashboard' },
  { label: '상관관계', href: '/correlation',  key: 'correlation' },
  { label: '자금흐름', href: '#flow',         key: 'flow' },
  { label: '섹터',    href: '#sector',        key: 'sector' },
  { label: '알림',    href: '#alerts',        key: 'alerts' },
  { label: '마이페이지', href: '/mypage',      key: 'mypage' },
];

export default function Topbar({ isLoggedIn, isLoading, onLogin, onLogout, now, activePage = 'dashboard', stockData, krStockData, cryptoData }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="logo-text" style={{ fontSize: 17, letterSpacing: '-0.5px', marginRight: 20 }}>
          FlowSignal
        </span>
        <nav className="topbar-nav">
          {NAV_ITEMS.map(item => (
            <a
              key={item.label}
              href={item.href}
              className={`topbar-nav-item${item.key === activePage ? ' active' : ''}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="topbar-right">
        {now && (
          <div className="topbar-clock">
            <span className="status-dot" />
            <span className="topbar-live">LIVE</span>
            <span className="topbar-time">{now}</span>
          </div>
        )}

        <SearchDropdown
          stockData={stockData}
          krStockData={krStockData}
          cryptoData={cryptoData}
        />

        <div className="btn-icon">🔔</div>
        <div className="btn-icon">⚙️</div>

        {isLoading ? (
          <div className="btn-icon" style={{ fontSize: 11, color: 'var(--muted)' }}>...</div>
        ) : isLoggedIn ? (
          <div className="profile-wrap" ref={dropdownRef}>
            <div className="profile-btn" onClick={() => setShowDropdown(v => !v)}>
              <div className="avatar-circle">U</div>
              <span>내 계정</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>▾</span>
            </div>
            {showDropdown && (
              <div className="dropdown">
                <div className="dropdown-item">👤 프로필</div>
                <div className="dropdown-item">⚙️ 설정</div>
                <div className="dropdown-divider" />
                <div
                  className="dropdown-item danger"
                  onClick={() => { setShowDropdown(false); onLogout(); }}
                >
                  🚪 로그아웃
                </div>
              </div>
            )}
          </div>
        ) : (
          <button className="login-btn" onClick={onLogin}>
            🔐 로그인
          </button>
        )}
      </div>
    </div>
  );
}
