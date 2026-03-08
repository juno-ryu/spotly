# Plan: PWA 래핑 (Progressive Web App)

> 작성일: 2026-03-08
> 피처명: `pwa`
> 단계: Plan

---

## 1. 배경 및 목적

### 현재 상황

- **앱명**: 창업 분석기 (spotly)
- **서비스**: 주소+업종 입력 → 공공 API 수집 → 5대 지표 100점 → Claude AI 리포트
- **기술 스택**: Next.js 16 (App Router) / React 19 / TypeScript 5.7
- **현재 PWA 설정 없음**: `public/` 폴더 미존재, manifest.json 없음, Service Worker 없음

### 왜 PWA인가

- **모바일 우선 타겟**: 소상공인은 현장에서 스마트폰으로 입지 분석 수요가 높음
- **설치 가능성**: 앱스토어 없이 홈 화면에 추가 → 네이티브 앱 같은 UX
- **오프라인 내성**: 분석 결과 페이지는 캐시로 오프라인 열람 가능 (재방문 시)
- **빠른 로딩**: 정적 자산 캐싱으로 반복 접속 속도 개선

---

## 2. 앱 구조 현황 파악

### 페이지 목록

| 경로 | 설명 | 오프라인 필요성 |
|------|------|----------------|
| `/` | 홈 (입지 분석 소개) | 낮음 (입력 폼만 있음) |
| `/map` | 카카오맵 뷰 | 중간 (지도는 온라인 필요) |
| `/region` | 지역 분석 | 중간 |
| `/history` | 분석 이력 | 높음 (오프라인 열람 유용) |
| `/industry` | 업종 선택 | 낮음 |
| `/analyze` | 분석 입력 | 없음 (온라인 필수) |
| `/analyze/[id]` | 분석 진행 폴링 | 없음 (온라인 필수) |
| `/report/[id]` | 분석 리포트 | 높음 (저장해서 오프라인 열람) |

### API Routes

| 경로 | 설명 | 캐시 전략 |
|------|------|---------|
| `/api/report/[id]/pdf` | PDF 다운로드 | 캐시 불필요 |
| `/api/geocode/*` | 주소 검색 | 단기 캐시 (SWR) |

### 현재 `src/app/layout.tsx` 메타데이터

```typescript
metadata: Metadata = {
  title: SITE_CONFIG.name,       // "창업 분석기"
  description: SITE_CONFIG.description,  // "소상공인 창업 입지 분석 서비스"
}
```

---

## 3. PWA 구성 요소 체크리스트

### 필수 (Must)

- [ ] **Web App Manifest** (`public/manifest.json`)
  - name, short_name, description
  - start_url, display: "standalone"
  - theme_color, background_color
  - icons (192x192, 512x512, maskable)

- [ ] **Service Worker** (`next-pwa` 패키지 활용)
  - 정적 자산 Cache First
  - API 라우트 Network First
  - 오프라인 폴백 페이지 (`/offline`)

- [ ] **PWA 메타 태그** (`src/app/layout.tsx`)
  - `<meta name="theme-color">`
  - `<link rel="manifest">`
  - `<link rel="apple-touch-icon">`
  - `<meta name="apple-mobile-web-app-capable">`
  - `<meta name="apple-mobile-web-app-status-bar-style">`

- [ ] **앱 아이콘** (`public/icons/`)
  - icon-192x192.png
  - icon-512x512.png
  - icon-maskable-192x192.png (안드로이드 어댑티브 아이콘)
  - apple-touch-icon.png (iOS용 180x180)
  - favicon.ico

- [ ] **오프라인 페이지** (`src/app/offline/page.tsx`)
  - 네트워크 없을 때 보여줄 폴백 UI

### 선택 (Should)

- [ ] **A2HS(Add to Home Screen) 설치 배너**
  - 앱 설치 유도 UI 컴포넌트
  - `beforeinstallprompt` 이벤트 핸들링

- [ ] **리포트 페이지 오프라인 캐싱**
  - `/report/[id]` 방문 시 캐시 저장 → 오프라인 재열람 가능

- [ ] **PWA 업데이트 알림**
  - 새 Service Worker 등록 시 사용자에게 갱신 알림

### 제외 (Won't)

- Push Notifications: 현재 사용자 알림 시나리오 없음 (분석은 동기 폴링 방식)
- Background Sync: 오프라인 분석 요청 저장 → 복잡도 대비 가치 낮음

---

## 4. 기술 구현 전략

### 패키지 선택: `next-pwa` (serwist fork)

```
npm install @serwist/next serwist
```

- Next.js 16 App Router 완벽 지원
- TypeScript 네이티브 지원
- Service Worker 자동 생성 (Workbox 기반)
- `next.config.ts`에 플러그인 추가만으로 동작

### 캐싱 전략

```
정적 자산 (_next/static/*): CacheFirst, 30일
이미지 (public/icons/*): CacheFirst, 7일
폰트 (Google Fonts 등): CacheFirst, 365일
API Routes (/api/*): NetworkFirst, 네트워크 실패 시 캐시
페이지 HTML: NetworkFirst, 오프라인 시 /offline 폴백
```

### 아이콘 생성 전략

- 기존 로고/브랜딩 자산 없음 → SVG 원본 아이콘 설계 후 `sharp` 또는 온라인 툴로 다양한 사이즈 생성
- "창업 분석기" 컨셉: 위치 핀 + 그래프 조합 아이콘

---

## 5. 구현 순서

```
Phase 1: 기반 설정
  1-1. @serwist/next 패키지 설치
  1-2. next.config.ts PWA 플러그인 설정
  1-3. tsconfig.json serwist 타입 추가
  1-4. public/sw.ts (Service Worker entry) 생성

Phase 2: 매니페스트 & 아이콘
  2-1. 앱 아이콘 SVG 설계 및 PNG 변환 (192, 512, maskable)
  2-2. public/manifest.json 작성
  2-3. src/app/layout.tsx 메타 태그 추가 (viewport, theme-color, apple 태그)

Phase 3: 오프라인 지원
  3-1. src/app/offline/page.tsx 생성 (폴백 UI)
  3-2. 캐싱 전략 구성 (serwist defaultCache + 커스텀 라우트)

Phase 4: UX 개선
  4-1. A2HS 설치 배너 컴포넌트 (`InstallBanner`)
  4-2. PWA 업데이트 알림 훅 (`usePWAUpdate`)
  4-3. 앱 설치 완료 후 스플래시 스크린 설정

Phase 5: 검증
  5-1. Lighthouse PWA 점수 90+ 달성 확인
  5-2. Chrome DevTools → Application 탭 Service Worker 동작 확인
  5-3. 오프라인 모드 시뮬레이션 테스트
  5-4. iOS Safari 홈 화면 추가 동작 확인
  5-5. Android Chrome 설치 배너 동작 확인
```

---

## 6. 파일 변경 목록 (예상)

### 신규 생성

```
public/
  manifest.json
  sw.ts                     # Service Worker entry
  icons/
    icon-192x192.png
    icon-512x512.png
    icon-maskable-192x192.png
    icon-maskable-512x512.png
    apple-touch-icon.png    # 180x180
    favicon.ico

src/app/
  offline/
    page.tsx               # 오프라인 폴백 페이지

src/components/
  pwa/
    install-banner.tsx     # A2HS 설치 배너
    update-prompt.tsx      # SW 업데이트 알림
```

### 수정

```
next.config.ts             # @serwist/next 플러그인 추가
tsconfig.json              # serwist 타입 include
src/app/layout.tsx         # PWA 메타 태그 + manifest 링크
```

---

## 7. 리스크 & 주의사항

| 리스크 | 내용 | 대응 |
|--------|------|------|
| Service Worker 캐시 오염 | 잘못된 캐시 전략 → 오래된 데이터 노출 | NetworkFirst 기본 / 캐시 버전 관리 |
| iOS 제한 | iOS Safari PWA는 Push / Background Sync 미지원 | 지원 기능 범위를 설치+오프라인으로 한정 |
| Kakao Maps 오프라인 | 지도 타일은 캐시 불가 | `/map` 페이지는 오프라인 불가 안내 명시 |
| 빌드 사이즈 증가 | SW 번들 추가 | serwist의 tree-shaking 활용 |
| 개발 환경 SW 간섭 | dev 모드에서 SW 동작 시 캐시 문제 | dev 모드 SW 비활성화 (`disable: process.env.NODE_ENV === 'development'`) |

---

## 8. 완료 기준 (Definition of Done)

- [ ] Lighthouse PWA 감사 점수 90점 이상
- [ ] Chrome / Android: 홈 화면 추가 가능 (설치 배너 표시)
- [ ] iOS Safari: 홈 화면 추가 후 standalone 모드 실행
- [ ] 오프라인 상태: `/offline` 폴백 페이지 표시
- [ ] `/report/[id]` 재방문 시 오프라인에서도 열람 가능
- [ ] 빌드 에러 없음 (`npm run build` 성공)

---

## 9. 참고 자료

- [serwist 공식 문서](https://serwist.pages.dev/) - Next.js App Router PWA
- [Web App Manifest 스펙](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [PWA Checklist (web.dev)](https://web.dev/pwa-checklist/)
- [iOS PWA 제한사항](https://webkit.org/blog/category/privacy/)
