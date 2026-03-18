# 스코어링 모델 명세

> 마지막 업데이트: 2026-03-15
> 박사님(scoring-engine-validator) 검증 완료: 2026-03-15
> ⚠️ 모든 수치/가중치 변경은 박사님 검토 필수

---

## 1. 파일 구조

```
src/features/analysis/lib/scoring/
├── index.ts         — 총점 합산 (calcTotalScore)
├── competition.ts   — 경쟁 강도
├── vitality.ts      — 상권 활력도
├── population.ts    — 배후 인구
├── survival.ts      — 생존율 (서울 전용)
├── infra-bonus.ts   — 인프라 보너스 (업종별 가중치 매트릭스)
└── types.ts         — 공통 타입 (등급, 정규화, normalize, logNormalize)
```

---

## 2. 총점 합산 (calcTotalScore)

### 서울 (vitality 데이터 있음)

```
totalScore = vitality×0.35 + competition×0.25 + population×0.20 + survival×0.20
           + infraBonus (최대 15점 가산, min(100) 캡)
```

### 비서울 (vitality 데이터 없음)

```
infraAccess = (infraBonus.score / 15) × 100
totalScore = competition×0.45 + population×0.40 + infraAccess×0.15
```

> infraBonus: 버스/학교/대학교/병의원 4개 항목을 업종별 가중치 매트릭스로 합산. MAX_BONUS=15.
> 비서울에서는 infraAccess로 정규화(0~100)하여 3번째 지표로 편입.

---

## 3. 등급 체계

| 점수 | 등급 |
|------|------|
| 80–100 | A |
| 60–79 | B |
| 40–59 | C |
| 20–39 | D |
| 0–19 | F |

---

## 4. 경쟁 강도 (Competition)

- 공식: `densityScore × 0.75 + franchiseScore × 0.25`
- 밀집도 시그모이드: `100 / (1 + exp(-4 × (ratio - 1)))`
- ratio = densityPerMeter / densityBaseline
- densityBaseline: industry-codes.ts에 43개 업종별 매핑 완료 (50m~630m)
- 소수 표본 보정 (V-03): totalCount < 5일 때 50점(중립)으로 수렴

### 프랜차이즈 U커브

- 0% → 25점 / 20~40% → 100점 / 80%+ → 0점
- V-09 보정: totalCount≥10이고 franchiseRatio=0이면 45점으로 재계산
- 비프랜차이즈 업종: franchiseScore=50 고정 (U커브 제외)
  - 현재: 의료, 부동산

---

## 5. 상권 활력도 (Vitality) — 서울만

### 가중치 (유동인구 데이터 있을 때)

| 하위 지표 | 가중치 | 계산 |
|----------|--------|------|
| 점포당 매출 | 35% | 로그 정규화 (50만~3,000만원) |
| 유동인구 | 35% | `max(골목상권, 지하철)` — max 200만명 기준 로그 정규화 |
| 상권 변화 | 30% | LH=85 / HL=55 / HH=30 / LL=30 |

유동인구 없을 때: 매출 65% + 상권변화 35%

### 상권변화지표 정의 (서울시 공식)

- 첫 글자: 운영영업개월평균 (생존 사업체 평균 영업기간)
- 둘째 글자: 폐업영업개월평균 (폐업 사업체 평균 영업기간)

| 등급 | 의미 | 점수 |
|------|------|------|
| LH | 생존업력↓ 폐업업력↑ — 신규 경쟁력 있는 역동 상권 | 85 |
| HL | 생존업력↑ 폐업업력↓ — 기존 강자 위주 안정 상권 | 55 |
| HH | 생존업력↑ 폐업업력↑ — 포화/정체 상권 | 30 |
| LL | 생존업력↓ 폐업업력↓ — 고회전 불안정 상권 | 30 |

### 지하철 거리감쇠 (현재)

| 거리 | 계수 |
|------|------|
| 100m 이내 | 1.4 |
| 200m 이내 | 1.3 |
| 300m 이내 | 1.15 |
| 500m 이내 | 1.0 |
| 500m 초과 | 0.85 |

비서울: `subwayScore × 0.35` → 최대 35점

---

## 6. 배후 인구 (Population)

- 읍면동: 3,000명(0점) ~ 50,000명(100점) 로그 정규화
- 시군구: 50,000명(0점) ~ 600,000명(100점)
- isDongLevel 플래그로 분기: 읍면동 조회 실패 시 시군구 fallback
- V-07: 읍면동 상한(50,000)을 시군구 하한(50,000)과 일치시켜 경계값 불연속 해소

---

## 7. 생존율 (Survival) — 서울만

- 공식: `closeScore × 0.6 + netChangeScore × 0.4`
- closeScore: 폐업률 시그모이드 `100 / (1 + exp(8 × (closeRate/100 - 0.05)))`
- netChangeScore: 순증감률 정규화 (-7.5~7.5%, 균형=50점)

---

## 8. 인프라 보너스 (infraBonus)

- MAX_BONUS = 15
- 4개 항목: bus, school, university, medical
- 업종별 가중치 매트릭스 (INDUSTRY_WEIGHTS): 16개 업종, 각 합 0.55
- null 항목 제외 후 totalWeight로 정규화
- 서울: baseScore에 직접 가산 (min(100) 캡)
- 비서울: infraAccess = (score/15)×100 → 3번째 지표로 편입 (이중 반영 방지 플래그)

---

## 9. 구현 체크리스트 (박사님 승인 2026-03-15)

### 1단계: 독립적 수정 (서울 지표 + 비프랜차이즈)

- [x] `survival.ts` — calcCloseScore 선형 역정규화로 교체
  ```
  closeScore = (1 - normalize(closeRate, 0, 15)) × 100
  → 0%=100점, 5%=67점, 10%=33점, 15%=0점
  ```
- [x] `vitality.ts` — CHANGE_SCORES 차등화
  ```
  HH: 30 → 40 (포화 — 진입 어렵지만 안착 시 안정)
  LL: 30 → 20 (불안정 — 진입 쉬우나 생존 위험)
  ```
- [x] `competition.ts` — NON_FRANCHISE_CATEGORIES 확장
  ```
  기존: 의료, 부동산
  추가: 교육, 서비스, 건강, 오락
  → 해당 업종 franchiseScore=50 고정
  ```

### 2a: 경쟁 밀집도

- [x] `industry-codes.ts` — 한식 densityBaseline 50 → 120
  - 나머지 업종은 실측 데이터 확보 후 다음 페이즈에서 교정

### 2b: 비서울 가중치

- [x] `actions.ts` — 비서울 가중치 변경
  ```
  변경 전: competition×0.40 + population×0.35 + infraAccess×0.25
  변경 후: competition×0.45 + population×0.40 + infraAccess×0.15
  ```

### 3단계: 지하철 + transit 업그레이드

- [x] `vitality.ts` — 지하철 거리감쇠 방식 변경 (증폭→감쇠)
  ```
  변경 전: 100m=1.4 / 200m=1.3 / 300m=1.15 / 500m=1.0 / 500m+=0.85
  변경 후: 200m이하=1.0 / 400m=0.85 / 600m=0.65 / 800m=0.45 / 800m+=0.25
  ```
- [x] `infra-bonus.ts` — calcTransitGrade 추가
  ```
  transitScore = max(subwayScore, busScore)
  둘 다 null이면 null → infraBonus에서 자동 제외
  ```
- [x] `actions.ts` — calcInfraBonus에 subway 전달
  ```
  서울(vitality 있음): subway=null → 이중 반영 방지
  비서울(vitality 없음): subway=실데이터 → transit에 활용
  ```

### 문서 동기화 (각 단계 후)

- [x] `scoring-model.md` — 이 문서를 수정 내용에 맞게 갱신
- [x] `dev-guide.md` 섹션 3 — 스코어링 엔진 현황 갱신

### 별도 이슈

- [ ] KOSIS fallback UI 개선 — "(시군구 기준)" 표시 강화

---

## 10. 다음 페이즈 과제

### densityBaseline 전체 업종 실측 교정

한식 외 나머지 업종(미용실, 편의점, 학원, 부동산, 약국 등)의 baseline이 과소 설정.
서울 주요 상권 10곳에서 카카오 API 샘플링 → 중앙값 기준 baseline 산출 필요.

### 카카오 검색 키워드 매핑 (9-0d)

`industry-codes.ts`의 `keywords` 필드가 미활용. "기타주점" 같은 공식 분류명이 카카오 검색에서 0건 반환.
`industryKeyword` 파라미터를 orchestrator에서 활용하도록 연결 필요.

### 업종별 가중치 차등

모든 업종에 동일한 가중치 적용 중. 업종별 데이터 유의미성 차이를 가중치에 반영하는 시스템 설계.

### 비서울 유동인구 별도 지표

transit을 infraBonus에서 분리하여 독립 5번째 지표로 승격. 가중치 체계 전면 재설계 필요.
