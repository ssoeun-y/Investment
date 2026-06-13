# AI Cross-Market Investment Intelligence Platform

주식과 코인 시장 데이터를 통합하고 AI 분석을 제공하는 금융 대시보드 웹 애플리케이션입니다.  
캡스톤 디자인 개인 프로젝트로, Bloomberg 스타일의 인터페이스에서 크로스마켓 인사이트와 자금 흐름 분석을 한 화면에 제공합니다.

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| 프론트엔드 | Next.js 15 (App Router), JavaScript |
| 스타일링 | Tailwind CSS, CSS Modules |
| 백엔드 | Spring Boot 3.2, Java 17 |
| 데이터베이스 | MySQL 8.0 (Docker) |
| 인증 | Kakao OAuth 2.0 (next-auth) |
| AI 분석 | Anthropic Claude API (claude-sonnet-4-6) |
| 외부 API | CoinGecko, Yahoo Finance, Alternative.me |
| 빌드 도구 | Gradle (멀티모듈) |

---

## 구현 기능

### 📊 메인 대시보드
- **Zone A 시장 체온계**: KOSPI/KOSDAQ, BTC 실시간 시세, 주식↔코인 상관도, 공포/탐욕 지수
- **Zone B 크로스마켓 차트**: BTC·나스닥·코스피 등락률 정규화 비교 (1D/1W/1M)
- **자금 흐름 패널**: 주식→코인 / 코인→주식 방향 비율 실시간 표시
- **Zone C 거래량 분석**: 섹터 히트맵, 거래량 시그널 테이블, 시장 심리 게이지
- **Zone D 섹터 로테이션**: 섹터별 자금 유입 순위, 강도, 판단
- **상관관계 메트릭스**: BTC/NASDAQ/KOSPI 피어슨 상관계수 3×3 히트맵
- **거래량 백테스팅 미니 차트**: MA5 전략 vs 단순 보유 수익률 비교

### 🔍 시장 분석
- 오늘의 시장 국면 자동 진단 (Risk-On / Risk-Off / High Volatility)
- Market Drivers (유동성 · 심리 분석)
- Cross-Asset Flow (코인 · 미국 주식 · 한국 증시 자산별 흐름)
- Leadership 패널, Risk Dashboard
- Scenario / Outlook (BTC · 나스닥 · 코스피 BASE / BULL / BEAR 3시나리오)
- 기술적 상태 요약 (RSI · MA · 변동성 · 거래량), 자산군 비교 테이블

### 🔗 상관관계 분석
- Sankey 다이어그램: 섹터↔코인 양방향 자금 흐름 시각화
- BTC × NASDAQ 롤링 피어슨 상관계수 시계열 차트 (1D/1W/1M)
- 주식 × 코인 상관관계 매트릭스 히트맵
- 실시간 이탈 감지 (디커플링 신호)
- 주식 vs 코인 5개 지표 실시간 비교 (수익률 · 변동성 · 거래량 · 상관계수 · 공포탐욕)
- 종합 판단 자동 생성

### 🤖 AI 인사이트
- 실시간 시장 데이터 기반 Claude API 자동 분석 (관망/매수/매도/분할매수 판단 + 근거 3가지)
- AI 채팅: 추천 질문 버튼 + 자유 입력, 대화 히스토리 유지
- `/api/ai` Next.js API Route로 CORS 우회 처리

### 📡 이벤트 감지
- 전체 자산 점수(score) 계산 후 상위 N개 항상 노출하는 시장 피드 구조
- Top Signal 카드 3개 (Chart.js 스파크라인 + 강도 HIGH/MID/LOW)
- 이벤트 피드 (거래량 급증 · 가격 동조 · 시장 방향 전환)

### 🧪 백테스팅 (Strategy Lab)
- 조건 빌더: RSI, MA 크로스, 가격 기준 AND/OR 조합
- 리스크 설정: 수수료, 손절/익절, 포지션 크기
- BTC 과거 데이터 기반 백테스트 실행, 수익률 곡선 · MDD · 샤프 비율 · 거래 로그 출력

### 🎮 Live Simulator
- RSI / MA 전략 실시간 신호 감지
- 가상 매수/매도 실행, 보유 현황 · 수익률 실시간 계산
- 추가 투자 기능, 거래 로그 기록

### 🔎 검색
- 종목 검색 드롭다운 (코인 / 주식 구분)
- 종목 상세 페이지 (`/search/[symbol]`): 현재가 · 변동률 · 차트

### 💬 커뮤니티 (토론)
- 게시글 CRUD (전체 / 코인 / 국내주식 / 해외주식 카테고리)
- 최신순 / 인기순 정렬, 페이지네이션
- 댓글 CRUD, 좋아요 토글 (중복 방지)
- 로그인 사용자만 작성 가능

### 👤 마이페이지
- 관심목록: 종목 추가 / 삭제, 실시간 시세 표시
- 내 글 목록 및 삭제
- 알림 설정: 급등/급락 · 디커플링 신호 · 공포탐욕 알림 토글 + 임계값 슬라이더
- 현재 발생 중인 알림 실시간 표시

---

## 로컬 실행 방법

### 사전 준비
- Java 17
- Node.js 18 이상
- Docker Desktop

### 1. 레포지토리 클론

```bash
git clone https://github.com/ssoeun-y/Investment.git
cd Investment
```

### 2. MySQL 컨테이너 실행

```bash
docker compose up -d
```

### 3. 백엔드 실행

```bash
cd backend
./gradlew :sowenixApi:bootRun
```

백엔드가 `http://localhost:8080` 에서 실행됩니다.

### 4. 프론트엔드 환경변수 설정

`frontend/.env.local` 파일 생성:

```
ANTHROPIC_API_KEY=sk-ant-여기에키입력
KAKAO_CLIENT_ID=카카오앱키
KAKAO_CLIENT_SECRET=카카오시크릿
NEXTAUTH_SECRET=임의의문자열
NEXTAUTH_URL=http://localhost:3000
```

### 5. 프론트엔드 실행

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

---

## 폴더 구조

```
Investment/
├── backend/
│   ├── sowenixApi/                  # Spring Boot API 서버
│   │   └── src/main/java/
│   │       └── se/sowl/sowenixApi/
│   │           ├── market/          # 시장 데이터 API (CoinGecko, Yahoo Finance)
│   │           ├── post/            # 커뮤니티 게시판 API
│   │           └── oauth/           # 카카오 OAuth
│   └── sowenixDomain/              # JPA 엔티티, Repository
│       └── src/main/java/
│           └── se/sowl/sowenixDomain/
│               ├── market/
│               ├── post/            # Post, Comment, PostLike, CommentLike
│               └── user/
├── frontend/
│   ├── app/
│   │   ├── layout.js               # 공통 레이아웃
│   │   ├── page.js                 # 메인 대시보드
│   │   ├── page.module.css         # 대시보드 CSS Module
│   │   ├── market-analysis/        # 시장 분석 페이지
│   │   ├── correlation/            # 상관관계 분석 페이지
│   │   │   └── components/         # SankeyFlow, CorrTimeline, CorrHeatmap 등
│   │   ├── ai-insight/             # AI 인사이트 페이지
│   │   ├── event-detection/        # 이벤트 감지 페이지
│   │   ├── backtest/               # 백테스팅 페이지
│   │   ├── simulator/              # Live Simulator 페이지
│   │   ├── search/[symbol]/        # 종목 상세 페이지
│   │   ├── community/              # 커뮤니티 게시판
│   │   ├── mypage/                 # 마이페이지
│   │   │   └── components/         # Watchlist, AlertSettings, MyPosts
│   │   └── api/
│   │       ├── ai/route.js         # Anthropic API 프록시
│   │       └── auth/               # NextAuth 카카오 OAuth
│   ├── components/
│   │   ├── Sidebar.jsx             # 사이드바 네비게이션
│   │   ├── Topbar.jsx              # 상단 바 (검색, 알림, 계정)
│   │   ├── SearchDropdown.jsx      # 종목 검색 드롭다운
│   │   ├── CrossMarketChart.jsx    # 크로스마켓 차트
│   │   ├── HeatmapCard.jsx         # 섹터 히트맵
│   │   └── ...
│   ├── hooks/
│   │   ├── useMarketData.js        # 시장 데이터 훅 (CoinGecko, 백엔드 API)
│   │   └── useAuth.js              # 카카오 로그인 상태 훅
│   └── styles/
│       └── dashboard.css           # 전역 다크테마 스타일
└── docker-compose.yml              # MySQL 8.0 컨테이너 설정
```

---

## 외부 API

| API | 용도 | 인증 |
|-----|------|------|
| CoinGecko | BTC, ETH, XRP, SOL, DOGE 실시간 시세 | 무료 (키 불필요) |
| Yahoo Finance | KOSPI, NASDAQ 히스토리 데이터 | 무료 (백엔드 프록시) |
| Alternative.me | 공포/탐욕 지수 | 무료 (키 불필요) |
| Anthropic Claude | AI 시장 분석 | API Key 필요 |
| Kakao OAuth | 소셜 로그인 | 앱 키 필요 |
