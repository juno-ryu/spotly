# 창업 분석기 — 개발 레퍼런스

> 새 기능 구현 / API 추가 / 스코어링 변경 전 반드시 읽을 것.
> 마지막 업데이트: 2026-03-03

---

## 1. 전체 아키텍처

```
사용자 주소+업종 입력
    ↓
Kakao Geocoding → 위경도 + 법정동코드 + 행정동코드(regionCode)
    ↓
analysis-orchestrator.ts (Promise.allSettled 병렬 수집)
    ├── [1] Kakao Places          → 경쟁업체 목록
    ├── [2] 서울 골목상권          → 매출/점포/유동인구 (서울만)
    ├── [3] KOSIS 인구             → 배후 인구 (전국)
    ├── [4] 지하철                 → 역세권 분석 (수도권)
    ├── [5] 버스                   → 정류장 접근성 (전국)
    ├── [6] 학교 DB                → 초중고 (전국)
    ├── [7] 대학교 Kakao           → 대학교 (전국)
    └── [8] 병의원 Kakao           → 종합병원 (전국)
    ↓
스코어링 엔진 → 4대 지표 가중합산 totalScore
    ↓
인사이트 빌더 (8개 룰) + combinedRiskInsights
    ↓
DB 저장 (AnalysisRequest) + Redis 캐시
    ↓
Claude AI 리포트 (haiku-4-5)
```

**UX 패턴**: POST → ID 즉시 반환 → 클라이언트 폴링 → 결과 표시

---

## 2. 데이터소스 현황

### 패턴: Client-Adapter 2계층

모든 데이터소스는 `src/server/data-sources/{name}/` 구조를 따른다.
- `client.ts` — API 호출, 파싱, 캐시
- `adapter.ts` — Kakao 좌표 기반 탐색 + 비즈니스 로직

### 연동된 데이터소스

| # | 데이터소스 | API 키 | 캐시 키 | TTL | 적용 범위 |
|---|-----------|--------|---------|-----|---------|
| 1 | Kakao Places | `KAKAO_REST_API_KEY` | ❌ 없음 | — | 전국 |
| 2 | 서울 골목상권 | `SEOUL_OPEN_API_KEY` | 상권코드별 분할 | 7~30일 | 서울만 |
| 3 | KOSIS 인구 | `KOSIS_API_KEY` | `kosis:population:{코드}` | 30일 | 전국 |
| 4 | 지하철 | `SEOUL_OPEN_API_KEY` | `subway:monthly:{역명}:{YYYYMM}` | 7일 | 수도권 |
| 5 | 버스 (TAGO) | `DATA_GO_KR_API_KEY` | `bus:sttn:{lat4}:{lng4}` | 7일 | 전국 |
| 6 | 학교 | DB 직접 쿼리 | Redis 불필요 | — | 전국 |
| 7 | 대학교 | `KAKAO_REST_API_KEY` | ❌ 없음 | — | 전국 |
| 8 | 병의원 | `KAKAO_REST_API_KEY` | ❌ 없음 | — | 전국 |

### SKIP 결정 (재구현 금지 — 사유 확정됨)

| API | SKIP 사유 |
|-----|---------|
| NPS 국민연금 | 데이터 무의미 판정 |
| 부동산 실거래 | 비단조적 관계·다중공선성. 향후 상가 임대료 API 확보 시 재논의 |
| 공정위 프랜차이즈 | 데이터 무의미 판정 |
| 어린이집/유치원 | 상권 분석 임팩트 미미 |
| 건축물대장 | API가 위경도 반경 조회 불가 (법정동+번지 개별 조회만) |
| 입주예정 아파트 | 불확실성 높음, 건축물대장과 동일 맥락 |
| HIRA 의료기관 | 위치 기반 검색 불가 (Kakao HP8으로 대체) |
| 대학알리미 API | 위경도·학생수 없음 (Kakao keyword로 대체) |

### 주요 구현 특이사항

**지하철 (subway)**
- 서울: 열린데이터광장 `CardSubwayTime` (OA-12252). 월별 집계, lag 2개월.
- 서울 데이터 상한: `LAST_AVAILABLE = "202412"` (202601은 미집계 데이터 희소)
- 지방: odcloud 자동변환 API — 부산(26), 대구(27), 광주(29), 대전(30)
- 광주 데이터 상한: `LAST_AVAILABLE = "202411"`
- `normalizeStationName()` — Kakao 역명("해운대역 부산2호선") → 역명("해운대")
- `matchStation()` — 괄호 표기 제거 ("화랑대(공릉)" → "화랑대") 후 일치 비교
- **빈 배열 캐시 금지**: `filtered.length > 0` 일 때만 Redis에 저장 (0건을 캐시하면 이후 계속 0건 반환)
- regionCode 매핑: 부산=26, 대구=27, 광주=29, 대전=30 (21/22/24/25 아님 — 과거 오류 수정됨)

**버스 (bus)**
- 서울: `ws.bus.go.kr` (별도 서비스 활용신청 필요, `DATA_GO_KR_API_KEY` 사용)
- 비서울: TAGO `BusSttnInfoInqireService`
- `REGION_PREFIX_TO_CITY_CODE` 매핑으로 전국 17개 시도 cityCode 자동 선택
- 정류소 응답의 `citycode` 필드를 노선 조회에 직접 사용 (요청 파라미터 cityCode 무시)
- 레거시 nodeId(CGB) 있는 정류소는 routeCount 낮아서 자연스럽게 후순위
- `distanceMeters <= radius` 필터링으로 사용자 선택 반경 내 정류소만 반환

**병의원 (medical)**
- Kakao HP8 카테고리 + "종합병원"/"의료원" 키워드 검색 병행
- 종합병원 + 의료원/대학병원만 포함, 병원·의원 완전 제외
- 탐색 반경: `Math.max(사용자반경, 2000)` — 사용자 반경이 작아도 최소 2km

**대학교 (university)**
- Kakao keyword "대학교" 검색 + `category_name.includes("대학교")` 이중 필터
- 오탐 방지: "파스쿠찌 가천대학교" 등 place_name에 "대학교" 포함 카페 → category_name으로 필터
- 탐색 반경: `Math.max(사용자반경, 1500)` — 사용자 반경이 작아도 최소 1.5km

**학교 (school)**
- CSV(전국초중등학교위치표준데이터) → Prisma School 모델 → DB 직접 쿼리
- 사용자 선택 반경 그대로 사용 (레벨별 반경 분리 SKIP — 학생수 데이터 없음)

**KOSIS 인구**
- 행정동코드(10자리) → 읍면동 단위. 실패 시 시군구(5자리) fallback
- 공간 해상도 한계: 읍면동 전체 기준, 반경 내 실거주 인구와 괴리 있음 (UI에 명시)

**서울 골목상권**
- 서울만 동작. 비서울은 vitality=null, survival=null 반환
- 상권코드(`trdarCd`) 기반 5개 API 병렬 수집 후 Redis 캐시

---

## 3. 스코어링 엔진

### 파일 구조

```
src/features/analysis/lib/scoring/
├── index.ts       — 총점 합산
├── competition.ts — 경쟁 강도
├── vitality.ts    — 상권 활력도
├── population.ts  — 배후 인구
├── survival.ts    — 생존율 (서울 전용)
└── types.ts       — 공통 타입 (등급, 정규화)
```

> ⚠️ 이 파일들은 반드시 `scoring-engine-validator` (박사님) 검토 후 수정.
> 어떤 이유로도 박사님 승인 없이 수치/가중치 변경 금지.

### 4대 지표 가중치 (박사님 검증 완료 2026-02-28)

| 지역 | 공식 |
|------|------|
| 서울 | `vitality(35%) + competition(25%) + population(20%) + survival(20%)` |
| 비서울 | `competition(55%) + population(45%)` |

### 등급 체계

| 점수 | 등급 |
|------|------|
| 80–100 | A |
| 60–79 | B |
| 40–59 | C |
| 20–39 | D |
| 0–19 | F |

### 경쟁 강도 (Competition)

- 공식: `densityScore × 0.75 + franchiseScore × 0.25`
- 밀집도 시그모이드: `100 / (1 + exp(-4 × (ratio - 1)))`
- ratio = densityBaseline / densityPerMeter
- densityBaseline: 한식 50m / 미용실·부동산 90m / 편의점 110m / 커피 150m / 치킨 160m / 기본 250m
- 프랜차이즈 U커브: 0%→25점 / 20~40%→100점 / 80%+→0점
- **비프랜차이즈 업종(의료, 부동산)**: franchiseScore=50 고정 (U커브 제외)

### 상권 활력도 (Vitality) — 서울만

| 하위 지표 | 가중치 | 계산 |
|----------|--------|------|
| 점포당 매출 | 35% | 로그 정규화 (50만~3,000만원) |
| 상권 변화 | 35% | LH=85 / HL=55 / HH=30 / LL=25 |
| 유동인구 | 30% | `max(골목상권, 지하철)` — max 200만명 기준 로그 정규화 |

> 상권변화지표: LH=확장기(좋음) / HL=안정성숙기 / HH=포화 / LL=불안정
> **과거 오류**: LL=90 (불안정을 활발로 잘못 평가) → LL=25로 수정 완료

비서울: `subwayScore × 0.35` → 최대 35점

### 배후 인구 (Population)

- 읍면동: 3,000명(0점) ~ 40,000명(100점) 로그 정규화
- 시군구: 50,000명(0점) ~ 600,000명(100점)

### 생존율 (Survival) — 서울만

- 공식: `closeScore × 0.6 + netChangeScore × 0.4`
- 폐업률 5% 기준: 낮을수록 높은 점수

---

## 4. 인사이트 빌더

```
src/features/analysis/lib/insights/
├── builder.ts      — ALL_RULES 배열, combinedRiskInsights()
├── index.ts        — buildInsights() 및 각 빌더 함수 export
├── types.ts        — InsightItem: { type, emoji, text, sub?, category }
└── rules/
    ├── competition.ts  — 경쟁 강도
    ├── population.ts   — 상권 활력도 + 배후인구
    ├── subway.ts       — 역세권
    ├── bus.ts          — 버스 접근성
    ├── school.ts       — 초중고 (학원 업종 분기)
    ├── university.ts   — 대학교 + 방학 리스크
    └── medical.ts      — 병의원 (약국/편의점 업종 분기)
```

- `category: "scoring"` — 점수에 반영된 근거
- `category: "fact"` — 참고 정보 (점수 미반영)

### combinedRiskInsights — 위험 조합 패턴 (5개)

| 패턴 | 조건 | 심각도 |
|------|------|--------|
| 유령 상권 | 유동인구 하위 20% + 매출 하위 20% + 폐업률 상위 20% | Critical |
| 레드오션 | 밀집도 < 30% + 프랜차이즈 > 60% | Critical |
| 거품 상권 | 개업률 > 10% + 폐업률 > 8% + HL | Major |
| 수요 부족 | 배후인구 < 5,000 + 유동인구 < 10,000 | Major |
| 교통 사각지대 | 지하철 없음 + 버스 노선 < 3개 | Minor |

### 업종별 인사이트 분기

| 업종 | 학교 | 대학교 | 병의원 | 프랜차이즈 |
|------|------|--------|--------|-----------|
| 학원 | "학원 입지 적합" 강조 | 해당없음 | 표시 안 함 | U커브 적용 |
| 카페/음식점/의류 | 팩트 표시 | "대학가+방학리스크" 강조 | 팩트 표시 | U커브 적용 |
| 약국 | 팩트 표시 | 팩트 표시 | "처방전 수요" 강조 | U커브 적용 |
| 편의점 | 팩트 표시 | 팩트 표시 | "환자·보호자 수요" 강조 | U커브 적용 |
| 의료/부동산 | 팩트 표시 | 팩트 표시 | 팩트 표시 | franchiseScore=50 고정 |

---

## 5. DB / Redis 구조

### Prisma 모델 (AnalysisRequest)

```
AnalysisRequest
├── totalScore (int)    — 4대 지표 가중합산
├── scoreDetail (Json)  — { competition, vitality|null, population|null, survival|null }
├── reportData (Json)   — AnalysisResult 전체 (places, competition, vitality, population, subway, bus, school, university, medical)
└── status              — PENDING / PROCESSING / COMPLETED / FAILED
```

raw 데이터 별도 모델 없음. 모든 수집 결과는 `reportData` JSON으로 저장.

### Redis 캐시 원칙

- `cachedFetch(key, ttl, fetcher)` — `src/server/cache/redis.ts`
- Redis 없으면 항상 fetcher 직행 (모킹 아님)
- **빈 배열은 캐시하지 않는다** — 지하철 등에서 0건 결과를 캐시하면 이후 갱신 불가
- TTL은 데이터 갱신 주기에 맞춰 설정 (골목상권 7~30일 / KOSIS 30일 / 지하철·버스 7일)

### Kakao Places Redis 캐시 없음 — 의도적 결정

lat/lng 조합이 사용자마다 달라 캐시 히트율 미미하고 메모리 낭비. 미구현이 정상.

---

## 6. 반경 정책 (확정 — 2026-03-02)

| 항목 | 값 | 비고 |
|------|-----|------|
| 반경 옵션 | 200m / 300m / 500m | 100m는 통계 신뢰도 부족으로 제외 |
| 반경 적용 | **전 어댑터 통일** | Kakao Places, 버스, 대학교, 병의원, 학교 전부 사용자 선택 반경 |
| 지하철 탐색 반경 | 500m 고정 | 역세권 특성상 고정 유지 |
| 병의원 최소 반경 | `Math.max(radius, 2000)` | 종합병원은 넓게 탐색 필요 |
| 대학교 최소 반경 | `Math.max(radius, 1500)` | 대학교는 넓게 탐색 필요 |
| 드래그 반경 조절 | 비활성 (주석 처리) | `radius-map.tsx` — 추후 재활성화 가능 |
| geo-utils.ts snapRadius | 200~500m 클램프 | `geo-utils.ts` |

---

## 7. 새 기능 구현 시 필수 체크

### 새 데이터소스 추가 순서

```
1. public-data-researcher → API 탐색 + 데이터 필드/단위/분포 정리
2. scoring-engine-validator → 지표 타당성 검증 + 계산 공식 승인
3. senior-backend-architect → Client-Adapter 구현 + orchestrator 연동
4. scoring-engine-validator → 구현된 스코어링 로직 최종 검증
5. code-reviewer → 전체 코드 품질 리뷰
6. senior-frontend-architect → 결과 UI 반영 (필요 시)
```

### 스코어링 수정 시

- 반드시 `scoring-engine-validator` 검토 먼저
- 대상 파일: `src/features/analysis/lib/scoring/*.ts`
- 인사이트 수치 기준도 스코어링 범주: `src/features/analysis/lib/insights/rules/*.ts`

### orchestrator 연동 시

- `analysis-orchestrator.ts`에 슬롯 추가
- `AnalysisResult` 타입에 필드 추가
- `reportData`에 자동 포함됨 (별도 DB 컬럼 불필요)
- `regionCode` 파라미터를 어댑터에 전달해야 지역별 분기 가능

### 캐시 추가 시

- 빈 배열/null 결과는 캐시하지 않도록 fetcher 내부에서 체크
- `CACHE_TTL` 상수 사용 (`src/server/cache/redis.ts`)
- 캐시 키 형식: `{dataSource}:{dimension}:{identifier}`

---

## 8. 업종별 데이터 유의미성 (설계 참고)

**H=핵심 / M=보조 / L=약함 / X=오해 유발**

| 데이터 | 음식점 | 카페 | 편의점 | 미용실 | 학원 | 의류 | 부동산 | 병의원 |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 지하철 승하차 | H | H | M | M | M | H | L | M |
| 버스 노선 수 | M | M | L | L | L | M | L | L |
| 동종업체 밀집도 | H | H | H | H | H | H | H | M |
| 프랜차이즈 비율 | H | H | H | L | M | M | X | X |
| 점포당 매출 | H | H | H | M | L | H | L | L |
| 상권변화지표 | H | H | M | M | L | H | M | L |
| 유동인구 | H | H | H | M | L | H | L | M |
| 폐업률 | H | H | H | H | H | H | M | M |
| 배후 인구 | H | M | H | H | H | M | H | H |
| 초중고 수 | L | M | M | L | H | L | M | L |
| 대학교 수 | H | H | H | M | L | H | L | L |
| 종합병원 수 | L | L | L | L | X | L | L | H |

> 병의원 업종: 메디컬 클러스터는 "경쟁"이 아닌 "집객 시너지" — 점수 해석 방향 재고 필요
> 카드 결제 기반 매출: 현금 거래 많은 업종(재래시장 식당) 과소 추정 가능 — UI에 경고 표시됨

---

## 9. 알려진 제약사항

| 항목 | 내용 |
|------|------|
| 서울 지하철 데이터 | CardSubwayTime, 2~3개월 지연. 상한선 202412 고정 |
| 광주 지하철 데이터 | 상한선 202411, 응답구조 `items[].item` 형태 |
| 부산/대구 지하철 | odcloud 자동변환 API. regionCode 26/27로 라우팅 |
| 서울 버스 | ws.bus.go.kr 별도 서비스 활용신청 필요 (KEY 등록 오류 코드 7/30) |
| KOSIS 인구 | 읍면동/시군구 단위 — 반경 내 실거주 인구와 괴리 있음 |
| 골목상권 | 서울 전용. 비서울은 vitality/survival = null |
| 골목상권 매출 | 카드 결제 기반 — 현금 거래 비율 높은 업종 과소 추정 |
| 프랜차이즈 목록 | 하드코딩 178개 브랜드 (주요 브랜드 95%+ 커버) |
| Kakao Places 캐시 | 의도적으로 미구현 (캐시 히트율 미미) |
| 지하철 빈 배열 캐시 | Redis에 0건 결과가 남아있으면 계속 0건 반환 — 빈 배열은 캐시 안 함 |

---

## 10. 🚨 인사이트 시스템 전격 개편 필요

> **우선순위: High** — 현재 인사이트가 업종 맥락과 무관하게 출력되어 사용자 신뢰도 훼손 가능성 있음.
> 담당: `ai-report-specialist` + `senior-frontend-architect`

### 핵심 문제

**카페를 선택했는데 "학원 운영에 유리한 학군입지"** 같은 텍스트가 출력됨.
현재 인사이트 룰이 업종을 일부 분기하지만, 텍스트 자체가 업종 중립적이지 않고 특정 업종(학원)에 편향된 표현을 그대로 사용.

### 체크리스트

#### [ ] 1. 인사이트 텍스트 업종 맥락화

각 룰 파일의 `text` / `sub` 워딩을 업종 무관 표현 또는 업종별 분기로 재작성.

| 파일 | 현재 문제 | 개편 방향 |
|------|---------|---------|
| `rules/school.ts` | "학원 운영에 유리한 학군" — 학원 외 업종에 노출됨 | 학원 업종만 해당 텍스트, 나머지는 "초중고 밀집 주거 상권" 등 중립 표현 |
| `rules/university.ts` | 대학교 인사이트 텍스트가 카페 외 업종에도 동일하게 출력 | 업종별 수혜 이유를 다르게 작성 (카페: 일상 소비, 의류: 트렌드 수요 등) |
| `rules/medical.ts` | 종합병원 관련 텍스트가 학원/의류 등에도 노출 | 약국·편의점만 "처방전/환자 수요" 강조, 나머지는 생략 또는 팩트만 |
| `rules/bus.ts` | 버스 접근성 설명이 업종 무관 | 업종별 유의미성 차이 반영 (배달 중심 음식점: 관련 없음 등) |
| `rules/competition.ts` | 밀집도 텍스트 업종 언급 없음 | 현행 유지 가능 (경쟁 강도는 업종 공통) |

#### [ ] 2. 섹션 표시 조건 업종 필터링

인사이트 섹션 자체를 업종에 따라 숨기는 로직 추가.

| 섹션 | 숨김 조건 |
|------|---------|
| 학교 (school) | 학원·편의점·미용실 외 업종 → 섹션 자체 접힌 상태로 기본값 또는 낮은 우선순위 |
| 병의원 (medical) | 약국·편의점 아닌 업종 → "참고 정보"로만 노출, 인사이트 텍스트 없음 |
| 대학교 (university) | 카페·의류·음식점 외 업종(예: 부동산) → 표시 안 함 |

현재 `category: "fact"` / `"scoring"` 구분은 있지만 **업종 기반 show/hide 로직 없음**.

#### [ ] 3. 업종별 인사이트 우선순위 정렬

업종에 따라 인사이트 카드의 표시 순서를 다르게 정렬.

예시:
- 카페: 교통입지 > 경쟁강도 > 대학교 > 인구 > 학교(하위)
- 학원: 학교 > 인구 > 교통입지 > 경쟁강도 > 대학교(하위)
- 약국: 병의원 > 인구 > 교통입지 > 경쟁강도

현재는 모든 업종이 동일한 순서로 섹션을 표시.

#### [ ] 4. InsightItem에 `businessTypes` 필드 추가 (설계 제안)

```typescript
interface InsightItem {
  emoji: string;
  text: string;
  sub?: string;
  category: "scoring" | "fact";
  businessTypes?: string[]; // 해당 인사이트가 유의미한 업종 코드 목록. 없으면 전체 노출.
}
```

빌더에서 `businessTypes`를 체크해 현재 업종과 맞지 않으면 필터링.

#### [ ] 5. combinedRiskInsights 업종 맥락화

"교통 사각지대" 패턴 — 배달 음식점에는 해당 없음.
업종별로 위험 패턴의 심각도 또는 표시 여부 조정 필요.

#### [ ] 6. 인사이트 텍스트 전수 검토

`ai-report-specialist`가 모든 룰 파일의 텍스트를 검토하여:
- 두루뭉실한 표현 제거
- 업종 편향 표현 → 중립 또는 분기 처리
- 사용자가 "이 인사이트가 내 업종에 왜 관련 있지?" 라고 느끼지 않도록

### 작업 순서 (권장)

```
1. ai-report-specialist → 전체 룰 파일 텍스트 검토 + 업종별 재작성 목록 작성
2. senior-frontend-architect → InsightItem businessTypes 필드 설계 + UI 필터링 로직
3. senior-backend-architect → 빌더 함수 업종 필터링 구현
4. code-reviewer → 전체 리뷰
```
