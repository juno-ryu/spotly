# 스코어링 모델 v3 — 4대 지표 체계

## 문서 정보

| 항목 | 내용 |
|------|------|
| **버전** | v3.0.0 |
| **작성일** | 2026-02-18 |
| **상태** | 설계 완료, 구현 진행 중 |
| **이전 버전** | v2 (NPS 기반 5개 지표, 100점 만점 가중합산) — 폐기 |

---

## 변경 배경

### v2 문제점

1. **NPS(국민연금) 의존도 과다**: 5개 지표 중 3개(상권 활력도, 경쟁강도, 생존율)가 NPS에 의존
2. **NPS API 불안정**: data.go.kr 기반으로 속도·안정성이 낮고, mock 폴백 빈번
3. **가중치 고정**: 지표별 배점(30/25/20/15/10)이 하드코딩 → 튜닝 불가
4. **실질적 구현 불일치**: 경쟁 강도(Kakao Places 기반)만 구현된 상태에서 나머지는 NPS 기반 설계

### v3 방향

- **데이터 소스 다변화**: Kakao, KOSIS, 부동산 실거래, 서울시 골목상권 등 독립적 소스 활용
- **지표별 100점 독립 스코어링**: 각 지표를 0~100점으로 독립 산출, 가중치는 별도 적용
- **서울/비서울 분리**: 서울시 골목상권 API는 서울 전용 → 지역별 지표 수가 다름

---

## 지표 설계

### 개요

| # | 지표명 | 데이터 소스 | 커버리지 | 점수 범위 |
|---|--------|------------|----------|-----------|
| 1 | **경쟁 강도** (Competition Intensity) | Kakao Places API | 전국 | 0~100 |
| 2 | **인구 밀도** (Population Density) | KOSIS 통계청 API | 전국 | 0~100 |
| 3 | **구매력** (Purchasing Power) | 부동산 실거래가 API | 전국 | 0~100 |
| 4 | **상권 활력도** (Commercial Vitality) | 서울시 골목상권 API | **서울만** | 0~100 |

### 지역별 지표 구성

| 지역 | 사용 지표 | 비고 |
|------|-----------|------|
| **서울** | 경쟁 + 인구 + 구매력 + 상권활력 (4개) | 전체 데이터 가용 |
| **비서울** | 경쟁 + 인구 + 구매력 (3개) | 상권 활력도 제외, 가중치 재분배 |

---

## 지표 1: 경쟁 강도 (Competition Intensity)

### 데이터 소스

- **Kakao Places API** (`server/data-sources/kakao/adapter.ts`)
- 입력: 업종 키워드, 좌표, 반경
- 출력: `KakaoPlacesRaw` (places 배열, totalCount)

### 현재 구현 상태: **완료**

- 파일: `features/analysis/lib/scoring/competition.ts`
- `analyzeCompetition()` → `CompetitionAnalysis` (score 0~100)

### 스코어링 공식

```
밀집도 점수 (60%):
  밀집도 = 반경(m) * 2 / 매장수  (약 N미터당 1개 매장)
  정규화 = (밀집도 / 업종별_기준치) ^ 2.0   (지수 곡선)
  점수 = clamp(0, 100, 정규화 * 100)

프랜차이즈 점수 (15%):
  프랜차이즈 비율 = 프랜차이즈수 / 전체수
  U자형 커브: 비율 0.25~0.35에서 최저점, 양 극단에서 높은 점수

직접경쟁 비율 (25%):
  직접경쟁비율 = 동일업종수 / 전체수
  역비례 점수: 비율 낮을수록 높은 점수
```

### 출력 인터페이스 (기존)

```typescript
interface CompetitionScore {
  score: number;       // 0~100
  grade: string;       // A~F
  gradeLabel: string;  // "매우 좋음" 등
}

interface CompetitionAnalysis {
  densityPerMeter: number;
  densityBaseline: number;
  directCompetitorCount: number;
  indirectCompetitorCount: number;
  directCompetitorRatio: number;
  franchiseCount: number;
  franchiseRatio: number;
  franchiseBrandNames: string[];
  competitionScore: CompetitionScore;
}
```

---

## 지표 2: 인구 밀도 (Population Density)

### 데이터 소스

- **KOSIS 통계청 API** (`server/data-sources/kosis/adapter.ts`)
- 입력: `adminDongCode` (행정동코드) 또는 `regionCode` (시군구코드)
- 출력: `PopulationMetrics`

### 현재 구현 상태: **어댑터 완료, 스코어러 미구현**

### 어댑터 출력

```typescript
interface PopulationMetrics {
  totalPopulation: number;  // 총 인구수
  households: number;       // 세대수
  isDongLevel: boolean;     // 동 단위 조회 성공 여부
}
```

### 스코어링 공식 (신규 설계)

```
인구 밀도 점수 = 인구 규모 점수(60%) + 세대 밀도 점수(40%)

인구 규모 점수:
  동 단위 조회 시: normalize(totalPopulation, 5000, 80000)
  시군구 단위 시: normalize(totalPopulation, 50000, 500000) (패널티 -10)

세대 밀도 점수:
  동 단위: normalize(households, 2000, 40000)
  시군구: normalize(households, 20000, 200000) (패널티 -10)

normalize(value, min, max) = clamp(0, 100, (value - min) / (max - min) * 100)
```

**설계 근거**:
- 동 단위 인구 5천~8만명이 일반적 상업 입지 범위
- 세대수는 실질적 소비 단위 (1인 가구 증가 반영)
- 시군구 단위 폴백 시 정밀도 패널티 부여

---

## 지표 3: 구매력 (Purchasing Power)

### 데이터 소스

- **부동산 실거래가 API** (`server/data-sources/real-estate/adapter.ts`)
- 입력: `regionCode` (법정동 5자리), `dealYm` (거래년월)
- 출력: `ApartmentTradeMetrics`

### 현재 구현 상태: **어댑터 완료, 스코어러 미구현**

### 어댑터 출력

```typescript
interface ApartmentTradeMetrics {
  transactionCount: number;   // 거래 건수
  avgPrice: number;           // 평균 거래가 (만원)
  trades: {
    price: number;
    area: number;
    floor: number;
    dealDate: string;
  }[];
}
```

### 스코어링 공식 (신규 설계)

```
구매력 점수 = 가격 수준 점수(50%) + 거래 활발도 점수(30%) + 면적당 단가 점수(20%)

가격 수준 점수:
  전국 평균 아파트가 ~45000만원 기준
  priceIndex = avgPrice / 45000
  점수 = normalize(priceIndex, 0.3, 2.5) * 100

거래 활발도:
  최근 3개월 거래 건수 기준
  점수 = normalize(transactionCount, 3, 80) * 100

면적당 단가 (평당가):
  avgPricePerArea = sum(price) / sum(area)  (3.3 곱해서 평당가)
  점수 = normalize(avgPricePerArea, 500, 5000) * 100
```

**설계 근거**:
- 아파트 실거래가는 지역 구매력의 proxy indicator
- 거래 활발도는 지역 경제 활성화 정도 반영
- 면적당 단가는 지역 프리미엄 수준 반영

**데이터 없는 경우**: `transactionCount === 0`이면 null 반환 → 가중치 재분배

---

## 지표 4: 상권 활력도 (Commercial Vitality) — 서울 전용

### 데이터 소스

- **서울시 골목상권 API** (`server/data-sources/seoul-golmok/client.ts`)
- 입력: 상권코드(TRDAR_CD) + 서비스업종코드(SVC_INDUTY_CD)
- 출력: `GolmokAggregated`

### 현재 구현 상태: **클라이언트 완료, 어댑터 + 스코어러 미구현**

### 클라이언트 출력

```typescript
interface GolmokAggregated {
  estimatedQuarterlySales: number; // 분기 추정매출 (원)
  salesCount: number;              // 분기 건수
  weekdayRatio: number;            // 평일 매출 비율
  peakTimeSlot: string;            // 피크 시간대
  peakDay: string;                 // 피크 요일
  storeCount: number;              // 점포수
  similarStoreCount: number;       // 유사업종 점포수
  openRate: number;                // 개업률(%)
  closeRate: number;               // 폐업률(%)
  franchiseCount: number;          // 프랜차이즈 점포수
  changeIndex?: string;            // 상권변화지표 (HH/HL/LH/LL)
  changeIndexName?: string;        // 상권변화지표명
  avgOperatingMonths?: number;     // 평균 영업기간(월)
  mainAgeGroup: string;            // 주 소비 연령대
  mainGender: string;              // 주 소비 성별
}
```

### 스코어링 공식 (신규 설계)

```
상권 활력도 = 매출 규모(30%) + 생존 지표(30%) + 상권 변화(20%) + 업종 밀도(20%)

매출 규모 점수:
  분기매출 = estimatedQuarterlySales
  점수 = normalize(분기매출, 10_000_000, 500_000_000) * 100
  (1천만원~5억원 범위)

생존 지표 점수:
  개폐업 비율 = openRate / max(closeRate, 0.1)
  점수 = normalize(개폐업비율, 0.5, 3.0) * 100
  (개업률이 폐업률의 0.5~3배 범위)

  보너스: avgOperatingMonths > 36이면 +10 (3년 이상 생존)
  패널티: closeRate > 15이면 -10 (폐업률 15% 초과)

상권 변화 점수:
  HH (다이나믹) = 90점  — 활발하게 성장 중
  HL (상권확장) = 70점  — 확장세
  LH (상권축소) = 40점  — 축소세
  LL (정체)     = 20점  — 정체
  미확인        = 50점  — 기본값

업종 밀도 점수:
  유사업종비율 = similarStoreCount / max(storeCount, 1)
  점수 = U자형(유사업종비율)
  - 0.1 미만: 80점 (진입 기회)
  - 0.1~0.2: 90점 (적정 경쟁)
  - 0.2~0.4: 70점 (경쟁 활발)
  - 0.4 이상: 50점 (과밀)
```

**설계 근거**:
- 매출 데이터는 상권 건강도의 가장 직접적 지표
- 개폐업률 비율은 상권의 신진대사(진입장벽 + 생존율) 반영
- 상권변화지표는 서울시 자체 분석 결과를 활용 (4등급 분류)
- 유사업종 밀도는 U자형 — 너무 적으면 수요 불확실, 적정 수준이 최적, 과밀은 감점

---

## 가중치 체계

### 현재 (v3.0 초기)

가중치는 우선 균등 배분 후, 실데이터 분석을 통해 튜닝한다.

```typescript
const SCORING_WEIGHTS_V3 = {
  /** 서울 지역 (4개 지표) */
  seoul: {
    competition: 0.30,     // 경쟁 강도
    population: 0.25,      // 인구 밀도
    purchasingPower: 0.20, // 구매력
    vitality: 0.25,        // 상권 활력도
  },
  /** 비서울 지역 (3개 지표) */
  nonSeoul: {
    competition: 0.40,     // 경쟁 강도
    population: 0.35,      // 인구 밀도
    purchasingPower: 0.25, // 구매력
  },
} as const;
```

### 종합 점수 계산

```typescript
totalScore = sum(각 지표 점수 × 가중치)
// 결과: 0~100점
```

### 지표 누락 시 가중치 재분배

특정 지표의 데이터를 조회하지 못한 경우, 해당 가중치를 나머지 지표에 비례 재분배한다.

```typescript
function redistributeWeights(
  weights: Record<string, number>,
  failedIndicators: string[],
): Record<string, number> {
  const failedTotal = failedIndicators.reduce((sum, key) => sum + weights[key], 0);
  const activeWeights = Object.entries(weights)
    .filter(([key]) => !failedIndicators.includes(key));
  const activeTotal = activeWeights.reduce((sum, [, w]) => sum + w, 0);

  return Object.fromEntries(
    activeWeights.map(([key, w]) => [key, w + (failedTotal * w / activeTotal)])
  );
}
```

---

## 등급 체계

모든 지표 및 종합 점수에 동일한 등급 체계를 적용한다.

| 등급 | 점수 범위 | 라벨 | 색상 |
|------|-----------|------|------|
| **S** | 90~100 | 최상 | `#10B981` (emerald) |
| **A** | 75~89 | 우수 | `#3B82F6` (blue) |
| **B** | 60~74 | 양호 | `#8B5CF6` (violet) |
| **C** | 45~59 | 보통 | `#F59E0B` (amber) |
| **D** | 30~44 | 미흡 | `#F97316` (orange) |
| **F** | 0~29 | 위험 | `#EF4444` (red) |

---

## 구현 파일 구조

```
src/features/analysis/lib/scoring/
├── types.ts              # 공통 스코어 타입 (IndicatorScore, ScoringResult)
├── competition.ts        # 경쟁 강도 스코어러 ✅ 완료
├── population.ts         # 인구 밀도 스코어러 (신규)
├── purchasing-power.ts   # 구매력 스코어러 (신규)
├── vitality.ts           # 상권 활력도 스코어러 (신규, 서울 전용)
├── weights.ts            # 가중치 상수 + 재분배 로직 (신규)
└── index.ts              # 통합 export

src/server/data-sources/seoul-golmok/
├── client.ts             # HTTP 클라이언트 ✅ 완료
└── adapter.ts            # 어댑터 (신규)
```

---

## 구현 순서

1. **서울 골목상권 어댑터** (`seoul-golmok/adapter.ts`) — client 호출 + 비즈니스 타입 변환
2. **상권 활력도 스코어러** (`scoring/vitality.ts`) — 서울 전용, 어댑터 출력 기반 100점 산출
3. **오케스트레이터 연결** — `analysis-orchestrator.ts`에 서울 분기 추가
4. **인구 밀도 스코어러** (`scoring/population.ts`) — KOSIS 어댑터 출력 기반
5. **구매력 스코어러** (`scoring/purchasing-power.ts`) — 부동산 어댑터 출력 기반
6. **가중치 모듈** (`scoring/weights.ts`) — 서울/비서울 가중치 + 재분배
7. **종합 점수 계산** — 4개 지표 통합 → UI 연결
