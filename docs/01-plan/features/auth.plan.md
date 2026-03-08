# Plan: auth (사용자 인증)

> 작성일: 2026-03-08
> 레벨: Dynamic
> 상태: Plan 완료

---

## 1. 목표

Supabase Auth를 활용한 Google OAuth 로그인 기능을 추가한다.
로그인한 사용자는 본인의 분석 내역을 조회할 수 있다.

---

## 2. 현황 분석

### 현재 구조

- Supabase PostgreSQL을 DB 호스팅으로만 사용 (연결 URL만 있음)
- Supabase Auth, Supabase SDK 미설치
- 인증 관련 코드 전무
- `AnalysisRequest` 모델에 `userId` 필드 없음 → 분석 결과 소유자 구분 불가
- history 페이지(`/history`) UI는 라우트 존재하지 않음

### 기술 스택 현황

```
Next.js 16 (App Router) + TypeScript + Prisma 6 + Supabase PostgreSQL
```

---

## 3. 요구사항

### 필수 (MVP)

- [ ] Google OAuth 로그인/로그아웃
- [ ] 로그인 상태에서 분석 시 userId 연결
- [ ] 내 분석 내역 조회 (`/history`)
- [ ] 비로그인 사용자도 분석 가능 (userId nullable)

### 선택 (추후)

- [ ] 카카오 OAuth
- [ ] 분석 결과 즐겨찾기
- [ ] 분석 공유 링크

---

## 4. 기술 결정

### 인증 방식: Supabase Auth

**선택 근거:**
- 이미 Supabase 프로젝트 운영 중 → 추가 인프라 없음
- Supabase 대시보드에서 Google OAuth 설정 몇 분이면 완료
- `@supabase/ssr` 패키지가 Next.js App Router 공식 지원
- Prisma Schema 변경 최소 (`userId` 필드 하나 추가)

**Auth.js 대비 장점:**
- Auth.js는 DB에 테이블 4개 추가 필요 (User, Account, Session, VerificationToken)
- Supabase Auth는 자체 `auth.users` 테이블로 관리 → Prisma Schema 오염 없음

**통합 방식:**
```
Supabase Auth → JWT 토큰 → Next.js 미들웨어에서 검증
→ Server Action/API Route에서 getUser() 호출
→ Prisma로 AnalysisRequest.userId 연결
```

---

## 5. 구현 범위

### Phase 1: Supabase Auth 연동

1. `@supabase/supabase-js` + `@supabase/ssr` 설치
2. Supabase 환경변수 추가 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. Supabase 클라이언트 유틸 생성 (server / browser / middleware 3종)
4. Next.js 미들웨어 추가 (세션 갱신)

### Phase 2: DB 스키마 변경

5. `AnalysisRequest`에 `userId String?` 추가 (nullable — 비로그인 허용)
6. `prisma migrate` 실행

### Phase 3: Server Action 연동

7. `startAnalysis` Server Action에서 현재 유저 조회 후 `userId` 연결

### Phase 4: UI

8. 로그인/로그아웃 버튼 (헤더 또는 메인 화면)
9. Google OAuth 팝업/리다이렉트 처리
10. `/history` 페이지 — 내 분석 내역 목록

---

## 6. 영향 범위

| 파일/영역 | 변경 유형 | 비고 |
|----------|----------|------|
| `prisma/schema.prisma` | 수정 | `userId` 필드 추가 |
| `src/lib/env.ts` | 수정 | Supabase 환경변수 추가 |
| `src/server/supabase/` | 신규 | 서버/클라이언트/미들웨어 유틸 |
| `src/middleware.ts` | 신규 | 세션 갱신 미들웨어 |
| `src/features/analysis/actions.ts` | 수정 | userId 연결 로직 |
| `src/features/auth/` | 신규 | 로그인 UI 컴포넌트 |
| `src/app/(main)/history/` | 신규 | 내 분석 내역 페이지 |

---

## 7. 비로그인 정책

- 비로그인 상태에서 분석 실행 → 정상 동작, `userId = null`
- 비로그인 분석 결과는 `/analyze/:id` URL로 직접 접근만 가능
- `/history`는 로그인 필수 → 미로그인 시 로그인 유도

---

## 8. 리스크

| 리스크 | 대응 |
|-------|------|
| Supabase JWT ↔ Prisma 통합 직접 구현 필요 | `@supabase/ssr` 공식 문서 패턴 따름 |
| 기존 분석 데이터 userId 없음 | nullable로 처리, 마이그레이션 불필요 |
| Google OAuth 콘솔 설정 필요 | Google Cloud Console redirect URI 설정 필요 |

---

## 9. 완료 기준

- [ ] Google 계정으로 로그인/로그아웃 가능
- [ ] 로그인 후 분석 실행 시 DB에 userId 저장
- [ ] `/history`에서 내 분석 내역 목록 표시
- [ ] 비로그인 사용자도 분석 실행 가능
