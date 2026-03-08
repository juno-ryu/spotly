# Design: auth (사용자 인증)

> 작성일: 2026-03-08
> 참조: docs/01-plan/features/auth.plan.md

---

## 1. 아키텍처 개요

```
[브라우저]
  └── supabase.auth.signInWithOAuth('google')
        ↓ redirect
[Google OAuth]
        ↓ callback
[/auth/callback] (Next.js Route Handler)
  └── supabase.auth.exchangeCodeForSession()
        ↓
[Next.js 미들웨어] (모든 요청)
  └── supabase.auth.getUser() → 세션 갱신
        ↓
[Server Action / API Route]
  └── createServerClient() → getUser()
        ↓
[Prisma] AnalysisRequest.userId = user.id
```

---

## 2. 파일 구조

```
src/
├── middleware.ts                          # 신규: 세션 갱신 미들웨어
├── server/
│   └── supabase/
│       ├── server.ts                      # 신규: Server Component용 클라이언트
│       ├── browser.ts                     # 신규: Client Component용 클라이언트
│       └── middleware.ts                  # 신규: 미들웨어용 클라이언트
├── features/
│   └── auth/
│       ├── actions.ts                     # 신규: signIn / signOut Server Action
│       └── components/
│           ├── login-button.tsx           # 신규: Google 로그인 버튼
│           └── user-menu.tsx             # 신규: 로그인 상태 표시 + 로그아웃
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts                   # 신규: OAuth 콜백 처리
│   └── (main)/
│       ├── history/
│       │   └── page.tsx                   # 신규: 내 분석 내역
│       └── page.tsx                       # 수정: 로그인 버튼 추가
└── lib/
    └── env.ts                             # 수정: Supabase 환경변수 추가
prisma/
└── schema.prisma                          # 수정: userId 필드 추가
```

---

## 3. 환경변수

```bash
# .env 추가
NEXT_PUBLIC_SUPABASE_URL=https://dhvzjhlkfpeeuwuthvvi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # Supabase 대시보드 > Project Settings > API
```

`src/lib/env.ts` 추가:
```typescript
NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
```

---

## 4. Prisma Schema 변경

```prisma
model AnalysisRequest {
  // ... 기존 필드 유지 ...

  /// Supabase Auth 사용자 ID (비로그인 시 null)
  userId        String?

  // ... 기존 필드 유지 ...

  @@index([userId])  // 추가
}
```

마이그레이션:
```bash
npx prisma migrate dev --name add-user-id-to-analysis
```

---

## 5. Supabase 클라이언트 유틸

### `src/server/supabase/server.ts`
```typescript
// Server Component, Server Action, Route Handler에서 사용
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### `src/server/supabase/browser.ts`
```typescript
// Client Component에서 사용 (싱글톤)
import { createBrowserClient } from '@supabase/ssr'

export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
```

### `src/server/supabase/middleware.ts`
```typescript
// middleware.ts 전용
import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'

export function createSupabaseMiddleware(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}
```

---

## 6. 미들웨어

### `src/middleware.ts`
```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseMiddleware } from '@/server/supabase/middleware'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createSupabaseMiddleware(request, response)

  // 세션 갱신 (getUser 호출이 핵심 — 토큰 자동 refresh)
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

## 7. OAuth 콜백 라우트

### `src/app/auth/callback/route.ts`
```typescript
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/server/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseServer()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/`)
}
```

---

## 8. Auth Server Actions

### `src/features/auth/actions.ts`
```typescript
'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/server/supabase/server'

export async function signInWithGoogle() {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error || !data.url) throw new Error('Google 로그인 실패')
  redirect(data.url)
}

export async function signOut() {
  const supabase = await createSupabaseServer()
  await supabase.auth.signOut()
  redirect('/')
}
```

---

## 9. UI 컴포넌트

### `src/features/auth/components/login-button.tsx`
```typescript
// Server Component
import { signInWithGoogle } from '../actions'

export function LoginButton() {
  return (
    <form action={signInWithGoogle}>
      <button type="submit" className="...">
        Google로 시작하기
      </button>
    </form>
  )
}
```

### `src/features/auth/components/user-menu.tsx`
```typescript
// Server Component
import { createSupabaseServer } from '@/server/supabase/server'
import { signOut } from '../actions'

export async function UserMenu() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{user.email}</span>
      <form action={signOut}>
        <button type="submit" className="text-sm ...">로그아웃</button>
      </form>
    </div>
  )
}
```

---

## 10. analysis actions.ts 수정

`startAnalysis` 함수에서 현재 유저 조회 후 userId 연결:

```typescript
// 기존 import에 추가
import { createSupabaseServer } from '@/server/supabase/server'

export async function startAnalysis(input: AnalysisRequest) {
  // ... 기존 validation 코드 ...

  // 현재 로그인 유저 조회 (비로그인이면 null)
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const analysis = await prisma.analysisRequest.create({
    data: {
      // ... 기존 필드 ...
      userId: user?.id ?? null,  // 추가
    },
  })

  // ... 이하 기존 코드 동일 ...
}
```

---

## 11. history 페이지

### `src/app/(main)/history/page.tsx`
```typescript
import { createSupabaseServer } from '@/server/supabase/server'
import { prisma } from '@/server/db/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HistoryPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // 비로그인 → 홈으로
  if (!user) redirect('/')

  const analyses = await prisma.analysisRequest.findMany({
    where: { userId: user.id, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      address: true,
      industryName: true,
      totalScore: true,
      createdAt: true,
    },
  })

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">내 분석 내역</h1>
      {analyses.length === 0 ? (
        <p className="text-muted-foreground text-sm">분석 내역이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {analyses.map((a) => (
            <li key={a.id}>
              <Link href={`/analyze/${a.id}`} className="block rounded-xl border p-4 hover:bg-muted/50">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{a.address}</p>
                    <p className="text-xs text-muted-foreground">{a.industryName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-violet-600">{a.totalScore?.toFixed(0)}점</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

---

## 12. 구현 순서

1. `npm install @supabase/supabase-js @supabase/ssr`
2. `.env` 환경변수 추가 (Supabase 대시보드에서 값 복사)
3. Supabase 대시보드 > Authentication > Providers > Google 활성화
4. Google Cloud Console에서 OAuth 앱 생성, redirect URI 등록
5. `src/server/supabase/` 유틸 3개 파일 생성
6. `src/middleware.ts` 생성
7. `prisma/schema.prisma` `userId` 추가 → `npx prisma migrate dev`
8. `src/app/auth/callback/route.ts` 생성
9. `src/features/auth/actions.ts` 생성
10. `src/features/auth/components/` UI 컴포넌트 생성
11. `src/features/analysis/actions.ts` 수정 (userId 연결)
12. `src/app/(main)/history/page.tsx` 생성
13. 메인 페이지에 LoginButton / UserMenu 추가

---

## 13. 완료 기준

- [ ] Google 로그인 버튼 클릭 → Google 계정 선택 → 앱으로 복귀
- [ ] 로그인 상태에서 분석 실행 → DB `userId` 저장 확인
- [ ] `/history` 접속 → 내 분석 내역 목록 표시
- [ ] 비로그인 사용자 분석 실행 → `userId = null`로 정상 저장
- [ ] 로그아웃 후 `/history` 접속 → 홈으로 redirect
