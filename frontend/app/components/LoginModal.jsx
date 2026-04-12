export default function LoginModal({ onLogin, onClose }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-title">SOWENIX 로그인</div>
                <div className="modal-sub">소셜 계정으로 간편하게 시작하세요</div>
                <button className="kakao-btn" onClick={onLogin}>
                    <span>💬</span> 카카오로 로그인
                </button>
                <button className="modal-close" onClick={onClose}>닫기</button>
            </div>
        </div>
    );
}