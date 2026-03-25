# 코드베이스 품질 분석 보고서

> 분석 일자: 2026-03-25
> 대상: 182개 TS/TSX 파일 + 15개 문서
> 상태: **완료** (182개 파일 전수 리뷰 완료)

---

## Critical (즉시 수정 필요)

### C-01. 등급 기준 4곳 독립 정의 — 동일 점수, 다른 등급 표시

등급 산출 함수가 **4곳에서 각각 독립적으로 정의**되어 있고, 기준값이 불일치한다.

| 함수 | 파일 | A등급 기준 | 사용처 |
|------|------|----------|--------|
| `scoreToGrade()` | `scoring/types.ts` | **≥75** (박사님 승인) | 스코어링 엔진, actions, 리포트 |
| `getGrade()` | `lib/grade.ts` | **≥80** (구버전) | GradeBadge 컴포넌트 |
| `getGradeInfo()` | `api/og/route.tsx` | **≥75** | OG 이미지 |
| `getScoreLevel()` | `enums/score-level.ts` | **≥80** (EXCELLENT) | ScoreGauge |
| `getScoreThreshold()` | `score-gauge.tsx` | **≥80** (excellent) | ScoreGauge 색상 |

**영향**: 77점 → 리포트/OG에서는 A등급, 미리보기 Badge/ScoreGauge에서는 B등급/조건부추천.
**해결**: `scoreToGrade` 하나로 통일. 나머지 4개 삭제.

### C-02. 등급 색상 6곳 중복 정의, B등급 불일치

| 파일 | B등급 색상 |
|------|----------|
| `grade.ts` GRADE_COLOR | text-blue-600 |
| `grade.ts` GRADE_PDF_COLOR | #2563eb (blue) |
| `report-viewer.tsx` GRADE_COLOR | **#8b5cf6 (보라)** |
| `score-metric-cards.tsx` GRADE_INDICATOR | **#3b82f6 (파랑)** |
| `report-viewer.tsx` GRADE_BADGE_CLASS | **violet 계열** |
| `score-metric-cards.tsx` GRADE_BADGE | **blue 계열** |
| `score-gauge.tsx` SCORE_STYLES | #7c3aed (violet) |
| `grade-badge.tsx` GRADE_BADGE_CLASS | violet 계열 |

**영향**: B등급이 화면에 따라 파랑/보라/바이올렛 다르게 표시.
**해결**: 1개 파일(`lib/grade.ts` 또는 `scoring/types.ts`)에 hex/Tailwind 색상 통합 정의.

---

## High (빠른 시일 내 수정)

### H-01. 프론트엔드 자체 판단 잔여 (5건)

| 파일:라인 | 내용 | 문제 |
|---------|------|------|
| `competition-chart.tsx:30-32` | `densityColor()` — 70/40 기준 | AI가 줘야 할 색상 판단 |
| `population-insight-card.tsx:59` | `> 60 ? amber : blue` | AI가 줘야 할 색상 판단 |
| `report-viewer.tsx:240` | `< 5` 점포 수 경고 텍스트 | AI가 줘야 할 해석 |
| `report-viewer.tsx:288` | `"기준: 폐업률 5% 초과 시 주의"` | 하드코딩 기준 텍스트 |
| `infrastructure-insight-card.tsx:53-57` | `extractRating()` 키워드 평가 | AI가 줘야 할 평가 |

### H-02. console.log 87개 프로덕션 잔존

| 파일 | 개수 | 유형 | 조치 |
|------|------|------|------|
| `analysis-orchestrator.ts` | 5 | 디버그 배너 | 제거 |
| `kakao/client.ts` | 4 (IS_DEV 조건부) | API 로깅 | 유지 (dev only) |
| `kakao/adapter.ts` | 1 | 조회 성공 로그 | 제거 |
| `kosis/client.ts` | 7 | API 요청/응답 | 제거 |
| `kosis/adapter.ts` | 3 | 데이터 유무 | 제거 |
| `seoul-golmok/adapter.ts` | 7 | 수집 과정 로그 | 제거 |
| `subway/adapter.ts` | 4 | 역세권 분석 | 제거 |
| `bus/adapter.ts` | 2 | 정류소 분석 | 제거 |
| `school/adapter.ts` | 1 | DB 조회 | 제거 |
| `university/adapter.ts` | 2 | 검색 결과 | 제거 |
| `medical/adapter.ts` | 1 | 검색 결과 | 제거 |
| `real-estate/*` | 5 | SKIP된 모듈 | 파일 자체 삭제 |
| `redis.ts` | 2 | console.warn | **유지** (에러 핸들링) |
| `report/actions.ts` | 1 | console.error | **유지** (에러 핸들링) |
| `og/route.tsx` | 1 | console.error | **유지** (에러 핸들링) |
| `pdf/route.tsx` | 1 | console.error | **유지** (에러 핸들링) |

→ IS_DEV 조건부 로그와 에러 핸들링(warn/error)만 유지, 나머지 제거

### H-03. dev-guide.md 등급 기준 불일치

문서에 "80~100 = A"로 기재. 실제 코드는 75~100 = A (박사님 승인 후 문서 미갱신).

---

## Medium (개선 권장)

### M-01. 데드 코드 / 미사용 파일 (14개+)

**완전 데드 파일 (외부 import 없음)**:

| 파일 | 라인수 | 사유 |
|------|--------|------|
| `components/ui/sidebar.tsx` | 726 | 사이드바 미사용 |
| `components/ui/tabs.tsx` | — | 상세분석 탭 제거로 미사용 |
| `components/ui/skeleton.tsx` | — | 미사용 |
| `components/ui/form.tsx` | — | 미사용 |
| `components/ui/select.tsx` | — | 미사용 |
| `components/ui/popover.tsx` | — | 미사용 |
| `report/components/ai-insight-card.tsx` | 41 | 미사용 |
| `hooks/use-mounted.ts` | 14 | 미사용 |
| `remote/client.ts` | 83 | 미사용 HTTP 클라이언트 |
| `data-sources/nps/` (2파일) | ~230 | SKIP된 데이터소스 |
| `data-sources/real-estate/` (2파일) | ~250 | SKIP된 데이터소스 |
| `data-sources/franchise/` (2파일) | ~200 | SKIP된 데이터소스 |

**주석 처리된 코드**:
- `analyze/page.tsx`, `history/page.tsx`, `industry/page.tsx`, `region/page.tsx` — BackButton import + `{/* <BackButton /> */}` 주석

**데드 상수**:
- `CACHE_TTL.NTS` (redis.ts) — SKIP된 NPS용
- `CACHE_TTL.REAL_ESTATE` (redis.ts) — SKIP된 부동산용

### M-02. RadarChart 이중 렌더링

`report-viewer.tsx:135-144` — 모바일/데스크톱 두 SVG를 동시 렌더링, CSS로 숨김.
`useMobile` 훅으로 조건부 렌더링 변경 필요.

### M-03. infrastructure-insight-card.tsx headline 데드 prop

headline 중복 제거 후 내부 미사용이나 prop 인터페이스에 여전히 남아있음.

### M-04. 인사이트 시스템 업종 맥락화 미완 (dev-guide §11)

dev-guide.md에 체크리스트 6개 항목이 있으나 미구현. 카페에서 "학원 운영에 유리한 학군" 텍스트 가능.

### M-05. Google/Kakao 로그인 SVG 3곳 중복

| SVG | 중복 파일 |
|-----|---------|
| Google 로고 (`M16.51 8H8.98v3...`) | `auth-required-modal.tsx`, `login-button.tsx`, `login-screen.tsx` |
| Kakao 로고 (`bg-[#FEE500]`) | `auth-required-modal.tsx`, `login-screen.tsx` |

→ 공용 컴포넌트(`GoogleIcon`, `KakaoIcon`)로 분리 권장

### M-06. 브랜드 색상 `#7c3aed` 8곳 하드코딩

| 파일 | 횟수 |
|------|------|
| `radius-map.tsx` | 6 |
| `center-pin.tsx` | 1 |
| `fullscreen-map.tsx` | 1 |
| `site.ts` | 1 |

→ `constants/site.ts`에 `BRAND_COLOR` 상수 정의 후 import

### M-07. `haversineMeters` 함수 5곳 중복 정의 (`getDistanceMeters`가 이미 존재)

`lib/geo-utils.ts`에 `getDistanceMeters`가 이미 정의되어 있으나, 아래 5곳에서 동일 함수를 독립 구현:

| 파일 |
|------|
| `subway/adapter.ts` |
| `school/adapter.ts` |
| `medical/adapter.ts` |
| `university/adapter.ts` |
| `bus/client.ts` |

→ `getDistanceMeters`를 import해서 사용하도록 통합

### M-08. competitor-map.tsx 하드코딩 색상 대량 (40개+)

지도 마커, 인포윈도우, 범례에 hex 색상이 직접 하드코딩. `#7c3aed`(브랜드), `#2563eb`(지하철), `#ea580c`(버스), `#16a34a`(학교), `#4f46e5`(대학), `#dc2626`(병의원) 등.

→ 지도 마커 색상 상수 객체로 분리 권장

### M-09. `itemsToPopulationData` 미사용 함수 (kosis/client.ts:226)

`kosis/client.ts` 하단의 `itemsToPopulationData` 함수가 외부에서 호출되지 않음. 데드 코드.

### M-10. `SeoulApiSuccessBody` / `fetchPage` 중복 정의

`seoul-golmok/client.ts`와 `subway/client.ts`에서 동일한 `SeoulApiSuccessBody`, `SeoulApiErrorBody` 인터페이스와 `fetchPage`, `fetchAllPages` 함수가 각각 독립 구현됨. 공통 유틸로 분리 가능.

---

## Low (시간 날 때 개선)

### L-01. 하드코딩 hex 색상 40개+

`report/` 폴더에만 40개+, 지도 컴포넌트에 8개+ 하드코딩 hex.

### L-02. 삭제 가능 문서 (3개)

| 문서 | 사유 |
|------|------|
| `docs/scoring/qa-issues.md` | 2026-03-15 수정 완료된 이력 |
| `docs/scoring/qa-round2.md` | 2026-03-15 테스트 완료된 이력 |
| `docs/login-flow-redesign.md` | "검토 중" 상태 방치 |

### L-03. competition.ts V-09 중복 계산

line 270-272에서 `ratio`와 `densityScore`를 재계산하지만, line 165-166에서 이미 동일한 값이 계산됨. 변수 재사용 가능.

---

## 긍정적 평가

- **스코어링 엔진**: 수식 정확, 가중치 dev-guide와 일치, 엣지케이스(0건/null/소수표본) 처리 양호
- **에러 핸들링**: orchestrator의 Promise.all + 개별 .catch() 패턴 적절. 부분 실패 시 graceful degradation
- **캐시 전략**: cachedFetch + TTL 데이터 특성별 분리, 빈 배열 캐시 금지 원칙 준수
- **타입 안정성**: `any` 타입 0건, `@ts-ignore` 0건, `as` 타입 단언 최소
- **환경변수 검증**: zod 스키마 + hasApiKey 패턴 깔끔
- **Client-Adapter 패턴**: 모든 데이터소스가 일관된 2계층 구조
- **인사이트 엔진**: 업종별 분기, combinedRiskInsights 5개 패턴 잘 설계됨
- **프랜차이즈 감지**: fuzzyMatch + 짧은 브랜드명 정확 매칭(3자 이하) 처리 좋음
- **대학교 오탐 방지**: category_name 이중 필터 + 시/도 불일치 제거 + 부속기관 키워드 제외

---

## 수정 우선순위

| 순위 | 이슈 | ID | 예상 작업량 |
|------|------|-----|-----------|
| 1 | 등급 함수 4곳 → 1곳 통일 | C-01 | 1시간 |
| 2 | 등급 색상 통합 | C-02 | 1시간 |
| 3 | 데드 코드 삭제 (14개 파일) | M-01 | 30분 |
| 4 | console.log 정리 | H-02 | 30분 |
| 5 | dev-guide.md 등급 기준 갱신 | H-03 | 10분 |
| 6 | 프론트 자체 판단 제거 | H-01 | 30분 |
| 7 | haversineMeters 통합 | M-07 | 20분 |
| 8 | Google/Kakao SVG 분리 | M-05 | 20분 |
| 9 | 브랜드 색상 상수화 | M-06 | 15분 |
| 10 | BackButton 주석/import 정리 | M-01 | 10분 |
