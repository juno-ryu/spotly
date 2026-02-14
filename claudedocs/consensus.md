# 프로젝트 분석 합의 사항

> **일자:** 2026-02-07
> **참여:** Claude Code (Opus 4.6) + Cursor AI
> **대상:** `/Users/juno/work/my` (Next.js 스타터 프로젝트)

---

## 합의 완료 항목

### 라이브러리 관련

| 항목 | 결론 | 근거 |
|------|------|------|
| **radix-ui** | ✅ 정상 패키지, 유지 | npm 레지스트리에 `radix-ui@1.4.3` 공식 등록. shadcn/ui 통합 패키지 |
| **react-use** | ⚠️ 즉시 제거는 아님, 대안 교체 검토 | `architecture.mdc`에 필수 라이브러리로 지정됨. 단, 1년 이상 업데이트 없어 유지보수 중단 상태 |
| **HTTP 클라이언트** | ✅ fetch 기반 유지 (ky/axios 불필요) | Next.js의 fetch 확장(캐싱/재검증)과 정합성이 높음 |
| **Zod** | ✅ v4 업그레이드 권장 | 파싱 성능 6~14배 향상. `zod/v4` 서브패스로 점진적 마이그레이션 가능 |

### 설정/인프라 관련

| 항목 | 결론 | 근거 |
|------|------|------|
| **ESLint flat config** | ✅ 즉시 추가 필요 | ESLint 9 설치됐으나 `eslint.config.mjs` 누락 |
| **환경 변수 검증** | ✅ 추가 필요 | `NEXT_PUBLIC_API_URL` 빈 문자열 시 `new URL()` 예외 가능 |
| **TypeScript target** | ✅ `ES2017` → `ES2022` 상향 | `Object.hasOwn`, `Array.at()` 등 최신 API 타입 지원 |
| **App Router 파일** | ✅ `loading.tsx`, `error.tsx`, `not-found.tsx` 추가 | 프로덕션 앱 필수 파일 |

### 코드 관련

| 항목 | 결론 | 근거 |
|------|------|------|
| **`page.tsx`의 `"use client"`** | ✅ 유지 (프로젝트 규칙 준수) | `global.mdc`에 "always use client component" 규칙 |
| **HTTP 클라이언트 예외 처리** | ✅ 개선 필요 | 빈 URL 예외, 에러 표준화 부족 |

### 최신 버전 (Claude Code만 조사)

| 라이브러리 | 현재 | 최신 | 업그레이드 |
|-----------|------|------|----------|
| Next.js | ^15.1.7 | 16.1.6 | 중기 계획 |
| React | ^19.0.0 | 19.2.4 | 중기 계획 |
| Tailwind CSS | ^4.0.6 | 4.1.18 | 자동 업데이트 |
| Zod | ^3.24.2 | 4.3.6 | 단기 계획 |
| 나머지 | semver 범위 내 | 자동 업데이트 | 별도 조치 불필요 |

---

## 액션 플랜 (합의 기반)

### High

1. `eslint.config.mjs` 추가
2. 환경 변수 검증 추가 (`src/lib/env.ts`)
3. HTTP 클라이언트 빈 URL 예외 처리

### Medium

4. Zod v3 → v4 마이그레이션
5. TypeScript target `ES2017` → `ES2022`
6. App Router 파일 추가 (`loading.tsx`, `error.tsx`, `not-found.tsx`)
7. `react-use` 대안 라이브러리 교체 검토 (아키텍처 룰 업데이트 포함)

### Low

8. Next.js 15 → 16 업그레이드
9. React 19.0 → 19.2 업데이트
10. 테스트 인프라 도입 (Vitest + RTL)
11. Prettier + lint-staged + Husky 구성

---

## 미합의 / 잔여 이슈

- 타 AI 문서(`PROJECT_ANALYSIS.md`) 153행에 "radix-ui 제거 필요" 잔존 (41행과 모순)
- `.claude/rules/` 룰 파일 최신화 필요 (작년 작성, 구식 가능성)
