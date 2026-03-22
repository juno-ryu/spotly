# Spotly 성장 전략 + 앱인토스 배포 계획서

> 작성일: 2026-03-20
> 상태: 계획 단계

---

## 1. 배경 및 목표

### 1.1 왜 앱인토스인가

- 토스 앱 3,000만 유저에게 설치 없이 노출 가능
- 현재 홍보 채널 부재 → 서비스 검증(PMF) 자체가 불가능한 상황
- 앱인토스가 유일한 대규모 노출 채널

### 1.2 서비스 개요

소상공인 창업 입지 분석 서비스. 주소+업종 입력 → 8개 공공 API 수집 → 다중 지표 100점 만점 → Claude AI 리포트 생성.

---

## 2. 앱인토스 핵심 제약사항 (공식 확인 완료)

### 2.1 정적 SPA 필수 — SSR 불가

앱인토스 공식 답변 (Dylan, 앱인토스 팀, 2026-02-20):

> "외부에 호스팅된 소스코드를 불러오게 되면 별도 검수 없이 배포될 수 있어 보안 및 검수 정책상 관리가 어려움"
> "클라이언트 소스코드는 토스 인프라에 배포되어 서빙됨"
> "자체 서버 존재 시 HTTPS API 통신으로 진행"

- `.ait` 번들 = `vite build` → `dist/` 정적 파일 → 패키징
- 번들 용량 제한: 압축 해제 기준 100MB 이하
- 외부 URL 로드 불가 (iframe, redirect 모두 금지)
- HTTPS API 통신은 허용

**출처:** https://techchat-apps-in-toss.toss.im/t/api/2568, https://techchat-apps-in-toss.toss.im/t/topic/2570

### 2.2 토스 로그인 전용

> "미니앱에서는 토스 로그인만 사용 가능. 자사 로그인이나 다른 간편 로그인 방식 불가."

- 카카오/구글 OAuth 사용 불가
- `appLogin()` SDK + mTLS 서버 간 통신 필수
- Supabase Auth에 토스 로그인 provider 없음 → 수동 연동 필요

**출처:** https://developers-apps-in-toss.toss.im/login/intro.html

### 2.3 기타 정책

- **SDK 2.x 필수** (2026-03-23 이후 1.x 업로드 불가)
- **비게임 앱은 "앱 내 기능" 최소 1개 등록 필수**
- **UX 라이팅**: 해요체 통일, 능동적 표현, "돼요" (≠ "되어요")
- **다크패턴 5대 반려 기준**: 진입 시 바텀시트, 뒤로가기 시 바텀시트, 거절 선택지 부재, 예상 외 광고, 모호한 CTA
- **앱 아이콘**: 600×600px 각진 정사각형, 배경색 꽉 채움 → `spotly-logo3.png` (완료)
- **참고용 고지** 필수 → 로그인 모달에 추가 완료

---

## 3. 아키텍처

### 3.1 현재 구조 (Vercel)

```
사용자 브라우저
    ↓
spotly-beta.vercel.app (Next.js 16, SSR)
    ├── Server Components (데이터 페칭)
    ├── Server Actions (분석 실행, 리포트 생성, 인증)
    ├── API Routes (geocode)
    ├── Supabase Auth (카카오/구글 OAuth)
    ├── Prisma → PostgreSQL
    ├── Upstash Redis (캐시)
    └── Claude API (haiku-4-5)
```

### 3.2 앱인토스 추가 후 구조

```
[기존] 사용자 브라우저
    ↓
spotly-beta.vercel.app (Next.js, SSR) ← 변경 없음
    ├── Server Components, Server Actions (그대로)
    ├── API Routes (기존 + SPA용 추가) ← 추가
    └── 토스 로그인 서버 API ← 추가

[신규] 토스 앱 WebView
    ↓
.ait 번들 (Vite + React SPA, 토스 인프라에서 서빙)
    ├── 공유 클라이언트 컴포넌트
    ├── react-router (클라이언트 라우팅)
    └── fetch() → spotly-beta.vercel.app/api/*
```

### 3.3 디렉토리 구조

```
spotly/
├── src/                          # 기존 Next.js (변경 최소화)
│   ├── app/
│   │   ├── api/                  # 기존 geocode + SPA용 API 추가
│   │   │   ├── geocode/
│   │   │   ├── analysis/route.ts       ← 추가
│   │   │   ├── report/generate/route.ts ← 추가
│   │   │   ├── report/[id]/route.ts     ← 추가
│   │   │   ├── history/route.ts         ← 추가
│   │   │   └── auth/toss/
│   │   │       ├── token/route.ts       ← 추가 (토스 토큰 교환)
│   │   │       └── session/route.ts     ← 추가 (Supabase 세션 발급)
│   │   └── (main)/               # 기존 페이지 (변경 없음)
│   ├── features/                 # 기존 기능 (변경 없음)
│   └── server/                   # 기존 서버 유틸 (변경 없음)
│
├── spa/                          # 신규 — 앱인토스용 정적 SPA
│   ├── granite.config.ts         # 앱인토스 설정
│   ├── package.json              # vite, react, react-router
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx              # 엔트리포인트
│       ├── App.tsx               # react-router 라우트 정의
│       ├── pages/                # 얇은 래퍼 (각 10~30줄)
│       │   ├── welcome.tsx
│       │   ├── industry.tsx
│       │   ├── region.tsx
│       │   ├── map.tsx
│       │   ├── analyze.tsx
│       │   ├── report.tsx
│       │   └── history.tsx
│       ├── auth/
│       │   └── toss-login.ts     # appLogin() SDK 호출
│       └── lib/
│           └── api.ts            # Vercel API 클라이언트
│
├── package.json                  # workspaces: ["spa"]
├── vercel.json                   # CORS 헤더 설정 추가
└── prisma/
```

---

## 4. 작업 상세

### 4.1 API Route 추가 (Server Action → API 노출)

기존 서버 액션의 핵심 로직은 그대로 두고, API Route에서 호출만 한다.
Next.js 공식 권장 패턴: "핵심 로직을 Data Access Layer에 분리하고, Server Action과 API Route 양쪽에서 호출하라." (출처: https://nextjs.org/blog/building-apis-with-nextjs)

**기존 서비스(SSR)는 성능 손해 0. 서버 액션 그대로 유지.**

| 서버 액션 | API Route (추가) | HTTP | 용도 |
|-----------|-----------------|------|------|
| `executeAnalysis(params)` | `POST /api/analysis` | POST | 8개 API 병렬 수집 + 스코어링 |
| `generateReport(data)` | `POST /api/report/generate` | POST | Claude AI 리포트 생성 |
| — | `GET /api/report/[id]` | GET | 리포트 조회 |
| — | `GET /api/history` | GET | 분석 이력 조회 |
| `signInWithKakao/Google` | 사용 안 함 (토스 전용) | — | — |
| — | `POST /api/auth/toss/token` | POST | 토스 인가코드 → 토큰 교환 |
| — | `POST /api/auth/toss/session` | POST | Supabase 세션 발급 |

#### API Route 구현 예시

```typescript
// src/app/api/analysis/route.ts
import { executeAnalysis, type AnalyzeParams } from "@/features/analysis/actions";

export async function POST(req: Request) {
  const params: AnalyzeParams = await req.json();

  // 필수값 검증
  if (!params.lat || !params.lng || !params.address || !params.code || !params.keyword || !params.radius) {
    return Response.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  const data = await executeAnalysis(params);
  return Response.json(data);
}
```

```typescript
// src/app/api/report/generate/route.ts
import { generateReport } from "@/features/report/actions";

export async function POST(req: Request) {
  const data = await req.json();
  const result = await generateReport(data);
  return Response.json(result);
}
```

#### 성능 분석: Server Action vs API Route

| 항목 | Server Action (기존 Next.js) | API Route (토스 SPA) |
|------|:---:|:---:|
| 서버-서버 통신 | Vercel → 외부 API (같은 리전, ~1-5ms) | 유저 → Vercel → 외부 API (왕복 추가) |
| JS 번들 | 서버 렌더링, 클라이언트 JS 최소 | SPA 전체 JS 포함 |
| 데이터 워터폴 | 서버에서 병렬 fetch 후 한번에 렌더 | JS 로드 → fetch → 렌더 (3단계) |
| 타입 안전성 | 자동 추론 | 수동 파싱 |
| 스트리밍 | Suspense 지원 | 불가 |

**결론: 기존 서비스 성능 영향 없음. 토스 SPA만 클라이언트 fetch 오버헤드 존재하나, 앱인토스 정책상 불가피.**

### 4.2 CORS 설정

토스 인프라에서 서빙되는 SPA가 Vercel API를 호출하려면 CORS 설정 필수.

**출처:** https://vercel.com/kb/guide/how-to-enable-cors

#### 방법 1: `vercel.json` (권장)

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "토스인프라도메인" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" },
        { "key": "Access-Control-Allow-Credentials", "value": "true" }
      ]
    }
  ]
}
```

#### 방법 2: Middleware (동적 제어)

```typescript
// middleware.ts
const allowedOrigins = [
  'https://spotly-beta.vercel.app',
  'https://토스인프라도메인',  // 샌드박스 테스트 시 확인 필요
];

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const isAllowed = origin && allowedOrigins.includes(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin : '',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const response = NextResponse.next();
  if (isAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  return response;
}

export const config = { matcher: '/api/:path*' };
```

#### 주의사항

- 토스 인프라 origin 도메인은 **샌드박스 테스트 시 개발자 도구로 확인** 필요
- `Access-Control-Allow-Credentials: true` 사용 시 `*` 불가, 명시적 도메인 필수
- 커스텀 WebView 환경에서 origin이 `null`일 수 있음 → 별도 인증 토큰 방식 검토

### 4.3 토스 로그인 연동

#### 4.3.1 전체 플로우

```
[SPA] appLogin() SDK 호출
    ↓
사용자 약관 동의 (첫 로그인 시)
    ↓
인가 코드 + referrer 수신 (유효시간 10분)
    ↓
[SPA → Vercel] POST /api/auth/toss/token { authorizationCode, referrer }
    ↓
[Vercel → 토스] mTLS 통신으로 AccessToken 발급
    ↓
[Vercel → 토스] AccessToken으로 사용자 정보 조회 → AES-256-GCM 복호화
    ↓
[Vercel] Supabase admin.createUser() 또는 기존 유저 조회
    ↓
[Vercel] admin.generateLink() → verifyOtp() → access_token + refresh_token 발급
    ↓
[Vercel → SPA] 토큰 반환
    ↓
[SPA] supabase.auth.setSession({ access_token, refresh_token })
    ↓
이후 모든 API 호출에 Authorization 헤더 포함
```

#### 4.3.2 Supabase Auth 통합 (auth.users 테이블 사용)

Supabase에 토스 로그인 provider가 없으므로, admin API로 수동 연동한다.

```typescript
// src/app/api/auth/toss/session/route.ts
import { createSupabaseAdmin } from "@/server/supabase/admin";

export async function POST(req: Request) {
  const { tossUserKey, name, email } = await req.json();

  const supabase = createSupabaseAdmin();
  const fakeEmail = `toss_${tossUserKey}@toss.spotly.internal`;

  // 1. 기존 유저 조회 또는 신규 생성
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === fakeEmail);

  if (!existing) {
    await supabase.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: {
        provider: 'toss',
        toss_user_key: tossUserKey,
        name: name ?? '',
      },
    });
  }

  // 2. Magic Link 생성 → OTP 검증 → 세션 토큰 발급
  const { data: link } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: fakeEmail,
  });

  const { data: session } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  });

  // 3. 토큰 반환
  return Response.json({
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
  });
}
```

**이 방식의 장점:**
- `auth.users` 테이블에 토스 유저가 들어감
- 기존 `supabase.auth.getUser()` 그대로 동작
- RLS 정책 그대로 적용
- `analysisReport.userId` 연결 가능

**출처:**
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://github.com/orgs/supabase/discussions/11854

#### 4.3.3 mTLS 토큰 교환 서버 구현

```typescript
// src/app/api/auth/toss/token/route.ts
import https from 'node:https';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TOSS_API_BASE = 'https://api.apps-in-toss.com';

// mTLS 에이전트
const mtlsAgent = new https.Agent({
  cert: fs.readFileSync(process.env.TOSS_CLIENT_CERT_PATH!),
  key: fs.readFileSync(process.env.TOSS_CLIENT_KEY_PATH!),
});

export async function POST(req: Request) {
  const { authorizationCode, referrer } = await req.json();

  // 1. 인가코드 → AccessToken 교환
  const tokenRes = await fetch(
    `${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorizationCode, referrer }),
      // @ts-expect-error — Node.js fetch agent
      agent: mtlsAgent,
    }
  );
  const { accessToken, refreshToken } = await tokenRes.json();

  // 2. AccessToken으로 사용자 정보 조회
  const meRes = await fetch(
    `${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/login-me`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      // @ts-expect-error
      agent: mtlsAgent,
    }
  );
  const userInfo = await meRes.json();

  // 3. 개인정보 복호화 (AES-256-GCM)
  const decryptedName = decryptField(userInfo.name);

  return Response.json({
    tossUserKey: userInfo.userKey,
    name: decryptedName,
  });
}

function decryptField(encrypted: string): string {
  const key = Buffer.from(process.env.TOSS_DECRYPTION_KEY_BASE64!, 'base64');
  const aad = Buffer.from(process.env.TOSS_AAD_STRING!, 'utf8');
  const buf = Buffer.from(encrypted, 'base64');

  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(12, buf.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  decipher.setAAD(aad);

  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
}
```

#### 4.3.4 알려진 이슈 (커뮤니티 보고)

| 이슈 | 내용 | 해결 |
|------|------|------|
| `getIsTossLoginIntegratedService()` 캐싱 | 응답값이 캐싱되어 로그인 상태 분기 어려움 | httpOnly 쿠키로 AT/RT 저장 |
| 샌드박스 `generate-token` 실패 | 샌드박스에서만 토큰 교환 실패 사례 | 환경별 엔드포인트 확인 |
| iOS 로컬 스토리지 삭제 | 7일 미상호작용 시 로컬 스토리지 삭제 | httpOnly 쿠키 방식 사용 |
| mTLS 인증서 만료 | 유효기간 390일, 만료 시 인증 실패 | 만료 전 재발급 알림 설정 |

**출처:** https://techchat-apps-in-toss.toss.im/t/applogin/3056, https://techchat-apps-in-toss.toss.im/t/generate-token/2920

### 4.4 SPA 프론트엔드 (`spa/`)

#### 4.4.1 기술 스택

- Vite + React 19 + TypeScript
- react-router (클라이언트 라우팅)
- `@apps-in-toss/web-framework` (SDK 2.x)
- TDS (`@toss/tds-mobile`) — 검수 통과를 위해 권장
- 기존 `src/` 컴포넌트 직접 import (`../../src/features/...`)

#### 4.4.2 granite.config.ts

```typescript
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'spotly',
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  outdir: 'dist',
  permissions: [],
  brand: {
    displayName: '스팟리',
    icon: 'https://콘솔에서_업로드한_로고_URL',
    primaryColor: '#7c3aed',
  },
  webViewProps: {
    type: 'partner',
  },
});
```

#### 4.4.3 페이지 구조

각 페이지는 10~30줄의 얇은 래퍼. 기존 클라이언트 컴포넌트를 import하고, API fetch로 데이터를 연결.

```typescript
// spa/src/pages/analyze.tsx (예시)
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query'; // 또는 자체 훅
import { AnalysisResult } from '../../src/features/analysis/components/analysis-result';
import { api } from '../lib/api';

export function AnalyzePage() {
  const [searchParams] = useSearchParams();
  const params = {
    lat: Number(searchParams.get('lat')),
    lng: Number(searchParams.get('lng')),
    address: searchParams.get('address') ?? '',
    code: searchParams.get('code') ?? '',
    keyword: searchParams.get('keyword') ?? '',
    radius: Number(searchParams.get('radius')),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['analysis', params],
    queryFn: () => api.post('/api/analysis', params),
  });

  if (isLoading) return <AnalysisResultSkeleton />;
  if (!data) return null;

  return (
    <AnalysisResult
      data={data}
      isAuthenticated={!!api.getSession()}
      onGenerateReport={() => api.post('/api/report/generate', data)}
    />
  );
}
```

#### 4.4.4 API 클라이언트

```typescript
// spa/src/lib/api.ts
const BASE_URL = import.meta.env.PROD
  ? 'https://spotly-beta.vercel.app'
  : 'http://localhost:3000';

export const api = {
  async post(path: string, body: unknown) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
      },
      body: JSON.stringify(body),
    });
    return res.json();
  },

  async get(path: string) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
      },
    });
    return res.json();
  },
};
```

### 4.5 앱 내 기능 등록 (필수)

비게임 앱은 최소 1개 등록 필수. "~하기" 형식 권장.

| 기능명 | 경로 | 설명 |
|--------|------|------|
| 상권 분석하기 | `intoss://spotly/analyze` | 메인 분석 기능 |
| 분석 리포트 보기 | `intoss://spotly/history` | 이력 확인 |

---

## 5. 브랜딩 & 디자인 체크리스트

| 항목 | 요구사항 | 상태 |
|------|---------|:---:|
| 앱 아이콘 | 600×600px, 각진 정사각형, 배경 꽉 채움 | ✅ `spotly-logo3.png` |
| 앱 이름 | 한글 권장 | "스팟리" (결정 필요) |
| 브랜드 컬러 | HEX 코드 | `#7c3aed` |
| 참고용 고지 | 유저가 참고용으로만 사용할 수 있도록 기재 | ✅ 모달에 추가 완료 |
| UX 라이팅 | 해요체, 능동형, "돼요" | 전수 점검 필요 |
| 다크패턴 방지 | 5대 반려 기준 준수 | 점검 필요 |
| 내비게이션 바 | 앱인토스 전용 컴포넌트 | 구현 필요 |

---

## 6. 콘솔 사전 준비 (행정 작업)

앱인토스 콘솔: https://apps-in-toss.toss.im

| 작업 | 상세 |
|------|------|
| 워크스페이스 생성 | 토스 비즈니스 계정 필요 |
| 앱 등록 | appName: `spotly` |
| mTLS 인증서 발급 | 콘솔에서 발급 → 서버에 안전 보관 (390일 유효) |
| 토스 로그인 약관 등록 | 이용약관, 개인정보 수집·이용, 제3자 제공 |
| 동의 항목 설정 | 필수: 이름(USER_NAME), 선택: 이메일 |
| 연결 해제 콜백 URL | `https://spotly-beta.vercel.app/api/auth/toss/unlink` |
| 복호화 키 수신 | AES-256-GCM 키 + AAD 이메일로 수신 |
| 샌드박스 앱 설치 | iOS/Android 다운로드 |

---

## 7. 출시 프로세스

```
① 콘솔 등록 + mTLS 인증서 발급 (행정)
② API Routes 추가 (서버 액션 래핑)
③ CORS 설정 (vercel.json 또는 middleware)
④ 토스 로그인 API Route 추가 (mTLS + Supabase 세션) (mTLS + Supabase 연동)
⑤ spa/ 디렉토리 생성 (Vite + React SPA)
⑥ granite.config.ts 설정
⑦ 샌드박스 테스트 (최소 1회)
⑧ UX 라이팅 + 다크패턴 점검
⑨ 앱 내 기능 등록 (최소 1개)
⑩ .ait 번들 업로드 → 검토 요청 (영업일 최대 3일)
⑪ 승인 → 출시
```

---

## 8. 환경 변수 (추가 필요)

```env
# 토스 로그인 mTLS
TOSS_CLIENT_CERT_PATH=/path/to/client.crt
TOSS_CLIENT_KEY_PATH=/path/to/client.key
TOSS_DECRYPTION_KEY_BASE64=...
TOSS_AAD_STRING=...

# 토스 API
TOSS_API_BASE=https://api.apps-in-toss.com
```

---

## 9. 리스크 및 미확인 사항

| 항목 | 상태 | 비고 |
|------|:---:|------|
| 토스 인프라 origin 도메인 | 미확인 | 샌드박스 테스트 시 개발자 도구로 확인 |
| TDS 적용 필수 여부 | 미확인 | 비게임 검수 체크리스트에서 확인 필요 |
| 기존 컴포넌트 SPA import 호환성 | 미확인 | Vite에서 Next.js 전용 코드 제외 필요 |
| Kakao Maps SDK 웹뷰 동작 | 미확인 | 앱인토스 WebView에서 정상 동작 테스트 필요 |
| 번들 사이즈 100MB 이하 | 미확인 | Kakao Maps + React 번들 크기 측정 필요 |

---

## 10. 가치 제안 (Value Proposition)

### 10.1 유저가 직접 하면?

상권 분석을 직접 하려면 최소 6개 사이트를 돌아다녀야 한다:

| # | 사이트 | 데이터 | 소요 시간 |
|---|--------|--------|----------|
| 1 | 소상공인365 (sbiz.or.kr) | 점포 수, 매출 추정 | ~15분 |
| 2 | 서울시 우리마을가게 (golmok.seoul.go.kr) | 유동인구, 매출, 생존율 | ~20분 |
| 3 | KOSIS 통계청 | 배후 인구 | ~15분 |
| 4 | 카카오맵 | 경쟁업체 직접 검색+세기 | ~20분 |
| 5 | 서울교통공사/TAGO | 지하철·버스 승하차 | ~15분 |
| 6 | 학교·병원 직접 확인 | 인프라 환경 | ~10분 |
| | **합계** | | **~1.5시간** |

그리고 이 데이터를 **직접 해석해서 결론**을 내려야 한다. 이건 전문가가 아니면 거의 불가능.

> "창업전문가가 아니고서는 일반인이 상권 분석을 '제대로, 잘' 해내기란 쉽지 않은 일"
> — 삼쩜삼 (https://help.3o3.co.kr/hc/ko/articles/23656832727193)

### 10.2 스팟리가 제공하는 가치

**① 8개 국가·민간 데이터 자동 수집 (무료)**

| # | 데이터 소스 | 제공 기관 | 분석 내용 |
|---|-----------|----------|----------|
| 1 | Kakao Places | 카카오 | 반경 내 경쟁업체 수, 프랜차이즈 비율 |
| 2 | 서울 골목상권 | 서울시 | 점포당 매출, 유동인구, 개·폐업률 |
| 3 | KOSIS 인구 | 통계청 | 읍면동/시군구 배후 인구 |
| 4 | 지하철 승하차 | 서울교통공사/지방 교통 | 역세권 유동인구 (거리 감쇠 적용) |
| 5 | 버스 정류장 | TAGO 국토교통부 | 정류장 접근성 |
| 6 | 학교 DB | 교육부 | 초중고 반경 내 분포 |
| 7 | 대학교 | 카카오 | 대학 유무 + 거리 |
| 8 | 병의원 | 카카오 | 종합병원·의원 인프라 |

**② 4대 지표 스코어링 엔진 (무료)**

| 지표 | 가중치 (서울 4지표) | 측정 대상 |
|------|:-----------------:|----------|
| 상권 활력도 | 35% | 점포당 매출, 유동인구, 상권 변화 추이 |
| 경쟁 강도 | 25% | 업종 밀집도, 프랜차이즈 비율 (시그모이드+U커브) |
| 배후 인구 | 20% | 읍면동/시군구 인구 규모 |
| 생존율 | 20% | 폐업률, 순증감률 |
| + 인프라 보너스 | 최대 +15점 | 교통, 학교, 대학, 의료 (업종별 가중치) |

→ **100점 만점 종합 점수 + A~F 등급**

**③ AI 전문가 종합 리포트 (유료 990원)**

Claude AI가 수집된 모든 데이터를 분석하여 생성하는 맞춤 리포트:

| 항목 | 내용 |
|------|------|
| **종합 판정** | 추천 / 조건부 추천 / 주의 / 비추천 |
| **핵심 요약** | 이 위치에서 이 업종을 해도 되는가에 대한 한 줄 결론 |
| **예상 매출 범위** | 점포당 월 매출 추정, 피크 시간대, 주요 고객층 |
| **생존율 분석** | 폐업률, 개업률, 고위험 여부 해석 |
| **리스크 경고** | 위험/경고/주의 등급별 구체적 위험 요소 |
| **맞춤 창업 전략** | 포지셔닝, 실행 항목, 타겟 고객, 추천 운영시간 |
| **입지 대안 제안** | 현재 위치 평가 + 더 나은 방향/지역 제안 |
| **배후 인구 인사이트** | 인구 규모가 매출에 미치는 영향 해석 |
| **인프라 인사이트** | 교통·학교·의료 환경이 사업에 미치는 영향 |
| **상세 분석** | 위 모든 데이터를 종합한 깊이 있는 분석문 |

**④ 가치 환산**

| 비교 대상 | 가격 | 스팟리 |
|-----------|------|:------:|
| 직접 분석 (6개 사이트, 1.5시간+) | 시급 환산 ~15,000원 | **990원** |
| 크몽 프리랜서 상권 분석 | 5~30만원 | **990원** |
| 민간 컨설팅 (대면) | 30~50만원 | **990원** |
| 오픈업 프로 (B2B) | 월 99만원~ | **990원** |
| 창업 실패 시 평균 부채 | 1억 236만원 | **990원** |

> 1.5시간의 데이터 수집 + 전문가 수준의 AI 해석을 990원에.
> 수천만 원의 창업 투자 전, 990원짜리 보험.

---

## 11. 수익 모델 및 가격 전략

### 11.1 서비스 구조

```
무료 (전 플랫폼 동일):
  주소+업종 입력 → 8개 공공 API 수집 → 100점 스코어링
  → 경쟁업체 수, 유동인구, 교통, 인프라 등 기본 분석 결과

유료 (전 플랫폼 동일):
  "AI 전문가 리포트 받기" → 결제 → Claude 종합 분석 리포트
```

무료 분석은 로그인 없이 제공. AI 리포트만 유료.
무료 분석이 있어야 SEO 리포트 축적, 공유 바이럴, 전환 퍼널이 작동함.

### 10.2 가격 결정: 990원

#### 가격대별 비교 분석

| 가격 | PG수수료(4.3%+VAT) | Claude API | 순마진 | 100건 매출 | 소비자 인식 |
|-----:|---:|---:|---:|---:|------|
| 990원 | 47원 | 100원 | **843원** | 84,300원 | "천원도 안 해" → 충동구매 |
| 1,900원 | 90원 | 100원 | 1,710원 | 171,000원 | "이천원 가까이" → 한번 생각 |
| 3,900원 | 185원 | 100원 | 3,615원 | 361,500원 | "사천원" → 고민 |
| 4,900원 | 232원 | 100원 | 4,568원 | 456,800원 | "오천원 가까이" → 더 고민 |

#### 990원을 선택하는 근거

**1. 1,000원의 벽 — 한국 소비자 심리**

> CU 1,000원 이하 상품 매출: 매년 20%대 성장, 2024년 27.3% 신장
> — 머니투데이 (https://news.mt.co.kr/mtview.php?no=2024090508543539957)

> 고물가·경기침체 장기화로 990원 상품이 유통업계 전반으로 확대
> — 한국일보 (https://www.hankookilbo.com/News/Read/A2025060308030003436)

1,000원 이하는 한국 소비자에게 **"거의 무료"** 영역. "천원도 안 하는데 한번 해볼까?" 허들이 극도로 낮음.

**2. 리포트 볼륨 → SEO 자산 → 복리 성장**

990원의 낮은 허들 → 더 많은 유저가 리포트 생성 → DB에 리포트 축적 → sitemap → 검색 노출 → 유기적 유입.

리포트 1,000개 = 1,000개의 롱테일 검색 키워드. 가격이 낮을수록 이 플라이휠이 빨리 돌아감.

**3. 바이럴 잠재력**

"990원에 AI 상권 분석을?" → 놀라움 → 공유 확률 높음.
"3,900원에 AI 상권 분석을?" → "음 괜찮네" → 공유 동기 낮음.

**4. 가격 인상 용이성**

990원 → 1,900원 전환: "천원대"로 자릿수 동일, 심리적 저항 낮음.
3,900원 → 4,900원 전환: "3천원대 → 4천원대"로 자릿수 변경, 저항 높음.

**5. 3,900원의 가치 근거 (추후 인상 시 활용)**

| 비교 대상 | 가격 | 스팟리 대비 |
|-----------|------|:---------:|
| 민간 상권 컨설팅 | 30~50만원 | 100배 |
| 크몽 프리랜서 분석 | 5~30만원 | 50배 |
| 창업 실패 시 평균 부채 | 1억 236만원 | 26,000배 |
| 프랜차이즈 창업비용 평균 | 1억 5,900만원 | 40,000배 |
| 소상공인 3년 내 폐업률 | 40% (10명 중 4명) | — |

3,900원의 가치는 충분히 증명 가능하나, 초기에는 볼륨 확보가 우선이므로 990원으로 시작.
검증 후 프리미엄 티어(상세 리포트 3,900원) 추가하는 방식으로 확장.

출처:
- 소상공인 40%, 3년 내 폐업, 평균 부채 1억 (https://www.newsis.com/view/NISX20250319_0003104135)
- 2024 폐업자 100만 명 돌파 (https://www.segye.com/newsView/20250706503716)
- 프랜차이즈 창업비용 평균 1억5900만원 (https://www.asiae.co.kr/article/2024010418315804857)
- MIT/시카고대 Charm Pricing 연구 (https://www.business.com/articles/the-game-of-pricing-how-the-number-9-affects-purchase-behavior/)
- 900의 마법, 4900원 vs 5100원 인식 차이 (https://www.munhwa.com/article/11365936)
- Harvard Labor Illusion 연구 (https://www.hbs.edu/faculty/Pages/item.aspx?num=40158)

#### 체감 가치 확보 — 노동 환상(Labor Illusion)

"버튼 3번에 990원"이 아닌 "8개 기관 데이터 + AI 전문가 분석을 990원에" 로 프레이밍.

하버드 연구: "사람들은 뒤에서 노력이 투입되는 것을 볼 수 있을 때 가치를 더 높게 평가"
(https://www.hbs.edu/faculty/Pages/item.aspx?num=40158)

이미 구현된 GeneratingProgress 컴포넌트가 이 역할을 수행:

```
✅ 국민연금공단(NPS) 사업체 데이터 분석
✅ 서울시(골목상권) 매출·유동인구 분석
✅ 통계청(KOSIS) 전국 배후인구 데이터 분석
✅ 국토교통부(TAGO) 전국 버스·지하철 교통 분석
✅ Kakao Places(카카오) 인접 매장 분석
✅ 교육부·카카오 학교·대학·의료 인프라 분석
⏳ 데이터 취합 및 AI 리포트 작성중입니다.
```

유저는 7단계 진행 과정을 보면서 "이 가격에 이만큼 해주네"를 체감.

### 10.3 결제 수단

| 플랫폼 | 결제 수단 | 비고 |
|--------|----------|------|
| 웹 (spotly-beta.vercel.app) | 토스페이먼츠 | 카드, 간편결제 |
| 앱인토스 | 토스페이 / 인앱결제 | 토스 내장 결제 |

동일 결제사(토스) → 정산 통합 가능.

### 10.4 가격 전략: 앵커링 + 얼리버드

**정가 3,900원 / 얼리버드 특가 990원** 으로 표기.

#### UI 표기 예시

```
┌─────────────────────────────────────┐
│                                     │
│  정가 3,900원  →  990원              │
│  ──────          ━━━━              │
│  🔥 얼리버드 특가 (선착순 500명)      │
│                                     │
│  [AI 전문가 리포트 받기  990원]       │
│                                     │
└─────────────────────────────────────┘
```

#### 심리학적 근거

| 효과 | 설명 |
|------|------|
| **앵커링** | 3,900원이 기준점 → 990원이 "75% 할인"으로 인식 |
| **가치 프레이밍** | "990원짜리를 산다" vs "3,900원짜리를 990원에 산다"는 완전히 다른 체감 |
| **긴급성** | "선착순 / 얼리버드" → 지금 안 사면 3,900원 → 행동 유도 |
| **가격 인상 명분** | 나중에 1,900원 / 3,900원으로 올려도 "원래 가격 복원"이므로 저항 최소 |
| **가치 인식 보호** | 990원이지만 "3,900원 가치"로 인식 → 서비스 신뢰도 유지 |

#### 가격 로드맵

```
Phase 1 (런칭): 정가 3,900원 / 얼리버드 990원 (선착순 500명)
  → 볼륨 확보, PMF 검증, SEO 자산 축적, 바이럴

Phase 2 (500명 달성): 정가 3,900원 / 할인가 1,900원
  → "얼리버드 종료, 아직 50% 할인 중" 프레이밍

Phase 3 (검증 완료): 정가 3,900원
  → 또는 3,900원(기본) / 7,900원(프리미엄) 2티어 확장
```

각 Phase 전환 시 유저 반응 데이터 기반으로 판단.

---

## 12. SEO 최적화 — 리포트 페이지 검색 노출

### 11.1 현재 상태

| 항목 | 상태 | 비고 |
|------|:---:|------|
| 리포트 페이지 `robots` | ✅ noindex 없음 | 크롤링 허용 상태 |
| `sitemap.xml` | ✅ 리포트 포함 | 최대 1,000개 동적 수집 |
| OG 메타데이터 | ✅ 완성 | 주소, 업종, 점수, OG 이미지 |
| `robots.txt` | ⚠️ `/analyze` disallow | 분석 페이지는 크롤링 제외 (정상) |
| 리포트 canonical URL | ✅ 있음 | `SITE_CONFIG.url/report/[id]` |

**현재 리포트 페이지는 이미 SEO 기본 인프라가 갖춰져 있음.**

### 11.2 개선 필요 사항

#### (1) 구조화된 데이터 (JSON-LD)

검색 결과에 리치 스니펫으로 노출되려면 구조화된 데이터 추가 필요.

```typescript
// report/[id]/page.tsx에 추가
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: `${report.address} ${report.industryName} 창업 분석`,
  description: `종합 점수 ${report.totalScore}점`,
  author: { "@type": "Organization", name: "스팟리" },
  datePublished: report.createdAt,
};

// <script type="application/ld+json"> 삽입
```

#### (2) 키워드 최적화

리포트 제목/메타 형식을 검색 의도에 맞게 조정:

```
현재: "성수동1가 카페 창업 분석"
개선: "성수동 카페 창업 입지 분석 | 종합 87점 | 스팟리"
```

타겟 키워드 예시:
- `[동네] [업종] 창업 분석`
- `[동네] 상권 분석`
- `[동네] [업종] 창업 입지`

#### (3) 네이버 서치어드바이저 등록

구글은 sitemap 자동 발견하지만, 네이버는 수동 등록 필요:
- https://searchadvisor.naver.com/ 에서 사이트 등록
- sitemap.xml 제출
- 한국 검색 트래픽의 대부분이 네이버이므로 필수

#### (4) 리포트 수가 SEO의 핵심

리포트가 많을수록 롱테일 키워드 커버리지 증가:
- 10개 리포트 → 10개 검색 키워드
- 1,000개 리포트 → 1,000개 검색 키워드 (복리 효과)
- 무료 분석 제공으로 리포트 양 확보 → SEO 자산 축적

---

## 13. 카카오톡 공유 기능

### 12.1 현재 상태

공유하기 기능 **미구현**. (`share` 관련 코드 없음)

### 12.2 구현 계획

#### (1) 리포트 페이지 공유 버튼

```
[공유하기] 클릭 → 카카오톡 공유 (Kakao SDK sendDefault)
```

카카오톡 메시지 템플릿:

```
┌─────────────────────────────┐
│ [OG 이미지: 성수동 카페 87점] │
│                             │
│ 성수동 카페 창업 점수 87점!    │
│ AI가 분석한 상권 리포트 보기   │
│                             │
│ [리포트 보기]  [나도 분석하기]  │
└─────────────────────────────┘
```

- "리포트 보기" → `/report/[id]` (리포트 조회, SEO에도 기여)
- "나도 분석하기" → `/` (신규 유저 유입)

#### (2) Web Share API 폴백

카카오 SDK 없는 환경 (토스 WebView 포함) 대비:

```typescript
if (navigator.share) {
  await navigator.share({
    title: `${address} ${industry} 창업 분석 | 스팟리`,
    text: `종합 점수 ${score}점! AI 상권 분석 리포트를 확인해보세요.`,
    url: `https://spotly-beta.vercel.app/report/${id}`,
  });
}
```

#### (3) 분석 결과 페이지 공유

AI 리포트 생성 전 무료 분석 결과도 공유 가능하게:

```
"이 동네 카페 창업 점수 87점이래! 너도 해봐"
→ 링크 클릭 → 분석 결과 페이지 (로그인 필요 없음)
→ "AI 리포트도 받아볼래?" → 가입/결제 유도
```

### 12.3 바이럴 루프

```
유저 A: 분석 실행 → 리포트 생성 → 카톡 공유
    ↓
유저 B: 카톡에서 클릭 → 리포트 구경 → "나도 해볼까?"
    ↓
유저 B: 분석 실행 → 리포트 생성 → 카톡 공유
    ↓
유저 C, D, E...
```

---

## 14. 3대 채널 시너지

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  앱인토스     │     │    SEO      │     │  카톡 공유    │
│ (유저 유입)   │────→│ (검색 유입)  │←────│ (바이럴 유입) │
│ 토스페이 결제  │     │  복리 성장   │     │  유저→유저   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ↓
                    리포트 생성 (공통)
                    → DB 저장 → sitemap → 검색 노출
                    → 공유 → 신규 유저 → 리포트 생성 → ...
```

- 토스에서 만든 리포트 → DB 저장 → sitemap에 포함 → 검색 노출 (※ 토스 WebView 내부가 아닌, Vercel 서버의 `/report/[id]` 경로)
- 웹에서 분석한 리포트 → 카톡 공유 → 신규 유저
- 공유로 들어온 유저 → 토스에서 재방문 → 결제

---

## 15. 전략 요약: 왜 토스 먼저인가

### 15.1 현재 상황

```
서비스 완성 → 무료 전환 → 로그인 유도 → 그래도 유저 없음
  ↓
카페 홍보, 당근마켓, 쇼츠 제작 → 효과 미미
  ↓
채널 자체가 없는 상태에서 마케팅 다각화는 무의미
```

**핵심 병목: 채널 부재.** 좋은 서비스가 있어도 사람 앞에 놓이지 않으면 존재하지 않는 것과 같다.

### 15.2 왜 마케팅 다각화가 아닌 토스인가

| 접근 | 기대 효과 | 문제 |
|------|----------|------|
| 블로그/카페 홍보 | 소수 유입 | 이미 해봄. 효과 미미 |
| 유튜브 쇼츠 | 바이럴 가능성 | 이미 해봄. 효과 미미 |
| 인스타/틱톡 광고 | 타겟팅 가능 | 광고비 필요. 수익 모델 없는 상태에서 출혈 |
| SEO | 복리 성장 | 리포트가 없으면 인덱싱할 콘텐츠 자체가 없음 |
| **앱인토스** | **3천만 유저 직접 노출** | **엔지니어링 비용 있지만, 채널 문제를 근본적으로 해결** |

마케팅 다각화는 "사람이 온 다음"의 전략이다.
토스는 "사람을 데려오는" 전략이다.

### 15.3 토스가 해결하는 것

```
토스 배포
  ↓
3천만 유저 앞에 노출 → 유료(990원) 결제 발생
  ↓
매출 검증 (PMF) ← 이게 지금 가장 급한 것
  ↓
리포트 DB 축적 → sitemap → SEO 자동 작동 ← 마케팅 비용 0
  ↓
공유 기능 → 카카오톡 바이럴 ← 마케팅 비용 0
  ↓
SEO + 바이럴로 웹 유저도 유입
  ↓
웹에서도 990원 결제 → 매출 채널 2개
  ↓
데이터 기반으로 가격 인상 (1,900원 → 3,900원)
```

### 15.4 실행 우선순위

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase 0 (즉시)
  ── 웹 서비스 결제 연동 (토스페이먼츠)
  ── 얼리버드 990원 UI 적용
  ── 공유하기 기능 구현
  ── SEO 최적화 (JSON-LD, 네이버 서치어드바이저)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase 1 (앱인토스 준비)
  ── 콘솔 등록 + mTLS 인증서 발급
  ── API Routes 추가 (서버 액션 래핑)
  ── CORS 설정
  ── 토스 로그인 API Route 추가 (mTLS + Supabase 세션)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase 2 (앱인토스 배포)
  ── spa/ 디렉토리 + Vite SPA 구축
  ── granite.config.ts 설정
  ── 샌드박스 테스트
  ── UX 라이팅 + 다크패턴 점검
  ── 검수 요청 → 출시
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Phase 3 (성장)
  ── 데이터 기반 가격 최적화
  ── 시드 콘텐츠 30곳 직접 분석
  ── 프리미엄 티어 확장
  ── 마케팅 다각화 (이때부터)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Phase 0은 앱인토스와 무관하게 **지금 바로** 할 수 있는 것들.
웹 결제 + 공유 + SEO는 토스 배포 기다리는 동안 병행 진행.

---

## 16. 작업 이력 (2026-03-20)

### 완료

| 작업 | 상태 | 비고 |
|------|:---:|------|
| 로그인 모달 참고용 고지 문구 | ✅ | 토스 심사 반려 피드백 반영 |
| 로그인 모달 카카오 애드핏 비활성화 | ✅ | 주석 처리 |
| 로그인 모달 무료체험 문구 제거 | ✅ | |
| OAuth 로그인 후 AI 리포트 자동 생성 | ✅ | sessionStorage one-shot 패턴 |
| 리포트 생성 중 네비게이션 차단 | ✅ | beforeunload + popstate |
| 로고3 생성 (600×600, 보라 배경) | ✅ | 앱인토스 아이콘 규격 충족 |
| 리포트 SEO 메타데이터 후킹 포인트 | ✅ | 판정, 매출, 폐업률, 경쟁업체 동적 조합 |
| JSON-LD 구조화 데이터 | ✅ | Article 스키마 |
| sitemap/robots 최적화 | ✅ | 리포트만 크롤링 허용 |
| 구글 서치 콘솔 등록 + sitemap 제출 | ✅ | 색인 요청 완료, 크롤링 확인 |
| 네이버 서치어드바이저 등록 + sitemap 제출 | ✅ | |
| 공유하기 기능 | ✅ | 카카오톡 SDK (모바일) + 클립보드 복사 (PC) |
| 홈 버튼 (리포트 페이지) | ✅ | 뒤로가기 대체 + 뒤로가기 차단 |
| 뒤로가기 버튼 전체 숨김 | ✅ | 5개 페이지 주석 처리 |
| OG 이미지 전면 개편 | ✅ | 원형 게이지 + 종합평가 + scope + summary |
| OG 정사각형 (600×600) | ✅ | 카카오톡 공유용 센터 정렬 레이아웃 |
| 앱인토스 배포 계획서 | ✅ | 전략, 가격, 가치제안, 로드맵 전체 문서화 |
| API Routes 추가 (Phase 1 핵심) | ✅ | `feat/api-routes` 브랜치, 커밋 5b8065c |
| POST /api/analysis | ✅ | executeAnalysis() 래핑, zod 검증 |
| POST /api/report/generate | ✅ | generateReport() 래핑, zod 검증 |
| GET /api/report/[id] | ✅ | Prisma 리포트 조회 (공개 — SEO/공유용) |
| GET /api/history | ✅ | Supabase 인증 필수, 분석 이력 조회 |
| CORS middleware | ✅ | origin 화이트리스트 + OPTIONS preflight |
| 코드 리뷰 + 수정 반영 | ✅ | as 캐스팅→zod, 빈 문자열 CORS 헤더 제거 |
| E2E 테스트 (Playwright) | ✅ | 홈→업종→지역→지도→분석→리포트 전체 에러 0건 |

### 미완료 (다음 작업)

| 작업 | 상태 | 블로커 |
|------|:---:|------|
| 웹 결제 연동 (토스페이먼츠) | ⏳ | 카카오뱅크 정산 계좌 미지원 → 다른 계좌 필요 |
| 얼리버드 990원 UI 적용 | ⏳ | 결제 연동 후 |
| 시드 콘텐츠 20~30곳 | ⏳ | 직접 분석 실행 필요 |
| 앱인토스 콘솔 세팅 | ⏳ | 워크스페이스 생성, 앱 등록 |
| mTLS 인증서 발급 | ⏳ | 콘솔 세팅 후 |
| 토스 로그인 API Route | ⏳ | mTLS 인증서 필요 |
| SPA 프론트엔드 (`spa/`) | ⏳ | Phase 2 |
| 구글 서치 콘솔 sitemap 상태 확인 | ⏳ | "가져올 수 없음" → 1~3일 후 재확인 |
| `feat/api-routes` 브랜치 main 머지 | ⏳ | PR 생성 후 머지 |

---

## 참고 문서

- [앱인토스 개발자센터](https://developers-apps-in-toss.toss.im/)
- [앱인토스 콘솔](https://apps-in-toss.toss.im/)
- [WebView 튜토리얼](https://developers-apps-in-toss.toss.im/tutorials/webview.html)
- [토스 로그인 개발](https://developers-apps-in-toss.toss.im/login/develop.html)
- [토스 로그인 콘솔 설정](https://developers-apps-in-toss.toss.im/login/console.html)
- [토스 로그인 QA](https://developers-apps-in-toss.toss.im/login/qa.html)
- [미니앱 브랜딩 가이드](https://developers-apps-in-toss.toss.im/design/miniapp-branding-guide.md)
- [UX 라이팅 가이드](https://developers-apps-in-toss.toss.im/design/ux-writing.html)
- [다크패턴 방지 정책](https://developers-apps-in-toss.toss.im/design/consumer-ux-guide.md)
- [미니앱 출시](https://developers-apps-in-toss.toss.im/development/deploy.md)
- [Vercel CORS 설정](https://vercel.com/kb/guide/how-to-enable-cors)
- [Next.js Building APIs](https://nextjs.org/blog/building-apis-with-nextjs)
- [Server Actions vs Route Handlers](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers)
- [Supabase admin.createUser()](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [앱인토스 예제 저장소](https://github.com/toss/apps-in-toss-examples)
