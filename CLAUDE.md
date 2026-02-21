# 창업 분석기 (Startup Analyzer)

소상공인 창업 입지 분석 서비스. 주소+업종 입력 → 공공 API 수집 → 5대 지표 100점 만점 → Claude AI 리포트.

## 기술 스택

Next.js 16 (App Router) | TypeScript 5.7 | React 19 | PostgreSQL + Prisma 6 | Upstash Redis
Claude API (haiku-4-5) | shadcn-ui + Tailwind 4 | Recharts | Kakao Maps | react-hook-form + zod
zustand | dayjs | ts-pattern | es-toolkit | npm

## 에이전트 오케스트레이션 규칙

- **분석/검증/구현 작업은 반드시 `cto-lead` 에이전트에게 먼저 위임한다.**
- **`cto-lead`는 작업 완료 후 반드시 `report-writer`에게 결과를 넘겨 보고서를 작성하게 한다.**
- **모든 문서화(결과 보고, 완료 보고, 검증 결과 등)는 `report-writer`가 단독 담당한다.** Claude(나)나 cto-lead가 직접 보고서를 쓰지 않는다.
- Claude(나)는 사용자 대화 창구 역할만 한다.
- 흐름: `사용자 요청 → cto-lead → 전문 에이전트들 → report-writer → 사용자`

### 사용 가능한 에이전트 목록

| 에이전트 | 역할 |
|---------|------|
| `cto-lead` | 팀 오케스트레이션, 작업 분배, 우선순위 결정 |
| `senior-backend-architect` | Server Action / API Route / DB / 캐시 / 외부 API |
| `senior-frontend-architect` | 컴포넌트 / 훅 / 상태 관리 / UI |
| `code-reviewer` | 코드 품질 + API 연동 + 성능 통합 리뷰 |
| `scoring-engine-validator` | 스코어링 로직 설계·검증·자문 |
| `ai-report-specialist` | AI 리포트 품질 (프롬프트, 인사이트, 응답 정제) |
| `report-writer` | 최종 문서화 (보고서, 완료 보고) |
| `public-data-researcher` | 공공데이터 API 리서치, 신규 지표 발굴 |

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
