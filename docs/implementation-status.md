# 창업 분석기 — 구현 현황 & 페이즈별 체크리스트

> 마지막 업데이트: 2026-03-02 (건축물대장 SKIP, 대학교 카페 필터 버그 수정)
> **이 문서는 Claude가 작업 전 반드시 참조해야 합니다.**
> 새 기능 구현 / API 추가 / 스코어링 변경 전 이 문서를 먼저 읽고 현황을 파악하세요.

---

## 목차

1. [전체 아키텍처 요약](#1-전체-아키텍처-요약)
2. [데이터소스 구현 현황](#2-데이터소스-구현-현황)
3. [스코어링 엔진 현황](#3-스코어링-엔진-현황)
4. [인사이트 빌더 현황](#4-인사이트-빌더-현황)
5. [DB / Redis 캐시 현황](#5-db--redis-캐시-현황)
6. [Phase 1 — 구현 체크리스트](#6-phase-1--구현-체크리스트)
7. [Phase 2 — 검증 체크리스트](#7-phase-2--검증-체크리스트)

---

## 1. 전체 아키텍처 요약

```
사용자 주소+업종 입력
    ↓
Kakao Geocoding → 위경도 + 법정동코드 + 행정동코드
    ↓
analysis-orchestrator.ts (Promise.all 병렬 수집)
    ├── [1] Kakao Places          → 경쟁업체 목록
    ├── [2] 서울 골목상권          → 매출/점포/유동인구 (서울만)
    ├── [3] KOSIS 인구             → 배후 인구 (전국)
    ├── [4] 지하철                 → 역세권 분석 (수도권)
    └── [5] 버스                   → 정류장 접근성 (전국)
    ↓
스코어링 엔진
    ├── competition.ts  → competitionScore (totalScore로 단독 사용 중)
    ├── vitality.ts     → vitalityScore (scoreDetail JSON에만 저장)
    └── population.ts   → populationScore (scoreDetail JSON에만 저장)
    ↓
인사이트 빌더 (competition / population / subway / bus 4개 룰)
    ↓
DB 저장 (AnalysisRequest: totalScore=4대지표가중합산, scoreDetail, reportData) + Redis 캐시
    ↓
Claude AI 리포트 (haiku-4-5)
```

> ~~⚠️ NPS, 부동산, 프랜차이즈 API는 Client-Adapter 구현 완료됐으나 orchestrator 미연결~~ → **SKIP** (데이터 무의미 판정)
> ✅ totalScore = 4대 지표 가중 합산 (서울: vitality 35% + competition 25% + population 20% + survival 20%)

---

## 2. 데이터소스 구현 현황

### ✅ 2-1. Kakao Places (경쟁업체 탐색)

| 항목 | 내용 |
|------|------|
| 파일 | `src/server/data-sources/kakao/client.ts` + `adapter.ts` |
| 제공기관 | Kakao |
| API 키 | `KAKAO_REST_API_KEY` |
| 엔드포인트 | `https://dapi.kakao.com/v2/local/search/keyword.json` |
| 수집 필드 | place_name, category_name, x/y(위경도), distance, place_url |
| Redis 캐시 | ❌ 없음 |
| Orchestrator | ✅ 연결됨 (슬롯 1) |
| 적용 지역 | 전국 |
| 출력 타입 | `KakaoPlacesRaw { totalCount, fetchedCount, places[] }` |

동작: 업종명 키워드 + 위경도 + 반경으로 키워드 검색 → `analyzeCompetition()` 입력으로 사용.
지하철 역 탐색(SW8 카테고리)에도 이중 활용.

---

### ✅ 2-2. 서울 골목상권 (상권 활력도)

| 항목 | 내용 |
|------|------|
| 파일 | `src/server/data-sources/seoul-golmok/client.ts` + `adapter.ts` |
| 제공기관 | 서울특별시 열린데이터광장 |
| API 키 | `SEOUL_OPEN_API_KEY` |
| 서비스명 | 우리마을가게 상권분석서비스 (골목상권) |
| 수집 API 5종 | VwsmTrdarStorQq(점포), VwsmTrdarSelngQq(매출), VwsmTrdarIxQq(변화지표), VwsmTrdarFlpopQq(유동인구), VwsmTrdarRepopQq(상주인구) |
| Redis 캐시 | ✅ 있음 (TTL 7~30일, 상권코드별 분할) |
| Orchestrator | ✅ 연결됨 (슬롯 2, **서울만**) |
| 적용 지역 | **서울 한정** |

수집 필드: 점포수/개업폐업건수/프랜차이즈점포수, 분기추정매출/요일별시간대별매출,
상권변화지표(HH/HL/LH/LL), 유동인구총수/남녀비율/요일시간대연령대, 상주인구/세대수

출력 타입(`CommercialVitalityData`):
```
estimatedQuarterlySales, salesCount, weekdayRatio, peakTimeSlot, peakDay,
storeCount, openRate, closeRate, franchiseCount, similarStoreCount,
changeIndex(HH/HL/LH/LL), changeIndexName, mainAgeGroup, mainGender,
floatingPopulation { totalFloating, maleRatio, peakTimeSlot, peakDay, mainAgeGroup },
residentPopulation { totalResident, totalHouseholds }
```

---

### ✅ 2-3. KOSIS 통계청 (배후 인구)

| 항목 | 내용 |
|------|------|
| 파일 | `src/server/data-sources/kosis/client.ts` + `adapter.ts` |
| 제공기관 | 통계청 |
| API 키 | `KOSIS_API_KEY` |
| 통계표 | `DT_1B04005N` (읍면동), `DT_1B040A3` (시군구 fallback) |
| Redis 캐시 | ✅ 있음 (TTL 30일, 키: `kosis:population:{동코드}`) |
| Orchestrator | ✅ 연결됨 (슬롯 3, 전국) |

동작: 행정동코드(10자리) 있으면 읍면동 단위 → 실패 시 시군구(5자리) fallback
출력: `{ totalPopulation, isDongLevel(boolean) }`

---

### ✅ 2-4. 지하철 (역세권 분석)

| 항목 | 내용 |
|------|------|
| 파일 | `src/server/data-sources/subway/client.ts` + `adapter.ts` |
| 제공기관 | 서울시 열린데이터광장 + Kakao |
| API 키 | `SEOUL_OPEN_API_KEY` + `KAKAO_REST_API_KEY` |
| 서비스명 | CardSubwayTime (OA-12252, 서울시 월별 시간대별 승하차 통계) |
| Redis 캐시 | ✅ 있음 (TTL 7일, 키: `subway:monthly:{역명}:{월YYYYMM}`) |
| Orchestrator | ✅ 연결됨 (슬롯 4, 수도권) |

2단계: Kakao Places(SW8)로 반경 500m 내 역 탐색 → 가장 가까운 역 전월 시간대별 승하차 합산 → 일평균 산출
출력: `{ isStationArea, nearestStation { name, distance, dailyAvgTotal, days }, stationsInRadius[] }`

---

### ✅ 2-5. 버스 (대중교통 접근성)

| 항목 | 내용 |
|------|------|
| 파일 | `src/server/data-sources/bus/client.ts` + `adapter.ts` |
| 제공기관 | 국토교통부 (공공데이터포털) |
| API 키 | `DATA_GO_KR_API_KEY` |
| 서비스명 | BusSttnInfoInqireService (TAGO) |
| Redis 캐시 | ✅ 있음 (TTL 7일, 키: `bus:sttn:{lat4}:{lng4}`) |
| Orchestrator | ✅ 연결됨 (슬롯 5, 전국) |

2단계: `getCrdntPrxmtSttnList`(인근 5개 정류소) → `getSttnThrghRouteList`(경유 노선, 병렬)
출력: `{ hasBusStop, nearestStop { nodeId, name, distanceMeters, routes[], routeCount }, stopCount, stopsInRadius[], totalRouteCount }`

> ✅ 전국 커버: `REGION_PREFIX_TO_CITY_CODE` 매핑으로 17개 시도 cityCode 자동 선택 (2026-03-02 완료)

---

### ~~⚠️ 2-6. NPS 국민연금~~ — **SKIP** (데이터 무의미 판정)

| 항목 | 내용 |
|------|------|
| 파일 | `src/server/data-sources/nps/client.ts` + `adapter.ts` |
| API 키 | `DATA_GO_KR_API_KEY` |
| Redis 캐시 | ❌ 없음 |
| Orchestrator | ⛔ SKIP |

~~수집 가능: 사업장명, 가입자수(직원수), 당월 고지금액(월급여 역산), 운영 기간, 업종코드~~
~~활용 가능 지표: 상권 내 평균 직원수, 소득 추정, 생존율(운영 기간)~~

---

### ~~⚠️ 2-7. 부동산 실거래~~ — **SKIP** (스코어링 반영 불가, 팩트 표시 낮은 우선순위)

| 항목 | 내용 |
|------|------|
| 파일 | `src/server/data-sources/real-estate/client.ts` + `adapter.ts` |
| API 키 | `DATA_GO_KR_API_KEY` |
| 응답 형식 | XML |
| Redis 캐시 | ❌ 없음 |
| Orchestrator | ⛔ SKIP |

**SKIP 근거 (2026-03-02 박사님 재검토):**
- 매매가↑ → 창업 유리가 아님 (소비력↑이지만 임대료도↑, 비단조적 관계)
- 매매가 ≠ 임대료 (창업자에게 실제 필요한 건 상가 임대료)
- 배후인구/생존율과 다중공선성 — 독립적 정보량 없음
- 법정동 단위 조회 vs 반경 500m 분석 — 공간 해상도 불일치
- 거래 건수 적은 달 신뢰도 문제

**향후 방향:** 한국감정원 상가 임대료 API 확보 시 "임대 비용" 지표로 통합 설계 권장

---

### ~~⚠️ 2-8. 프랜차이즈 공정거래위원회~~ — **SKIP** (데이터 무의미 판정)

| 항목 | 내용 |
|------|------|
| 파일 | `src/server/data-sources/franchise/client.ts` + `adapter.ts` |
| API 키 | `DATA_GO_KR_API_KEY` |
| Redis 캐시 | ✅ 있음 (TTL 30일, 키: `franchise:all-brands:{year}`) |
| Orchestrator | ⛔ SKIP |

~~수집 가능: 브랜드명, 업종 대/중분류, 주요 상품, 가맹본부명~~
~~활용: 하드코딩 브랜드 목록 교체 → 실시간 공정위 데이터 기반 프랜차이즈 감지~~

---

## 3. 스코어링 엔진 현황

```
src/features/analysis/lib/scoring/
├── index.ts       — 총점 합산
├── competition.ts — 경쟁 강도
├── vitality.ts    — 상권 활력도
├── population.ts  — 배후 인구
├── survival.ts    — 생존율 (서울 전용)
└── types.ts       — 공통 타입 (등급, 정규화)
```

> ✅ **totalScore = 4대 지표 가중 합산** (`actions.ts` `calcTotalScore()`)
> 서울: vitality(35%) + competition(25%) + population(20%) + survival(20%)
> 비서울: competition(55%) + population(45%)

### 등급 체계

| 점수 | 등급 |
|------|------|
| 80–100 | A |
| 60–79 | B |
| 40–59 | C |
| 20–39 | D |
| 0–19 | F |

### 경쟁 강도 (Competition)

수식: `densityScore × 0.75 + franchiseScore × 0.25`

밀집도 (시그모이드): `100 / (1 + exp(-4 × (ratio - 1)))` — ratio = densityBaseline / densityPerMeter

업종별 densityBaseline: 한식 50m / 미용실·부동산 90m / 편의점 110m / 커피 150m / 치킨 160m / 기본 250m

프랜차이즈 U커브: 0%→25점 / 20~40%→100점 / 80%+→0점

### 상권 활력도 (Vitality) — 서울만 풀스코어

| 하위 지표 | 가중치 | 계산 |
|----------|--------|------|
| 점포당 매출 | 35% | 로그 정규화 (50만~3,000만원) |
| 상권 변화 | 30% | 고정값 LH=85 / HL=55 / HH=30 / LL=25 |
| 유동인구 | 35% | `max(골목상권, 지하철)` — max 200만명 기준 로그 정규화 |

비서울: `subwayScore × 0.35` → 최대 35점

### 배후 인구 (Population)

읍면동: 3,000명(0점) ~ 40,000명(100점) 로그 정규화
시군구: 50,000명(0점) ~ 600,000명(100점)

### 미구현 지표

| 지표 | 목표 가중치 | 상태 |
|------|-----------|------|
| ~~생존율~~ | ~~20%~~ | ✅ **구현 완료** — `scoring/survival.ts`. 서울 전용(closeRate/openRate 기반) |
| ~~소득~~ | ~~10%~~ | ⛔ **SKIP** (NPS·부동산 데이터 소스 무의미 판정) |

---

## 4. 인사이트 빌더 현황

```
src/features/analysis/lib/insights/
├── builder.ts      — 룰 등록 및 실행 (ALL_RULES 배열)
├── index.ts        — buildInsights() / buildCompetitionInsights() / buildPopulationInsights() / buildSubwayInsights() / buildBusInsights() / buildSchoolInsights() / buildUniversityInsights() / buildMedicalInsights() export
├── types.ts        — InsightData, InsightItem, InsightRule 타입
└── rules/
    ├── competition.ts  — 경쟁 강도 (densityPerMeter, franchiseRatio 기반)
    ├── population.ts   — 상권 활력도 + 배후인구 인사이트
    ├── subway.ts       — 역세권 (isStationArea, nearestStation)
    ├── bus.ts          — 버스 접근성 (hasBusStop, nearestStop, routeCount)
    ├── school.ts       — 초중고 학교 (업종별 분기)
    ├── university.ts   — 대학교 + 방학 리스크
    └── medical.ts      — 병의원 (종별 분류, 업종별 분기)
```

InsightItem: `{ type, emoji, text, sub?, category: "scoring" | "fact" }`
- scoring = 점수에 반영된 근거
- fact = 참고 정보 (점수 미반영)

### 인사이트 메시지 요약

**경쟁 강도:** A등급 "경쟁업체 적어 진입 여건 좋아요" ~ F등급 "매장 매우 밀집 과포화"
프랜차이즈 20~40% "적절한 비율" / 0%+저등급 "상권 활성도 낮을 수 있어 신중 검토 필요"

**상권 활력도:** 점포당 매출 등급별 / 유동인구 등급별 / 폐업률 5% 기준 양호/위험

**역세권:** 일평균 10만명+ "대형 역세권" / 역거리+노선 / 비역세권 명시

**버스:** 정류장명+거리+노선수 / 5개+ "밀집" / 없음 "접근성 낮음" / null "데이터 수집 실패"

**학교:** 학원 업종 → "초중고 N곳 인근 — 학원 입지 적합/신중" / 일반 업종 → 개수 팩트 표시

**대학교:** 카페/음식점/편의점/의류 → "대학가 핵심 상권 + 방학 리스크" / 없음 → "대학가 아님"

**의료시설:** 약국 → "처방전 수요" / 편의점 → "환자·보호자 수요" / 종합병원 목록 팩트 표시

---

## 5. DB / Redis 캐시 현황

### Prisma DB

```
AnalysisRequest
├── totalScore (int)    — 4대 지표 가중 합산 (서울: vitality+competition+population+survival / 비서울: competition+population)
├── scoreDetail (Json)  — { competition: CompetitionAnalysis, vitality: VitalityAnalysis|null, population: PopulationAnalysis|null, survival: SurvivalAnalysis|null }
├── reportData (Json)   — AnalysisResult 전체 덤프 (places, competition, vitality, population, subway, bus, school, university, medical 포함)
└── status              — PENDING/PROCESSING/COMPLETED/FAILED
```

raw 데이터 별도 모델 없음. 모든 수집 데이터는 `reportData` JSON으로 덤프.
subway, bus 데이터도 reportData 안에 포함됨 (scoreDetail에는 없음).

### Redis 캐시

| 데이터소스 | 캐시 키 | TTL | 상태 |
|-----------|---------|-----|------|
| KOSIS 인구 | `kosis:population:{코드}` | 30일 | ✅ |
| ~~프랜차이즈~~ | ~~`franchise:all-brands:{year}`~~ | ~~30일~~ | ⛔ SKIP |
| 서울 골목상권 | 상권코드별 분할 | 7~30일 | ✅ |
| 버스 | `bus:sttn:{lat4}:{lng4}` | 7일 | ✅ |
| 지하철 | `subway:monthly:{역명}:{YYYYMM}` | 7일 | ✅ |
| Kakao Places | — | — | ❌ 없음 |
| ~~NPS~~ | — | — | ⛔ SKIP |
| ~~부동산 실거래~~ | — | — | ⛔ SKIP |

---

## 6. Phase 1 — 구현 체크리스트

> **목표:** 연결 가능한 API 전부 붙이고, 그릴 수 있는 인사이트 전부 표시한다.
> 수치의 유의미함은 Phase 2에서 검증한다. 지금은 일단 다 켠다.

---

### 6-A. orchestrator 미연결 API 연결

- ~~[ ] **NPS 국민연금 orchestrator 연결**~~ → **SKIP** (데이터 무의미 판정)
- ~~[ ] **부동산 실거래 orchestrator 연결**~~ → **SKIP** (데이터 무의미 판정)
- ~~[ ] **공정위 프랜차이즈 orchestrator 연결**~~ → **SKIP** (데이터 무의미 판정)

---

### 6-B. 신규 API 추가 — 교육시설

> **⏳ 대기 중 항목은 사용자 API 키 발급 필요 — 문서 하단 "API 키 발급 대기 목록" 참조**

- ~~[ ] **어린이집 (보건복지부)**~~ → **SKIP** (상권 분석 임팩트 미미 판정)

- ~~[ ] **유치원 (교육부 유치원알리미)**~~ → **SKIP** (상권 분석 임팩트 미미 판정)

- [x] **초중고등학교 (전국초중등학교위치표준데이터)**
  - ✅ **다음 세션 즉시 구현 가능** — CSV 파일 확보 완료
  - **구현 방법: CSV → DB 적재 (방법 A)**
  - CSV 파일: `~/Downloads/전국초중등학교위치표준데이터.csv` (EUC-KR 인코딩)
  - 파일 구조: 학교ID, 학교명, 학교급구분(초/중/고), 설립형태, 운영상태, 위도, 경도, 소재지도로명주소
  - 전국 12,013개 (초 6,312 / 중 3,308 / 고 2,394), 전부 운영 중
  - **구현 순서**:
    1. Prisma `School` 모델 추가 → `npx prisma migrate dev`
    2. `scripts/seed-schools.ts` 작성 (EUC-KR 변환 후 bulk insert)
    3. `src/server/data-sources/school/adapter.ts` — DB 쿼리 기반 (Redis 캐시 불필요)
    4. `insights/rules/school.ts` — 학교급별 수 팩트 표시 (학생수 데이터 없음)
  - ⚠️ NEIS schoolInfo API는 위경도/학생수 없어 사용 불가 → 표준데이터 CSV 사용
  - 인사이트: "반경 500m — 초등학교 2곳, 중학교 1곳"
  - 활용 업종: 학원(보습), 분식, 문구점

- [x] **대학교 — Kakao 기반 구현 완료 (2026-03-02)**
  - ~~대학알리미 API~~ → **사용 불가** (브라우저 직접 조사 2026-03-02 확인)
  - Kakao `searchByKeyword("대학교", coord, 2000m)` + place_name 필터
  - `src/server/data-sources/kakao/client.ts` — `searchByCategory` 함수 추가
  - `src/server/data-sources/university/adapter.ts` — `fetchUniversityAnalysis()`
  - `AnalysisResult`에 `university: UniversityAnalysis | null` 추가
  - `insights/rules/university.ts` — 대학교 목록 + 방학 리스크 경고 (category: "fact")
  - orchestrator 슬롯 7 연결, UI 추가

---

### 6-C. 신규 API 추가 — 의료시설

- [x] **병의원/약국 — Kakao HP8 기반 구현 완료 (2026-03-02)**
  - ~~HIRA 의료기관별상세정보서비스~~ → **위치 기반 검색 불가** (2026-03-02 확인)
  - Kakao `searchByCategory("HP8", coord, 2000m)` + category_name/place_name 종별 분류 (종합병원 + 의료원/대학병원만, 병원·의원 제외)
  - ⚠️ **업종별 해석 차이**: 약국·편의점은 의원(동네 병원) 수가 핵심 입지 기준. 현재는 종합병원/병원만 표시하므로 향후 선택 업종이 약국/편의점일 때 의원 수를 별도 인사이트로 추가 표시하는 업종별 분기 처리 필요.
  - `src/server/data-sources/medical/adapter.ts` — `fetchMedicalAnalysis()`
  - `AnalysisResult`에 `medical: MedicalAnalysis | null` 추가
  - `insights/rules/medical.ts` — 병의원 수 + 종별 표시 (category: "fact")
  - orchestrator 슬롯 8 연결, UI 추가

---

### 6-D. 신규 API 추가 — 주거/부동산

- ~~[ ] **건축물대장 (국토교통부 건축HUB)**~~ → **SKIP** (구현 난도 대비 효용 낮음 판정 2026-03-02)
  - **SKIP 근거**:
    - API가 위경도 반경 조회 불가 — 시군구코드+법정동코드+본번+부번 개별 조회만 지원
    - 반경 내 배후세대 수를 구하려면 Kakao로 건물 목록 조회 → 주소별 API 개별 호출 → 수십~수백 건 호출 필요
    - KOSIS 세대수도 같은 읍면동 해상도 불일치 문제로 이미 제거된 상태
    - 구현 난도 대비 얻는 정보량 미미 판정

- ~~[ ] **입주예정 아파트 (한국부동산원)**~~  → **SKIP** (건축물대장 SKIP과 동일 맥락, 불확실성 높음)
  - 수집: 단지명, 주소, 입주예정월, 세대수
  - 인사이트: 향후 N개월 내 입주 예정 세대 → 미래 수요 예측 팩트 표시
  - **점수화 금지** — 불확실성 높아 팩트 표시만

---

### 6-E. 버스 전국 커버 완성

- [x] **버스 cityCode 하드코딩 제거 → 완료 (2026-03-02)**
  - `REGION_PREFIX_TO_CITY_CODE` 매핑 + `getCityCodeFromRegionCode()` 추가
  - orchestrator regionCode 전달로 전국 17개 시도 커버

- [x] **버스(경기/부산/대구/인천) 검증 → 완료 (2026-03-02)**
  - 경기(수원): cityCode 잘못된 prefix "31"→"41" 수정. 실제 정류소 citycode 필드 사용으로 노선 5개 조회 성공
  - 부산(해운대): 노선명 필드 routenm→routeno 수정으로 3개 조회 성공
  - 대구(중구): 레거시(CGB)/신규(DGB) nodeId 공존 → routeCount>0 정류소 우선 선택으로 12개 조회 성공
  - 인천(남동구): 4개 노선 조회 성공
  - **수정 내역**: proxmtSttnItemSchema에 citycode 필드 추가, getCrdntPrxmtSttnList에서 cityCode 파라미터 제거, getSttnThrghRouteList에서 stn.citycode 사용, thrghRouteItemSchema에 routeno 필드 추가

---

### 6-F. 기존 데이터 인사이트 보강

- ~~[ ] **NPS 인사이트 룰 (`insights/rules/nps.ts`)**~~ → **SKIP**
  - 평균 운영 기간 → 상권 안정성 인사이트

- [ ] **부동산 인사이트 룰 (`insights/rules/real-estate.ts`)**
  - 평균 아파트 매매가 → 지역 구매력 팩트
  - 최근 거래 건수 → 부동산 시장 활성도 팩트

- [x] **교육시설 인사이트 룰 업종별 분기 → 완료 (2026-03-02)**
  - `school.ts`: 학원 업종 → "학원 입지 적합/신중 검토" 메시지
  - `university.ts`: 카페/음식점/편의점/의류 → "대학가 핵심 상권" 강조

- [x] **의료시설 인사이트 룰 업종별 분기 → 완료 (2026-03-02)**
  - `medical.ts`: 약국 → "처방전 수요", 편의점 → "환자·보호자 수요" 메시지

---

### 6-G. 스코어링 보강 (박사님 승인 완료 — 구현 대기)

> 2026-02-28 박사님(scoring-engine-validator) 전면 감사 완료. 아래 항목은 감사 결과 기반.

#### 🔴 Critical — totalScore 구조 재설계

- [x] **[C1] totalScore → 4대 지표 가중 합산으로 교체 → 완료 (2026-03-02)**
  - 서울: `vitality(35%) + competition(25%) + population(20%) + survival(20%)`
  - 비서울 fallback: `competition(55%) + population(45%)`
  - `actions.ts` `calcTotalScore()` 함수 신규 작성 및 적용 완료

- [x] **[C3] 상권변화지표 LL/HH 정의 확인 → 완료 (2026-03-02)**
  - 공식 정의: 첫 글자=생존 사업체 평균 영업기간, 둘째 글자=폐업 사업체 평균 영업기간 (H=높음, L=낮음)
  - LH(확장기)=85 / HL(안정/성숙기)=55 / HH(포화)=30 / LL(불안정)=25 로 수정
  - 기존 LL=90이었던 치명적 오류 수정 완료

- [x] **[C4] 경쟁 밀집도 점수 커브 → 시그모이드 교체 → 완료 (2026-03-02)**
  - `100 / (1 + exp(-4 * (ratio - 1)))` — 전 구간 변별력 확보

#### 🟡 Major — 정규화 파라미터 수정

- [x] **[M1] 유동인구 max 50만 → 200만 상향 → 완료 (2026-03-02)**
  - `logMax = Math.log(2_000_000)` (실제 데이터 p95 기준)

- [x] **[M3] 지하철 거리 감쇠 강화 → 완료 (2026-03-02)**
  - 계단식: 100m이내=1.4배 / 200m=1.3배 / 300m=1.15배 / 500m=1.0배 / 초과=0.85배

- [x] **[M4] 생존율 지표 구현 → 완료 (2026-03-02)**
  - `scoring/survival.ts` 신규 작성
  - 공식: `closeScore * 0.6 + netChangeScore * 0.4` (박사님 승인)
  - 서울 전용, 비서울은 null 반환

#### 🟢 Minor

- [x] **[m1] 프랜차이즈 U커브 0% 시작점 조정 → 완료 (2026-03-02)**
  - 40점 → 25점으로 하향 (박사님 조건부 승인)

- ~~[ ] **소득 지표 구현**~~ → **SKIP** (NPS·부동산 데이터 소스 무의미 판정)

---

### 6-H. 기술부채 해소

- [x] **[C2] 가중치 주석-코드 불일치 수정 → 완료 (2026-03-02)**
  - `DENSITY_WEIGHT=0.75 / FRANCHISE_WEIGHT=0.25` 로 통일

- ~~[ ] **Kakao Places Redis 캐시 추가**~~ → **SKIP** (lat/lng 조합이 사용자마다 다름 → 캐시 히트율 미미, 메모리 낭비)

- ~~[ ] **부동산 실거래 Redis 캐시 적용**~~ → **SKIP**

- [x] **인사이트 함수명 정리 → 완료 (2026-03-02)**
  - `buildVitalityInsights()` → `buildPopulationInsights()`로 rename 완료

- [x] **scoreBreakdownSchema에 population 추가 → 완료 (2026-03-02)**
  - population + survival 필드 추가

- [x] **PROJECT_INDEX.md 최신화 → 완료 (2026-03-02)**

- [x] **분석 반경 매직 넘버 상수화 → 완료 (2026-03-02)**
  - `constants.ts`: `ANALYSIS_RADIUS_DEFAULT`, `UNIVERSITY_RADIUS`, `MEDICAL_RADIUS` 추출
  - university/medical adapter에서 하드코딩 2000 → import로 교체

- ~~[ ] **학교 어댑터 반경 레벨별 분리**~~ → **SKIP** (의미 없음 판정 2026-03-02)
  - 학생수 데이터 없이 개수만 세는 구조에서 반경 분리는 오히려 지도 마커와 불일치 유발
  - 사용자가 선택한 분석 반경 그대로 사용이 더 일관적

---

## 7. Phase 2 — 검증 체크리스트

> **목표:** Phase 1 구현이 완료된 후, 각 데이터가 실제 창업 준비하는 사장님께 유의미한 정보를 주는가를 검증한다.
> 유의미하지 않은 데이터는 숨기거나 표시 방식을 변경한다.

---

### 7-A. 업종별 데이터 유의미성 매트릭스

**H=핵심 / M=보조 / L=약함 / X=오해 유발, 비표시 권장**

#### 접근성

| 데이터 | 음식점 | 카페 | 편의점 | 미용실 | 학원 | 의류 | 부동산 | 병의원 |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 지하철 역세권 (승하차) | H | H | M | M | M | H | L | M |
| 버스 정류장 수 | M | M | M | L | L | M | L | L |
| 버스 노선 수 | M | M | L | L | L | M | L | L |
| 버스 정류장 거리 | M | M | M | L | L | M | X | L |

> 학원: 셔틀/학부모 차량 동선이 더 중요. 대중교통 지표 예측력 낮음.
> 부동산·병의원: "동네 상권" 특성 — 대중교통보다 배후 주거인구가 핵심.

#### 경쟁

| 데이터 | 음식점 | 카페 | 편의점 | 미용실 | 학원 | 의류 | 부동산 | 병의원 |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 동종업체 수 / 밀집도 | H | H | H | H | H | H | H | M |
| 프랜차이즈 비율 | H | H | H | L | M | M | X | X |

> 병의원: 메디컬 클러스터는 "경쟁"이 아닌 "집객 시너지". 점수 해석 방향 재고 필요.
> 부동산·병의원: 프랜차이즈 구조 아님 → U커브 점수 왜곡. 해당 업종에서 제외 검토.

#### 상권 (서울 골목상권)

| 데이터 | 음식점 | 카페 | 편의점 | 미용실 | 학원 | 의류 | 부동산 | 병의원 |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 분기 추정매출 / 점포당 매출 | H | H | H | M | L | H | L | L |
| 상권변화지표 | H | H | M | M | L | H | M | L |
| 유동인구 / 요일시간대 | H | H | H | M | L | H | L | M |
| 폐업률 | H | H | H | H | H | H | M | M |

> 카드 결제 기반 매출 — 현금 거래 많은 업종(재래시장 식당) 과소 추정 가능. 명시 필요.
> 학원/부동산/병의원: 골목상권 집계에 매출이 포함되지 않거나 해석 어려움.

#### 인구·주거

| 데이터 | 음식점 | 카페 | 편의점 | 미용실 | 학원 | 의류 | 부동산 | 병의원 |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 배후 인구 (읍면동/시군구) | H | M | H | H | H | M | H | H |
| 주 소비 연령대 | H | H | M | H | H | H | M | H |
| 아파트 실거래가 | M | M | M | M | H | M | H | M |
| 배후세대 수 | M | L | H | H | H | L | H | H |

> 학원: 아파트 가격과 가장 강한 상관. 교육열 높은 중산층 이상 가구 필수.
> 카페: 배후인구보다 유동인구(직장인·관광객) 의존도 높음. 배후인구 낮아도 성립 가능.

#### 교육·의료시설

| 데이터 | 음식점 | 카페 | 편의점 | 미용실 | 학원 | 의류 | 부동산 | 병의원 |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ~~어린이집/유치원 수~~ | — | — | — | — | — | — | — | — |
| 초중고 수 / 학생수 | L | M | M | L | H | L | M | L |
| 대학교 수 / 재학생 | H | H | H | M | L | H | L | L |
| 병의원/약국 수 | L | L | L | L | X | L | L | H |

> 대학가: 방학 시즌 매출 급감 리스크 동시 표시 필수.
> 학원: 초중고 학교 수/학생수 핵심. 반경 500m 이내 학교 존재 여부가 입지 결정적 요인.

---

### 7-B. 수치 기준 검증

#### 접근성 기준

| 항목 | 양호(Green) | 보통(Yellow) | 위험(Red) | 검증 필요 사항 |
|------|------------|------------|---------|--------------|
| 지하철 일평균 승하차 | 50,000명+ | 20,000~50,000 | 20,000명 미만 | 동네형 업종은 20,000도 충분할 수 있음. 업종별 기준 분리 검토 |
| 역까지 거리 | 300m 이내 | 300~500m | 500m 초과 | 의류/카페는 300m가 임계값. 편의점은 거리보다 배후인구가 더 중요 |
| 버스 노선 수 | 10개+ | 5~10개 | 5개 미만 | 환승 허브 효과 고려 여부 |

#### 경쟁 기준

| 항목 | 양호 | 보통 | 위험 | 검증 필요 사항 |
|------|-----|-----|-----|--------------|
| 밀집도 | 기준값 이상 | 기준값 50~100% | 기준값 50% 미만 | densityBaseline이 통계 기반인지 경험 추정인지 확인 |
| 프랜차이즈 비율 | 20~40% | 10~20% or 40~60% | <10% or >60% | 현재 U커브와 일치. 업종별 최적 범위 차이 검증 |

#### 상권 기준 (서울)

| 항목 | 양호 | 보통 | 위험 | 검증 필요 사항 |
|------|-----|-----|-----|--------------|
| 점포당 월매출 | 1,000만원+ | 500~1,000만원 | 500만원 미만 | 업종별 기대 매출이 극단적으로 다름. 업종별 기준 분리 필요 |
| 상권변화지표 | LL(다이나믹) | LH(확장) | HL(축소), HH(정체) | 현재 코드와 동일. 단, 부동산중개에서 HH는 "안정"일 수 있음 |
| 분기 유동인구 | 50만명+ | 10~50만명 | 10만명 미만 | 실제 분포와 현재 로그 정규화 범위(5,000~500,000) 일치 여부 검증 |
| 폐업률 | 3% 미만 | 3~8% | 8% 초과 | 업종 전체 평균 대비 비교가 핵심. 절대값보다 상대값 |

---

### 7-C. 위험 신호 조합 패턴 — **구현 완료 (2026-03-02)**

`src/features/analysis/lib/insights/builder.ts` — `combinedRiskInsights()` 구현 완료.

다음 패턴 감지 시 인사이트에 명시적 경고 표시:

| 패턴명 | 조건 | 메시지 | 심각도 |
|--------|------|--------|--------|
| 유령 상권 | 유동인구 하위 20% + 매출 하위 20% + 폐업률 상위 20% | "상권이 사실상 침체 상태입니다 — 신규 입점 신중히 검토하세요" | Critical |
| 레드오션 | 밀집도 < 기준의 30% + 프랜차이즈 비율 > 60% | "대형 브랜드가 과밀한 지역 — 개인 매장 생존이 어렵습니다" | Critical |
| 거품 상권 | 개업률 > 10% + 폐업률 > 8% + 상권변화 HL | "창업 러시 후 대량 폐업이 반복되는 불안정 상권입니다" | Major |
| 수요 부족 | 배후인구 < 5,000 + 유동인구 < 10,000 | "고객 기반 자체가 부족한 지역입니다" | Major |
| 교통 사각지대 | 지하철 없음 + 버스 노선 3개 미만 | "대중교통 접근성이 매우 낮습니다" | Minor |

---

### 7-D. Critical — 반드시 해결 (프로덕션 배포 전)

| # | 항목 | 상태 | 담당 |
|---|------|:---:|------|
| C-01 | **비서울 지역 활력도 0점 vs "데이터 없음" 구분 UI** — vitality===null 시 "서울 전용" 배지 + 안내 표시 | `[x]` | Frontend |
| C-02 | **상권코드-반경 매핑 정합성** — `fetchCommercialVitality`에서 radius가 `getTrdarsByLocation`에 직접 전달 확인. 수정 불필요 | `[x]` | Backend |
| C-03 | **KOSIS 인구 공간 해상도 한계 고지** — 배후 인구 표시에 "(행정동/시군구 전체 기준 (KOSIS 2024) · 반경 내 실제 거주인구와 다를 수 있음)" 추가 | `[x]` | Frontend + Insights |
| C-04 | **점포당 매출 정규화 업종별 분리** — ⛔ 현행 유지 (골목상권 API 자체가 업종별 분리 미지원). 인사이트 경고 메시지로 대체 | `[x]` | Scoring Validator |
| C-05 | **유동인구 정규화 범위 실증 검증** — ⛔ 현행 유지 (ln(5,000)~ln(2,000,000) 범위가 소규모~A급 변별력 충분 확인) | `[x]` | Data Researcher |
| C-06 | **5대 지표 가중치 근거 문서화** — ⚠️ 미완료. implementation-status.md 가중치 근거 섹션 추가 필요 | `[ ]` | Scoring Validator |
| C-07 | **상권변화지표 업종별 해석 차이** — 점수 변경 없음. 인사이트 메시지 분기 처리 (부동산/학원/의료 업종별 HH 해석 차이 안내 추가) | `[x]` | Insights |
| C-08 | **카드 결제 기반 매출 과소추정 명시** — 한식·분식 등 현금 거래 비율 높은 업종에서 경고 팩트 메시지 추가 | `[x]` | Insights |

---

### 7-E. Major — 조속히 해결

| # | 항목 | 상태 | 담당 |
|---|------|:---:|------|
| M-01 | **경쟁업체 0개 = 100점 오해 방지** — `directCompetitorCount === 0` 시 "수요 자체가 없는 지역일 수 있다" 경고 추가 | `[x]` | Insights |
| M-02 | **종합 A등급인데 핵심 지표 F등급 경고** — competition/vitality/population 중 score < 20이면 amber 경고 배너 표시 | `[x]` | Frontend |
| M-03 | **비선형 커브(^2.0) 도메인 적합성** — ⛔ 현행 유지 (실제로는 로그 정규화이며 ^2.0 커브 미사용 확인. 정상 동작) | `[x]` | Scoring Validator |
| M-04 | **활력도 점수의 업종 무관 적용** — ⛔ 현행 유지 (골목상권 데이터 자체가 업종 비특화적이므로 가중치 분기는 근거 없는 차별화) | `[x]` | Scoring Validator |
| M-05 | **densityBaseline 통계적 근거 확보** — ⚠️ 통계 확보 불완전. 경험 추정값임을 문서화. 실증 검증 추후 과제로 남김 | `[ ]` | Data Researcher |
| M-06 | **상권변화지표 30% 가중치의 이산값 점프** — ⛔ 현행 유지 (최대 18점 변동으로 등급 1단계 이내. 원본 데이터 자체가 범주형) | `[x]` | Scoring Validator |
| M-07 | **유동인구 fallback 투명성** — 골목상권 유동인구 없어 지하철 데이터 대체 시 팩트 메시지 추가 | `[x]` | Insights |
| M-08 | **프랜차이즈 브랜드 목록 커버리지** — ⚠️ 공정위 등록 기준 수천 개 대비 ~150개는 주요 브랜드 위주. 실질적 커버리지 검증 추후 과제 | `[ ]` | Data Researcher |
| M-09 | **데이터 기준 시점 표시** — KOSIS "(KOSIS 2024)" 기준 연도 표시 추가. 골목상권 매출은 C-08 경고에 포함 | `[x]` | Frontend |
| M-10 | **비프랜차이즈 업종 U커브 제외** — `competition.ts`에 `industryCategory` 파라미터 추가. 의료/부동산은 franchiseScore=50 고정 | `[x]` | Backend |
| M-11 | **대학가 방학 리스크 표시** — 수혜 업종(카페/음식점/의류 등) "여름·겨울 방학 시 30~50% 감소 가능" 구체적 경고 추가 | `[x]` | Insights |
| M-12 | **위험 신호 조합 패턴 구현** — `combinedRiskInsights()` 5개 패턴 구현 완료 (유령/레드오션/거품/수요부족/교통사각지대) | `[x]` | Backend + Insights |

---

### 7-F. Minor — 개선 권장

| # | 항목 | 상태 | 담당 |
|---|------|:---:|------|
| m-01 | **점수 breakdown UI** — AccordionTrigger에 "밀집도 Nm/개 / 프랜차이즈 N개 (N%)" 세부 배지 표시 | `[x]` | Frontend |
| m-02 | **활력도 세부 점수 공개** — AccordionTrigger에 "매출 N점 / 상권변화 N점 / 유동인구 N점" breakdown 배지 표시 | `[x]` | Frontend |
| m-03 | **상권변화지표 자연어 변환 확인** — HH/HL/LH/LL은 scoring 내부에서만 사용, UI 미노출 확인. 수정 불필요 | `[x]` | Insights |
| m-04 | **프랜차이즈 U커브 10% 가중치 영향도** 10% 가중치로 U커브를 유지하는 것의 실질적 효과 분석 | `[ ]` | Scoring Validator |
| ~~m-05~~ | ~~**NPS 1인 사업장 누락 규모**~~ | ~~`[ ]`~~ | **SKIP** |
| m-06 | **개업률 단독 표시 방식** — 기존 코드 이미 준수 중 (openRate 단독 표시 없음). 수정 불필요 | `[x]` | Insights |

---

### 7-G. 데이터 표시 방식 결정 — 점수화 vs 팩트 표시

| 데이터 | 점수화 | 팩트 표시 | 이유 |
|--------|:---:|:---:|------|
| 지하철 승하차 | ✅ 유동인구 가중치로 반영 | ✅ 역명/거리/일평균 표시 | 직접 수요 지표 |
| 버스 정류장 | ❌ 점수화 금지 | ✅ 정류장명/거리/노선수 표시 | 서울 외 지역 형평성 문제 |
| ~~아파트 실거래가~~ | ~~❌ 점수화 금지~~ | ~~✅ 평균가 팩트 표시~~ | **SKIP** (데이터 무의미 판정) |
| 배후세대 수 | 검토 중 | ✅ 세대수 팩트 표시 | 편의점/미용실에 핵심. 점수화 가능하나 박사님 검토 필요 |
| 교육시설 수 | ❌ 점수화 금지 | ✅ 업종별 강조 표시 | 단순 개수 점수화 시 단순화 오류 |
| 의료시설 수 | ❌ 점수화 금지 | ✅ 업종별 강조 표시 | 업종마다 의미 완전히 다름 |
| 입주예정 아파트 | ❌ 점수화 금지 | ✅ "X개월 내 N세대 입주 예정" | 불확실성 높음 |
| 개업률 | ❌ 단독 점수화 금지 | ✅ 폐업률과 함께만 표시 | 단독 해석 시 오해 유발 |

---

## 8. 전체 진행률

> 마지막 집계: 2026-03-02
> SKIP 항목은 분모에서 제외. "완료"는 코드 구현이 실제로 된 것만 인정.

### Phase 1 — 구현

| 섹션 | 항목 | 완료 | SKIP | 미완료 | 진행률 |
|------|:----:|:----:|:----:|:------:|:------:|
| 6-A. orchestrator 연결 | 3 | 0 | 3 | 0 | ~~100%~~ (전체 SKIP) |
| 6-B. 교육시설 API 추가 | 4 | 2 | 2 | 0 | **100%** |
| 6-C. 의료시설 API 추가 | 1 | 1 | 0 | 0 | **100%** |
| 6-D. 주거/부동산 API 추가 | 2 | 0 | 2 | 0 | ~~100%~~ (전체 SKIP) |
| 6-E. 버스 전국 커버 | 2 | 2 | 0 | 0 | **100%** |
| 6-F. 인사이트 보강 | 4 | 2 | 1 | 1 | 67% |
| 6-G. 스코어링 보강 | 9 | 9 | 1 | 0 | **100%** (SKIP 제외) |
| 6-H. 기술부채 해소 | 6 | 5 | 3 | 0 | **100%** (SKIP 제외) |
| **Phase 1 합계** | **28** | **20** | **13** | **1** | **95%** |

> 💡 실질 미완료 항목(SKIP 제외): **1개** (6-F 부동산 인사이트 룰 — 데이터소스 SKIP으로 의미 없음)

### Phase 2 — 검증

| 섹션 | 항목 | 완료 | SKIP(현행유지) | 미완료 | 진행률 |
|------|:----:|:----:|:----:|:------:|:------:|
| 7-D. Critical | 8 | 7 | 0 | 1 | **88%** |
| 7-E. Major | 12 | 9 | 0 | 3 | **75%** |
| 7-F. Minor | 6 | 4 | 1 | 1 | **80%** (SKIP 제외) |
| **Phase 2 합계** | **26** | **20** | **1** | **5** | **80%** |

> ⚠️ 미완료 5개: C-06(가중치 근거 문서화), M-05(densityBaseline 실증), M-08(프랜차이즈 커버리지), m-04(U커브 가중치 영향도 분석) + Phase 1 잔여 1개

### 전체 요약

| 구분 | 전체 항목 | 완료 | SKIP | 실질 미완료 | **진행률** |
|------|:--------:|:----:|:----:|:-----------:|:---------:|
| Phase 1 | 28 | 20 | 11 | 1 | **95%** |
| Phase 2 | 26 | 20 | 1 | 5 | **80%** |
| **전체** | **54** | **40** | **12** | **6** | **약 74%** |

> 📌 **단, Phase 1 전제인 기반 인프라(orchestrator 5개 슬롯, 스코어링 3개 모듈, 인사이트 4개 룰)는 이미 구축 완료.**
> Phase 1 체크리스트는 "추가 기능" 기준이며, 서비스 자체는 현재도 동작함.

### 현재 동작하는 기능 (기반 인프라)

| 기능 | 상태 |
|------|:----:|
| Kakao 지오코딩 → 위경도/법정동코드 | ✅ |
| Kakao Places 경쟁업체 검색 | ✅ |
| 서울 골목상권 수집 (서울만) | ✅ |
| KOSIS 배후 인구 수집 (전국) | ✅ |
| 지하철 역세권 분석 (수도권) | ✅ |
| 버스 접근성 분석 (전국) | ✅ |
| 경쟁 강도 스코어링 | ✅ |
| 상권 활력도 스코어링 | ✅ |
| 배후 인구 스코어링 | ✅ |
| 인사이트 빌더 (4개 룰) | ✅ |
| DB 저장 + Redis 캐시 | ✅ |
| Claude AI 리포트 생성 | ✅ |
| 분석 결과 UI (폴링) | ✅ |

---

## 9. 작업 이력

> 세션마다 완료된 작업을 기록한다. 어디까지 진행했는지 파악하는 기준 지표.
> 상태: ✅ 완료 / ⚠️ 부분완료 / ❌ 실패 / ⏭️ SKIP

| 날짜 | 작업 내용 | 상태 | 비고 |
|------|---------|:----:|------|
| 2026-02-28 | 버스 API Client-Adapter 구현 (`src/server/data-sources/bus/`) | ✅ | TAGO BusSttnInfoInqireService 연동 |
| 2026-02-28 | 지하철 역세권 분석 구현 (`src/server/data-sources/subway/`) | ✅ | ~~서울시 CardSubwayStatsNew~~ → 2026-03-02에 CardSubwayTime으로 교체 |
| 2026-02-28 | 인사이트 룰 추가 — subway, bus (`insights/rules/subway.ts`, `bus.ts`) | ✅ | builder.ts ALL_RULES에 등록 |
| 2026-02-28 | **전체 mock 데이터 제거** — `src/server/data-sources/mock/` 디렉토리 삭제 | ✅ | 10개 JSON 파일 삭제, USE_MOCK 패턴 7개 클라이언트에서 제거 |
| 2026-02-28 | kakao/client.ts mock 제거 후 함수 시그니처 손상 → 복구 | ✅ | `searchByKeyword` 반환 타입 선언 재복구 |
| 2026-02-28 | analysis-result.tsx 버스 UI 수정 — null 시 "데이터 수집 실패" 표기 | ✅ | bus===null 분기 추가 |
| 2026-02-28 | `.claude/rules/backend-data.md` mock 금지 규칙 추가 | ✅ | `USE_MOCK` 패턴 절대 금지 명문화 |
| 2026-02-28 | `docs/implementation-status.md` 최초 작성 | ✅ | scoring-engine-validator + senior-backend-architect 에이전트 분석 기반 |
| 2026-02-28 | NPS / 부동산 실거래 / 프랜차이즈 orchestrator 연결 → **SKIP 결정** | ⏭️ | 데이터 무의미 판정, 전체 체크리스트에 SKIP 표시 완료 |
| 2026-02-28 | 체크리스트 Phase 1 / Phase 2 구조 재편 | ✅ | public-data-researcher + scoring-engine-validator 에이전트 협업 결과 반영 |
| 2026-02-28 | 규칙 파일 전수 대조 — 체크리스트 vs 실제 코드 정합성 검토 | ✅ | 8개 불일치 수정 (버스 버그 명시, DB 필드 구조, 인사이트 빌더 구조 등) |
| 2026-02-28 | **스코어링 전면 감사** — scoring-engine-validator(박사님) 전체 코드 감사 | ✅ | 종합 4/10점. Critical 4건·Major 4건·Minor 4건 발견. 6-G에 체크리스트 반영 완료 |
| 2026-03-02 | **[C3] 상권변화지표 LL/HH 정의 오류 수정** — `scoring/vitality.ts` `calcChangeScore()` | ✅ | researcher 공식 정의 확인 → 박사님 승인 → LL 90점→25점 (불안정 상권을 활발로 잘못 평가하던 치명적 오류 수정) |
| 2026-03-02 | **[M4] 생존율 구현 + [C1] totalScore 재설계** | ✅ | `scoring/survival.ts` 신규 작성 + `actions.ts` calcTotalScore() 추가. 서울: 4대 지표 가중합산 / 비서울: competition+population fallback |
| 2026-03-02 | **[C4][M1][M3][C2] 스코어링 4개 항목 보강** | ✅ | 밀집도 시그모이드 커브 / 유동인구 max 200만 / 지하철 거리 계단식 감쇠 / 가중치 75/25 통일 |
| 2026-03-02 | **부동산 실거래 API 재검토** — scoring-engine-validator 재심사 | ⏭️ SKIP | 점수화 불가(비단조적 관계·다중공선성), 팩트 표시도 낮은 우선순위. 향후 상가 임대료 API 확보 시 재논의 |
| 2026-03-02 | **[6-E] 버스 cityCode 하드코딩 제거** — 전국 17개 시도 커버 | ✅ | `REGION_PREFIX_TO_CITY_CODE` 매핑 + `getCityCodeFromRegionCode()` + orchestrator regionCode 전달 |
| 2026-03-02 | **[6-H] scoreBreakdownSchema population + survival 추가** — `schema.ts` | ✅ | population(기존 저장 중이었으나 스키마 누락) + survival 필드 추가 |
| 2026-03-02 | **[6-H] buildVitalityInsights → buildPopulationInsights rename** | ✅ | builder.ts·index.ts·analysis-result.tsx 전수 변경, re-export alias 버그 수정 |
| 2026-03-02 | **[6-H] redis.ts CACHE_TTL.BUS 상수 추가** — `bus/client.ts` CACHE_TTL.SEOUL 오용 수정 | ✅ | 7일 TTL 전용 상수 분리 |
| 2026-03-02 | **PROJECT_INDEX.md 최신화** | ✅ | SKIP 항목 반영, mock 패턴 제거, 슬롯 구조·survival.ts·totalScore 재설계 반영 |
| 2026-03-02 | **[6-G m1] 프랜차이즈 U커브 0% 시작점 40→25점** — `scoring/competition.ts` | ✅ | 박사님 조건부 승인. 종합점수 영향 약 -0.94점, 등급 변화 없음 |
| 2026-03-02 | **NEIS API 조사** — 초중고/유치원/학생수 | ⚠️ | schoolInfo만 성공(위경도·학생수 없음). 유치원 서비스명 미발견. 표준데이터 CSV 방식으로 전환 결정 |
| 2026-03-02 | **전국초중등학교위치표준데이터 CSV 확보** | ✅ | ~/Downloads/ 저장. 12,013개 전국 학교, 위경도 포함, EUC-KR 인코딩 |
| 2026-03-02 | **data.go.kr 활용신청** — 대학교·HIRA 의료 | ✅ | 대학알리미 대학 기본 정보 + 의료기관별상세정보 승인 완료. DATA_GO_KR_API_KEY 사용 가능 |
| 2026-03-02 | **[S1] 초중고 학교 DB 적재 + 인사이트 구현** | ✅ | CSV(12,014개) → Prisma School 모델 → seed 적재 → school/adapter.ts → insights/rules/school.ts → orchestrator 슬롯 6 연결 + UI 추가 |
| 2026-03-02 | **[S2] 대학교 Kakao 기반 구현** | ✅ | kakao/client.ts searchByCategory 추가 → university/adapter.ts → insights/rules/university.ts (방학 리스크 포함) → orchestrator 슬롯 7 + UI |
| 2026-03-02 | **[S3] 의료시설 Kakao HP8 기반 구현** | ✅ | medical/adapter.ts → insights/rules/medical.ts (종별 분류) → orchestrator 슬롯 8 + UI |
| 2026-03-02 | **지도 마커 반경 밖 버그 수정** — competitor-map.tsx isInRadius 체크 추가 | ✅ | 대학교·의료시설 forEach에 반경 체크 추가. Kakao distance 필드 `"0"` 반환 → haversine 직접 계산으로 전환 |
| 2026-03-02 | **의료시설 마커 종류 조정** — 병원+종합병원 표시 (의원만 제외) | ✅ | 성남시의료원 등 시립의료원이 Kakao에서 "병원"으로 분류됨 → 지도 레벨 필터 제거, adapter 수준에서 의원만 제외 유지 |
| 2026-03-02 | **교육·의료 인사이트 업종별 분기** — school/university/medical rules | ✅ | 학원→학교 강조, 카페·음식점·의류→대학가 강조, 약국→처방전, 편의점→환자 수요 메시지 |
| 2026-03-02 | **반경 매직 넘버 상수화** — `constants.ts` | ✅ | `UNIVERSITY_RADIUS`, `MEDICAL_RADIUS` 추출. university/medical adapter 하드코딩 제거 |
| 2026-03-02 | **학교 반경 레벨별 분리 시도 → SKIP** | ⏭️ | 학생수 데이터 없이 개수만 세는 구조에서 의미 없음 판정. 사용자 선택 반경 유지로 롤백 |
| 2026-03-02 | **[T4] 버스 비서울 지역 검증 + 3개 버그 수정** | ✅ | (1) 경기도 prefix "31"→"41" 수정 (2) 정류소 응답 citycode 필드 노선 조회에 직접 사용 (3) routeno 필드 추가(부산/대구/인천 등) (4) 레거시 nodeId 우선순위 낮춤 — 경기/부산/대구/인천 전 지역 노선 조회 성공 |
| 2026-03-02 | **버스 인사이트 노선명 표시** — `insights/rules/bus.ts` formatRouteNo 추가 | ✅ | "해운대구2" → "2번" 형식 변환. 최대 5개 + "외 N개" 표시 |
| 2026-03-02 | **버스 대표 정류소 선택 로직 개선** — `bus/adapter.ts` | ✅ | 가장 가까운 정류소 → 노선 수 가장 많은 정류소 우선. 레거시 CGB nodeId 자연스럽게 후순위 처리 |
| 2026-03-02 | **의료시설 종합병원+의료원+대학병원만 표시** — `medical/adapter.ts` + `competitor-map.tsx` | ✅ | classifyMedical에 place_name 체크 추가(의료원/대학병원 → 종합병원 분류). 병원·의원 완전 제외. 지도 마커 이중 필터 |
| 2026-03-02 | **지도 마커 isInRadius 전수검사** — `competitor-map.tsx` | ✅ | isInRadius 함수를 모든 마커 섹션 앞(line 161)으로 이동. places/subway/school 섹션에 isInRadius 체크 추가. 6개 마커 타입 전부 반경 내만 표시 |
| 2026-03-02 | **대학교 카페/식당 오탐 버그 수정** — `university/adapter.ts` | ✅ | "파스쿠찌 가천대학교" 등 place_name에 "대학교" 포함된 카페가 대학교로 오분류. `category_name.includes("대학교")` 조건 추가로 해결 |
| 2026-03-02 | **[T6] 건축물대장 SKIP 결정** | ⏭️ | API 위경도 반경 조회 불가(법정동코드+번지 개별 조회만 지원). 구현 난도 대비 효용 낮음. 입주예정 아파트도 동시 SKIP |
| 2026-03-02 | **지하철 승하차 API 교체** — `CardSubwayStatsNew` → `CardSubwayTime` (OA-12252) | ✅ | 기존 서비스 전 날짜 INFO-200 반환 확인(deprecated). 월별 시간대별 24슬롯 합산 → 일평균 방식으로 전환. subway/client.ts 전면 재작성 + adapter.ts 함수명 업데이트 |
| 2026-03-02 | **Phase 2 검증 작업 — C-01~C-08, M-01~M-12, m-01~m-06** | ✅/⏭️ | 25개 항목 중 20개 완료(80%). C-04/C-05/M-03/M-04/M-06 현행 유지 결정(박사님). M-10 비프랜차이즈 U커브 제외 구현. M-12 combinedRiskInsights 5패턴 구현. C-01 비서울 UI 구분. M-02 F등급 경고 배너. m-01/m-02 breakdown 배지. 미완료: C-06/M-05/M-08/m-04 |

---

### 미해결 버그 / 알려진 이슈

| 우선순위 | 항목 | 위치 | 증상 |
|:--------:|------|------|------|
| ~~🔴 High~~ | ~~버스 cityCode 하드코딩~~ | — | ✅ 완료 (2026-03-02) — 전국 17개 시도 매핑으로 교체 |
| ~~🟡 Mid~~ | ~~competition.ts 주석-코드 불일치~~ | — | ✅ 완료 (2026-03-02) — 75/25 통일 |
| ~~🟡 Mid~~ | ~~buildVitalityInsights 함수명 불일치~~ | — | ✅ 완료 (2026-03-02) — buildPopulationInsights로 rename |
| ~~🟡 Mid~~ | ~~scoreBreakdownSchema population 누락~~ | — | ✅ 완료 (2026-03-02) — population + survival 필드 추가 |
| ~~🟡 Mid~~ | ~~PROJECT_INDEX.md 내용 오래됨~~ | — | ✅ 완료 (2026-03-02) |
| ~~🔴 High~~ | ~~totalScore = competition 단독 [C1]~~ | ~~`features/analysis/actions.ts`~~ | ✅ 완료 (2026-03-02) — 4대 지표 가중합산으로 교체 |
| ~~🔴 High~~ | ~~상권변화지표 LL/HH 해석 반전 가능성 [C3]~~ | ~~`scoring/vitality.ts` `calcChangeScore()`~~ | ✅ 완료 (2026-03-02) — LH=85/HL=55/HH=30/LL=25 로 수정 |
| ~~🔴 High~~ | ~~밀집도 ratio≥1 → 무조건 100점 [C4]~~ | ~~`scoring/competition.ts`~~ | ✅ 완료 (2026-03-02) — 시그모이드 커브 적용 |
| ~~🟡 Mid~~ | ~~유동인구 max=50만 [M1]~~ | ~~`scoring/vitality.ts`~~ | ✅ 완료 (2026-03-02) — 200만으로 상향 |
| ~~🟡 Mid~~ | ~~경쟁 점수 가중치 불일치 [C2]~~ | ~~`scoring/competition.ts`~~ | ✅ 완료 (2026-03-02) — 75/25로 통일 |
| ~~🟢 Low~~ | ~~Kakao Places Redis 캐시 없음~~ | — | ⏭️ SKIP — lat/lng 조합 사용자마다 달라 히트율 미미 |

---

## 10. 다음 세션 작업 계획

> 우선순위 순서대로 진행한다.

### Phase 2 — 80% 완료. 미완료 5개 항목 진행 권장

> Phase 1 + Phase 2 대부분 완료. 남은 주요 항목:
> 1. **[C-06]** 4대 지표 가중치 근거 문서화 (이 섹션에 직접 추가)
> 2. **[M-05]** densityBaseline 실증 통계 확보 (Data Researcher)
> 3. **[M-08]** 프랜차이즈 브랜드 커버리지 검증 (Data Researcher)
> 4. **[m-04]** U커브 25% 가중치 영향도 분석 (Scoring Validator)

### 🟢 잔여 작업 우선순위

1. **[C-06] 가중치 근거 문서화** — 즉시 가능, 코드 변경 없음
2. **[M-05/M-08]** — 공공데이터 리서처 투입 필요
3. **[m-04]** — 박사님 분석 필요

### ⏳ API 키 발급 대기 (추후 진행)

| 시설 | 신청 사이트 | 환경변수 | 상태 |
|------|-----------|---------|------|
| ~~어린이집~~ | — | — | ⛔ SKIP (임팩트 미미) |
| ~~유치원~~ | — | — | ⛔ SKIP (임팩트 미미) |
| NEIS (초중고 API) | https://open.neis.go.kr | `NEIS_API_KEY` | ✅ 발급 완료 (`4a544d...`) — but 초중고는 표준데이터 CSV 방식으로 대체 |

> ⚠️ 어린이집·유치원은 키 발급 후 반드시 실제 API 응답 샘플 확인 후 구현할 것.
> 추측 기반 구현 절대 금지.
