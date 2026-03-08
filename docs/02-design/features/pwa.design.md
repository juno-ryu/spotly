# Design: PWA 래핑 (Progressive Web App)

> 작성일: 2026-03-08
> 피처명: `pwa`
> 단계: Design
> 참조: `docs/01-plan/features/pwa.plan.md`

---

## 1. 현재 코드 현황 (As-Is)

### `src/app/layout.tsx` 현재 상태

```typescript
// 이미 viewport 있음 — viewportFit: "cover" 는 PWA safe-area에 유리
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: SITE_CONFIG.name,        // "창업 분석기"
  description: SITE_CONFIG.description,
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### `src/components/providers.tsx` 현재 상태

```typescript
export function Providers({ children }) {
  return (
    <>
      <KakaoMapProvider>{children}</KakaoMapProvider>
      <Toaster />
    </>
  );
}
```

### `next.config.ts` 현재 상태

```typescript
const nextConfig: NextConfig = {
  images: { remotePatterns: [...] }
};
```

### 현재 없는 것

- `public/` 폴더 없음
- `manifest.json` 없음
- Service Worker 없음
- PWA 관련 메타 태그 없음

---

## 2. 아키텍처 설계 (To-Be)

### 전체 구조

```
창업 분석기 (Next.js 16 App Router)
│
├── next.config.ts          ← @serwist/next 플러그인 추가
│
├── public/
│   ├── manifest.json       ← Web App Manifest
│   ├── sw.ts               ← Service Worker entry (serwist 자동 처리)
│   └── icons/
│       ├── icon-192.png
│       ├── icon-512.png
│       ├── icon-maskable-192.png
│       ├── icon-maskable-512.png
│       └── apple-touch-icon.png   (180×180)
│
├── src/app/
│   ├── layout.tsx          ← PWA 메타 태그 추가 (현재 viewport 유지)
│   └── offline/
│       └── page.tsx        ← 오프라인 폴백 페이지
│
└── src/components/
    └── pwa/
        ├── install-banner.tsx    ← A2HS 설치 유도 배너
        └── update-prompt.tsx     ← SW 업데이트 알림
```

---

## 3. 패키지 설정

### 설치

```bash
npm install @serwist/next serwist
```

### `next.config.ts` 변경

```typescript
import withSerwist from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
};

export default withSerwist({
  swSrc: "public/sw.ts",          // Service Worker 소스
  swDest: "public/sw.js",          // 빌드 출력
  disable: process.env.NODE_ENV === "development",  // dev 모드 비활성화
})(nextConfig);
```

### `tsconfig.json` 변경

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "types": ["@serwist/next/typings"]   // ← 추가
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "public/sw.ts"]  // ← public/sw.ts 추가
}
```

---

## 4. Service Worker 설계

### `public/sw.ts`

```typescript
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
```

### 캐싱 전략 상세

| 리소스 | 전략 | TTL | 비고 |
|--------|------|-----|------|
| `_next/static/*` | CacheFirst | 1년 | Next.js 빌드 해시로 버전 관리 |
| `_next/image/*` | CacheFirst | 30일 | 이미지 최적화 결과 |
| `public/icons/*` | CacheFirst | 7일 | PWA 아이콘 |
| `public/*.png, *.ico` | CacheFirst | 7일 | 정적 자산 |
| `/api/geocode/*` | NetworkFirst | 24시간 | 주소 검색 결과 |
| `/api/report/*` | NetworkFirst | 없음 | PDF는 캐시 안 함 |
| 페이지 HTML | NetworkFirst | 없음 | 최신 분석 결과 필요 |
| 오프라인 폴백 | `/offline` | - | 네트워크 실패 시 표시 |

> `defaultCache`가 `_next/static`, `_next/image`, Google Fonts를 기본 처리.
> 나머지는 serwist의 NetworkFirst 기본값 적용.

---

## 5. Web App Manifest 설계

### `public/manifest.json`

```json
{
  "name": "창업 분석기",
  "short_name": "창업분석기",
  "description": "소상공인 창업 입지 분석 서비스",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#ffffff",
  "background_color": "#ffffff",
  "lang": "ko-KR",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/home.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "창업 분석기 홈 화면"
    }
  ],
  "categories": ["business", "finance", "productivity"],
  "shortcuts": [
    {
      "name": "입지 분석 시작",
      "url": "/analyze",
      "description": "새 입지 분석 시작"
    },
    {
      "name": "분석 이력",
      "url": "/history",
      "description": "이전 분석 이력 보기"
    }
  ]
}
```

> `theme_color`는 shadcn-ui 기본 배경색(`#ffffff`, 라이트 모드)에 맞춤.
> 다크 모드 지원 시 `media` 조건부 theme_color 추가 가능 (v1.5 Manifest 스펙).

---

## 6. 메타 태그 설계

### `src/app/layout.tsx` 변경 사항

```typescript
// 추가할 metadata
export const metadata: Metadata = {
  title: SITE_CONFIG.name,
  description: SITE_CONFIG.description,
  manifest: "/manifest.json",                          // ← 추가
  appleWebApp: {                                       // ← 추가 (iOS PWA)
    capable: true,
    statusBarStyle: "default",
    title: SITE_CONFIG.name,
  },
  formatDetection: {                                   // ← 추가
    telephone: false,
  },
  icons: {                                             // ← 추가
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

// viewport 수정 (themeColor 추가)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",           // 현재 유지
  themeColor: [                   // ← 추가
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },  // zinc-950
  ],
};
```

---

## 7. 오프라인 폴백 페이지 설계

### `src/app/offline/page.tsx`

```
┌─────────────────────────────────┐
│                                  │
│         [WifiOff 아이콘]          │
│                                  │
│    인터넷 연결이 없습니다           │
│                                  │
│  네트워크 연결을 확인한 후          │
│  다시 시도해 주세요.               │
│                                  │
│     [ 다시 시도 ]  [ 이력 보기 ]   │
│                                  │
└─────────────────────────────────┘
```

- "다시 시도": `window.location.reload()` 클릭 핸들러
- "이력 보기": `/history` 링크 (캐시된 이력 열람 가능)
- 애니메이션 없음 (오프라인 상황이므로 최소 리소스)

---

## 8. A2HS 설치 배너 컴포넌트 설계

### `src/components/pwa/install-banner.tsx`

```
┌──────────────────────────────────────────────┐
│ [앱 아이콘 32px]                              │
│ 창업 분석기를 홈 화면에 추가하세요             │
│ 빠른 실행과 오프라인 열람이 가능합니다          │
│                         [나중에] [설치하기]    │
└──────────────────────────────────────────────┘
```

**동작 흐름**:

```
앱 로드
  ↓
beforeinstallprompt 이벤트 캡처 → useState에 저장
  ↓
배너 표시 (sessionStorage 체크 — "dismissed" 아닐 때만)
  ↓
[설치하기] 클릭 → prompt() 호출 → 사용자 선택
  ↓
appinstalled 이벤트 → 배너 숨김 + 토스트 "설치 완료"
[나중에] 클릭 → sessionStorage.setItem("pwa-dismissed", "1") → 배너 숨김
```

**상태 관리**:
```typescript
// 전역 상태 불필요 — 로컬 useState + sessionStorage면 충분
const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
const [showBanner, setShowBanner] = useState(false);
```

**배치 위치**: `src/components/providers.tsx`에 추가 (앱 전체에서 한 번만 마운트)

---

## 9. SW 업데이트 알림 컴포넌트 설계

### `src/components/pwa/update-prompt.tsx`

```
┌──────────────────────────────────────┐
│ 새 버전이 있습니다. 지금 업데이트하면  │
│ 최신 기능을 이용할 수 있습니다.        │
│                           [업데이트]  │
└──────────────────────────────────────┘
```

**동작 흐름**:
```
SW 등록 → waitingWorker 감지
  ↓
Sonner 토스트로 알림 (최하단 고정)
  ↓
[업데이트] 클릭
  → waitingWorker.postMessage({ type: "SKIP_WAITING" })
  → window.location.reload()
```

> `serwist`의 `skipWaiting: true` 설정으로 자동 교체도 가능하나,
> 분석 진행 중 갑작스러운 새로고침 방지를 위해 사용자 확인 방식 채택.

---

## 10. 아이콘 가이드라인

### 아이콘 개념

- **주 아이콘**: 위치 핀(📍) + 그래프 막대 조합
- **색상**: 브랜드 컬러 (shadcn 기본 `primary` 색상 기준)
- **배경**: 흰색 원형 또는 라운드 사각형

### 필요 파일

| 파일명 | 크기 | 용도 |
|--------|------|------|
| `icon-192.png` | 192×192 | Android, manifest |
| `icon-512.png` | 512×512 | splash screen, manifest |
| `icon-maskable-192.png` | 192×192 | Android 어댑티브 아이콘 |
| `icon-maskable-512.png` | 512×512 | Android 어댑티브 아이콘 |
| `apple-touch-icon.png` | 180×180 | iOS 홈 화면 |
| `favicon.ico` | 32×32 | 브라우저 탭 |

> Maskable 아이콘: 중앙 72% 영역에 핵심 요소 배치 (safe zone 준수)

### 생성 방법

```
1. SVG로 원본 아이콘 설계
2. sharp CLI 또는 https://maskable.app 으로 PNG 변환
3. https://realfavicongenerator.net 으로 favicon.ico 생성
```

---

## 11. 컴포넌트별 구현 상세

### `src/components/pwa/install-banner.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

// 브라우저 표준에 아직 없는 이벤트 타입 보완
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      if (!sessionStorage.getItem("pwa-install-dismissed")) {
        setPrompt(e as BeforeInstallPromptEvent);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!prompt) return null;

  const handleInstall = async () => {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("pwa-install-dismissed", "1");
    setPrompt(null);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-xl border bg-background p-4 shadow-lg">
      {/* 배너 UI */}
    </div>
  );
}
```

### `src/components/pwa/update-prompt.tsx`

```typescript
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function UpdatePrompt() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            toast("새 버전이 있습니다", {
              action: {
                label: "업데이트",
                onClick: () => {
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                  window.location.reload();
                },
              },
              duration: Infinity,
            });
          }
        });
      });
    });
  }, []);

  return null;
}
```

### `src/components/providers.tsx` 변경

```typescript
import { InstallBanner } from "@/components/pwa/install-banner";
import { UpdatePrompt } from "@/components/pwa/update-prompt";

export function Providers({ children }) {
  return (
    <>
      <KakaoMapProvider>{children}</KakaoMapProvider>
      <Toaster />
      <InstallBanner />   {/* ← 추가 */}
      <UpdatePrompt />    {/* ← 추가 */}
    </>
  );
}
```

---

## 12. 구현 순서 (체크리스트)

```
Phase 1: 패키지 & 설정
  □ npm install @serwist/next serwist
  □ next.config.ts withSerwist 래핑
  □ tsconfig.json include에 "public/sw.ts" 추가

Phase 2: Service Worker
  □ public/sw.ts 생성 (serwist 설정)
  □ 캐싱 전략 검증 (dev 빌드)

Phase 3: 아이콘 & Manifest
  □ SVG 아이콘 설계
  □ PNG 변환 (192, 512, maskable, apple-touch-icon)
  □ public/manifest.json 작성
  □ public/favicon.ico

Phase 4: 메타 태그
  □ src/app/layout.tsx — metadata.manifest 추가
  □ src/app/layout.tsx — metadata.appleWebApp 추가
  □ src/app/layout.tsx — metadata.icons 추가
  □ src/app/layout.tsx — viewport.themeColor 추가

Phase 5: 오프라인 페이지
  □ src/app/offline/page.tsx 생성

Phase 6: PWA UX 컴포넌트
  □ src/components/pwa/install-banner.tsx
  □ src/components/pwa/update-prompt.tsx
  □ src/components/providers.tsx 업데이트

Phase 7: 검증
  □ npm run build 성공 확인
  □ Chrome DevTools → Application → Service Workers 동작 확인
  □ Chrome DevTools → Application → Manifest 정보 확인
  □ Lighthouse PWA 점수 90+ 확인
  □ 오프라인 모드 시뮬레이션 테스트
  □ iOS Safari 홈 화면 추가 테스트
```

---

## 13. 변경 파일 최종 목록

### 신규 생성 (7개 파일 + 아이콘)

| 파일 | 설명 |
|------|------|
| `public/sw.ts` | Service Worker entry |
| `public/manifest.json` | Web App Manifest |
| `public/icons/icon-192.png` | 앱 아이콘 192px |
| `public/icons/icon-512.png` | 앱 아이콘 512px |
| `public/icons/icon-maskable-192.png` | maskable 아이콘 192px |
| `public/icons/icon-maskable-512.png` | maskable 아이콘 512px |
| `public/icons/apple-touch-icon.png` | iOS 아이콘 180px |
| `public/favicon.ico` | 파비콘 |
| `src/app/offline/page.tsx` | 오프라인 폴백 페이지 |
| `src/components/pwa/install-banner.tsx` | 설치 배너 |
| `src/components/pwa/update-prompt.tsx` | 업데이트 알림 |

### 수정 (3개 파일)

| 파일 | 변경 내용 |
|------|----------|
| `next.config.ts` | `withSerwist` 래핑 |
| `tsconfig.json` | `public/sw.ts` include, serwist types |
| `src/app/layout.tsx` | PWA 메타 태그 추가 (manifest, appleWebApp, icons, themeColor) |
| `src/components/providers.tsx` | InstallBanner, UpdatePrompt 추가 |

---

## 14. 검증 기준

| 기준 | 목표값 | 측정 방법 |
|------|--------|----------|
| Lighthouse PWA 점수 | 90+ | Chrome DevTools Lighthouse |
| Service Worker 등록 | 성공 | DevTools Application 탭 |
| 오프라인 폴백 | `/offline` 표시 | DevTools Network → Offline |
| Android 설치 배너 | 표시 | Chrome 홈 화면 추가 |
| iOS standalone 모드 | 실행됨 | Safari → 홈 화면 추가 |
| 빌드 에러 없음 | 0건 | `npm run build` |
