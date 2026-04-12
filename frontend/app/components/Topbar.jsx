import { useRef, useState } from 'react';

export default function Topbar({ isLoggedIn, isLoading, onLogin, onLogout }) {
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    return (
        <div className="topbar">
            <div className="topbar-left">
                <span className="page-title">대시보드</span>
                <span className="live-badge">
          <span className="status-dot"></span>LIVE
        </span>
            </div>
            <div className="topbar-right">
                <div className="search-box">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/>
                    </svg>
                    <span>종목 검색...</span>
                </div>
                <div className="btn-icon">🔔</div>

                {isLoading ? (
                    <div className="btn-icon" style={{ fontSize:11, color:'var(--muted)' }}>...</div>
                ) : isLoggedIn ? (
                    <div className="profile-wrap" ref={dropdownRef}>
                        <div className="profile-btn" onClick={() => setShowDropdown(v => !v)}>
                            <div className="avatar-circle">U</div>
                            <span>내 계정</span>
                            <span style={{ fontSize:10, color:'var(--muted)' }}>▾</span>
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