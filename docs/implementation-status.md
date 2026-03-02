# 창업 분석기 — 구현 현황 & 페이즈별 체크리스트

> 마지막 업데이트: 2026-03-02 (C3 상권변화지표 수정, M4 생존율 구현, C1 totalScore 재설계)
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
    └── [5] 버스                   → 정류장 접근성 (전국, ⚠️ 노선 조회는 cityCode=11 서울 고정 버그)
    ↓
스코어링 엔진
    ├── competition.ts  → competitionScore (totalScore로 단독 사용 중)
    ├── vitality.ts     → vitalityScore (scoreDetail JSON에만 저장)
    └── population.ts   → populationScore (scoreDetail JSON에만 저장)
    ↓
인사이트 빌더 (competition / population / subway / bus 4개 룰)
    ↓
DB 저장 (AnalysisRequest: totalScore=competition, scoreDetail, reportData) + Redis 캐시
    ↓
Claude AI 리포트 (haiku-4-5)
```

> ~~⚠️ NPS, 부동산, 프랜차이즈 API는 Client-Adapter 구현 완료됐으나 orchestrator 미연결~~ → **SKIP** (데이터 무의미 판정)
> ⚠️ totalScore = competition 단독 점수 (5대 지표 가중 합산 미구현)

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
| 서비스명 | CardSubwayStatsNew (서울시 일별 승하차 통계) |
| Redis 캐시 | ✅ 있음 (TTL 7일, 키: `subway:daily:{역명}:{날짜}`) |
| Orchestrator | ✅ 연결됨 (슬롯 4, 수도권) |

2단계: Kakao Places(SW8)로 반경 500m 내 역 탐색 → 가장 가까운 역 7일치 승하차 → 일평균 산출
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

> ⚠️ **버그**: `cityCode = 11` (서울) 하드코딩 → 서울 외 지역 노선 조회 0건

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
└── types.ts       — 공통 타입 (등급, 정규화)
```

> ⚠️ **현재 totalScore = competition 단독 점수**
> 5대 지표 가중 합산은 미구현. vitality, population은 scoreDetail JSON에만 저장.

### 등급 체계

| 점수 | 등급 |
|------|------|
| 80–100 | A |
| 60–79 | B |
| 40–59 | C |
| 20–39 | D |
| 0–19 | F |

### 경쟁 강도 (Competition)

수식: `densityScore × 0.90 + franchiseScore × 0.10`
> ⚠️ 코드-주석 불일치: 주석 "75%/25%" vs 실제 `0.90 / 0.10`

밀집도: `score = min(100, (√(πr²/N) / densityBaseline)² × 100)`

업종별 densityBaseline: 한식 50m / 미용실·부동산 90m / 편의점 110m / 커피 150m / 치킨 160m / 기본 250m

프랜차이즈 U커브: 0%→40점 / 20~40%→100점 / 80%+→0점

### 상권 활력도 (Vitality) — 서울만 풀스코어

| 하위 지표 | 가중치 | 계산 |
|----------|--------|------|
| 점포당 매출 | 35% | 로그 정규화 (50만~3,000만원) |
| 상권 변화 | 30% | 고정값 LL=90 / LH=70 / HL=40 / HH=20 |
| 유동인구 | 35% | `max(골목상권, 지하철)` |

비서울: `subwayScore × 0.35` → 최대 35점

### 배후 인구 (Population)

읍면동: 3,000명(0점) ~ 40,000명(100점) 로그 정규화
시군구: 50,000명(0점) ~ 600,000명(100점)

### 미구현 지표

| 지표 | 목표 가중치 | 상태 |
|------|-----------|------|
| 생존율 | 20% | ❌ closeRate/openRate 데이터 있음, 점수화 미구현 |
| ~~소득~~ | ~~10%~~ | ⛔ **SKIP** (NPS·부동산 데이터 소스 무의미 판정) |

---

## 4. 인사이트 빌더 현황

```
src/features/analysis/lib/insights/
├── builder.ts      — 룰 등록 및 실행 (ALL_RULES 배열로 4개 룰 관리)
├── index.ts        — buildInsights() / buildCompetitionInsights() / buildVitalityInsights() / buildSubwayInsights() / buildBusInsights() export
├── types.ts        — InsightData, InsightItem, InsightRule 타입
└── rules/
    ├── competition.ts  — 경쟁 강도 (densityPerMeter, franchiseRatio 기반)
    ├── population.ts   — 상권 활력도/인구 인사이트 (파일명 ≠ 역할명 — 주의)
    ├── subway.ts       — 역세권 (isStationArea, nearestStation)
    └── bus.ts          — 버스 접근성 (hasBusStop, nearestStop, routeCount)
```

> ⚠️ **함수명-파일명 불일치**: `builder.ts`의 `buildVitalityInsights()`가 실제로는 `rules/population.ts`의 `populationRules()`를 호출
> → `population.ts` 파일이 상권 활력도 + 배후인구 인사이트를 동시에 담당

InsightItem: `{ type, emoji, text, sub?, category: "scoring" | "fact" }`
- scoring = 점수에 반영된 근거
- fact = 참고 정보 (점수 미반영)

### 인사이트 메시지 요약

**경쟁 강도:** A등급 "경쟁업체 적어 진입 여건 좋아요" ~ F등급 "매장 매우 밀집 과포화"
프랜차이즈 20~40% "적절한 비율" / 0%+저등급 "상권 활성도 낮을 수 있어 신중 검토 필요"

**상권 활력도:** 점포당 매출 등급별 / 유동인구 등급별 / 폐업률 5% 기준 양호/위험

**역세권:** 일평균 10만명+ "대형 역세권" / 역거리+노선 / 비역세권 명시

**버스:** 정류장명+거리+노선수 / 5개+ "밀집" / 없음 "접근성 낮음" / null "데이터 수집 실패"

---

## 5. DB / Redis 캐시 현황

### Prisma DB

```
AnalysisRequest
├── totalScore (int)    — 현재 competition 단일값 (5대 지표 합산 미구현)
├── scoreDetail (Json)  — { competition: CompetitionAnalysis, vitality: VitalityAnalysis|null, population: PopulationAnalysis|null }
├── reportData (Json)   — AnalysisResult 전체 덤프 (places, competition, vitality, population, subway, bus 포함)
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
| 지하철 | `subway:daily:{역명}:{날짜}` | 7일 | ✅ |
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

- [ ] **어린이집 (보건복지부, data.go.kr)**
  - 서비스명: `I1880` 어린이집 정보 공개 포털 API
  - 수집: 어린이집명, 주소, 위경도, 유형(국공립/민간/가정), 정원
  - Client: `src/server/data-sources/childcare/client.ts`
  - Redis 캐시: TTL 30일
  - 인사이트: 반경 내 어린이집 수 + 유형 → `childcareRules()`
  - 활용 업종: 편의점, 분식, 키즈카페, 학원(영어유치원)

- [ ] **유치원 (교육부 유치원알리미)**
  - 수집: 유치원명, 주소, 위경도, 설립유형, 학급수, 원아수
  - Client: `src/server/data-sources/kindergarten/client.ts`
  - Redis 캐시: TTL 30일
  - 인사이트: 반경 내 유치원 수 + 원아수 합계 → `kindergartenRules()`

- [ ] **초중고등학교 (교육부 학교알리미)**
  - 수집: 학교명, 주소, 위경도, 학교급(초/중/고), 학생수
  - Client: `src/server/data-sources/school/client.ts`
  - Redis 캐시: TTL 30일
  - 인사이트: 학교급별 수 + 학생수 합계 → `schoolRules()`
  - 활용 업종: 학원(보습), 분식, 문구점

- [ ] **대학교 (한국대학교육협의회 대학알리미)**
  - 수집: 대학명, 주소, 위경도, 재학생수
  - Client: `src/server/data-sources/university/client.ts`
  - Redis 캐시: TTL 30일
  - 인사이트: 반경 내 대학교 수 + 재학생수 → `universityRules()`
  - ⚠️ 대학가 특성: 방학 시즌 매출 급감 리스크도 함께 표시

---

### 6-C. 신규 API 추가 — 의료시설

- [ ] **병의원/약국 (건강보험심사평가원 HIRA)**
  - 서비스명: HIRA 요양기관 현황 API
  - 수집: 기관명, 주소, 위경도, 종별(종합병원/병원/의원/약국), 진료과목
  - Client: `src/server/data-sources/medical/client.ts`
  - Redis 캐시: TTL 30일
  - 인사이트: 반경 내 종별 수 → `medicalRules()`
  - 활용 업종: 약국(동선 분석), 편의점(병원 인근), 병의원(클러스터 효과)

---

### 6-D. 신규 API 추가 — 주거/부동산

- [ ] **건축물대장 (국토교통부 건축HUB)**
  - 서비스명: `lawd` 건축물대장 일반 API
  - 수집: 건물용도, 세대수, 연면적, 사용승인일(신축/노후 판별)
  - 위경도 기반 반경 내 건축물 조회 → 아파트/주거용 세대수 합산
  - Client: `src/server/data-sources/building/client.ts`
  - Redis 캐시: TTL 30일
  - 인사이트: 배후세대 수 + 신축/노후 비율 → `buildingRules()`
  - ⚠️ 난도 높음: 대량 조회 최적화 필요

- [ ] **입주예정 아파트 (한국부동산원)**
  - 수집: 단지명, 주소, 입주예정월, 세대수
  - 인사이트: 향후 N개월 내 입주 예정 세대 → 미래 수요 예측 팩트 표시
  - **점수화 금지** — 불확실성 높아 팩트 표시만

---

### 6-E. 버스 전국 커버 완성

- [ ] **버스 cityCode 하드코딩 제거**
  - `getSttnThrghRouteList`의 `cityCode = 11` 서울 고정 제거
  - 위경도 기반 시도 코드 자동 판별 로직 추가
  - TAGO cityCode 매핑 테이블 작성 (서울=11, 경기=12, 부산=21, 대구=22, 인천=23, 광주=24, 대전=25 등)

- [ ] **버스(경기/광주/대구/대전/인천) 검증**
  - 각 도시별 실제 노선 조회 테스트
  - 도시코드별 API 응답 필드 차이 확인

---

### 6-F. 기존 데이터 인사이트 보강

- ~~[ ] **NPS 인사이트 룰 (`insights/rules/nps.ts`)**~~ → **SKIP**
  - 평균 운영 기간 → 상권 안정성 인사이트

- [ ] **부동산 인사이트 룰 (`insights/rules/real-estate.ts`)**
  - 평균 아파트 매매가 → 지역 구매력 팩트
  - 최근 거래 건수 → 부동산 시장 활성도 팩트

- [ ] **교육시설 인사이트 룰**
  - 학원 업종 선택 시: 반경 내 초중고 학생수 강조
  - 카페/음식점 업종 시: 대학교 재학생수 강조

- [ ] **의료시설 인사이트 룰**
  - 약국 업종 시: 인근 병의원·종합병원 수 강조
  - 편의점 업종 시: 병원 인근 여부 팩트 표시

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

- [ ] **[m1] 프랜차이즈 U커브 0% 시작점 조정**
  - 현재: 0% → 40점
  - 권장: 0% → 20~30점으로 하향 검토
  - `scoring/competition.ts`의 `calculateFranchiseUCurve()` 수정

- ~~[ ] **소득 지표 구현**~~ → **SKIP** (NPS·부동산 데이터 소스 무의미 판정)

---

### 6-H. 기술부채 해소

- [x] **[C2] 가중치 주석-코드 불일치 수정 → 완료 (2026-03-02)**
  - `DENSITY_WEIGHT=0.75 / FRANCHISE_WEIGHT=0.25` 로 통일

- ~~[ ] **Kakao Places Redis 캐시 추가**~~ → **SKIP** (lat/lng 조합이 사용자마다 다름 → 캐시 히트율 미미, 메모리 낭비)

- ~~[ ] **부동산 실거래 Redis 캐시 적용**~~ → **SKIP**

- [ ] **인사이트 함수명 정리**
  - `buildVitalityInsights()` → 실제 호출하는 `populationRules`와 이름 일치시키기
  - 또는 빌더 내 역할 명확히 주석화

- [ ] **scoreBreakdownSchema에 population 추가**
  - `actions.ts`에서 population을 저장하지만 zod 스키마 누락 → 타입 안전성 보강

- [ ] **PROJECT_INDEX.md 최신화**
  - 오케스트레이터 플로우에 nps/real-estate가 여전히 연결된 것으로 표기됨 → SKIP 반영
  - "Graceful Degradation: hasApiKey() → false이면 mock 데이터 자동 전환" 표기 삭제 (mock 전면 제거됨)
  - 외부 API 연동 테이블의 "모킹" 열 → SKIP/없음으로 수정

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
| 어린이집/유치원 수 | L | L | M | L | H | X | M | M |
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

### 7-C. 위험 신호 조합 패턴 — 구현 예정

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
| C-01 | **비서울 지역 활력도 0점 vs "데이터 없음" 구분 UI** 동일하게 보이면 사용자가 "이 상권이 죽었다"로 오해 | `[ ]` | Frontend |
| C-02 | **상권코드-반경 매핑 정합성** 사용자 반경 500m 선택 시 2km 상권코드가 매칭되면 점수 왜곡 | `[ ]` | Backend |
| C-03 | **KOSIS 인구 공간 해상도 한계 고지** 읍면동 인구 4만명 ≠ 반경 500m 거주 인구. 사용자에게 명시 | `[ ]` | Frontend + Insights |
| C-04 | **점포당 매출 정규화 업종별 분리** 편의점 5,000만원과 네일숍 300만원은 같은 척도 불가 | `[ ]` | Scoring Validator 먼저 |
| C-05 | **유동인구 정규화 범위 실증 검증** 현재 ln(5,000)~ln(500,000)이 실제 데이터 분포와 일치하는지 확인 | `[ ]` | Data Researcher |
| C-06 | **5대 지표 가중치 근거 문서화** 이론적 또는 실증적 근거 없는 가중치는 신뢰도 훼손 | `[ ]` | Scoring Validator |
| C-07 | **상권변화지표 업종별 해석 차이** HH(정체)가 부동산중개는 안정, 학원은 불안정을 의미하는 등 업종별 역전 케이스 | `[ ]` | Scoring Validator |
| C-08 | **카드 결제 기반 매출 과소추정 명시** 현금 거래 높은 업종에서 골목상권 매출이 실제보다 낮게 표시될 수 있음 | `[ ]` | Insights |

---

### 7-E. Major — 조속히 해결

| # | 항목 | 상태 | 담당 |
|---|------|:---:|------|
| M-01 | **경쟁업체 0개 = 100점 오해 방지** "수요 없는 곳"일 수 있음. 경고 메시지 추가 | `[ ]` | Insights |
| M-02 | **종합 A등급인데 핵심 지표 F등급 경고** 한 축이 완전히 무너진 경우 종합 점수만 보고 의사결정 방지 | `[ ]` | Frontend |
| M-03 | **비선형 커브(^2.0) 도메인 적합성** ratio=0.5일 때 25점 — 실제 상권 감각에 부합하는지 | `[ ]` | Scoring Validator |
| M-04 | **활력도 점수의 업종 무관 적용** 커피전문점과 부동산중개에 같은 유동인구 가중치 35% 적용 중 | `[ ]` | Scoring Validator |
| M-05 | **densityBaseline 통계적 근거 확보** 현재 경험 추정값인 densityBaseline의 실제 업종별 밀집도 통계 대조 | `[ ]` | Data Researcher |
| M-06 | **상권변화지표 30% 가중치의 이산값 점프** 4단계 이산값(20/40/70/90)이 연속 데이터와 합산 시 급격한 점수 변동 | `[ ]` | Scoring Validator |
| M-07 | **유동인구 fallback 투명성** 유동인구 없어 fallback 가중치 적용 시 사용자에게 명시 | `[ ]` | Insights |
| M-08 | **프랜차이즈 브랜드 목록 커버리지** ~150개 하드코딩이 실제 시장의 몇%인지 검증. 신규 브랜드 누락 확인 | `[ ]` | Data Researcher |
| M-09 | **데이터 기준 시점 표시** 서울 골목상권(분기), KOSIS(연도), 부동산(월) — UI에 "X년 X분기 기준" 표시 | `[ ]` | Frontend |
| M-10 | **비프랜차이즈 업종 U커브 제외** 부동산중개·병의원 업종에서 프랜차이즈 U커브 점수 제외 처리 | `[ ]` | Backend |
| M-11 | **대학가 방학 리스크 표시** 대학교 인근 입지는 방학 기간 매출 급감 위험 명시 | `[ ]` | Insights |
| M-12 | **위험 신호 조합 패턴 구현** 유령상권·레드오션·거품상권 등 복합 경고 인사이트 추가 | `[ ]` | Backend + Insights |

---

### 7-F. Minor — 개선 권장

| # | 항목 | 상태 | 담당 |
|---|------|:---:|------|
| m-01 | **점수 breakdown UI** "경쟁 점수 30점인 이유"를 세부 수치(밀집도/기준값/프랜차이즈%)로 표시 | `[ ]` | Frontend |
| m-02 | **활력도 세부 점수 공개** 매출 점수 + 상권변화 점수 + 유동인구 점수 breakdown | `[ ]` | Frontend |
| m-03 | **상권변화지표 자연어 변환 확인** HH/HL/LH/LL이 사용자 화면에 직접 노출되지 않는지 확인 | `[ ]` | Insights |
| m-04 | **프랜차이즈 U커브 10% 가중치 영향도** 10% 가중치로 U커브를 유지하는 것의 실질적 효과 분석 | `[ ]` | Scoring Validator |
| ~~m-05~~ | ~~**NPS 1인 사업장 누락 규모**~~ | ~~`[ ]`~~ | **SKIP** |
| m-06 | **개업률 단독 표시 방식 검토** 높은 개업률이 "활발함"인지 "과열 직전"인지 양면 해석 가능 — 폐업률과 묶어서만 표시 | `[ ]` | Insights |

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

> 마지막 집계: 2026-02-28
> SKIP 항목은 분모에서 제외. "완료"는 코드 구현이 실제로 된 것만 인정.

### Phase 1 — 구현

| 섹션 | 항목 | 완료 | SKIP | 미완료 | 진행률 |
|------|:----:|:----:|:----:|:------:|:------:|
| 6-A. orchestrator 연결 | 3 | 0 | 3 | 0 | ~~100%~~ (전체 SKIP) |
| 6-B. 교육시설 API 추가 | 4 | 0 | 0 | 4 | 0% |
| 6-C. 의료시설 API 추가 | 1 | 0 | 0 | 1 | 0% |
| 6-D. 주거/부동산 API 추가 | 2 | 0 | 0 | 2 | 0% |
| 6-E. 버스 전국 커버 | 2 | 0 | 0 | 2 | 0% |
| 6-F. 인사이트 보강 | 4 | 0 | 1 | 3 | 0% |
| 6-G. 스코어링 보강 | 9 | 7 | 1 | 1 | 88% |
| 6-H. 기술부채 해소 | 6 | 1 | 4 | 1 | 50% |
| **Phase 1 합계** | **28** | **8** | **10** | **10** | **44%** |

> 💡 실질 미완료 항목(SKIP 제외): **10개**

### Phase 2 — 검증

| 섹션 | 항목 | 완료 | SKIP | 미완료 | 진행률 |
|------|:----:|:----:|:----:|:------:|:------:|
| 7-D. Critical | 8 | 0 | 0 | 8 | 0% |
| 7-E. Major | 12 | 0 | 0 | 12 | 0% |
| 7-F. Minor | 6 | 0 | 1 | 5 | 0% |
| **Phase 2 합계** | **26** | **0** | **1** | **25** | **0%** |

> ⚠️ Phase 2는 Phase 1 완료 후 진행. 현재는 계획 단계.

### 전체 요약

| 구분 | 전체 항목 | 완료 | SKIP | 실질 미완료 | **진행률** |
|------|:--------:|:----:|:----:|:-----------:|:---------:|
| Phase 1 | 28 | 8 | 10 | 10 | **44%** |
| Phase 2 | 26 | 0 | 1 | 25 | **0% (계획)** |
| **전체** | **54** | **8** | **11** | **35** | **약 19%** |

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
| 버스 접근성 분석 (전국, 노선 서울만) | ⚠️ |
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
| 2026-02-28 | 지하철 역세권 분석 구현 (`src/server/data-sources/subway/`) | ✅ | 서울시 CardSubwayStatsNew + Kakao Places(SW8) |
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
