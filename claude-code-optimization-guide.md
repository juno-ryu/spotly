# Claude Code 극한 활용 가이드 & CLAUDE.md 최적화 전략

> 2026년 2월 기준 웹 리서치 기반 종합 분석 리포트 (2026-02-21 최종 업데이트)
> 대상 프로젝트: 창업 분석기 (Startup Analyzer)

---

## 목차

1. [CLAUDE.md 계층 구조](#1-claudemd-계층-구조)
2. [현재 프로젝트 진단](#2-현재-프로젝트-진단)
3. [CLAUDE.md 토큰 비용 최적화](#3-claudemd-토큰-비용-최적화)
4. [rules 파일 재구조화](#4-rules-파일-재구조화)
5. [멀티 에이전트 오케스트레이션](#5-멀티-에이전트-오케스트레이션)
6. [서브에이전트 역할 분담 전략](#6-서브에이전트-역할-분담-전략)
7. [Hooks 자동화 (선택적)](#7-hooks-자동화-선택적)
8. [비용 절감 실전 전략](#8-비용-절감-실전-전략)
9. [실행 계획 (Action Items)](#9-실행-계획)

---

## 1. CLAUDE.md 계층 구조

### 확정된 4단계 구조

Claude Code는 현재 작업 디렉토리에서 루트까지 모든 CLAUDE.md를 재귀적으로 탐색하여 **매 턴마다 전부 주입**한다. 따라서 각 레벨에는 해당 레벨에서만 의미 있는 내용만 배치한다.

```
~/.claude/CLAUDE.md              ← 글로벌 (모든 프로젝트)
~/automata/CLAUDE.md             ← 회사 프로젝트 공통 (TravelFlan)
~/work/CLAUDE.md                 ← 개인 프로젝트 공통
~/work/my/CLAUDE.md              ← 프로젝트 전용 (창업 분석기)
```

### 각 레벨별 역할과 확정 내용

**글로벌 (`~/.claude/CLAUDE.md`)** — 스택/프로젝트 무관, 모든 대화에 적용

```markdown
# Global Instructions

## 언어 정책

- **모든 응답은 한국어(한글)로 작성한다.**
- 코드 주석은 한국어로 작성한다.
- 기술 용어는 영어 병기 가능 (예: "상태 관리(State Management)").
- 에러 메시지/로그는 원문 유지, 설명은 한국어로 작성한다.

## AI 작업 규칙

- **코드를 건드리기 전에 반드시 현재 파일 상태를 먼저 읽어서 확인한다.** 추측으로 코드 구조나 파일명을 지어내지 않는다.
- 사용자가 명시적으로 실행을 요청하기 전까지 코드를 수정하지 않는다. 설명/확인이 먼저다.
- 사용자 의견에 무조건 동의하지 않는다. 근거 있는 자기 의견을 말하되, 틀리면 바로 인정한다.

## 작업 방식

- **점진적 작업**: 한번에 큰 변경 금지. 파일 1~2개씩 수정하고 중간 확인할 것.
- **기존 코드 우선 파악**: 구현 전에 반드시 기존 코드와 패턴을 먼저 확인하고, 그 패턴을 따를 것.
- **명확한 코드**: 영리한 코드보다 읽기 쉽고 의도가 분명한 코드를 작성할 것.

## 커밋 메시지

컨벤셔널 커밋 형식 (영어): feat: / fix: / refactor: / style: / test: / docs: / chore:

## 핵심 마인드셋

1. 단순성(Simplicity)
2. 가독성(Readability)
3. 함수형 패러다임(Functional Paradigm)
4. 실용주의(Pragmatism)

## 코드 가이드라인

- 조기 반환(Early Returns)
- 함수형 & 불변성, 순수 함수
- 상속보다 합성
- "무엇"이 아닌 "왜"를 문서화한다.
- 에러는 예외보다 에러 반환 방식 선호.
```

**회사 (`~/automata/CLAUDE.md`)** — TravelFlan Azure DevOps 환경 전용

```markdown
# TravelFlan 공통 규칙

- 모든 Git 작업은 **az CLI** 사용 (`gh CLI` 금지)
- PR 생성 후 **Teams 메시지 출력 필수** (형식: `.claude/rules/pr-workflow.md`)
- PR 리뷰 후 **자동으로 코드를 수정하지 않는다** — 사용자 요청 시에만 수정

## 작업별 필수 참조 규칙

- **PR 생성 시** → `.claude/rules/pr-workflow.md` 참조
- **PR 리뷰 시** → `.claude/rules/pr-review.md` 참조
```

**개인 프로젝트 공통 (`~/work/CLAUDE.md`)** — GitHub 기반 개인 프로젝트

```markdown
# 개인 프로젝트 공통 규칙

## Git (CRITICAL)

- 모든 Git 작업은 **gh CLI** 사용 (`az CLI` 금지)
- 커밋, 푸시, 브랜치, PR 생성/조회/리뷰 등 예외 없음
```

**프로젝트 전용 (`~/work/my/CLAUDE.md`)** — 창업 분석기 프로젝트만

```markdown
# 창업 분석기 (Startup Analyzer)

소상공인 창업 입지 분석 서비스. 주소+업종 입력 → 공공 API 수집 → 5대 지표 100점 만점 → Claude AI 리포트.

## 기술 스택

Next.js 16 (App Router) | TypeScript 5.7 | React 19 | PostgreSQL + Prisma 6 | Upstash Redis
Claude API (haiku-4-5) | shadcn-ui + Tailwind 4 | Recharts | Kakao Maps | react-hook-form + zod
zustand | dayjs | ts-pattern | es-toolkit | npm

## 작업별 필수 참조 규칙

- **프론트엔드 작업 시** → `.claude/rules/frontend.md` 참조
- **백엔드/API 작업 시** → `.claude/rules/backend.md` 참조
- **코드 작성 시** → `.claude/rules/code-style.md` 참조
- **새 기능 구현 시** → `.claude/rules/nextjs-patterns.md` 참조
- **⛔ .ts/.tsx 파일은 Serena MCP 필수** → `.claude/rules/serena.md` 참조 (Read/Grep/Edit 금지)
- **프로젝트 구조 파악 필요 시** → `PROJECT_INDEX.md` 참조
```

**핵심**: 프로젝트 CLAUDE.md는 **프로젝트 소개 + 기술 스택 + 룰 참조 지시**만 남긴다. 분석 플로우, DB 스키마, 외부 API 등은 `PROJECT_INDEX.md`에 별도 관리하고, Claude가 필요 시 Read로 참조한다.

### 레벨 분류 원칙

| 질문                             | Yes →    | No → |
| -------------------------------- | -------- | ---- |
| 모든 프로젝트(회사 포함)에 적용? | 글로벌   | ↓    |
| 회사 프로젝트 전체에 적용?       | automata | ↓    |
| 개인 프로젝트 전체에 적용?       | work     | ↓    |
| 이 프로젝트에서만 필요?          | 프로젝트 | —    |

### 장기 세션 규칙 망각 대책

CLAUDE.md는 매 턴 주입되지만, rules 파일은 세션 초에만 읽힘. 장기 세션에서 Claude가 규칙을 까먹는 문제 해결:

**CLAUDE.md에 "작업별 필수 참조 규칙"을 명시적으로 기술한다.**

이 패턴은 매 턴 주입되므로 Claude가 해당 작업을 만나면 규칙을 다시 읽게 된다.

---

## 2. 현재 프로젝트 진단

### Before (최적화 전) — rules 7개, ~69KB

| 파일                     | 크기       | 라인 수   | 상태                                                  |
| ------------------------ | ---------- | --------- | ----------------------------------------------------- |
| `CLAUDE.md`              | ~9.7KB     | 161줄     | ⚠️ 경량화 필요                                        |
| `global.md`              | 5.2KB      | 137줄     | ❌ 삭제됨 (글로벌 CLAUDE.md로 이동)                   |
| `architecture.md`        | 3.5KB      | 91줄      | ❌ 삭제됨 (nextjs-patterns.md + code-style.md에 흡수) |
| `new-feature-process.md` | 4.4KB      | 103줄     | ❌ 삭제됨 (nextjs-patterns.md에 합침)                 |
| `api-health-check.md`    | 4.2KB      | 95줄      | ❌ 삭제됨 (불필요)                                    |
| `backend.md`             | **21.8KB** | **676줄** | ⚠️ 분할 필요                                          |
| `frontend.md`            | **13.9KB** | **446줄** | ⚠️ 분할 필요                                          |

### After (현재) — CLAUDE.md 24줄 + rules 9개 + agents 4개

| 파일                     | 로딩 방식                                                             | 비고                                         |
| ------------------------ | --------------------------------------------------------------------- | -------------------------------------------- |
| **CLAUDE.md**            | 매 턴 주입                                                            | 162줄 → 24줄 (85% 절감)                      |
| `code-style.md`          | 항상                                                                  | 네이밍 규칙 + enum 패턴                      |
| `serena.md`              | 항상                                                                  | Serena MCP 도구 규칙                         |
| `nextjs-patterns.md`     | `paths: ["src/**"]`                                                   | Next.js 패턴 + API 예시 + 구현 프로세스      |
| `backend-data.md`        | `paths: ["src/server/data-sources/**"]`                               | Client-Adapter 패턴, 외부 API 연동, 헬스체크 |
| `backend-api.md`         | `paths: ["src/app/api/**", "src/features/*/actions.ts"]`              | Server Action, API Route, 에러 처리, 보안    |
| `backend-cache.md`       | `paths: ["src/server/cache/**", "src/server/db/**", "prisma/**"]`     | Redis, Prisma                                |
| `frontend-components.md` | `paths: ["src/features/*/components/**", "src/app/**/page.tsx", ...]` | 컴포넌트, 훅, 상태관리                       |
| `frontend-forms.md`      | `paths: ["src/features/*/schema.ts", "analysis-form*", "actions.ts"]` | 폼, zod 스키마, env.ts                       |

**삭제된 7개 파일과 흡수처:**

| 삭제된 파일              | 내용 흡수처                                               |
| ------------------------ | --------------------------------------------------------- |
| `global.md`              | `~/.claude/CLAUDE.md` (글로벌 레벨로 승격)                |
| `architecture.md`        | `nextjs-patterns.md` + `code-style.md`                    |
| `new-feature-process.md` | `nextjs-patterns.md`                                      |
| `api-health-check.md`    | `backend-data.md` (헬스체크 섹션)                         |
| `backend.md` (676줄)     | `backend-api.md` + `backend-data.md` + `backend-cache.md` |
| `frontend.md` (446줄)    | `frontend-components.md` + `frontend-forms.md`            |

### 벤치마크 비교

- CLAUDE.md는 **60~200줄** 이내 권장 → 현재 **24줄** ✅
- 개별 rules 파일은 **100~150줄** 이내 권장 → 최대 파일 ~150줄 ✅
- 총 rules 용량은 **30KB 이내** 권장 → 작업별 ~2~8KB 선택 로딩 ✅

---

## 3. CLAUDE.md 토큰 비용 최적화

### 핵심 원칙: "매 턴 주입되는 것은 최소한만"

CLAUDE.md는 매 API 콜마다 컨텍스트에 포함되므로, **가장 비싼 부동산**이다. 프로젝트 정보나 비즈니스 로직은 Claude가 코드를 읽으면 파악 가능하다. CLAUDE.md에는 **"어떤 작업을 할 때 어떤 룰을 읽어라"** 지시만 남긴다.

### 프로젝트 CLAUDE.md 확정본 (20줄, ~1KB)

```markdown
# 창업 분석기 (Startup Analyzer)

소상공인 창업 입지 분석 서비스. 주소+업종 입력 → 공공 API 수집 → 5대 지표 100점 만점 → Claude AI 리포트.

## 기술 스택

Next.js 16 (App Router) | TypeScript 5.7 | React 19 | PostgreSQL + Prisma 6 | Upstash Redis
Claude API (haiku-4-5) | shadcn-ui + Tailwind 4 | Recharts | Kakao Maps | react-hook-form + zod
zustand | dayjs | ts-pattern | es-toolkit | npm

## 작업별 필수 참조 규칙

- **프론트엔드 작업 시** → `.claude/rules/frontend.md` 참조
- **백엔드/API 작업 시** → `.claude/rules/backend.md` 참조
- **코드 작성 시** → `.claude/rules/code-style.md` 참조
- **새 기능 구현 시** → `.claude/rules/nextjs-patterns.md` 참조
- **⛔ .ts/.tsx 파일은 Serena MCP 필수** → `.claude/rules/serena.md` 참조 (Read/Grep/Edit 금지)
- **프로젝트 구조 파악 필요 시** → `PROJECT_INDEX.md` 참조
```

**절감 효과**: 9.7KB → ~1KB (약 90% 절감). 30턴 기준 291KB → 30KB.

### CLAUDE.md에서 뺀 것들

| 내용                                  | 이유                                            |
| ------------------------------------- | ----------------------------------------------- |
| 분석 플로우, 5대 지표, AI 리포트 구조 | `PROJECT_INDEX.md`에 별도 관리 (필요 시 Read)   |
| 디렉토리 구조, DB 스키마              | `PROJECT_INDEX.md`에 별도 관리 (필요 시 Read)   |
| 외부 API 연동 표                      | `PROJECT_INDEX.md`에 별도 관리 (필요 시 Read)   |
| 핵심 패턴 (캐시, 에러 격리 등)        | `PROJECT_INDEX.md`에 별도 관리 (필요 시 Read)   |
| Git 규칙 (`gh CLI`)                   | work/CLAUDE.md에서 상속                         |
| 패키지매니저 (npm)                    | 기술 스택 한 줄에서 파악 가능                   |
| "세션 시작 시 필수 읽기" 지시         | rules 자동 로딩으로 대체 (paths 또는 항상 로딩) |

### PROJECT_INDEX.md 활용 전략

프로젝트 구조, 분석 플로우, DB 스키마, 외부 API 등 **프로젝트 전체 맥락**은 `PROJECT_INDEX.md`에 별도 관리한다.

|           | CLAUDE.md에 넣기                 | PROJECT_INDEX.md 별도   |
| --------- | -------------------------------- | ----------------------- |
| 주입 방식 | 매 턴 자동 (~8KB × 30턴 = 240KB) | 필요 시 Read 1회 (~8KB) |
| 토큰 비용 | 높음                             | **낮음**                |
| 정보 접근 | 즉시                             | Read 1턴 소요           |

- **CLAUDE.md**: "이 룰 읽어라" 지시만 (매 턴 주입되는 최소 정보)
- **PROJECT_INDEX.md**: 프로젝트 전체 맥락 (필요 시 1회 읽기)
- **Serena 메모리**: `.serena/memories/project_index.md`에도 동일 내용 연동 → Serena 도구 사용 시 자동 참조

`sc:index-repo` 스킬로 생성하며, 코드 변경 시 주기적으로 재생성한다.

### "당연한 말" 제거 원칙

CLAUDE.md와 rules에서 아래 유형의 내용은 제거한다. Claude가 별도 지시 없이도 알고 있는 것들:

- "서술적인 이름 사용", "DRY 원칙" — 기본 중의 기본
- "사용자 입력 검증", "주석 최소화" — 당연
- "성급한 최적화 지양" — 보편 원칙
- 중복 표현 ("존재하지 않는 파일 언급하지 않는다" ≈ "먼저 읽어서 확인한다")

**남겨야 할 것**: Claude가 실제로 자주 어기는 행동 교정 규칙

- "코드 건드리기 전에 먼저 읽어라" ← 추측으로 코드를 짜는 경우 빈번
- "명시적 요청 전까지 수정하지 마라" ← 멋대로 고치는 경우 빈번
- "점진적 작업" ← 한번에 10개 파일 바꾸는 경우 빈번
- "Serena MCP 필수 사용" ← MCP 연결해도 기본 도구(Read/Grep/Edit)로 빠지는 경우 빈번

### 규칙 강도 조절 팁

Claude가 특정 규칙을 무시하는 경우, 표현 강도를 높여야 한다:

| 강도   | 표현 예시                                        | Claude 준수율    |
| ------ | ------------------------------------------------ | ---------------- |
| 약     | "~를 적극 사용한다"                              | 낮음 (무시 빈번) |
| 중     | "~를 우선 사용한다. 기본 도구로 대체하지 않는다" | 보통             |
| **강** | **"⛔ ~를 금지한다" + 금지/필수 대비 테이블**    | **높음**         |

**효과적인 패턴**: CLAUDE.md(매 턴 주입)에 ⛔ 강한 한 줄 + rules 파일에 구체적 금지/필수 테이블 조합

---

## 4. rules 파일 재구조화

### 핵심 원칙: "필요한 파일만, 필요할 때만"

### 현재 rules 파일 현황 (9개) ✅ 완료

| 파일                     | paths                                                                                                                          | 로딩 방식     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `code-style.md`          | 없음                                                                                                                           | **항상** 로딩 |
| `serena.md`              | 없음                                                                                                                           | **항상** 로딩 |
| `nextjs-patterns.md`     | `src/**`                                                                                                                       | 조건부 로딩   |
| `backend-data.md`        | `src/server/data-sources/**`                                                                                                   | 조건부 로딩   |
| `backend-api.md`         | `src/app/api/**`, `src/features/*/actions.ts`                                                                                  | 조건부 로딩   |
| `backend-cache.md`       | `src/server/cache/**`, `src/server/db/**`, `prisma/**`                                                                         | 조건부 로딩   |
| `frontend-components.md` | `src/features/*/components/**`, `src/features/*/hooks/**`, `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/components/**` | 조건부 로딩   |
| `frontend-forms.md`      | `src/features/*/schema.ts`, `analysis-form*`, `src/features/*/actions.ts`                                                      | 조건부 로딩   |

> ⚠️ **`paths` 없는 rules 파일**은 무조건 로딩된다 (항상 필요한 소형 파일에 적합).
> ⚠️ **주의**: `globs`, `alwaysApply`, `description`은 **Cursor 전용** 프론트매터다. Claude Code는 `paths`만 지원한다. 파일 확장자도 `.mdc`가 아닌 **`.md`**를 사용한다.

### paths 프론트매터로 자동 로딩 제어

`.claude/rules/` 안의 `.md` 파일 상단에 YAML 프론트매터를 추가하면, **해당 경로의 파일을 작업할 때만** 자동으로 로딩된다:

```yaml
---
# backend-api.md 상단
paths:
  - "src/app/api/**"
  - "src/features/*/actions.ts" # frontend-forms.md와 의도적 중복 (API 규칙 + 폼 통합 규칙 모두 필요)
---
```

```yaml
---
# frontend-components.md 상단
paths:
  - "src/features/*/components/**"
  - "src/features/*/hooks/**"
  - "src/app/**/page.tsx" # src/app/** 대신 page.tsx/layout.tsx만 — route.ts 과매칭 방지
  - "src/app/**/layout.tsx"
  - "src/components/**"
---
```

### 파일 분할 완료 내역

**backend.md (676줄 → 3개 파일) ✅**

| 파일               | 내용                                         | paths                            |
| ------------------ | -------------------------------------------- | -------------------------------- |
| `backend-api.md`   | Server Action, API Route, 에러 처리, 보안    | `src/app/api/**`, `actions.ts`   |
| `backend-data.md`  | Client-Adapter 패턴, 외부 API 연동, 헬스체크 | `src/server/data-sources/**`     |
| `backend-cache.md` | Redis 캐시, Prisma, DB 패턴                  | `cache/**`, `db/**`, `prisma/**` |

**frontend.md (446줄 → 2개 파일) ✅**

| 파일                     | 내용                                       | paths                                                 |
| ------------------------ | ------------------------------------------ | ----------------------------------------------------- |
| `frontend-components.md` | 컴포넌트 패턴, 훅, App Router, 상태관리    | `components/**`, `hooks/**`, `page.tsx`, `layout.tsx` |
| `frontend-forms.md`      | react-hook-form, zod 스키마, 폼 UX, env.ts | `schema.ts`, `analysis-form*`, `actions.ts`           |

### 자동 로딩 요약 (실제)

| 작업 유형          | 자동 로딩되는 파일                      | 예상 용량 |
| ------------------ | --------------------------------------- | --------- |
| 코드 작성 (일반)   | code-style + serena                     | ~1.8KB    |
| 백엔드 API 작업    | + nextjs-patterns + backend-api         | ~6KB      |
| 데이터소스 작업    | + backend-data                          | ~8KB      |
| 프론트엔드 UI 작업 | + nextjs-patterns + frontend-components | ~7KB      |

**절감 효과**: 세션 초 69KB 일괄 로딩 → 작업별 ~2~8KB 선택 로딩.

---

## 5. 멀티 에이전트 오케스트레이션

### Agent Teams (실험적 기능)

여러 Claude Code 세션이 팀으로 협업하는 기능. 2026년 2월 기준 실험적 상태.

#### 활성화 방법

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

또는 `.claude/settings.json`에 추가:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

#### 아키텍처

```
┌──────────────────────────────┐
│         Team Lead            │
│  (작업 분배, 결과 종합)        │
└──────┬───────┬───────┬───────┘
       │       │       │
  ┌────▼──┐ ┌──▼────┐ ┌▼──────┐
  │팀원 A │ │팀원 B │ │팀원 C │
  │(독립  │ │(독립  │ │(독립  │
  │컨텍스트)│ │컨텍스트)│ │컨텍스트)│
  └───┬───┘ └───┬───┘ └───┬───┘
      │         │         │
      └────────▼──────────┘
          공유 Task List
    (~/.claude/tasks/{team-name}/)
```

| 구성 요소     | 역할                                                               |
| ------------- | ------------------------------------------------------------------ |
| **Team Lead** | 메인 세션. 팀 생성, 작업 분배, 결과 종합                           |
| **Teammates** | 독립 Claude Code 인스턴스. 각자 독립 컨텍스트 윈도우에서 자율 작업 |
| **Task List** | 공유 작업 목록. 의존성 관리 가능                                   |
| **Mailbox**   | 팀원 간 직접 메시지 교환 (서브에이전트와 핵심 차이점)              |

#### 서브에이전트와의 핵심 차이

| 기준            | Agent Teams                     | 서브에이전트                             |
| --------------- | ------------------------------- | ---------------------------------------- |
| **소통 방식**   | 팀원끼리 직접 메시지 교환       | 메인에만 보고                            |
| **컨텍스트**    | 각자 **독립 풀 컨텍스트**       | 격리된 경량 컨텍스트                     |
| **작업 관리**   | 공유 Task List + 의존성         | 메인이 분배 + 결과 수집                  |
| **토큰 비용**   | **3~5x** (각자 풀 세션)         | 낮음 (요약만 메인에 반환)                |
| **스폰 시간**   | 20~30초                         | 즉시~수초                                |
| **세션 재개**   | ❌ 제한적 (알려진 한계)         | ✅ 완전 지원                             |
| **중첩**        | ❌ 팀원이 팀 생성 불가          | ❌ 서브에이전트가 서브에이전트 생성 불가 |
| **적합한 작업** | 대규모 기능 구현, 경합적 디버깅 | 탐색, 리뷰, 테스트, 빠른 분석            |

#### Agent Teams가 적합한 경우

- **대규모 기능 구현**: 프론트엔드 + 백엔드 + 테스트를 동시에 각 팀원이 담당
- **경합적 디버깅**: 여러 가설을 각 팀원이 독립적으로 검증
- **리서치 + 구현 병행**: 한 팀원은 API 스펙 조사, 다른 팀원은 구현 시작
- **크로스 레이어 작업**: 프론트/백/DB 각 레이어를 담당자가 독립 작업 후 통합

#### Agent Teams 사용 시 주의사항

1. **세션 재개 불가**: `/resume`으로 돌아와도 진행 중이던 팀원은 복구 안 됨
2. **동일 파일 편집 충돌**: 팀원끼리 같은 파일을 수정하면 충돌 발생 → 파일 단위로 분배
3. **비용 3~5배**: 각 팀원이 독립 세션이므로 토큰 사용량이 배수로 증가
4. **하나의 팀만 가능**: 한 세션에서 하나의 팀만 운영

#### 창업 분석기에서의 활용 시나리오

```
[팀 리드] "새 데이터 소스(통계청 인구) 연동 + UI 추가"
    ├── [팀원 A] src/server/data-sources/kosis/ 클라이언트+어댑터 구현
    ├── [팀원 B] src/features/analysis/components/ 에 인구 차트 추가
    └── [팀원 C] 기존 스코어링 엔진에 인구밀도 지표 통합
```

#### 표시 모드

- **in-process** (기본): 터미널 내 실행. `Shift+Down`으로 팀원 전환
- **split-pane**: tmux 또는 iTerm2 필요. 각 팀원이 별도 패널에 표시

---

## 6. 서브에이전트 역할 분담 전략

### 서브에이전트란?

메인 Claude 세션에서 **Task 도구**로 생성하는 자식 에이전트. 각자 독립 컨텍스트에서 작업 후 요약 결과만 메인에 반환한다.

#### 핵심 특성

```
메인 에이전트 컨텍스트          서브에이전트 1             서브에이전트 2
┌───────────────────┐     ┌──────────────────┐    ┌──────────────────┐
│ 전체 대화 히스토리    │     │ 커스텀 시스템 프롬프트 │    │ 커스텀 시스템 프롬프트 │
│ 풀 도구 접근         │ Task│ 제한된 도구 세트     │    │ 제한된 도구 세트     │
│                   │────▶│ 격리된 상태        │    │ 격리된 상태        │
│                   │     │                  │    │                  │
│ ◀── 요약 결과만 반환 │     └──────────────────┘    └──────────────────┘
└───────────────────┘
```

- **컨텍스트 격리**: 메인 대화 히스토리가 전달되지 않음 → 메인 컨텍스트 보호
- **병렬 실행**: 여러 서브에이전트를 동시 실행 가능
- **요약 반환**: 상세 탐색 로그가 아닌 요약만 메인에 반환 → 토큰 절약
- **재개 가능**: 에이전트 ID로 이전 작업 이어서 진행 가능

### `.claude/agents/` 에이전트 정의

#### 파일 구조

```
.claude/agents/                    # 프로젝트 레벨
├── api-reviewer.md
├── test-engineer.md
├── scoring-specialist.md
└── perf-auditor.md

~/.claude/agents/                  # 사용자 레벨 (모든 프로젝트)
├── code-reviewer.md
└── security-reviewer.md
```

#### 정의 파일 형식: YAML 프론트매터 + 마크다운

```markdown
---
name: agent-name # 필수. kebab-case
description: 언제 이 에이전트를 사용할지 # 필수. Claude가 자동 라우팅에 사용
tools: Read, Grep, Glob # 선택. 허용할 도구 목록 (생략 시 모든 도구 상속)
model: sonnet # 선택. sonnet | opus | haiku | inherit
memory: project # 선택. user | project | local (영속 메모리)
---

시스템 프롬프트 내용 (마크다운)
```

#### 프론트매터 전체 옵션

| 필드              | 필수 | 타입     | 설명                                        |
| ----------------- | ---- | -------- | ------------------------------------------- |
| `name`            | ✅   | string   | 고유 식별자 (kebab-case)                    |
| `description`     | ✅   | string   | Claude가 자동 위임 판단에 사용              |
| `tools`           |      | string[] | 허용 도구 (생략 = 모든 도구)                |
| `disallowedTools` |      | string[] | 명시적 차단 도구                            |
| `model`           |      | string   | `sonnet`, `opus`, `haiku`, `inherit`        |
| `permissionMode`  |      | string   | `default`, `acceptEdits`, `dontAsk`, `plan` |
| `maxTurns`        |      | number   | 최대 턴 수                                  |
| `skills`          |      | string[] | 미리 로딩할 스킬                            |
| `mcpServers`      |      | object   | MCP 서버 설정                               |
| `hooks`           |      | object   | 에이전트 전용 훅                            |
| `memory`          |      | string   | 영속 메모리 스코프                          |
| `background`      |      | boolean  | 백그라운드 실행 여부                        |
| `isolation`       |      | string   | `worktree` (Git 격리 실행)                  |

#### 영속 메모리 (Persistent Memory)

서브에이전트가 세션 간 지식을 축적할 수 있는 기능:

| 스코프    | 저장 위치                            | 용도                         |
| --------- | ------------------------------------ | ---------------------------- |
| `user`    | `~/.claude/agent-memory/<name>/`     | 모든 프로젝트 공통 지식      |
| `project` | `.claude/agent-memory/<name>/`       | 프로젝트 전용, Git 공유 가능 |
| `local`   | `.claude/agent-memory-local/<name>/` | 프로젝트 전용, gitignored    |

메모리 활성화 시 에이전트는 `MEMORY.md`를 읽고/쓸 수 있으며, 첫 200줄이 시스템 프롬프트에 자동 포함된다.

### 프로젝트 맞춤 에이전트 정의 예시

#### 1. API 연동 리뷰어 (수정 권한 없음, Serena 허용)

```markdown
---
name: api-reviewer
description: 외부 공공데이터 API 연동 코드의 품질, 에러 핸들링, 캐시 전략 리뷰. 코드 리뷰 요청 시 자동 사용.
disallowedTools: Edit, Write, Bash
model: sonnet
---

당신은 공공데이터 API(data.go.kr, 서울 열린데이터광장) 연동 전문가입니다.

.ts 파일 탐색 시 반드시 Serena MCP 도구를 사용한다 (get_symbols_overview → find_symbol 순서).

리뷰 체크리스트:

1. Client-Adapter 2계층 분리 여부
2. zod 스키마 파싱 적용 여부 (as Promise<T> 캐스팅 금지)
3. 에러 격리 (Promise.allSettled) 패턴
4. Redis 캐시 TTL 적정성
5. 모킹 폴백 (hasApiKey / USE_MOCK) 구현
6. fetchWithRetry 재시도 패턴
7. 로깅 접두사: [API 요청], [API 응답], [소스명] 조회 성공: N건

피드백은 우선순위별로 정리:

- 🔴 Critical (반드시 수정)
- 🟡 Warning (수정 권장)
- 🟢 Suggestion (개선 제안)
```

> **설계 결정**: `tools: Read, Grep, Glob` 대신 `disallowedTools: Edit, Write, Bash`를 사용한다.
> `tools`로 허용 목록을 지정하면 Serena MCP가 차단됨. `disallowedTools`로 수정/실행 도구만 차단하면
> 읽기 전용 성격을 유지하면서 Serena 포함 모든 조회 도구를 사용할 수 있다.

#### 2. 테스트 엔지니어 (실행 권한 있음)

```markdown
---
name: test-engineer
description: 테스트 작성 및 실행 전문가. 테스트 관련 요청 시 자동 사용.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

당신은 Next.js + TypeScript 테스트 전문가입니다.

현재 프로젝트에 테스트 프레임워크가 설치되어 있지 않다.
테스트 작성 요청 시 먼저 설치 여부를 확인하고, 미설치 시 vitest 설치를 제안한다:
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom

테스트 작성 원칙 (vitest 기준):

- 모킹 우선: 외부 API는 반드시 모킹 (실제 호출 금지)
- Client/Adapter 각각 독립 테스트
- 에러 케이스 반드시 포함 (네트워크 에러, 파싱 에러, 빈 응답)
- zod 스키마 검증 테스트 포함
- Server Action 테스트: 입력 검증 + 성공/실패 분기 커버

실행 후 결과 요약:

- 통과/실패 건수
- 실패 원인 분석
- 커버리지 리포트 (가능 시)
```

#### 3. 스코어링 전문가 (읽기 + 분석, opus)

```markdown
---
name: scoring-specialist
description: 5대 지표 스코어링 모델 분석 및 개선 전문가.
model: opus
memory: project
---

당신은 소상공인 창업 입지 분석의 스코어링 모델 전문가입니다.

분석 대상: src/features/analysis/lib/scoring/

- index.ts — 진입점, 지표 통합
- vitality.ts — 상권 활력 지표
- competition.ts — 경쟁 강도 지표
- types.ts — 타입 정의

분석 시작 시 get_symbols_overview로 구조 파악 후 필요한 심볼만 find_symbol로 읽는다.

분석 항목:

- 가중치 배분의 합리성 검증
- 데이터 정규화 방식 적절성
- 등급 커트라인(A/B/C/D/F) 분포 분석
- 엣지 케이스 (데이터 누락 시 처리)

MEMORY.md에 이전 분석 결과와 개선 이력을 기록합니다.
```

> **설계 결정**: `tools` 미지정 → 모든 도구 상속 (Serena 포함). `model: opus` — 가중치/정규화 추론은
> 복잡한 도메인 지식이 필요하므로 최고 추론력 모델 사용.

#### 4. 성능 감사자 (읽기 전용)

```markdown
---
name: perf-auditor
description: 캐시 전략, DB 쿼리, 번들 사이즈 등 성능 감사. 성능 관련 이슈 시 자동 사용.
tools: Read, Grep, Glob, Bash
model: sonnet
---

당신은 Next.js + PostgreSQL 성능 최적화 전문가입니다.

감사 항목:

1. Redis 캐시 히트율 및 TTL 적절성
2. Prisma 쿼리 N+1 문제
3. Server Component vs Client Component 분류 적절성
4. 불필요한 리렌더링 (memo, useMemo, useCallback)
5. 번들 사이즈 (dynamic import 활용)
6. API 응답 시간 (Promise.allSettled 병렬화)
```

### 모델 선택 전략

| 작업 유형                  | 모델     | 이유                    |
| -------------------------- | -------- | ----------------------- |
| 아키텍처 분석, 복잡한 추론 | `opus`   | 최고 추론력 필요        |
| 코드 리뷰, 구현, 리팩터링  | `sonnet` | 비용 효율 + 충분한 능력 |
| 린팅, 포맷팅, 단순 탐색    | `haiku`  | 최저 비용, 빠른 응답    |

### 실전 활용 패턴

#### 패턴 1: 새 데이터 소스 추가 워크플로우

```
메인: "통계청 인구 API 연동해줘"
  └── 서브에이전트(탐색, haiku): KOSIS API 스펙 조사 + 기존 패턴 분석
  └── 메인이 결과 받아서 구현
  └── 서브에이전트(api-reviewer, sonnet): 코드 리뷰
  └── 서브에이전트(test-engineer, sonnet): 테스트 작성 + 실행
```

#### 패턴 2: 병렬 코드 리뷰

```
메인: "PR 전체 리뷰해줘"
  ├── 서브에이전트(api-reviewer): API 연동 코드 리뷰
  ├── 서브에이전트(perf-auditor): 성능 감사
  └── 서브에이전트(security-reviewer): 보안 검토
  → 3개 동시 실행, 메인이 결과 종합
```

#### 패턴 3: 컨텍스트 격리 탐색

대형 코드베이스에서 서브에이전트로 탐색하면 메인 컨텍스트가 오염되지 않는다:

```
메인: "이 에러 원인 찾아줘"
  └── 서브에이전트(탐색, haiku): 관련 파일 20개 읽고 원인 분석
  → 결과 요약(~200 토큰)만 메인에 반환
  → 메인 컨텍스트는 깨끗하게 유지
```

### 에이전트 로딩 우선순위

| 위치                  | 범위                   | 우선순위 |
| --------------------- | ---------------------- | -------- |
| CLI `--agents` 플래그 | 현재 세션              | 1 (최고) |
| `.claude/agents/`     | 현재 프로젝트          | 2        |
| `~/.claude/agents/`   | 모든 프로젝트          | 3        |
| 플러그인 `agents/`    | 플러그인 설치 프로젝트 | 4 (최저) |

### 자동 vs 명시적 호출

- **자동**: `description` 필드를 기반으로 Claude가 적절한 에이전트를 자동 선택
- **명시적**: `"api-reviewer 에이전트로 이 코드 리뷰해줘"` 처럼 직접 지정

---

## 7. Hooks 자동화 (선택적)

### Hooks란?

Claude Code 라이프사이클의 특정 시점에 자동 실행되는 셸 명령/프롬프트/에이전트. CLAUDE.md의 가이드라인과 달리 **확정적으로 항상 실행**된다.

### CLAUDE.md vs Hooks

|               | CLAUDE.md                            | Hooks                                  |
| ------------- | ------------------------------------ | -------------------------------------- |
| **성격**      | 가이드라인 (따를 수도 안 따를 수도)  | 규칙 (무조건 실행)                     |
| **보장**      | Claude가 대체로 따르지만 100%는 아님 | 항상 실행 (결정론적)                   |
| **적합한 것** | 아키텍처 결정, 코드 스타일, 컨벤션   | 포맷팅 강제, 위험 명령 차단, 자동 검증 |

### 실제로 필요한가?

**소규모 프로젝트(< 2만 LOC)에서는 선택적**. CLAUDE.md 규칙만으로 충분한 경우가 많다.

**도입을 고려할 시점:**

- 승인 피로감 — 매 세션 50+ 번 "yes" 클릭
- 포맷팅 불일치 — Claude가 간헐적으로 다른 포맷 사용
- 보호 파일 — `.env`, `package-lock.json` 등 절대 건드리면 안 되는 파일

### 도입 시 추천 훅 (최소 2개만)

**1. 자동 포맷팅 (PostToolUse)** — 설정 5분

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

**2. 위험 명령 차단 (PreToolUse)** — 설정 15분

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo $CLAUDE_TOOL_INPUT | grep -qE 'rm -rf|drop table|prisma migrate reset' && echo 'BLOCK: 위험한 명령어 감지' && exit 2 || exit 0"
          }
        ]
      }
    ]
  }
}
```

### 설정 방법

CLI에서 `/hooks` 명령어로 대화형 설정 가능 (JSON 직접 편집 불필요).

설정 파일 위치:

- `~/.claude/settings.json` — 모든 프로젝트
- `.claude/settings.json` — 현재 프로젝트 (Git 공유)
- `.claude/settings.local.json` — 현재 프로젝트 (개인용, gitignored)

---

## 8. 비용 절감 실전 전략

### 모델 라우팅 전략

```
Planning (아키텍처 결정) → Opus (최고 추론력)
Implementation (코드 작성) → Sonnet (비용 효율)
Quick tasks (포맷팅, 이름변경) → Haiku (최저 비용)
```

### 컨텍스트 관리

| 전략                   | 설명                                          | 절감 효과          |
| ---------------------- | --------------------------------------------- | ------------------ |
| `/clear` 전략적 사용   | 연구→계획→구현→검증 단계 사이에 클리어        | 누적 히스토리 제거 |
| `/compact` 선제적 사용 | 컨텍스트 70% 도달 시 실행                     | 대화 히스토리 압축 |
| 서브에이전트 위임      | 테스트/빌드 등 장황한 출력은 서브에이전트에서 | 메인 컨텍스트 보호 |
| CLAUDE.md 경량화       | 매 턴 주입 비용 절감                          | 턴당 ~8.7KB 절약   |
| rules paths 자동 로딩  | 필요한 것만 로딩                              | 세션 초 ~60KB 절약 |

### 비용 절감 시뮬레이션

```
[Before] 30턴 세션:
  CLAUDE.md: 9.7KB × 30 = 291KB
  Rules (수동 Read): 69KB × 1 = 69KB
  총 오버헤드: ~360KB

[After] 30턴 세션:
  CLAUDE.md (경량): ~1KB × 30 = 30KB
  Rules (paths 자동): ~5KB × 1 = 5KB (관련 파일만)
  총 오버헤드: ~35KB

  절감: ~90% (360KB → 35KB)
```

### 세션 분할 패턴

```
세션 1: 리서치 & 계획
  - "KOSIS 인구 API 스펙을 조사하고 구현 계획을 세워줘"
  - 서브에이전트(탐색)로 API 스펙 조사
  - 결과를 .claude/plans/ 에 저장
  - /clear

세션 2: 구현
  - "plans/kosis-integration.md 계획대로 구현해줘"
  - 코드 작성
  - /clear

세션 3: 테스트 & 리뷰
  - "방금 구현한 KOSIS 연동을 테스트하고 리뷰해줘"
  - 서브에이전트(test-engineer + api-reviewer) 병렬 실행
```

---

## 9. 실행 계획

### Phase 1: 즉시 적용 ✅ (완료)

- [x] **CLAUDE.md 계층 구조 확정**: global / automata / work / my 4단계
- [x] **글로벌 CLAUDE.md**: 언어 정책 + AI 작업 규칙 + 마인드셋 + 코드 가이드라인
- [x] **automata CLAUDE.md**: az CLI + Teams + 작업별 규칙 참조
- [x] **work CLAUDE.md**: gh CLI (CRITICAL)
- [x] **automata rules**: pr-workflow.md, pr-review.md 분리
- [x] **"당연한 말" 제거**: 성능, DRY, 중복 표현 등 정리

### Phase 2: rules 구조 개선 ✅ (완료)

- [x] **불필요 rules 삭제**: `global.md`, `architecture.md`, `new-feature-process.md`, `api-health-check.md` 제거
- [x] **새 rules 추가**: `code-style.md`, `nextjs-patterns.md`, `serena.md`
- [x] **nextjs-patterns.md에 paths 프론트매터 적용**: `paths: ["src/**"]`
- [x] **중복 내용 흡수**: architecture → nextjs-patterns.md + code-style.md / new-feature-process → nextjs-patterns.md
- [x] **프로젝트 CLAUDE.md 경량화**: 162줄 → 24줄 (85% 절감)
- [x] **backend.md 3분할**: backend-api / backend-data / backend-cache + paths 추가
- [x] **frontend.md 2분할**: frontend-components / frontend-forms + paths 추가
- [x] **paths 정밀화**: `src/app/**` → `page.tsx/layout.tsx`만, `analysis/components/**` 중복 제거
- [x] **zod 스키마 규칙 중복 제거**: backend-api.md에서 제거, frontend-forms.md로 일원화

### Phase 3: 에이전트 & 자동화

- [x] **서브에이전트 정의**: `.claude/agents/`에 api-reviewer, test-engineer, scoring-specialist, perf-auditor 생성
- [x] **에이전트 수정**: 실제 파일 경로 반영, Serena MCP 허용, scoring-specialist → opus 모델, vitest 미설치 안내
- [ ] **Agent Teams 테스트**: 대규모 기능 구현 시 팀 모드 실험
- [ ] **(선택) Hooks 설정**: 자동 포맷팅 + 위험 명령 차단 (승인 피로감 발생 시)

### Phase 4: 지속적 (습관화)

- [ ] `/clear` 단계별 사용 습관화
- [ ] `/cost`로 비용 모니터링
- [ ] CLAUDE.md를 2주마다 리뷰 & 정리 (Claude가 이미 잘 따르는 규칙 제거)
- [ ] 반복 실수 발생 시 해당 rules 파일에 추가

---

## 참고 소스

- [Claude Code 공식 Best Practices](https://code.claude.com/docs/en/best-practices)
- [CLAUDE.md 최적화 - Arize AI](https://arize.com/blog/claude-md-best-practices-learned-from-optimizing-claude-code-with-prompt-learning/)
- [Writing a good CLAUDE.md - HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [How to Write a Good CLAUDE.md - Builder.io](https://www.builder.io/blog/claude-md-guide)
- [Agent Teams 공식 문서](https://code.claude.com/docs/en/agent-teams)
- [서브에이전트 공식 문서](https://code.claude.com/docs/en/sub-agents)
- [서브에이전트 SDK API 문서](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Hooks 자동화 가이드](https://code.claude.com/docs/en/hooks-guide)
- [Hooks 레퍼런스](https://code.claude.com/docs/en/hooks)
- [토큰 사용 최적화 - ClaudeLog](https://claudelog.com/faqs/how-to-optimize-claude-code-token-usage/)
- [Context Window 관리 전략](https://claudefa.st/blog/guide/mechanics/context-management)
- [awesome-claude-code (GitHub)](https://github.com/hesreallyhim/awesome-claude-code)
- [claude-code-tips 45가지](https://github.com/ykdojo/claude-code-tips)
- [Anthropic 팀의 Claude Code 활용법](https://www.anthropic.com/news/how-anthropic-teams-use-claude-code)
- [Claude Code Hooks 20+ 예시](https://aiorg.dev/blog/claude-code-hooks)
- [Agent Teams 가이드 - claudefa.st](https://claudefa.st/blog/guide/agents/agent-teams)
- [서브에이전트 베스트 프랙티스 - PubNub](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/)
