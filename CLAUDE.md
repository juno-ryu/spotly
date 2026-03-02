# 창업 분석기 (Startup Analyzer)

소상공인 창업 입지 분석 서비스. 주소+업종 입력 → 공공 API 수집 → 5대 지표 100점 만점 → Claude AI 리포트.

## 기술 스택

Next.js 16 (App Router) | TypeScript 5.7 | React 19 | PostgreSQL + Prisma 6 | Upstash Redis
Claude API (haiku-4-5) | shadcn-ui + Tailwind 4 | Recharts | Kakao Maps | react-hook-form + zod
zustand | dayjs | ts-pattern | es-toolkit | npm

## ⛔⛔⛔ 에이전트 오케스트레이션 — 최고 우선순위 규칙 ⛔⛔⛔

> 세부 규칙 전문: `.claude/rules/orchestration.md` **(필독 필수)**

### 실제 검증된 오케스트레이션 방식

```
Claude(나) → TeamCreate → Task(팀원, team_name, name, run_in_background) → SendMessage 협업 → TeamDelete
```

**핵심 원칙**:
- `TeamCreate`는 **Claude(나)가 직접** 호출한다
- 팀원 spawn도 **Claude(나)가 직접** `Task` 도구로 한다 (`team_name` + `name` 파라미터 필수)
- spawn 시 `run_in_background: true` → tmux 분할 창으로 각 팀원이 별도 창에 뜸
- 팀원들은 `SendMessage`로 직접 소통하고, 메시지는 Claude(나)에게 자동 전달됨
- 작업 완료 후 `SendMessage(shutdown_request)` → `TeamDelete` 순으로 정리

---

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
