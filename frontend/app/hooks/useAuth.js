import { useState, useEffect } from 'react';

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080';

export function useAuth() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading]   = useState(true);

    useEffect(() => {
        const check = async () => {
            const url = `${serverUrl}/api/auth/session`;
            console.log(`[AUTH] 세션 확인 요청 → ${url}`);
            try {
                const res  = await fetch(url, { credentials: 'include' });
                const data = await res.json();
                console.log(`[AUTH] status: ${res.status} | isLoggedIn: ${data.result?.isLoggedIn}`);
                setIsLoggedIn(data.result.isLoggedIn);
            } catch (e) {
                console.error('[AUTH] 세션 확인 실패:', e.message);
                setIsLoggedIn(false);
            } finally {
                setIsLoading(false);
            }
        };
        check();
    }, []);

    const handleKakaoLogin = () => {
        console.log('[AUTH] 카카오 로그인 시도');
        window.location.href = `${serverUrl}/oauth2/authorization/kakao`;
    };

    const handleLogout = () => {
        console.log('[AUTH] 로그아웃');
        setIsLoggedIn(false);
        window.location.href = `${serverUrl}/logout`;
    };

    return { isLoggedIn, isLoading, handleKakaoLogin, handleLogout };
}