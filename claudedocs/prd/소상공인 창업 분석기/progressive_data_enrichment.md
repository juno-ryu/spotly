# Progressive Data Enrichment — 스텝별 API 프리페치 전략

> **작성일**: 2026년 2월 15일
> **관련 문서**: [scoring_model_v2.md](./scoring_model_v2.md)
> **목표**: 현재 Step 5에서 일괄 호출하는 6~9개 API를 Step 2~4에 분산 배치하여, 최종 분석 대기시간을 ~8초 → ~1.5초로 단축

---

## 1. 현행 문제: "Step 5 병목"

```
현행 플로우:
Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → [POST /api/analyze] → 6~9개 API 동시 호출 → ~8초 대기
                                                                      ↑ 전부 여기서 발생
```

사용자는 Step 2에서 업종을 선택한 순간부터 `industryCode`가 확정되고, Step 3에서 지역을 선택하면 `regionCode`가 확정된다. 하지만 현재 코드(`data-aggregator.ts`)는 이 모든 파라미터가 모인 Step 5에서야 API 호출을 시작한다.

---

## 2. API별 필수 입력값과 최초 가용 시점

### 2.1 전체 API 맵

| API | 클라이언트 | 필수 입력값 | 최초 가용 Step | 현재 호출 시점 |
|-----|-----------|------------|---------------|---------------|
| 골목상권 — 상권변화지표 | `golmokClient.getChangeIndex()` | 없음 (전체 조회) | **Step 1** ⭐ | Step 5 |
| 골목상권 — 추정매출 | `golmokClient.getEstimatedSales()` | `industryKeyword` | **Step 2** | Step 5 |
| 골목상권 — 점포(개폐업) | `golmokClient.getStoreStatus()` | `industryKeyword` | **Step 2** | Step 5 |
| KOSIS 인구·세대 | `kosisClient.getPopulationByDistrict()` | `districtCode` (5자리) | **Step 3** | Step 5 |
| NPS 사업장 검색 | `npsClient.searchBusinesses()` | `regionCode` + `keyword` | **Step 3** | Step 5 |
| 부동산 실거래 | `realEstateClient.getApartmentTransactions()` | `regionCode` + `yearMonth` | **Step 3** | Step 5 |
| NPS 상세 조회 (×20) | `npsClient.getBusinessDetail()` | `seq` (검색 결과) | **Step 3 이후** | Step 5 |
| NPS 월별 추이 (×20) | `npsClient.getMonthlyTrend()` | `seq` (검색 결과) | **Step 3 이후** | Step 5 |
| Kakao 장소 검색 | Kakao REST API | `lat`, `lng`, `keyword` | **Step 4** | Step 5 |

### 2.2 핵심 발견

- **골목상권 변화지표**는 입력값이 **아예 없음** → Step 1 로딩 중에 미리 호출 가능
- **골목상권 매출/점포**는 `industryKeyword`만 있으면 됨 → Step 2 직후 호출 가능
- **NPS + 부동산 + KOSIS**는 `regionCode`가 필요 → Step 3 직후 호출 가능
- **NPS 상세/추이**는 NPS 검색 결과의 `seq`가 필요 → Step 3 검색 완료 직후 체이닝 가능

---

## 3. 스텝별 프리페치 파이프라인 설계

### 3.0 레이어 개요

```
Step 1 (인트로)        → Layer 0: 골목상권 변화지표 (입력값 불필요)
                         ⏬ 캐시 워밍
Step 2 (업종 선택)     → Layer 1: 골목상권 매출 + 점포 (industryKeyword 확정)
                         ⏬ 캐시 워밍
Step 3 (지역 선택)     → Layer 2: NPS검색 + 부동산 + KOSIS (regionCode 확정)
                         ⏬ 체이닝
                         Layer 2.5: NPS 상세 + 추이 (검색 결과 seq 확보)
                         ⏬ 캐시 워밍
Step 4 (지도 위치 조정) → Layer 3: Kakao 장소검색 + 법정동 변경 시 Delta Fetch
                         ⏬ 캐시 워밍
Step 5 (반경 확정)     → Layer 4: 캐시 히트 → 스코어링만 계산 (~0.5초)
```

---

### 3.1 Layer 0 — Step 1 (인트로 화면)

**트리거**: 페이지 진입 시 즉시

| API 호출 | 조건 | 용도 (스코어링 v2) |
|----------|------|-------------------|
| `golmokClient.getChangeIndex({})` | 서울 API 키 있을 때만 | 생존율 보정, 활력도 보정 |

**구현 방식**: 클라이언트에서 `/api/prefetch/golmok-index` 호출 → Redis 캐시에 저장

```typescript
// API Route: /api/prefetch/golmok-index
// TTL: 24시간 (분기 데이터이므로 장기 캐시 OK)
export async function GET() {
  const data = await cachedFetch("golmok:change", CACHE_TTL.SEOUL, () =>
    golmokClient.getChangeIndex({})
  );
  return NextResponse.json({ cached: true });
}
```

**효과**: 서울 분석 시 이 데이터가 이미 Redis에 있으므로 Step 5에서 즉시 히트

---

### 3.2 Layer 1 — Step 2 직후 (업종 선택 완료)

**트리거**: 사용자가 업종 칩을 탭한 순간 (`onChange` 이벤트)
**확정되는 값**: `industryCode`, `industryKeyword`

| API 호출 | 조건 | 용도 (스코어링 v2) |
|----------|------|-------------------|
| `golmokClient.getEstimatedSales({ industryKeyword })` | 서울 API 키 있을 때 | AI 리포트 매출 분석 |
| `golmokClient.getStoreStatus({ industryKeyword })` | 서울 API 키 있을 때 | 경쟁강도 포화지수, 생존율 블렌딩 |

**구현 방식**: 클라이언트에서 `POST /api/prefetch/golmok-industry` 호출

```typescript
// Request Body: { industryKeyword: string }
// 2개 API 병렬 호출 → Redis 캐시 저장
const [sales, stores] = await Promise.allSettled([
  cachedFetch(`golmok:sales:${industryKeyword}`, CACHE_TTL.SEOUL, () =>
    golmokClient.getEstimatedSales({ industryKeyword })
  ),
  cachedFetch(`golmok:store:${industryKeyword}`, CACHE_TTL.SEOUL, () =>
    golmokClient.getStoreStatus({ industryKeyword })
  ),
]);
```

**UX 피드백**: 업종 선택 칩에 로딩 shimmer → 완료 시 ✓ 표시. 사용자에게는 "업종 정보 확인 중..." 표시.

---

### 3.3 Layer 2 — Step 3 직후 (지역 선택 완료)

**트리거**: 사용자가 지역을 검색/선택한 순간
**확정되는 값**: `regionCode` (5자리 시군구코드), `latitude`, `longitude`

이 단계가 **가장 중요** — 스코어링 v2의 핵심 데이터 3개가 모두 이 시점에 호출 가능.

| API 호출 | 필수 입력 | 용도 (스코어링 v2 지표) | 응답 크기 |
|----------|----------|----------------------|----------|
| `npsClient.searchBusinesses()` | regionCode + keyword | 활력도(30), 경쟁강도(25), 생존율(20) | ~100건 |
| `realEstateClient.getApartmentTransactions()` | regionCode + yearMonth | 주거밀도(15), 소득수준(10) | ~50건 |
| `kosisClient.getPopulationByDistrict()` | districtCode | 경쟁강도 지역계수, 주거밀도 세대당거래율 | 2건 |

**구현 방식**: `POST /api/prefetch/region`

```typescript
// Request Body: { regionCode, industryKeyword }
const [nps, realestate, kosis] = await Promise.allSettled([
  cachedFetch(`nps:search:${regionCode}:${industryKeyword}`, CACHE_TTL.NPS, () =>
    npsClient.searchBusinesses({ regionCode, keyword: industryKeyword })
  ),
  cachedFetch(`realestate:${regionCode}:${dealYearMonth}`, CACHE_TTL.REAL_ESTATE, () =>
    realEstateClient.getApartmentTransactions(regionCode, dealYearMonth)
  ),
  cachedFetch(`kosis:pop:${regionCode}`, CACHE_TTL.KOSIS, () =>
    kosisClient.getPopulationByDistrict(regionCode)
  ),
]);
```

**스코어링 v2 임팩트**:

| v2 지표 | 이 시점에 확보되는 데이터 | 선행 계산 가능 여부 |
|---------|------------------------|-------------------|
| 활력도 | NPS wkplJnngStcd (전체 활성비율), totalCount | ⚠️ 부분 (모멘텀은 추이 필요) |
| 경쟁강도 | totalCount + KOSIS population → 지역계수 | ⚠️ 부분 (radius 미확정) |
| 생존율 | 전체 items의 wkplJnngStcd 분포 | ✅ 완전 (모집단 생존율 즉시 산출) |
| 주거밀도 | 거래건수 + 평균가 + 세대수 + 인구수 | ⚠️ 부분 (세대당 거래율은 가능) |
| 소득수준 | 평균 아파트가 + 거래건수 | ✅ 완전 |

---

### 3.4 Layer 2.5 — Step 3 체이닝 (NPS 검색 결과 활용)

**트리거**: Layer 2의 NPS 검색이 완료된 직후 (자동 체이닝)
**확정되는 값**: 각 사업장의 `seq`

| API 호출 | 병렬 수 | 용도 (스코어링 v2) |
|----------|---------|-------------------|
| `npsClient.getBusinessDetail(seq)` | ×20 | 활력도 직원규모, 생존율 시간가중 |
| `npsClient.getMonthlyTrend(seq, 12)` | ×20 | 활력도 추이 모멘텀 (v2 신규) |

**구현 방식**: Layer 2 응답 핸들러에서 자동 체이닝

```typescript
// Layer 2 NPS 검색 완료 콜백
const npsResult = await npsSearchPromise;
if (npsResult) {
  const top20 = npsResult.items.slice(0, 20);
  // 즉시 상세 + 추이 병렬 호출 (각 20건 = 총 40건 API)
  await Promise.allSettled([
    ...top20.map(b => cachedFetch(`nps:detail:${b.seq}`, ...)),
    ...top20.map(b => cachedFetch(`nps:trend:${b.seq}`, ...)),
  ]);
}
```

**주의**: 40건 API를 동시에 호출하면 data.go.kr 429 제한에 걸릴 수 있음. 5건씩 배치로 호출하거나 `p-limit` 사용 권장:

```typescript
import pLimit from "p-limit";
const limit = pLimit(5); // 동시 5건 제한
await Promise.allSettled(
  top20.flatMap(b => [
    limit(() => cachedFetch(`nps:detail:${b.seq}`, ...)),
    limit(() => cachedFetch(`nps:trend:${b.seq}`, ...)),
  ])
);
```

---

### 3.5 Layer 3 — Step 4 (지도 위치 조정)

**트리거**: 사용자가 지도에서 핀을 드래그하여 위치 변경 시
**확정되는 값**: 정밀 `latitude`, `longitude`, 최종 `법정동코드`

| 시나리오 | 동작 |
|---------|------|
| 법정동 변경 없음 (같은 동 내 이동) | 추가 API 호출 없음, 기존 캐시 유지 |
| **법정동 변경됨** (다른 동으로 이동) | **Delta Fetch**: 변경된 regionCode로 Layer 2 재실행 |
| Kakao 장소 검색 | lat/lng + keyword로 주변 업체 45건 조회 |

**Delta Fetch 조건 판정**:

```typescript
// Step 4에서 핀 드래그 후 geocoding
const newRegionCode = await kakaoGeocoding(newLat, newLng);
if (newRegionCode !== prevRegionCode) {
  // 법정동이 바뀌었으므로 NPS + 부동산 + KOSIS 재호출
  prefetchRegion(newRegionCode, industryKeyword);
  setPrevRegionCode(newRegionCode);
}
```

**디바운싱**: 핀 드래그 중 지속적인 API 호출 방지

```typescript
// 500ms 디바운스 후 geocoding → Delta Fetch 판정
const debouncedCheck = useMemo(
  () => debounce(async (lat: number, lng: number) => {
    const code = await geocode(lat, lng);
    if (code !== prevRegionCode.current) {
      triggerDeltaFetch(code);
    }
  }, 500),
  []
);
```

---

### 3.6 Layer 4 — Step 5 (반경 확정 → 최종 분석)

**트리거**: 사용자가 반경을 확정하고 "분석하기" 탭

이 시점에서는 **대부분의 데이터가 이미 Redis에 캐시되어 있음**.

| 작업 | 소요 시간 | 비고 |
|------|----------|------|
| Redis 캐시에서 데이터 조회 | ~50ms | 6~9개 키 mget |
| 캐시 미스 API (있다면) | ~1~2초 | 드문 경우 |
| **스코어링 v2 계산** | **~10ms** | 순수 계산 |
| AI 리포트 생성 (Claude) | ~3~5초 | 비동기, 별도 폴링 |

**기대 효과: 스코어링 결과 표시까지 ~0.5초** (AI 리포트는 비동기 로딩)

---

## 4. 스코어링 v2 지표 × 스텝 × API 매트릭스

### 4.1 지표별 데이터 의존성 및 최초 가용 시점

```
              Step 1    Step 2    Step 3      Step 3.5     Step 4    Step 5
              (인트로)  (업종)    (지역)      (체이닝)     (지도)    (반경확정)
─────────────────────────────────────────────────────────────────────────────
활력도 30점
├─ 신규창업비율                              🔵 adptDt
├─ 직원규모                                  🔵 detail
├─ 활성비율                   🔵 wkplJnngStcd
└─ 추이모멘텀(v2)                            🔵 trend
─────────────────────────────────────────────────────────────────────────────
경쟁강도 25점
├─ 밀도(totalCount)           🔵 NPS search
├─ 지역계수(v2)               🔵 KOSIS pop
├─ 면적(radius)                                                    🔵 확정
└─ 포화지수(v2)    🔵 change  🔵 store
─────────────────────────────────────────────────────────────────────────────
생존율 20점
├─ 모집단생존율(v2)           🔵 wkplJnngStcd
├─ 시간가중생존율(v2)                        🔵 adptDt
└─ 골목블렌딩       🔵 change  🔵 store
─────────────────────────────────────────────────────────────────────────────
주거밀도 15점
├─ 거래건수                   🔵 부동산
├─ 세대당거래율(v2)           🔵 부동산+KOSIS
├─ 세대수                     🔵 KOSIS
└─ 인구수                     🔵 KOSIS
─────────────────────────────────────────────────────────────────────────────
소득수준 10점
├─ 평균거래가                 🔵 부동산
└─ 거래규모지수(v2)           🔵 부동산
─────────────────────────────────────────────────────────────────────────────

🔵 = 해당 시점에 데이터 확보 가능
```

### 4.2 스텝별 누적 데이터 커버리지

| 시점 | 스코어링 가능 비율 | 계산 가능한 지표 |
|------|------------------|----------------|
| Step 1 완료 | 0% | — |
| Step 2 완료 (서울) | ~8% | 골목상권 변화지표 + 점포 데이터 캐시 완료 |
| Step 3 완료 | **~65%** | 소득수준 100%, 주거밀도 100%, 생존율(모집단) 80%, 경쟁강도(radius 미확정) 60% |
| Step 3.5 완료 | **~90%** | + 활력도(직원/추이) 확보, 생존율(시간가중) 확보 |
| Step 4 완료 | ~92% | + Delta Fetch 시 보정 완료 |
| Step 5 완료 | **100%** | + radius 확정 → 면적 계산 → 밀도 산출 완료 |

---

## 5. API별 상세 프리페치 사양

### 5.1 골목상권 API (서울 한정)

| API | Layer | 캐시 키 | TTL | 응답 크기 | 실패 전략 |
|-----|-------|---------|-----|----------|----------|
| `getChangeIndex()` | 0 | `golmok:change` | 24h | ~50KB | 무시 (보정 비활성화) |
| `getEstimatedSales()` | 1 | `golmok:sales:{keyword}` | 12h | ~200KB | 무시 (AI리포트 매출 미포함) |
| `getStoreStatus()` | 1 | `golmok:store:{keyword}` | 12h | ~100KB | 무시 (포화지수 비활성화) |

**스코어링 v2 기여**:
- `changeIndex` → 활력도 보정 (HH/LH +5~10%), 생존율 블렌딩 가중치
- `closeRate` → 경쟁강도 포화지수 감산, 생존율 골목 블렌딩
- `openRate` → 활력도 보조 지표

### 5.2 NPS API

| API | Layer | 캐시 키 | TTL | 응답 크기 | 실패 전략 |
|-----|-------|---------|-----|----------|----------|
| `searchBusinesses()` | 2 | `nps:search:{region}:{keyword}` | 6h | ~30KB | 치명적 — 활력도/경쟁/생존 산출 불가 |
| `getBusinessDetail()` ×20 | 2.5 | `nps:detail:{seq}` | 6h | ~2KB/건 | 부분 실패 허용 |
| `getMonthlyTrend()` ×20 | 2.5 | `nps:trend:{seq}` | 6h | ~1KB/건 | 부분 실패 허용 (모멘텀 비활성화) |

**스코어링 v2 기여**:
- `searchBusinesses.totalCount` → 경쟁강도 실제밀도, 활력도 모집단 보정 **(v2 핵심)**
- `searchBusinesses.items[].wkplJnngStcd` → 생존율 모집단 계산 **(v2 핵심)**
- `getBusinessDetail.jnngpCnt` → 활력도 직원규모
- `getBusinessDetail.adptDt` → 생존율 시간가중, 활력도 신규비율
- `getMonthlyTrend.nwAcqzrCnt/lssJnngpCnt` → 활력도 추이모멘텀 **(v2 신규)**

### 5.3 부동산 실거래 API

| API | Layer | 캐시 키 | TTL | 응답 크기 | 실패 전략 |
|-----|-------|---------|-----|----------|----------|
| `getApartmentTransactions()` | 2 | `realestate:{region}:{ym}` | 12h | ~50KB | 주거밀도/소득 기본값 적용 |

**스코어링 v2 기여**:
- `transactions.length` → 주거밀도 거래건수, 소득 거래규모지수
- `calculateAveragePrice()` → 소득수준 가격비율
- `transactions.length / (households/1000)` → 주거밀도 세대당거래율 **(v2 신규)**

### 5.4 KOSIS 인구 API

| API | Layer | 캐시 키 | TTL | 응답 크기 | 실패 전략 |
|-----|-------|---------|-----|----------|----------|
| `getPopulationByDistrict()` | 2 | `kosis:pop:{district}` | 24h | ~1KB | 지역계수=1.0, 주거밀도 v1 fallback |

**스코어링 v2 기여**:
- `totalPopulation` → 경쟁강도 지역계수, 주거밀도 인구점수
- `households` → 주거밀도 세대당거래율 **(v2 핵심)**, 주거밀도 세대점수

---

## 6. 프리페치 API Route 설계

### 6.1 엔드포인트 구조

```
/api/prefetch/
├── golmok-index     GET     Layer 0: 상권변화지표
├── golmok-industry  POST    Layer 1: 업종별 매출 + 점포
├── region           POST    Layer 2: NPS + 부동산 + KOSIS
└── region-detail    POST    Layer 2.5: NPS 상세 + 추이 (체이닝)
```

### 6.2 클라이언트 훅

```typescript
// hooks/use-prefetch.ts
export function usePrefetch() {
  const prefetchGolmokIndex = useCallback(async () => {
    // Layer 0: Step 1 진입 시 호출
    await fetch("/api/prefetch/golmok-index");
  }, []);

  const prefetchIndustry = useCallback(async (industryKeyword: string) => {
    // Layer 1: Step 2 업종 선택 시 호출
    await fetch("/api/prefetch/golmok-industry", {
      method: "POST",
      body: JSON.stringify({ industryKeyword }),
    });
  }, []);

  const prefetchRegion = useCallback(async (
    regionCode: string,
    industryKeyword: string,
  ) => {
    // Layer 2 + 2.5: Step 3 지역 선택 시 호출
    // 서버에서 Layer 2 완료 후 자동으로 Layer 2.5 체이닝
    await fetch("/api/prefetch/region", {
      method: "POST",
      body: JSON.stringify({ regionCode, industryKeyword }),
    });
  }, []);

  return { prefetchGolmokIndex, prefetchIndustry, prefetchRegion };
}
```

### 6.3 각 스텝 컴포넌트 통합 위치

| 스텝 | 컴포넌트 | 훅 호출 시점 | 호출할 함수 |
|------|---------|-------------|------------|
| Step 1 | 인트로 페이지 | `useEffect([], ...)` (마운트 시) | `prefetchGolmokIndex()` |
| Step 2 | 업종 선택 칩 | `onChange` 이벤트 | `prefetchIndustry(keyword)` |
| Step 3 | 지역 검색 결과 클릭 | `onSelect` 이벤트 | `prefetchRegion(code, keyword)` |
| Step 4 | 지도 핀 드래그 | `onDragEnd` + 디바운스 | 법정동 변경 시 `prefetchRegion()` |
| Step 5 | 분석 버튼 | `onClick` | `POST /api/analyze` (캐시 히트 기대) |

---

## 7. Step 5 (최종 분석) 에서의 변화

### 7.1 현행 data-aggregator.ts 호출 흐름

```
aggregateAnalysisData() 호출
  → 1단계: NPS검색 + 부동산 + KOSIS + 골목상권 (병렬, ~3~5초)
  → 2단계: NPS 상세 + 추이 ×20 (병렬, ~3~5초)
  → 합계: ~6~8초
```

### 7.2 프리페치 적용 후

```
aggregateAnalysisData() 호출 (동일 함수, 코드 변경 최소!)
  → 1단계: cachedFetch() → Redis 히트 → ~50ms ✅
  → 2단계: cachedFetch() → Redis 히트 → ~50ms ✅
  → 합계: ~100ms + 스코어링 계산 ~10ms = ~110ms
```

**핵심**: `data-aggregator.ts`의 코드는 **거의 변경 불필요**. `cachedFetch()`가 이미 Redis를 먼저 확인하므로, 프리페치가 캐시를 채워놓으면 자동으로 히트됨.

---

## 8. UX 피드백 — 스텝별 사용자 표시

프리페치가 백그라운드에서 진행될 때, 사용자에게 진행 상황을 보여주면 체감 대기 감소.

### Step 2 업종 선택 직후

```
┌──────────────────────────────────┐
│  ☕ 카페 선택됨                   │
│  📊 카페 업종 데이터 확인 중...    │ ← 골목상권 매출/점포 프리페치
│  ✅ 카페 업종 데이터 준비 완료     │ ← 캐시 완료
└──────────────────────────────────┘
```

### Step 3 지역 선택 직후

```
┌──────────────────────────────────┐
│  📍 강남구 선택됨                  │
│  🏢 주변 사업장 조회 중... (1/3)   │ ← NPS
│  🏠 부동산 시세 조회 중... (2/3)   │ ← 부동산 실거래
│  👥 인구 데이터 조회 중... (3/3)   │ ← KOSIS
│  ✅ 지역 데이터 준비 완료          │
└──────────────────────────────────┘
```

### Step 4 하단 바텀시트

프리페치 데이터를 **즉시 미리보기**로 활용 가능:

```
┌──────────────────────────────────────────┐
│  📊 강남구 카페 미리보기                    │
│  ───────────────────────────────────────  │
│  🏢 주변 카페 47개 | 활성 39개 (83%)       │ ← NPS totalCount + wkplJnngStcd
│  🏠 최근 아파트 거래 156건 | 평균 8.2억     │ ← 부동산 실거래
│  👥 인구 312,000명 | 세대 142,000          │ ← KOSIS
│  📈 상권변화: HH (활발한 경쟁)              │ ← 골목상권 (서울)
│  ───────────────────────────────────────  │
│  💡 이미 83%의 분석 데이터가 준비되었어요    │
└──────────────────────────────────────────┘
```

이 미리보기는 **이미 캐시된 데이터만으로 렌더링** → 추가 API 호출 없음.

---

## 9. 에러 핸들링 및 Fallback

| 시나리오 | 대응 |
|---------|------|
| Layer 0/1 실패 (골목상권) | 무시. 서울 보정만 비활성화 |
| Layer 2 NPS 실패 | **치명적**. Step 5에서 재시도. 여전히 실패 시 에러 반환 |
| Layer 2 부동산 실패 | 주거밀도/소득 기본값 적용 (v1 fallback) |
| Layer 2 KOSIS 실패 | 지역계수=1.0, 주거밀도 v1 모드 |
| Layer 2.5 NPS 상세/추이 부분 실패 | 실패한 건만 Step 5에서 재시도 |
| 사용자가 Step 3 → Step 2로 돌아감 | Layer 1 재호출 (업종 변경 가능) |
| Step 4에서 법정동 변경 | Delta Fetch로 Layer 2 재실행 |
| Redis 다운 | `cachedFetch` fallback → 직접 API 호출 (현행과 동일) |

---

## 10. 성능 예측

### Before (현행)

```
Step 5 "분석하기" 클릭
  → NPS 검색: ~1.5초
  → 부동산: ~1초
  → KOSIS: ~0.5초
  → 골목상권 ×3: ~1초
  → (병렬이므로 max ~1.5초)
  → NPS 상세 ×20: ~2초
  → NPS 추이 ×20: ~2초
  → (병렬이므로 max ~3초, rate limit 고려)
  ─────────────────
  총 대기: ~5~8초 (네트워크 상태에 따라)
```

### After (프리페치 적용)

```
Step 5 "분석하기" 클릭
  → Redis mget (6~9 키): ~50ms
  → 캐시 미스 건 재호출: ~0~1초 (드문 경우)
  → 스코어링 v2 계산: ~10ms
  ─────────────────
  총 대기: ~0.1~1.5초

AI 리포트: 비동기 3~5초 (별도 폴링, 결과 페이지에서 로딩)
```

**예상 개선율**: Step 5 대기시간 **80~95% 감소**

---

## 11. 구현 우선순위

| Phase | 작업 | 효과 | 복잡도 |
|-------|------|------|--------|
| **P0** | `/api/prefetch/region` + Layer 2 | Step 5 대기시간 50% 감소 | 🟡 중간 |
| **P0** | Layer 2.5 체이닝 (NPS 상세/추이) | Step 5 대기시간 추가 30% 감소 | 🟡 중간 |
| **P1** | `use-prefetch` 훅 + Step 3 통합 | 클라이언트 트리거 | 🟢 낮음 |
| **P1** | `/api/prefetch/golmok-industry` + Layer 1 | 서울 분석 시 추가 최적화 | 🟢 낮음 |
| **P2** | Layer 0 (골목상권 변화지표) | 캐시 워밍 (효과 작음) | 🟢 낮음 |
| **P2** | Step 4 Delta Fetch + 디바운싱 | 위치 변경 시 정확도 보장 | 🟡 중간 |
| **P3** | UX 피드백 (프로그레스, 미리보기) | 체감 UX 향상 | 🟡 중간 |
