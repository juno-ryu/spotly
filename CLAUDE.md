# 프로젝트 개요 — 창업 분석기 (Startup Analyzer)

## 서비스 소개

소상공인 창업 입지 분석 서비스. 사용자가 주소와 업종을 입력하면 **공공 데이터 API**(국민연금 NPS, 국세청 NTS, 부동산 실거래가)를 수집·분석하여 **5대 지표 기반 100점 만점 종합 점수**를 산출하고, **Claude AI가 맞춤형 리포트**를 생성한다.

## 기술 스택

| 영역             | 기술                                          |
| ---------------- | --------------------------------------------- |
| **프레임워크**   | Next.js 16 (App Router, Turbopack)            |
| **언어**         | TypeScript 5.7, React 19                      |
| **DB**           | PostgreSQL + Prisma ORM 6                     |
| **캐시**         | Upstash Redis (REST)                          |
| **AI**           | Anthropic Claude API (`claude-haiku-4-5`)     |
| **UI**           | shadcn-ui, Radix UI, Tailwind CSS 4           |
| **차트**         | Recharts                                      |
| **지도**         | Kakao Maps SDK (`react-kakao-maps-sdk`)       |
| **PDF**          | `@react-pdf/renderer`                         |
| **폼**           | react-hook-form + zod resolver                |
| **상태관리**     | zustand (클라이언트), React Query (서버 상태) |
| **유틸**         | dayjs, es-toolkit, ts-pattern                 |
| **패키지매니저** | npm                                           |

## 핵심 비즈니스 로직

### 분석 플로우

1. **입력**: 사용자가 주소 + 업종 + 반경(500m/1km/3km) 입력 → `POST /api/analyze`
2. **지오코딩**: Kakao REST API로 좌표 → 법정동코드 변환
3. **데이터 수집** (병렬, Redis 캐시):
   - NPS 사업장 검색 → 상위 20개 상세 + 월별 추이 조회
   - 부동산 실거래가 조회 (XML 파싱)
   - NTS 사업자 상태 배치 조회
4. **스코어링**: 5대 지표 가중 합산 (총 100점)
5. **AI 리포트**: Claude Haiku로 구조화된 분석 리포트 생성

### 5대 분석 지표

| 지표        | 배점 | 데이터 소스                                |
| ----------- | ---- | ------------------------------------------ |
| 상권 활력도 | 30점 | NPS 신규 창업 비율 + 직원 규모 + 활성 비율 |
| 경쟁 강도   | 25점 | 동일 업종 밀집도 (역비례)                  |
| 생존율      | 20점 | 활성 / (활성 + 폐업)                       |
| 주거 밀도   | 15점 | 아파트 거래 건수                           |
| 소득 수준   | 10점 | 평균 아파트 거래가 / 전국 평균             |

### AI 리포트 구조

verdict(추천/조건부 추천/주의/비추천) + summary + strengths + risks + recommendations + detailedAnalysis

## 디렉토리 구조

```
src/
├── app/                          # Next.js App Router
│   ├── (main)/                   # 메인 레이아웃 그룹 (사이드바)
│   │   ├── page.tsx              # 홈 (랜딩)
│   │   ├── analyze/page.tsx      # 분석 폼
│   │   ├── analyze/[id]/page.tsx # 분석 결과
│   │   ├── report/[id]/page.tsx  # AI 리포트 (force-dynamic)
│   │   └── history/page.tsx      # 분석 이력 (force-dynamic)
│   └── api/
│       ├── analyze/route.ts      # POST: 분석 요청 → 비동기 처리
│       ├── analyze/[id]/route.ts # GET: 분석 결과 폴링
│       ├── report/[id]/pdf/      # PDF 다운로드
│       └── geocode/route.ts      # 지오코딩 프록시
├── features/
│   ├── analysis/                 # 분석 기능
│   │   ├── schema.ts             # zod 스키마 (요청/응답/점수)
│   │   ├── components/           # 폼, 결과, 차트, 지도, 테이블 등
│   │   ├── hooks/                # use-analysis-polling
│   │   ├── lib/                  # scoring-engine, data-aggregator
│   │   └── constants/            # industries, scoring 가중치
│   ├── map/                      # Kakao 지도
│   │   ├── components/           # kakao-map-provider
│   │   └── hooks/
│   └── report/                   # AI 리포트
│       ├── schema.ts             # AI 리포트 zod 스키마
│       ├── actions.ts            # Server Action (Claude API 호출)
│       ├── components/           # report-viewer, ai-insight-card, report-download
│       └── lib/                  # prompt-builder, pdf-template
├── server/                       # 서버 전용 모듈
│   ├── cache/redis.ts            # Upstash Redis 캐시 (cachedFetch)
│   ├── db/prisma.ts              # Prisma 클라이언트
│   └── data-sources/             # 외부 API 클라이언트
│       ├── nps-client.ts         # 국민연금 사업장 (검색/상세/추이)
│       ├── nts-client.ts         # 국세청 사업자 상태
│       ├── real-estate-client.ts # 부동산 실거래 (XML 파싱)
│       ├── kakao-geocoding.ts    # Kakao 지오코딩/장소검색
│       ├── types.ts              # 공통 타입 (DataGoKrResponse, KakaoResponse 등)
│       └── mock/                 # 개발용 모킹 JSON
├── components/ui/                # shadcn-ui 컴포넌트 (~20개)
├── constants/
│   ├── enums/                    # as const 패턴 enum
│   ├── api-types.ts              # 페이지네이션/정렬 공통 스키마
│   └── site.ts                   # 사이트 설정
├── hooks/                        # 공통 훅 (use-mounted, use-mobile)
├── lib/
│   ├── env.ts                    # 환경 변수 검증 (zod) + hasApiKey 헬퍼
│   └── utils.ts                  # cn 유틸리티
├── remote/client.ts              # 클라이언트 전용 HTTP 클라이언트
└── types/kakao.d.ts              # Kakao SDK 타입 선언
```

## DB 스키마 (Prisma)

| 모델               | 설명                                                         |
| ------------------ | ------------------------------------------------------------ |
| `AnalysisRequest`  | 분석 요청 + 결과 (상태: PENDING→PROCESSING→COMPLETED/FAILED) |
| `ApiCache`         | 공공 API 응답 장기 캐시 (Redis 보조)                         |
| `IndustryCategory` | 업종 분류 코드 시드 데이터                                   |

## 외부 API 연동

| API                        | 용도                  | 모킹 조건                             |
| -------------------------- | --------------------- | ------------------------------------- |
| 국민연금 NPS (data.go.kr)  | 사업장 검색/상세/추이 | `DATA_GO_KR_API_KEY` 없으면 mock JSON |
| 국세청 NTS (odcloud.kr)    | 사업자 상태 조회      | 동일                                  |
| 부동산 실거래 (data.go.kr) | 아파트 거래가 (XML)   | 동일                                  |
| Kakao REST API             | 지오코딩, 장소 검색   | `KAKAO_REST_API_KEY` 없으면 모킹      |
| Anthropic Claude           | AI 리포트 생성        | `ANTHROPIC_API_KEY` 없으면 비활성     |

## 주요 패턴

- **비동기 분석**: POST 즉시 ID 반환 → 클라이언트가 GET 폴링으로 완료 대기
- **캐시 전략**: Redis `cachedFetch(key, ttl, fetcher)` → 미스 시 fetcher 실행 후 저장
- **Graceful Degradation**: API 키 없으면 모킹/비활성 모드 자동 전환 (`hasApiKey` 헬퍼)
- **XML 파싱**: 부동산 API는 JSON 미지원 → 정규식 기반 XML 파서 자체 구현
- **점수 정규화**: `normalize(value, min, max, maxScore)` 선형 보간 함수
- **에러 격리**: `Promise.allSettled` + `extractFulfilled`로 일부 API 실패해도 나머지 결과 활용

---

# 프로젝트 규칙

## ⚠️ Git 관련 작업 (CRITICAL — 최우선 준수)

**이 프로젝트의 모든 Git 관련 작업은 반드시 `gh` CLI (GitHub CLI)를 사용한다.**

- 커밋, 푸시, 브랜치, PR 생성/조회/리뷰 등 모든 Git 작업에 `gh` CLI 사용
- `az repos` 명령어 사용 금지 (이 프로젝트는 GitHub 기반)
- 글로벌 설정(~/.claude/CLAUDE.md)의 Azure DevOps 규칙은 이 프로젝트에 적용하지 않음

---

## 세션 시작 시 필수 읽기 (MANDATORY)

**새 대화가 시작되면, 첫 번째 작업을 수행하기 전에 반드시 아래 4개 규칙 파일을 Read 도구로 읽어야 한다.** 이 파일들은 자동 로드되지 않으므로 매 세션마다 명시적으로 읽어야 한다:

1. `.claude/rules/architecture.mdc` — 라이브러리, 디렉토리 구조, 네이밍 규칙
2. `.claude/rules/global.mdc` — 코드 스타일, 성능, 테스트, Next.js 규칙
3. `.claude/rules/new-feature-process.mdc` — API 패턴, 구현 절차
4. `.claude/rules/backend.mdc` — Server Action, API Route, 에러 처리, 보안, 캐싱
5. `.claude/rules/api-health-check.mdc` — 외부 API 상태 확인 (세션 시작 시 curl 테스트)
6. `claudedocs/prd/소상공인 창업 분석기/prd_20260209.md` — PRD (제품 요구사항, 비즈니스 모델, 스코어링 모델, 로드맵)

<!-- 읽은 후, `.claude/rules/api-health-check.mdc`의 curl 명령으로 **무조건 외부 API 헬스체크를 수행**한다 (작업 내용과 무관).
빨간불(FAIL)이 나온 API만 수정하고, 초록불 API는 건드리지 않는다. -->
