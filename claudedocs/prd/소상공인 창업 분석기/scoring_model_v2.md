# 스코어링 모델 v2 — 개선 설계서

> **작성일**: 2026년 2월 15일
> **상태**: 설계 검토
> **대상 파일**: `scoring-engine.ts`, `constants/scoring.ts`, `data-aggregator.ts`

---

## 1. 현행 모델 (v1) 약점 요약

| # | 약점 | 영향 | 심각도 |
|---|------|------|--------|
| W1 | NPS 상위 20개만 상세 조회 → 샘플 편향 | 활력도·생존율 정확도 저하 | 🔴 높음 |
| W2 | 업종별 기준밀도 하드코딩 (6개 업종만) | 미등록 업종은 default=10 적용 → 왜곡 | 🔴 높음 |
| W3 | 전국 평균 아파트가 4.5억 고정 | 시간 경과로 점차 부정확 | 🟡 중간 |
| W4 | 골목상권 보정이 서울만 적용 | 비서울 지역은 NPS 단독 의존 → 신뢰도 낮음 | 🟡 중간 |
| W5 | 선형 보간만 사용 (normalize) | 극단값에서 변별력 부족 | 🟢 낮음 |
| W6 | 데이터 품질/커버리지 불투명 | 사용자가 "72점"의 신뢰도를 알 수 없음 | 🟡 중간 |
| W7 | 월별 추이 데이터 활용 미흡 | 성장/쇠퇴 트렌드 반영 안됨 | 🟡 중간 |

---

## 2. v2 설계 원칙

1. **동일 가중치 유지** — 5대 지표 배점(30/25/20/15/10 = 100)은 변경하지 않음. 사용자 인터페이스 호환성 보장.
2. **기존 데이터 소스만 활용** — 새로운 외부 API 추가 없이, 이미 수집하는 데이터의 활용도를 극대화.
3. **신뢰도 메타데이터 추가** — 각 지표에 `confidence: 0~1` 필드를 추가하여 데이터 품질을 투명하게 공개.
4. **비서울 지역 보정 확대** — KOSIS + NPS 데이터 교차검증으로 서울 외 지역의 정확도 향상.
5. **점진적 적용** — v1 로직을 완전 교체하지 않고, 개선 레이어를 추가하는 방식으로 구현.

---

## 3. 지표별 개선안

### 3.1 상권 활력도 (30점) — `calculateVitality` v2

**현행 문제**: 상위 20개 사업장만 상세 조회하므로, 실제 사업장이 200개여도 20개의 통계에 의존.

#### 개선 내용

**A. NPS totalCount 활용**

현재 `searchBusinesses()`는 `{ items, totalCount }`를 반환하지만, `data-aggregator.ts`에서 `totalCount`를 버리고 `items`만 사용 중. `totalCount`를 AggregatedData에 추가하여 실제 모집단 크기를 반영.

```typescript
// AggregatedData에 추가
totalBusinessCount: number;  // NPS API가 반환한 실제 사업장 수
sampledCount: number;        // 상세 조회한 사업장 수 (현재 20)
```

**B. 3-요소 복합 지표 → 4-요소로 확장**

| 요소 | v1 비중 | v2 비중 | 변경사항 |
|------|--------|--------|----------|
| 신규 창업 비율 | 30% | 25% | 유지 (adptDt 기반) |
| 평균 직원 규모 | 40% | 30% | NPS totalCount로 모집단 보정 |
| 활성 비율 | 30% | 25% | 유지 |
| **추이 모멘텀** (신규) | — | **20%** | monthlyTrend 성장/감소 방향 |

**C. 추이 모멘텀 (신규 요소)**

NPS 월별 추이에서 신규 가입자(nwAcqzrCnt)와 퇴사자(lssJnngpCnt)의 순변동을 분석. 최근 12개월 중 순증가 월이 많을수록 상권이 성장 중.

```
momentum = (순증가 월 수 - 순감소 월 수) / 총 월 수
// -1(완전 쇠퇴) ~ +1(완전 성장)
```

**D. 직원 규모 보정 계수**

상세 조회 20개의 평균 직원수를, totalCount로 보정:
```
adjustedAvg = sampleAvg * (sampledCount / min(totalCount, 50))
// totalCount가 50 이상이면 표본이 상위 편중이므로 하향 보정
```

#### v2 공식

```
vitality = 30 × (
  newBizScore × 0.25 +
  adjustedEmployeeScore × 0.30 +
  activeRatioScore × 0.25 +
  momentumScore × 0.20
)
```

#### confidence 산정

```
confidence = min(sampledCount / totalBusinessCount, 1.0)
// 20/20 = 1.0 (전수 조사), 20/200 = 0.1 (10% 샘플링)
```

---

### 3.2 경쟁 강도 (25점) — `calculateCompetition` v2

**현행 문제**: 6개 업종만 기준밀도 등록. 서울 강남과 세종시의 밀도 기준이 동일.

#### 개선 내용

**A. 인구밀도 보정 계수 (Regional Coefficient)**

KOSIS 인구 데이터와 반경 면적으로 해당 지역의 인구밀도를 계산하고, 전국 평균 대비 계수를 산출:

```
regionPopDensity = population.totalPopulation / areaKm2
nationalAvgDensity = 500 // 전국 평균 약 500명/km²

regionalCoeff = clamp(regionPopDensity / nationalAvgDensity, 0.5, 2.0)
// 인구 밀집 지역은 기준밀도를 높여 경쟁 강도를 완화
// 인구 희소 지역은 기준밀도를 낮춰 경쟁 강도를 강화
```

**B. 동적 기준밀도**

하드코딩된 기준밀도에 지역계수를 곱하여 동적으로 조정:

```
adjustedBaseDensity = baseDensity[industryCode] × regionalCoeff
```

| 예시 | 기준밀도 | 인구밀도 | 계수 | 조정밀도 |
|------|---------|---------|------|---------|
| 카페, 강남 | 15 | 20,000명/km² | 2.0 (cap) | 30 |
| 카페, 세종 | 15 | 300명/km² | 0.6 | 9 |
| 치킨, 은평 | 8 | 8,000명/km² | 1.6 | 12.8 |

**C. 미등록 업종 fallback 개선**

현재 `default: 10`을 사용. v2에서는 NPS 검색 결과의 totalCount와 면적으로 **해당 지역의 실측 밀도 중앙값**을 기준밀도로 사용:

```
if (!baseDensity[industryCode]) {
  // 실측 밀도의 1.2배를 기준으로 사용 (약간의 여유)
  effectiveBaseDensity = actualDensity * 1.2;
} else {
  effectiveBaseDensity = baseDensity[industryCode] * regionalCoeff;
}
```

**D. 포화지수 가산 (서울 한정)**

골목상권 데이터에서 `closeRate`(폐업률)이 높으면 시장이 과포화:
```
if (golmok && golmok.closeRate > 10) {
  // 폐업률 10% 초과 시 경쟁 점수 하향 (시장 진입 불리)
  saturationPenalty = (golmok.closeRate - 10) / 30 * 0.15;
  competition *= (1 - saturationPenalty);
}
```

#### v2 공식

```
actualDensity = totalBusinessCount / areaKm2
adjustedBase = baseDensity × regionalCoeff  // (또는 fallback)
maxDensity = adjustedBase × 2

rawScore = normalize(maxDensity - actualDensity, 0, maxDensity, 25)
competition = rawScore × (1 - saturationPenalty)  // 서울만
```

#### confidence 산정

```
hasPopulation = population ? 1.0 : 0.5   // KOSIS 없으면 지역보정 불가
hasGolmok = golmok ? 1.0 : 0.8           // 골목상권 없어도 기본 로직 작동
confidence = hasPopulation × 0.6 + hasGolmok × 0.4
```

---

### 3.3 생존율 (20점) — `calculateSurvival` v2

**현행 문제**: 단순 활성/폐업 비율. 시간 가중치 없음. 최근 6개월 내 폐업과 5년 전 폐업을 동일 취급.

#### 개선 내용

**A. 시간 가중 생존율**

`adptDt`(가입일)을 활용하여 업력별 생존을 분석:

```
// 업력 구간별 생존 가중치
recentSurvival (2년 이내 개업 중 활성 비율) × 0.5
midSurvival (2~5년 업력 중 활성 비율) × 0.3
longSurvival (5년 이상 업력 중 활성 비율) × 0.2
```

최근 생존율이 높으면 현재 상권이 건강하다는 의미로, 더 높은 가중치를 부여.

**B. 모집단 크기 보정**

현재: `activeCount / (activeCount + closedCount)` — 20개 샘플 기준.
v2: `totalCount` 대비 `활성 비율`을 함께 고려:

```
sampleSurvivalRate = activeCount / (activeCount + closedCount)
// totalCount가 매우 클 경우, 검색 결과의 wkplJnngStcd 분포도 활용
```

NPS 검색 결과(items 배열)에는 `wkplJnngStcd`(가입상태)가 포함되어 있으므로, 상세 조회 없이도 전체 items의 활성/폐업 비율을 계산할 수 있음. → **이것이 v1의 가장 큰 낭비**. 현재는 `rawBusinesses`에서 `status`를 매핑한 후 상위 20개의 detail에서 다시 계산. 실제로는 **전체 items의 wkplJnngStcd**를 집계하면 더 정확한 모집단 생존율을 얻을 수 있음.

```typescript
// v2: 전체 items 기반 생존율 (상세 조회 불필요)
const allActive = rawBusinesses.filter(b => b.wkplJnngStcd === "1").length;
const allClosed = rawBusinesses.filter(b => b.wkplJnngStcd !== "1").length;
const populationSurvivalRate = allActive / (allActive + allClosed);
```

**C. 골목상권 블렌딩 개선 (서울)**

현행 NTS 70% + 골목상권 30% 고정 → **데이터 품질 기반 동적 비중**:
```
// 샘플 크기가 작을수록 골목상권 비중 증가
npsWeight = min(sampledCount / 20, 0.7)
golmokWeight = 1 - npsWeight
blendedRate = populationSurvivalRate * npsWeight + golmokSurvivalRate * golmokWeight
```

#### v2 공식

```
populationSurvivalRate = allActiveInSearch / totalInSearch
timeWeightedRate = recent×0.5 + mid×0.3 + long×0.2  // (상세 조회 20개 기준)

finalRate = hasGolmok
  ? populationRate × npsWeight + golmokRate × golmokWeight
  : populationRate × 0.6 + timeWeightedRate × 0.4

survival = normalize(finalRate, 0.5, 0.9, 20)
```

#### confidence 산정

```
sampleCoverage = sampledCount / totalBusinessCount
hasTimeSeries = adptDt가 있는 비율
confidence = sampleCoverage × 0.4 + hasTimeSeries × 0.3 + (hasGolmok ? 0.3 : 0)
```

---

### 3.4 주거 밀도 (15점) — `calculateResidential` v2

**현행 문제**: 거래건수 임계값(10~200) 하드코딩. 인구 100만 도시와 인구 5만 도시에 같은 기준 적용.

#### 개선 내용

**A. 인구 대비 정규화**

절대 거래건수가 아닌, 세대 대비 거래 비율로 평가:

```
tradeRate = transactionCount / (population.households / 1000)
// 1000세대당 거래건수
```

| 지역 | 거래건수 | 세대수 | v1 점수 | tradeRate | v2 점수 |
|------|---------|--------|---------|-----------|--------|
| 강남 | 300 | 200,000 | 15 (만점) | 1.5 | 11.3 |
| 세종 | 50 | 15,000 | 5.3 | 3.3 | 15 (만점) |

세종처럼 세대수 대비 활발한 거래가 있는 지역이 실제 주거 유입이 높다는 것을 반영.

**B. 복합 지표 비중 조정**

| 요소 | v1 비중 | v2 비중 | 비고 |
|------|--------|--------|------|
| 거래건수 (절대) | 40% | 20% | 기본 안전장치 유지 |
| **거래율 (세대당)** | — | **25%** | 신규 |
| 세대수 | 35% | 30% | 유지 |
| 인구수 | 25% | 25% | 유지 |

KOSIS 데이터가 없으면 v1 로직(거래건수 100%)으로 fallback.

**C. 임계값 동적 조정**

```
// 인구 규모별 임계값 자동 조정
if (population) {
  dynamicMaxTransactions = Math.max(50, population.households / 500);
  dynamicMinTransactions = Math.max(5, population.households / 5000);
}
```

#### v2 공식

```
tradeRate = transactionCount / (households / 1000)
tradeRateScore = normalize(tradeRate, 0.5, 5.0, 15)
absoluteScore = normalize(transactionCount, dynamicMin, dynamicMax, 15)
householdScore = normalize(households, 5000, 150000, 15)
populationScore = normalize(totalPopulation, 10000, 500000, 15)

residential = hasPopulation
  ? absoluteScore × 0.20 + tradeRateScore × 0.25 + householdScore × 0.30 + populationScore × 0.25
  : normalize(transactionCount, 10, 200, 15)  // v1 fallback
```

#### confidence 산정

```
confidence = hasPopulation ? 0.9 : 0.5
// 부동산 거래 데이터 지연(2~3개월)을 반영하여 최대 0.9
```

---

### 3.5 소득 수준 (10점) — `calculateIncome` v2

**현행 문제**: 전국 평균 아파트가 `NATIONAL_AVG_APT_PRICE = 45000`(만원, 4.5억) 하드코딩. 부동산 시장 변동 미반영.

#### 개선 내용

**A. 동적 기준가격**

분석 시점에 실제 수집된 부동산 거래가 데이터의 **중앙값**을 전국 기준 대용으로 활용:

```
// 캐시된 최근 거래 데이터에서 전국 기준가 산출
// Redis에 월별 전국 평균가를 캐싱하여 사용
nationalAvg = getCachedNationalAverage() ?? FALLBACK_PRICE
```

다만 단일 분석 요청에서 "전국 평균"을 실시간 산출하는 것은 비효율적이므로, **월 1회 배치로 전국 평균을 갱신**하는 것이 현실적.

단기적으로는 하드코딩 값을 **분기별로 수동 갱신**하는 것도 충분:
```typescript
// 2026 Q1 기준 (한국부동산원 실거래가 지수 참조)
export const NATIONAL_AVG_APT_PRICE = 48000; // 4.8억 (2026년 기준 갱신)
export const PRICE_UPDATE_DATE = "2026-01"; // 갱신 시점 기록
```

**B. 거래량 보정**

평균 거래가만으로는 소득 수준을 온전히 반영하지 못함. 거래가 × 거래량 = 총 거래규모를 보조 지표로 활용:

```
volumeIndex = transactionCount × avgPrice / 10000
// 거래가 높고 활발한 지역 = 실제 구매력이 있는 지역
```

**C. 비중 조정**

| 요소 | v1 비중 | v2 비중 |
|------|--------|--------|
| 평균가 / 전국평균 | 100% | 70% |
| **거래규모 지수** | — | **30%** |

#### v2 공식

```
priceRatio = avgAptPrice / nationalAvg
priceScore = normalize(priceRatio, 0.5, 2.0, 10) × 0.7

volumeIndex = (transactionCount × avgAptPrice) / 10000
volumeScore = normalize(volumeIndex, 50, 2000, 10) × 0.3

income = priceScore + volumeScore
```

#### confidence 산정

```
hasTransactions = transactionCount > 0 ? 0.8 : 0.3
priceRecent = (현재월 - dealYearMonth) < 4 ? 1.0 : 0.7
confidence = hasTransactions × priceRecent
```

---

## 4. 신뢰도 점수 (Confidence Score) — 신규 추가

### 설계 의도

"이 자리 72점입니다"만으로는 사용자가 점수의 신뢰도를 알 수 없음. "72점 (신뢰도 높음)"이면 의사결정에 도움, "72점 (신뢰도 낮음)"이면 추가 조사 권유.

### 구조

```typescript
export interface ScoreConfidence {
  /** 종합 신뢰도 (0~1, 소수점 2자리) */
  overall: number;
  /** 지표별 신뢰도 */
  breakdown: {
    vitality: number;
    competition: number;
    survival: number;
    residential: number;
    income: number;
  };
  /** 데이터 커버리지 요약 */
  dataCoverage: {
    npsCount: number;         // NPS 검색 결과 수
    npsSampledCount: number;  // 상세 조회 수
    hasRealEstate: boolean;
    hasPopulation: boolean;
    hasGolmok: boolean;
    realEstateDelay: number;  // 부동산 데이터 지연 (월)
  };
}
```

### 종합 신뢰도 산정

각 지표의 confidence를 가중치 비례로 합산:

```
overall = (
  vitality.confidence × 30 +
  competition.confidence × 25 +
  survival.confidence × 20 +
  residential.confidence × 15 +
  income.confidence × 10
) / 100
```

### UX 표시

| 신뢰도 범위 | 표시 | 설명 |
|-------------|------|------|
| 0.8 ~ 1.0 | 🟢 높음 | 충분한 데이터 기반 분석 |
| 0.5 ~ 0.8 | 🟡 보통 | 일부 데이터 부족, 참고용 |
| 0.0 ~ 0.5 | 🔴 낮음 | 데이터 부족, 추가 조사 권장 |

---

## 5. 정규화 함수 개선

### 현행: 선형 보간

```
normalize(value, min, max, maxScore) = ((value - min) / (max - min)) * maxScore
```

문제: 중간값 대역에서 변별력이 부족하고, 극단값에서 너무 빠르게 0 또는 만점에 도달.

### v2: 시그모이드 옵션 추가

실제 상권 데이터는 정규분포에 가까우므로, S-커브가 더 자연스러운 분포를 반영:

```typescript
function normalizeV2(
  value: number,
  min: number,
  max: number,
  maxScore: number,
  curve: "linear" | "sigmoid" = "linear",
): number {
  if (value <= min) return 0;
  if (value >= max) return maxScore;

  const ratio = (value - min) / (max - min);

  if (curve === "sigmoid") {
    // 로지스틱 커브: 중앙 구간에서 변별력 극대화
    const k = 6; // 기울기 조절 (높을수록 급격)
    const sigmoid = 1 / (1 + Math.exp(-k * (ratio - 0.5)));
    return Math.round(sigmoid * maxScore * 10) / 10;
  }

  return Math.round(ratio * maxScore * 10) / 10;
}
```

### 적용 전략

| 지표 | v1 | v2 | 이유 |
|------|----|----|------|
| 활력도 | linear | linear | 이미 복합 지표로 분산됨 |
| 경쟁 강도 | linear | **sigmoid** | 밀도 극단값에서 급격한 변화 방지 |
| 생존율 | linear | **sigmoid** | 50%~90% 구간에서 변별력 필요 |
| 주거 밀도 | linear | linear | 데이터 분포가 균일 |
| 소득 수준 | linear | linear | 비율 기반이라 이미 분산됨 |

---

## 6. v1 vs v2 비교표

### 가상 시나리오: 서울 강남구 치킨전문점

| 지표 | v1 점수 | v2 점수 | 변화 | 이유 |
|------|--------|--------|------|------|
| 활력도 | 22.5 | 19.8 | ↓ | 추이 모멘텀 반영 (최근 순감소) |
| 경쟁강도 | 8.0 | 12.5 | ↑ | 인구밀도 보정으로 기준밀도 상향 |
| 생존율 | 14.0 | 12.8 | ↓ | 전체 items 기반 + 시간 가중 |
| 주거밀도 | 15.0 | 13.2 | ↓ | 세대당 거래율 정규화 |
| 소득수준 | 10.0 | 9.5 | ↓ | 거래규모 지수 반영 |
| **합계** | **69.5** | **67.8** | ↓1.7 | |
| **신뢰도** | — | **0.85** 🟢 | 신규 | |

### 가상 시나리오: 세종시 카페

| 지표 | v1 점수 | v2 점수 | 변화 | 이유 |
|------|--------|--------|------|------|
| 활력도 | 18.0 | 21.5 | ↑ | 추이 모멘텀 강한 양수 (신도시 성장) |
| 경쟁강도 | 18.0 | 20.5 | ↑ | 인구밀도 낮아 기준밀도 하향 → 점수 상향 |
| 생존율 | 10.0 | 13.5 | ↑ | 전체 모집단 생존율이 샘플보다 높음 |
| 주거밀도 | 6.0 | 10.8 | ↑ | 세대당 거래율이 높음 (유입 활발) |
| 소득수준 | 5.0 | 5.5 | ↑ | 거래규모 지수 반영 |
| **합계** | **57.0** | **71.8** | ↑14.8 | |
| **신뢰도** | — | **0.62** 🟡 | 신규 | 골목상권 없어서 보통 |

**핵심 변화**: v1은 서울 편향이 심해 세종 같은 성장 도시를 과소평가. v2는 인구 대비 정규화로 이를 보정.

### 가상 시나리오: 경북 포항 한식음식점

| 지표 | v1 점수 | v2 점수 | 변화 | 이유 |
|------|--------|--------|------|------|
| 활력도 | 12.0 | 11.2 | ↓ | 추이 모멘텀 약한 음수 |
| 경쟁강도 | 15.0 | 16.8 | ↑ | 인구밀도 낮아 기준밀도 하향 |
| 생존율 | 12.0 | 11.5 | ↓ | 전체 모집단 반영 |
| 주거밀도 | 4.0 | 5.8 | ↑ | 세대당 거래율 정규화 |
| 소득수준 | 3.0 | 3.2 | → | 큰 차이 없음 |
| **합계** | **46.0** | **48.5** | ↑2.5 | |
| **신뢰도** | — | **0.55** 🟡 | 신규 | |

---

## 7. 구현 순서 (우선순위)

### Phase 1 — 즉시 적용 (코드 변경 최소)

| # | 작업 | 파일 | 복잡도 |
|---|------|------|--------|
| 1 | `AggregatedData`에 `totalBusinessCount` 추가 | data-aggregator.ts | 🟢 낮음 |
| 2 | 전체 items의 `wkplJnngStcd` 기반 생존율 계산 | scoring-engine.ts | 🟢 낮음 |
| 3 | `NATIONAL_AVG_APT_PRICE`를 2026년 기준으로 갱신 | constants/scoring.ts | 🟢 낮음 |
| 4 | 미등록 업종 fallback을 실측밀도 기반으로 변경 | scoring-engine.ts | 🟡 중간 |

### Phase 2 — 핵심 개선 (1~2일)

| # | 작업 | 파일 | 복잡도 |
|---|------|------|--------|
| 5 | 인구밀도 보정 계수 (Regional Coefficient) 구현 | scoring-engine.ts | 🟡 중간 |
| 6 | 추이 모멘텀 지표 추가 | scoring-engine.ts | 🟡 중간 |
| 7 | 거래율 (세대당) 정규화 | scoring-engine.ts | 🟡 중간 |
| 8 | 거래규모 지수 추가 | scoring-engine.ts | 🟢 낮음 |

### Phase 3 — 신뢰도 + UX (2~3일)

| # | 작업 | 파일 | 복잡도 |
|---|------|------|--------|
| 9 | `ScoreConfidence` 인터페이스 + 산출 로직 | scoring-engine.ts, schema.ts | 🟡 중간 |
| 10 | 시간 가중 생존율 구현 | scoring-engine.ts | 🟡 중간 |
| 11 | 시그모이드 정규화 옵션 | scoring-engine.ts | 🟢 낮음 |
| 12 | 신뢰도 UI 표시 (결과 페이지) | analysis/components/ | 🟡 중간 |

---

## 8. 스키마 변경사항

### schema.ts 추가

```typescript
/** 항목별 점수 v2 */
export const scoreBreakdownV2Schema = z.object({
  vitality: z.number().min(0).max(30),
  competition: z.number().min(0).max(25),
  survival: z.number().min(0).max(20),
  residential: z.number().min(0).max(15),
  income: z.number().min(0).max(10),
});

/** 신뢰도 */
export const scoreConfidenceSchema = z.object({
  overall: z.number().min(0).max(1),
  breakdown: z.object({
    vitality: z.number().min(0).max(1),
    competition: z.number().min(0).max(1),
    survival: z.number().min(0).max(1),
    residential: z.number().min(0).max(1),
    income: z.number().min(0).max(1),
  }),
});

/** 분석 결과 응답 v2 */
export const analysisResultV2Schema = analysisResultSchema.extend({
  confidence: scoreConfidenceSchema.nullable(),
});
```

### constants/scoring.ts 추가

```typescript
/** 전국 평균 인구밀도 (명/km², 통계청 기준) */
export const NATIONAL_AVG_POP_DENSITY = 500;

/** 인구밀도 보정 계수 범위 */
export const REGIONAL_COEFF_RANGE = {
  MIN: 0.5,
  MAX: 2.0,
} as const;

/** 추이 모멘텀 가중치 */
export const MOMENTUM_WEIGHT = 0.20;

/** 거래율 정규화 구간 (1000세대당 거래건수) */
export const TRADE_RATE_THRESHOLDS = {
  MIN: 0.5,
  MAX: 5.0,
} as const;

/** 거래규모 지수 구간 */
export const VOLUME_INDEX_THRESHOLDS = {
  MIN: 50,
  MAX: 2000,
} as const;
```

---

## 9. AI 리포트 연동

신뢰도 데이터를 AI 리포트 프롬프트에 포함하여, Claude가 신뢰도를 고려한 분석을 제공:

```
// prompt-builder.ts 추가 컨텍스트
신뢰도: ${confidence.overall} (${confidenceLabel})
- 활력도 신뢰도: ${confidence.breakdown.vitality}
- 데이터 커버리지: NPS ${dataCoverage.npsCount}건 중 ${dataCoverage.npsSampledCount}건 상세조회
- 골목상권 데이터: ${dataCoverage.hasGolmok ? '있음' : '없음'}

신뢰도가 낮은 지표에 대해서는 "데이터가 제한적이므로 참고 수준" 등의 단서를 포함해주세요.
```

---

## 10. 하위 호환성

| 항목 | 호환성 | 비고 |
|------|--------|------|
| `ScoreBreakdown` 타입 | ✅ 동일 | 5대 지표 구조 변경 없음 |
| `calculateTotalScore` 시그니처 | ✅ 동일 | `AggregatedData → ScoreResult` |
| `ScoreResult` 반환 | ⚠️ 확장 | `confidence` 필드 추가 (optional) |
| DB 스키마 | ✅ 변경 없음 | `scoreDetail` JSON 컬럼에 저장 |
| API 응답 | ⚠️ 확장 | `confidence` 필드 추가 (nullable) |
| UI 컴포넌트 | ✅ 호환 | 신뢰도 뱃지만 추가 |

---

## 참고

- [현행 scoring-engine.ts 분석](/src/features/analysis/lib/scoring-engine.ts)
- [현행 data-aggregator.ts 분석](/src/features/analysis/lib/data-aggregator.ts)
- [경쟁사 분석](/claudedocs/research/competitor_analysis.md)
