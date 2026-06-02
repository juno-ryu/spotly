# 창업 분석기 (Startup Analyzer)

소상공인 창업 입지 분석 서비스. 주소+업종 입력 → 공공 API 수집 → 다중 지표 100점 만점 → Claude AI 리포트.

## 기술 스택

Next.js 16 (App Router) | TypeScript 5.7 | React 19 | PostgreSQL + Prisma 6 | Upstash Redis
Claude API (haiku-4-5) | shadcn-ui + Tailwind 4 | Recharts | Kakao Maps | react-hook-form + zod
zustand | dayjs | ts-pattern | es-toolkit | npm

## Claude/Codex 초기 컨텍스트 공유

`~/work` 공통 구조와 맞추기 위해 아래 문서를 같은 초기 컨텍스트 보고서로 취급한다.

- `.claude/rules/project-information.md` → `PROJECT_PURPOSE.md`
- `.claude/rules/project-index.md` → `PROJECT_INDEX.md`
- `docs/dev-guide.md` — 구현 현황, 데이터소스, 스코어링, 캐시 정책

`AGENTS.md`는 `CLAUDE.md`를 가리키는 symlink다. 둘 중 하나만 읽고 같은 문서로 취급한다.

## ⛔ 작업 전 필수 — 구현 현황 파악

> **모든 새 기능 구현 / API 추가 / 스코어링 변경 전 반드시 먼저 읽을 것**

- **`docs/dev-guide.md`** — 아키텍처, 데이터소스 현황, 스코어링 구조, 반경 정책, SKIP 결정, 구현 주의사항
  - 어떤 API가 연동됐는지 / SKIP된 것과 사유
  - 스코어링 4대 지표 가중치 + 확정 수식
  - Redis 캐시 구조 + 빈 배열 캐시 금지 원칙
  - 반경 정책 (확정값)
  - 새 기능 구현 순서

---

## 작업별 필수 참조 규칙

- **외부 API 연동 작업 시** → `.claude/rules/backend-data.md` (paths 자동 로딩)
- **Server Action / API Route 작업 시** → `.claude/rules/backend-api.md` (paths 자동 로딩)
- **캐시 / DB 작업 시** → `.claude/rules/backend-cache.md` (paths 자동 로딩)
- **컴포넌트 / 훅 작업 시** → `.claude/rules/frontend-components.md` (paths 자동 로딩)
- **폼 / 스키마 작업 시** → `.claude/rules/frontend-forms.md` (paths 자동 로딩)
- **코드 작성 시** → `.claude/rules/code-style.md` 참조
- **새 기능 구현 시** → `.claude/rules/nextjs-patterns.md` 참조
- **⛔ .ts/.tsx 파일은 Serena MCP 필수** → `.claude/rules/serena.md` 참조 (Read/Grep/Edit 금지)
- **프로젝트 구조 파악 필요 시** → `PROJECT_INDEX.md` 참조
