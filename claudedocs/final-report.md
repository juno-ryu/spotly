# 프로젝트 최신화 최종 보고서

> **일자:** 2026-02-07
> **실행:** Claude Code (Opus 4.6)
> **근거:** consensus.md, service-analysis.md, project_analysis.md 합의 내용

---

## 1. 패키지 버전 업그레이드

| 패키지 | Before | After | 변경 유형 |
|--------|--------|-------|-----------|
| **next** | ^15.1.7 | ^16.1.6 | Major |
| **react** | ^19.0.0 | ^19.2.4 | Minor |
| **react-dom** | ^19.0.0 | ^19.2.4 | Minor |
| **zod** | ^3.24.2 | ^4.3.6 | Major |
| **@hookform/resolvers** | ^3.9.1 | ^5.2.2 | Major |
| **lucide-react** | ^0.474.0 | ^0.563.0 | Minor |
| **@types/node** | ^22.13.2 | ^25.2.1 | Major |
| **@types/react** | ^19.0.8 | ^19.2.13 | Minor |
| **eslint-config-next** | ^15.1.7 | ^16.1.6 | Major |
| **tailwindcss** | ^4.0.6 | ^4.1.18 | Minor |
| **@tailwindcss/postcss** | ^4.0.6 | ^4.1.18 | Minor |
| **react-use** | ^17.6.0 | 삭제 | 제거 |
| **@uidotdev/usehooks** | (없음) | ^2.4.1 | 신규 |

---

## 2. 룰 파일 변경 (`.claude/rules/`)

### 2.1 `global.mdc`

| 항목 | Before | After |
|------|--------|-------|
| Component 기본 | `"always use client component"` | Server Component 기본, 필요시만 `"use client"` |
| enum 규칙 | (없음) | TypeScript `enum` 금지, `as const` 패턴 필수 |
| 한글 JSDoc | (없음) | 비즈니스 도메인 값에 한글 JSDoc 필수 |
| Data Fetching | (없음) | Next.js 네이티브 fetch 기본, Server Action 기본 |
| 환경 변수 | (없음) | `src/lib/env.ts`에서 zod 검증 |
| AI 프롬프트 템플릿 | Solution Process 섹션 존재 | 제거 |
| Tailwind v4 설치 명령어 | 설치 명령어 + PostCSS 예시 | 제거 (이미 설치) |
| shadcn 명령어 | `npx shadcn@latest add` | `npx shadcn add` |

### 2.2 `architecture.mdc`

| 항목 | Before | After |
|------|--------|-------|
| React Query | 필수 (3번) | **선택적** (Optional 카테고리) |
| `react-use` | 필수 (5번) | `@uidotdev/usehooks`로 교체 |
| `@dayjs` | 잘못된 패키지명 | `dayjs` (정정) |
| Library 카테고리 | 단일 목록 11개 | Core/UI/Form/Optional 4개 카테고리 15개 |
| Data Fetching 전략 | (없음) | Server Component fetch / Server Action / React Query(선택) |
| Directory Structure | 기본 구조만 | `enums/`, `api-types.ts`, `env.ts`, `actions.ts`, `queries/` 추가 |
| Enum Pattern | (없음) | `as const` + 타입 추출 패턴 + 코드 예시 |
| 누락 라이브러리 | 11개 | `@hookform/resolvers`, `radix-ui`, `class-variance-authority`, `clsx`+`tailwind-merge` 추가 |

### 2.3 `new-feature-process.mdc`

| 항목 | Before | After |
|------|--------|-------|
| 존재하지 않는 참조 | supabase, auth, LoginPage 등 | 전부 제거, 실제 파일만 참조 |
| API 패턴 | `httpClient` 전용 | Server Component fetch + URI+tag 한 쌍 관리 |
| 뮤테이션 | (없음) | Server Action (`actions.ts`) 기본 |
| React Query | queries/ 필수 | queries/ 선택적 (폴링, 무한스크롤 시에만) |
| 환경 변수 | `NEXT_PUBLIC_API_URL` 직접 사용 | `env.API_URL` (서버 전용, zod 검증) |
| Process | 4단계 | 7단계 (schema → api → actions → components → page → queries) |

---

## 3. 신규 파일 생성

| 파일 | 목적 |
|------|------|
| `src/lib/env.ts` | 환경 변수 zod 검증 (`API_URL`, `NEXT_PUBLIC_API_URL`) |
| `src/constants/api-types.ts` | 페이지네이션/정렬 공통 zod 스키마 (레거시 `service/input/output` 패턴 채택) |
| `src/app/loading.tsx` | App Router 로딩 UI |
| `src/app/error.tsx` | App Router 에러 UI |
| `src/app/not-found.tsx` | App Router 404 UI |
| `eslint.config.mjs` | ESLint 9 flat config (Next.js 16 호환) |

---

## 4. 기존 파일 수정

| 파일 | 변경 내용 |
|------|-----------|
| `tsconfig.json` | `target: ES2017` → `ES2022`, `jsx: preserve` → `react-jsx` (Next.js 16 자동 설정) |
| `src/app/page.tsx` | `"use client"` 제거 (Server Component로 전환) |
| `src/remote/client.ts` | `HttpError` 커스텀 에러 클래스 추가, 빈 URL 예외 처리 개선, 역할 명시 주석 |
| `src/hooks/use-mounted.ts` | `useState+useEffect` → `useSyncExternalStore` (React 19.2 lint 규칙 대응) |

---

## 5. 삭제

| 대상 | 사유 |
|------|------|
| `/service` 디렉토리 전체 | 레거시 구조. 패턴만 채택(URI+tag, 페이지네이션 타입, as const enum), 구현체 폐기 |
| `react-use` 패키지 | 유지보수 중단(1년+), `@uidotdev/usehooks`로 교체 |

---

## 6. 검증 결과

| 검증 | 결과 |
|------|------|
| `npm run build` | ✅ 성공 (Next.js 16.1.6 Turbopack) |
| `npx eslint src/` | ✅ 0 errors, 0 warnings |
| TypeScript | ✅ 타입 체크 통과 |

---

## 7. 반영 근거 매핑

| 근거 문서 | 반영 항목 |
|----------|-----------|
| **consensus.md** High #1 | ESLint flat config 추가 |
| **consensus.md** High #2 | 환경 변수 검증 (`src/lib/env.ts`) |
| **consensus.md** High #3 | HTTP 클라이언트 빈 URL 예외 처리 |
| **consensus.md** Medium #4 | Zod v3 → v4 |
| **consensus.md** Medium #5 | TypeScript target ES2022 |
| **consensus.md** Medium #6 | App Router 파일 추가 |
| **consensus.md** Medium #7 | `react-use` → `@uidotdev/usehooks` |
| **consensus.md** Low #8 | Next.js 15 → 16 |
| **consensus.md** Low #9 | React 19.0 → 19.2 |
| **service-analysis.md** 합의 | URI+tag 패턴, 페이지네이션/정렬 타입, as const enum, React Query 선택적 |
| **service-analysis.md** 제안 | Next.js 네이티브 fetch 기본, Server Action 기본 |
| **project_analysis.md** | 라이브러리 버전 업그레이드 전반 |

---

## 8. 미반영 (향후 검토)

| 항목 | 사유 |
|------|------|
| Prettier + lint-staged + Husky | consensus.md Low 우선순위. 별도 세션에서 작업 |
| 테스트 인프라 (Vitest + RTL) | consensus.md Low 우선순위. 실제 feature 개발 시 도입 |
| ESLint 9 → 10 | eslint-config-next@16이 ESLint 9를 사용 중. 호환성 확인 후 |
