# 스코어링 모델 v3 — 현재 구현 상태

## 문서 정보

| 항목 | 내용 |
|------|------|
| **버전** | v3.1.0 |
| **작성일** | 2026-02-18 |
| **상태** | 2지표 독립 스코어링 구현 완료, 종합 점수 미연결, AI 리포트 파이프라인 단절 |
| **이전 버전** | v2 (NPS 기반 5개 지표, 100점 만점 가중합산) — 폐기, 코드 잔존 |

---

## 아키텍처 현황

### 실제 동작하는 시스템 (Active)

```
사용자 입력 (주소 + 업종 + 반경)
    ↓
POST /api/analyze → processAnalysis()
    ↓
runAnalysis() [analysis-orchestrator.ts]
    ├── fetchKakaoPlaces() ──→ analyzeCompetition() → CompetitionAnalysis (0~100)
    └── fetchCommercialVitality() → analyzeVitality() → VitalityAnalysis (0~100) [서울만]
    ↓
DB 저장: reportData = { places, competition, vitality, ... }
         totalScore = 0 (하드코딩)
         scoreDetail = {} (하드코딩)
    ↓
UI 표시: 경쟁강도 등급(S~F) + 인사이트
         상권활력도 등급(S~F) + 인사이트 [서울만]
```

### 미사용 레거시 코드 (Dead Code)

| 파일 | 설명 | 상태 |
|------|------|------|
| `scoring-engine.ts` | 구 5지표 종합 점수 계산기 | `totalScore: 0` 하드코딩으로 미호출 |
| `constants/scoring.ts` | 구 가중치 (30/25/20/15/10) | `scoring-engine.ts`만 참조 |
| `schema.ts` → `ScoreBreakdown` | 구 5지표 스키마 (vitality 0~30 등) | `prompt-builder.ts`, `grade.ts`만 참조 |
| `grade.ts` | 구 지표별 퍼센트→등급(A~F) 변환 | `prompt-builder.ts`만 참조 |

### 알려진 Critical 이슈

| # | 이슈 | 영향 |
|---|------|------|
| 1 | **AI 리포트 파이프라인 단절** | `report/actions.ts`가 구 데이터 구조(`businesses`, `scoreDetail`, `golmok`) 기대 → 신 데이터 구조(`places`, `competition`, `vitality`)와 불일치 → AI에 모든 값 0으로 전달 |
| 2 | **종합 점수 없음** | `totalScore: 0` 하드코딩, 경쟁+활력 두 독립 점수만 존재 |
| 3 | **비서울 극도 제한** | 서울 외 지역은 경쟁강도만 표시 (활력도 없음) |

---

## 지표 1: 경쟁 강도 (Competition Intensity)

### 구현 상태: **완료** ✅

| 항목 | 내용 |
|------|------|
| **파일** | `features/analysis/lib/scoring/competition.ts` |
| **데이터 소스** | Kakao Places API |
| **커버리지** | 전국 |
| **점수 범위** | 0~100 (높을수록 경쟁 약함 = 유리) |

### 스코어링 공식

```
경쟁 점수 = 밀집도 점수(90%) + 프랜차이즈 U커브(10%)

밀집도 계산:
  면적 = π × 반경²
  밀집도 = √(면적 / 매장수)     ← 약 N미터당 1개 매장
  비율 = 밀집도 / 업종별_기준값
  점수 = min(100, (비율 ^ 2.0) × 100)    ← 지수 곡선

프랜차이즈 U커브 (0~100):
  20~40% → 100점 (최적: 상권 검증 + 공존 가능)
  0% → 40점 (매력도 낮음)
  80%+ → 0점 (개인 매장 생존 어려움)
```

### 업종별 밀집도 기준값

| 업종 | 코드 | 기준(m) |
|------|------|---------|
| 치킨 | I56192 | 200 |
| 한식 | I56111 | 150 |
| 커피 | I56191 | 120 |
| 편의점 | G47112 | 200 |
| 기본값 | - | 250 |

*주: 기준값은 `industry-codes.ts`의 `densityBaseline` 필드에 정의*

### 출력 인터페이스

```typescript
interface CompetitionAnalysis {
  densityPerMeter: number;        // 약 N미터당 1개 매장
  densityBaseline: number;        // 업종별 기준값
  directCompetitorCount: number;  // 직접 경쟁(동일 업종 키워드)
  indirectCompetitorCount: number;
  directCompetitorRatio: number;  // 0~1
  franchiseCount: number;
  franchiseRatio: number;         // 0~1
  franchiseBrandNames: string[];  // ~150개 브랜드 fuzzy 매칭
  competitionScore: {
    score: number;    // 0~100
    grade: string;    // S~F
    gradeLabel: string;
  };
}
```

### 데이터 유의미성: ✅ 유의미

- Kakao Places는 실시간 데이터, 전국 커버리지
- `densityBaseline` 기반 업종별 상대 평가
- 프랜차이즈 감지는 하드코딩 목록(~150개) 기반, 연 1~2회 수동 업데이트 필요

---

## 지표 2: 상권 활력도 (Commercial Vitality) — 서울 전용

### 구현 상태: **완료** ✅

| 항목 | 내용 |
|------|------|
| **파일** | `features/analysis/lib/scoring/vitality.ts` |
| **데이터 소스** | 서울시 골목상권 API (5개 엔드포인트) |
| **커버리지** | 서울만 |
| **점수 범위** | 0~100 (높을수록 활력 높음) |

### 사용하는 API (5개)

| API | 서비스명 | 단위 | 캐시 | 용도 |
|-----|----------|------|------|------|
| 상권영역 | TbgisTrdarRelm | 좌표→상권코드 | 30일 | 상권 매핑 (TM좌표 거리 계산) |
| 점포현황 | VwsmTrdarStorQq | 상권+업종 | 30일 | 점포수, 개폐업 건수, 프랜차이즈 |
| 상권변화 | VwsmTrdarIxQq | 상권 | 30일 | 변화지표 4등급 |
| 추정매출 | VwsmTrdarSelngQq | 상권+업종 | 7일 | 분기 매출, 피크 시간/요일 |
| 유동인구 | VwsmTrdarFlpopQq | 상권 | 30일 | 분기 유동인구 |
| 상주인구 | VwsmTrdarRepopQq | 상권 | 30일 | 상주인구, 세대수 |

### 3지표 스코어링 공식

```
유동인구 데이터 있을 때:
  활력 = 점포당 매출(35%) + 상권변화(30%) + 유동인구(35%)

유동인구 데이터 없을 때 (fallback):
  활력 = 점포당 매출(55%) + 상권변화(45%)
```

#### 2a. 점포당 매출 점수 (35% / 55%)

```
salesPerStore = estimatedQuarterlySales / storeCount
점수 = normalize(salesPerStore, 5,000,000원, 50,000,000원) × 100
```

- 분기 500만원 미만 → 0점, 5,000만원 이상 → 100점
- 월 환산: ~167만원 ~ ~1,667만원
- 같은 업종의 지역 간 비교에 사용 (업종 간 비교 아님)

#### 2b. 상권 변화 점수 (30% / 45%)

| 코드 | API 이름 | 점수 | 의미 |
|------|----------|------|------|
| LL | 다이나믹 | 90 | 활발한 신진대사, 성장세 |
| LH | 상권확장 | 70 | 확장 중 |
| HL | 상권축소 | 40 | 축소세 |
| HH | 정체 | 20 | 정체 |
| 없음 | - | 50 | 중립 기본값 |

- 서울시 공식 분류를 그대로 사용
- 여러 상권의 다수결(mode)로 대표값 결정

#### 2c. 유동인구 점수 (35% / 0%)

```
점수 = normalize(totalFloating, 100,000명, 5,000,000명) × 100
```

- 분기 총 유동인구 기준 (00~06시 포함, 총량은 의미 있음)
- 피크 시간대 계산 시에만 00~06시 제외 (수면 인구 왜곡 방지)
- 60대 이상 연령대는 3분할하여 10년 구간 밀도로 비교

### 데이터 수정 이력 (v3.1 — 데이터 품질 검증 결과)

| 항목 | v3.0 (설계) | v3.1 (현재) | 변경 사유 |
|------|-------------|-------------|-----------|
| 업종밀도 | 20% 가중치 | **제거** | `SIMILR_INDUTY_STOR_CO ≥ STOR_CO` 항상 성립, 비율 100% 고정 |
| 생존율 | 30% 가중치 | **제거** | 레코드 90%가 개폐업률 0%, 비율 평균 무의미 |
| 매출 기준 | 총매출 | 점포당 매출 | 상권 3개 합산 시 99.3%가 5억 초과, 변별력 없음 |
| 변화지표 | HH=다이나믹(90) | LL=다이나믹(90) | **매핑 완전 반전** — API 실데이터로 검증하여 수정 |
| 유동인구 피크 | 전체 시간대 | 00~06 제외 | 통신사 기지국 기반 수면 인구 78.5% 왜곡 |
| 폐업률 집계 | 비율의 평균 | 절대 건수 합산 | 개별 레코드 90%가 0% → 평균 무의미 |

### 스코어링에서 제거된 지표의 활용

| 제거된 지표 | 현재 활용 | 파일 |
|-------------|-----------|------|
| 폐업률 | 인사이트 카드 (>5% 경고 / ≤5% 안정) | `insights/rules/population.ts` |
| 상주인구 세대수 | 인사이트 카드 (≥15K 풍부 / ≥5K 적정 / <5K 부족) | `insights/rules/population.ts` |
| 유동인구 규모 | 인사이트 카드 (≥100만 많음 / ≥30만 활발 / <30만 적음) | `insights/rules/population.ts` |

### 출력 인터페이스

```typescript
interface VitalityAnalysis {
  salesScore: number;        // 점포당 매출 점수 (0~100)
  changeScore: number;       // 상권 변화 점수 (0~100)
  footTrafficScore: number;  // 유동인구 점수 (0~100)
  vitalityScore: {
    score: number;     // 종합 (0~100)
    grade: Grade;      // S~F
    gradeLabel: string;
  };
  details: {
    estimatedQuarterlySales: number;
    salesPerStore: number;
    closeRate: number;
    openRate: number;
    changeIndexName: string | null;
    storeCount: number;
    peakTimeSlot: string;
    mainAgeGroup: string;
    floatingPopulation?: {
      totalFloating: number;
      maleRatio: number;
      peakTimeSlot: string;
      peakDay: string;
      mainAgeGroup: string;
    };
    residentPopulation?: {
      totalResident: number;
      totalHouseholds: number;
    };
  };
}
```

### 데이터 유의미성: ✅ 유의미 (3지표 모두)

---

## 등급 체계

모든 지표에 동일 기준 적용:

| 등급 | 점수 범위 | 라벨 |
|------|-----------|------|
| **S** | 90~100 | 최상 |
| **A** | 75~89 | 우수 |
| **B** | 60~74 | 양호 |
| **C** | 45~59 | 보통 |
| **D** | 30~44 | 미흡 |
| **F** | 0~29 | 위험 |

---

## 종합 점수 체계: 미구현

현재 경쟁강도(0~100)와 상권활력도(0~100)는 **독립 점수**로만 존재하며, 하나의 종합 점수로 합산되지 않습니다.

DB에 저장되는 값:
```typescript
totalScore: 0,      // 하드코딩
scoreDetail: {},     // 빈 객체
```

---

## 인사이트 시스템

### 구조

```
InsightRule → InsightItem[] (emoji + text + sub + category)
```

### 등록된 룰 (2개)

| 룰 | 파일 | 인사이트 항목 |
|----|------|--------------|
| `competitionRules` | `rules/competition.ts` | 매장간 거리, 프랜차이즈 현황 |
| `populationRules` | `rules/population.ts` | 유동인구 규모, 상주인구 배후, 폐업률 |

### 카테고리 분류

| 카테고리 | 의미 | UI 차이 |
|----------|------|---------|
| `scoring` | 스코어링에 반영되는 핵심 지표 | 없음 (내부 구분용) |
| `fact` | 참고 정보, 스코어 미반영 | 없음 |

---

## UI 표시 현황 (analysis-result.tsx)

### 경쟁강도 섹션 (전국)

- 등급 배지 (S~F)
- 인사이트: 매장간 거리, 프랜차이즈 현황

### 상권활력도 섹션 (서울만, vitality 데이터 있을 때)

- 등급 배지 (S~F)
- 인사이트: 유동인구 규모, 상주인구 배후, 폐업률

### 비서울 지역

- 경쟁강도만 표시
- 상권활력도 섹션 비노출

---

## AI 리포트 파이프라인: **단절** ⚠️

### 현재 흐름 (broken)

```
report/actions.ts → generateReport()
  ↓
DB에서 reportData, scoreDetail 읽기
  ↓
scoreDetail = {} → 모든 지표 0점
reportData.businesses = undefined → 0개
reportData.avgApartmentPrice = undefined → 0
reportData.golmok = undefined → 없음
  ↓
buildAnalysisPrompt() → AI에 모든 값 0 전달
  ↓
Claude가 0점 데이터로 리포트 생성 (무의미)
```

### 원인

`report/actions.ts`가 구 데이터 모델을 기대:
- `scoreDetail.vitality` (0~30) → 실제: `{}`
- `reportData.businesses` (NPS 사업장 배열) → 실제: 없음
- `reportData.avgApartmentPrice` (부동산 거래가) → 실제: 없음
- `reportData.golmok` (GolmokAggregated) → 실제: 없음 (vitality로 저장됨)

### 수정 필요 사항

1. `report/actions.ts`: 신 데이터 구조(`competition`, `vitality`)에서 데이터 추출
2. `prompt-builder.ts`: 신 스코어링 모델에 맞는 프롬프트 재설계
3. `schema.ts` `ScoreBreakdown`: 2지표 체계에 맞게 재정의 또는 제거

---

## 구현 파일 구조 (현재)

```
src/features/analysis/lib/scoring/
├── types.ts              # 공통 타입 (IndicatorScore, Grade, normalize, CompetitionAnalysis) ✅
├── competition.ts        # 경쟁 강도 스코어러 ✅ 완료
├── vitality.ts           # 상권 활력도 스코어러 (3지표 체계) ✅ 완료
└── index.ts              # 통합 export ✅

src/features/analysis/lib/
├── scoring-engine.ts     # ⚠️ 구 시스템 — 미사용, 제거 대상
├── insights/
│   ├── types.ts          # InsightData, InsightItem ✅
│   ├── builder.ts        # buildInsights() ✅
│   ├── index.ts          # export ✅
│   └── rules/
│       ├── competition.ts # 밀집도, 프랜차이즈 인사이트 ✅
│       └── population.ts  # 유동인구, 상주인구, 폐업률 인사이트 ✅
└── grade.ts              # ⚠️ 구 시스템 ScoreBreakdown 기반 — prompt-builder만 사용

src/server/data-sources/seoul-golmok/
├── client.ts             # 6개 API fetch + 집계 ✅ 완료
└── adapter.ts            # 비즈니스 타입 변환 ✅ 완료

src/features/report/
├── actions.ts            # ⚠️ 구 데이터 구조 기대 — AI 리포트 단절
└── lib/
    └── prompt-builder.ts # ⚠️ 구 ScoreBreakdown 기반 — 수정 필요
```

---

## 향후 작업 우선순위

| 우선순위 | 작업 | 파일 |
|----------|------|------|
| **P0** | AI 리포트 파이프라인 복구 | `actions.ts`, `prompt-builder.ts` |
| **P1** | 레거시 스코어링 코드 제거 | `scoring-engine.ts`, `constants/scoring.ts` |
| **P1** | ScoreBreakdown 스키마 재정의 | `schema.ts`, `grade.ts` |
| **P2** | 비서울 지역 데이터 확충 | KOSIS, 부동산 API 연동 검토 |
| **P2** | 종합 점수 도입 여부 결정 | 2지표 가중합 or 개별 표시 유지 |
| **P3** | client.ts 변화지표 주석 수정 | L96~101 |
