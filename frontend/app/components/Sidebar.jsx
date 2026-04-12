'use client';
import { useAuth } from '../hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import LoginModal from './LoginModal';

export default function Sidebar() {
    const { isLoggedIn, handleKakaoLogin } = useAuth();
    const router   = useRouter();
    const pathname = usePathname();
    const [showLoginModal, setShowLoginModal] = useState(false);

    const handleNavClick = (e, href) => {
        e.preventDefault();
        if (!isLoggedIn) {
            setShowLoginModal(true);
            return;
        }
        router.push(href);
    };

    const navClass = (href) =>
        `nav-item${pathname === href ? ' active' : ''}`;

    return (
        <>
            <aside className="sidebar">
                <div className="logo">
                    <div className="logo-text">SOWENIX</div>
                    <div className="logo-sub">Investment Intelligence</div>
                </div>
                <nav className="nav">
                    <div className="nav-section">Overview</div>
                    <a className={navClass('/')} href="/">
                        <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
                            <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
                        </svg>
                        대시보드
                    </a>
                    <a className={navClass('/market-analysis')} href="/market-analysis" onClick={(e) => handleNavClick(e, '/market-analysis')}>
                        <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <polyline points="1,11 5,7 8,9 11,4 15,6"/>
                        </svg>
                        시장 분석
                    </a>

                    <div className="nav-section">AI 엔진</div>
                    <a className={navClass('/ai-insight')} href="/ai-insight" onClick={(e) => handleNavClick(e, '/ai-insight')}>
                        <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="8" cy="8" r="3"/>
                            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/>
                        </svg>
                        AI 인사이트
                    </a>
                    <a className={navClass('/event-detection')} href="/event-detection" onClick={(e) => handleNavClick(e, '/event-detection')}>
                        <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M2 12l3-4 3 2 3-5 3 3"/><rect x="1" y="1" width="14" height="14" rx="2"/>
                        </svg>
                        이벤트 감지
                    </a>
                    <a className={navClass('/correlation')} href="/correlation" onClick={(e) => handleNavClick(e, '/correlation')}>
                        <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M8 14A6 6 0 108 2a6 6 0 000 12z"/><path d="M8 8l4-4M8 8v-3"/>
                        </svg>
                        상관관계
                    </a>

                    <div className="nav-section">전략</div>
                    <a className={navClass('/backtest')} href="/backtest" onClick={(e) => handleNavClick(e, '/backtest')}>
                        <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 3V1M11 3V1M1 7h14"/>
                        </svg>
                        백테스팅
                    </a>
                    <a className={navClass('/simulator')} href="/simulator" onClick={(e) => handleNavClick(e, '/simulator')}>
                        <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M13 5l-5 5-3-3-3 3"/>
                        </svg>
                        시뮬레이터
                    </a>

                    <div className="nav-section">커뮤니티</div>
                    <a className={navClass('/community')} href="/community" onClick={(e) => handleNavClick(e, '/community')}>
                        <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M14 10c0 1-1 2-2 2H5l-3 3V4c0-1 1-2 2-2h8c1 0 2 1 2 2z"/>
                        </svg>
                        토론
                    </a>
                </nav>
                <div className="sidebar-footer">
                    <span className="status-dot"></span>
                    <span style={{ fontSize:12, color:'var(--muted2)' }}>실시간 연결됨</span>
                </div>
            </aside>

            {showLoginModal && (
                <LoginModal
                    onLogin={handleKakaoLogin}
                    onClose={() => setShowLoginModal(false)} />
            )}
        </>
    );
}