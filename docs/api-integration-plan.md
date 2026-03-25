# 공공데이터 API 연동 계획서

> 리서처 기술 명세 + 박사님 스코어링 검토를 종합한 최종 구현 계획
> 작성일: 2026-03-25

---

## 현황 및 목표

### 핵심 문제
비서울 지역에서 vitality(활력도)와 survival(생존율) 지표 없음 → 경쟁 단일 지표에 과도 의존.

### 목표
10개 공공 API 연동으로 비서울도 서울과 동일한 4+1 지표 구조 달성.

---

## 박사님 최종 판정 요약

| # | API | 판정 | 스코어링 역할 |
|---|-----|------|-------------|
| 1 | 소상공인 상가정보 | **승인** | competition 보조 검증 (totalCount 변경 없음) |
| 2 | 행안부 인구통계 | **승인** | population 병행 조회 → 더 풍부한 데이터 채택 |
| 3 | 주차장 정보 | **조건부 승인** | infraBonus 확장 (0~100 정규화, 합 0.55 유지) |
| 4 | 카드소비 데이터 | **보류** | 비서울 vitality 복원 (데이터 분포 실측 필요) |
| 5 | 국세청 사업자 현황 | **조건부 승인** | 비서울 survival 복원 (업종 세분화 확인 필요) |
| 6 | 부동산원 임대동향 | **승인** | AI 리포트 참고자료만 (스코어링 미반영) |
| 7 | 공시지가 | **승인** | AI 리포트 참고자료만 (스코어링 미반영) |
| 8 | ITS 통행량 | **조건부 승인** | infraBonus 확장 (도로구간↔상가위치 최근접 매핑) |
| 9 | 문화기반시설 | **승인** | infraBonus 확장 (기존 패턴 재사용) |
| 10 | 가계동향(소비) | **승인** | AI 리포트 참고자료만 (시도 단위 한계) |

---

## Phase 1: 즉시 구현 (승인 완료)

### 1. 소상공인 상가정보 API

**기술 명세**:
- 엔드포인트: `http://apis.data.go.kr/B553077/api/open/sdsc/baroApi`
- 반경 조회: `GET /storeListInRadius?radius={m}&cx={경도}&cy={위도}&indsLclsCd={업종}`
- 인증: `serviceKey` 쿼리 파라미터 (기존 `DATA_GO_KR_API_KEY` 사용)
- 호출 제한: 30 TPS
- 페이징: `pageNo`, 최대 1000건/페이지

**구현 계획**:
```
src/server/data-sources/sbiz/
├── client.ts  — /storeListInRadius 호출 + 페이징
└── adapter.ts — 업종별 점포 수 집계 + Kakao 비교 데이터 생성
```

**스코어링 반영 (박사님 승인 — 방안 A)**:
- totalCount는 Kakao Places 단독 유지 (변경 없음)
- 상가정보는 "보조 검증" 역할만
- UI에 "약 N개 (추정)" 표시 시 상가정보 추정치 병기
- **기존 점수 영향: 0** (스코어링 공식 변경 없음)

**왜 totalCount를 합치지 않는가 (박사님 판단)**:
- 두 소스 교집합이 40~80%로 추정 → 단순 합산 시 1.2~1.8배 팽창
- 중복 제거 정밀도 문제 (주소·상호명·좌표 차이로 10~20% 오차)
- 업종별 커버리지 비대칭 → 업종 간 공정성 훼손

---

### 2. 행안부 주민등록 인구통계

**기술 명세**:
- 엔드포인트: `http://apis.data.go.kr/1741000/rnPpltnHhStus/selectRnPpltnHhStus`
- 인증: `serviceKey`
- 조회: 행정동코드 + 기준년월
- 응답: 연령대별(5세 단위) 인구, 성별, 세대수

**구현 계획**:
```
src/server/data-sources/mois-population/
├── client.ts  — 행안부 API 호출 + 캐시 (TTL 7일)
└── adapter.ts — 행정동코드 기반 인구 조회
```

**스코어링 반영 (박사님 승인)**:
- KOSIS와 행안부 두 소스를 병렬 호출
- 응답 비교 후 더 풍부한 데이터(필드 수, 연령 세분화, 신선도) 채택
- 행안부 장점: 월간 갱신 + 5세 단위 연령 세분화 → 업종별 타겟 인구 가중치 가능
- KOSIS 장점: 읍면동 단위 + 기존 검증된 파이프라인
- 가중치 변경 불필요
- **기존 점수 영향: 0~±5점** (데이터 소스 차이에 의한 미세 변동)

---

### 3. 주차장 정보

**기술 명세**:
- 엔드포인트: `http://apis.data.go.kr/B553881/Parking/PrkSttusInfo`
- 인증: `DATA_GO_KR_API_KEY`
- 조회: 시군구 단위 (반경 조회 미지원)
- 호출 제한: 10,000건/일 (개발계정)
- 응답: 주차장명, 위경도, 주차구획수, 요금, 운영시간

**구현 계획**:
```
1. Prisma 모델 추가: model Parking { name, lat, lng, totalSpaces, address ... }
2. 전국 주차장 CSV/API → DB 일괄 적재 (학교 DB 패턴)
3. bounding box pre-filter + Haversine 정밀 필터

src/server/data-sources/parking/
├── client.ts  — DB 조회 (학교와 동일 패턴)
└── adapter.ts — 반경 내 주차구획 합산 + 점수화
```

**스코어링 반영 (박사님 조건부 승인)**:
- `infra-bonus.ts`에 `parking` 항목 추가
- 점수화: `parkingScore = logNormalize(totalSpaces, 10, 500) × 100` (0~100)
- 업종별 가중치 예시:

| 업종 | transit | school | university | medical | **parking** | **합계** |
|------|---------|--------|------------|---------|------------|---------|
| 음식점 | 0.15 | 0.05 | 0.30 | 0.05 | **0.08** | **0.63→0.55 재조정** |
| 미용실 | 0.10 | 0.05 | 0.20 | 0.05 | **0.12** | 재조정 |
| 학원 | 0.15 | 0.15 | 0.10 | 0.05 | **0.10** | 재조정 |
| 카페 | 0.15 | 0.05 | 0.30 | 0.05 | **0.03** | 재조정 |

- **조건: MAX_BONUS 15점 유지, 가중치 합 0.55 유지**
- **기존 점수 영향: 0~+2점** (기존 항목 가중치 소폭 재분배)

---

### 4. 문화기반시설

**기술 명세**:
- 엔드포인트: `https://www.data.go.kr/data/15105210/openapi.do`
- 응답: 시설명, 위경도, 주소, 시설유형(도서관/박물관/공연장)
- 위경도 제공 → Haversine 필터링 가능

**구현 계획**:
```
1. Prisma 모델: model CultureFacility { name, type, lat, lng, address }
2. 전국 문화시설 DB 적재 (학교 패턴)

src/server/data-sources/culture/
├── client.ts  — DB 조회
└── adapter.ts — 반경 내 시설 수 + 유형별 분류
```

**스코어링 반영 (박사님 승인)**:
- `infra-bonus.ts`에 `culture` 항목 추가
- 점수화: 반경 1km 내 시설 수 기준 0~100
- 업종별 가중치: 카페(0.08) > 의류(0.06) > 음식점(0.04) > 학원(0.02)
- **기존 점수 영향: 0~+1점** (미미)

---

### 5. 부동산원 임대동향

**기술 명세**:
- 엔드포인트: `https://www.data.go.kr/data/15134761/openapi.do`
- 인증: `DATA_GO_KR_API_KEY`
- 조회: 시군구 단위, 분기별
- 응답: 상가/오피스 임대료, 공실률

**구현 계획**:
```
src/server/data-sources/rent/
├── client.ts  — data.go.kr REST 호출 + 캐시 (TTL 30일)
└── adapter.ts — 시군구 기준 임대료 조회
```

**스코어링 반영 (박사님 승인 — AI 리포트만)**:
- 스코어링 미반영
- `prompt-builder.ts`에 임대료 데이터 섹션 추가
- AI가 "이 지역 평균 상가 임대료 m²당 약 X만원" 인사이트 생성
- **기존 점수 영향: 0**

---

### 6. 공시지가

**기술 명세**:
- 엔드포인트: `https://www.data.go.kr/data/15124014/openapi.do`
- 조회: 법정동+번지 개별 (반경 불가)
- 응답: 개별공시지가 (원/m²)

**구현 계획**:
- 시군구 평균 공시지가를 사전 집계 → DB 또는 JSON 적재
- 분석 시 시군구코드로 조회

**스코어링 반영 (박사님 승인 — AI 리포트만)**:
- 스코어링 미반영
- AI 리포트에 "이 지역 평균 공시지가" 참고정보
- **기존 점수 영향: 0**

---

### 7. 가계동향(소비)

**기술 명세**:
- KOSIS API (기존 `KOSIS_API_KEY` 사용)
- 시도 단위, 분기 갱신
- 응답: 가구당 월평균 소득, 소비지출 (용도별)

**구현 계획**:
- 기존 KOSIS client 패턴 재사용
- 가계동향 테이블 ID로 조회

**스코어링 반영 (박사님 승인 — AI 리포트만)**:
- 스코어링 미반영
- AI 리포트에 "이 지역 가구당 월평균 외식비 약 X만원" 인사이트
- **기존 점수 영향: 0**

---

## Phase 2: 데이터 실측 후 구현 (보류/조건부)

### 8. 카드소비 데이터 → 비서울 vitality 복원

**기술 명세**:
- 경기도: `https://data.gg.go.kr` (API 제공)
- 기타 광역시: 각 포털별 CSV 파일
- 행정동 단위, 월간 갱신
- 핵심 필드: 매출금액, 매출건수, 업종분류

**구현 계획**:
```
src/server/data-sources/card-sales/
├── client.ts  — 지자체별 API/파일 통합 어댑터
└── adapter.ts — 행정동코드 기반 점포당 매출 산출
```

**스코어링 반영 (박사님 제안 — 보류, 데이터 분포 실측 필요)**:

```typescript
// 박사님 권고 공식 — 비서울 vitality
function calcNonSeoulVitality(data: CardSalesData): number {
  // 1단계: 개별 정규화 (각각 0~100)
  const revenueScore = logNormalize(data.avgRevenuePerStore, MIN_REV, MAX_REV) * 100;
  const transactionScore = logNormalize(data.avgTransactionsPerStore, MIN_TX, MAX_TX) * 100;
  const growthScore = normalize(data.revenueGrowthRate, -0.15, 0.30) * 100;

  // 2단계: 가중합산
  return Math.round(
    revenueScore * 0.45 +
    transactionScore * 0.30 +
    growthScore * 0.25
  );
}
```

**설계 원칙 (박사님)**:
- 반드시 "점포당 매출"로 환산 (행정동 총매출 ÷ 업종 점포수)
- 개별 정규화 후 가중합산 (단위 혼합 금지)
- 로그 정규화 (매출 분포 우편향)
- MIN_REV, MAX_REV 등 기준값은 실제 데이터 분포(p25/p50/p75/p90) 조사 후 설정

**선행 조건**:
1. 경기도 카드소비 API 실제 호출하여 데이터 분포 확보
2. 서울에서 골목상권 vitality vs 카드소비 vitality 교차검증 (피어슨 상관계수)
3. 정규화 기준값 확정 후 박사님 재검토

**기존 점수 영향**: 비서울 ±15~25점 변동 가능 (가중치 체계 전환)

---

### 9. 국세청 사업자 현황 → 비서울 survival 복원

**기술 명세**:
- 엔드포인트: `https://www.data.go.kr/data/15081808`
- 인증: `DATA_GO_KR_API_KEY`
- 호출 제한: 100req/call, 1M/일
- 시군구 단위

**구현 계획**:
```
src/server/data-sources/nts-business/
├── client.ts  — data.go.kr REST 호출
└── adapter.ts — 시군구별 업종별 폐업률/개업률 산출
```

**스코어링 반영 (박사님 제안 — 조건부 승인)**:

```typescript
// 박사님 권고 공식 — 비서울 survival
// 서울과 동일한 2지표 구조 유지
function calcNonSeoulSurvival(data: NtsBizData): number | null {
  if (data.totalBiz === 0) return null;

  const closeRate = (data.closedCount / data.totalBiz) * 100;
  const openRate = (data.newCount / data.totalBiz) * 100;

  // 서울과 동일한 공식 재사용
  const closeScore = Math.round((1 - normalize(closeRate, 0, 15)) * 100);
  const netChangeScore = Math.round(normalize(openRate - closeRate, -7.5, 7.5) * 100);

  return Math.round(closeScore * 0.6 + netChangeScore * 0.4);
}
```

**설계 원칙 (박사님)**:
- 서울과 동일한 2지표 구조 (closeScore×0.6 + netChangeScore×0.4)
- 동일한 정규화 범위 (closeRate 0~15%, netChange -7.5~+7.5%)
- UI에 "시군구 평균 기준 (상권별 편차 있을 수 있음)" 표기 필수

**선행 조건**: 국세청 API의 업종별 세분화 수준 확인 (대/중/소분류?)

---

### 10. ITS 통행량

**기술 명세**:
- 엔드포인트: `http://openapi.its.go.kr/portal/`
- 인증: ITS 포털 가입 후 API 키 발급
- 데이터: 도로 구간별 통행량, 속도, 시간대별 패턴 (5분 간격)
- 전국 주요 도로 커버

**구현 계획**:
```
src/server/data-sources/its-traffic/
├── client.ts  — ITS API 호출 + 캐시 (TTL 1일)
└── adapter.ts — 최근접 도로구간 매핑 + 통행량 점수화
```

- 도로구간↔상가위치 매핑: 분석 좌표에서 최근접 ITS 구간을 Haversine으로 탐색
- 반경 500m 이내 도로구간의 일평균 통행량 합산

**스코어링 반영**:
- `infra-bonus.ts`에 `traffic` 항목 추가
- 점수화: `trafficScore = logNormalize(dailyAvgTraffic, 1000, 50000) × 100`
- 업종별 가중치: 도로변 노출 중요 업종(편의점, 음식점)은 높게, 주거지 업종(학원, 미용실)은 낮게
- MAX_BONUS 15점 유지, 가중치 합 0.55 유지 조건 동일

---

## 비서울 스코어링 공식 변경 로드맵

### 현재 (Phase 1 전)
```
P+S있음: competition×0.40 + population×0.35 + survival×0.25 + infraBonus
P있음:   competition×0.45 + population×0.40 + infraAccess×0.15
P없음:   competition×0.75 + infraAccess×0.25
```

### Phase 1 완료 후
```
(변경 없음 — 상가정보는 보조, 주차장/문화시설은 infraBonus 내부 재분배)
```

### Phase 2 완료 후 (박사님 권고 — 최종 목표)
```
4지표 (vitality+survival 모두 복원):
  competition×0.30 + vitality×0.30 + population×0.20 + survival×0.20 + infraBonus(max15)

3지표 (survival 미복원):
  competition×0.35 + vitality×0.35 + population×0.30 + infraBonus(max15)

3지표 (vitality 미복원, 카드소비 미커버 지역):
  competition×0.40 + population×0.35 + survival×0.25 + infraBonus(max15)

2지표 (현행 유지 — vitality, survival 모두 없는 지역):
  competition×0.45 + population×0.40 + infraAccess×0.15
```

**서울과의 차이 근거**:
- vitality: 0.35→0.30 (카드소비가 골목상권보다 해상도 낮음)
- competition: 0.25→0.30 (비서울에서 Kakao Places가 가장 신뢰성 높은 소스)
- infraBonus 가산 방식 서울과 통일 (baseScore + max15)

---

## 다중공선성 리스크 (박사님 분석)

| 쌍 | 상관계수 추정 | 리스크 | 완화 방안 |
|----|:---:|:---:|------|
| vitality(카드매출) ↔ population | 0.5~0.7 | **High** | "점포당 매출" 기준 채택으로 인구 효과 제거 |
| vitality ↔ competition | 0.4~0.6 | Medium | 방향 반대(보완 관계), 실질 왜곡 낮음 |
| parking ↔ transit | 0.3~0.5 | Low | infraBonus 내부 가중합 → 자연 완화 |
| 상가정보 ↔ Kakao | 0.8~0.9 | Eliminated | 방안A(보조 검증)로 동시 투입 안 함 |

**종합**: 관리 가능 수준. Phase 2 후 서울 교차검증에서 r>0.7 쌍 발견 시 가중치 재조정.

---

## 기존 점수 호환성

| Phase | 서울 영향 | 비서울 영향 | 완화 방안 |
|-------|:---:|:---:|------|
| Phase 1 | 0 | 0~+2점 | 영향 미미, 별도 조치 불필요 |
| Phase 2 | 0 | **±15~25점** | 전환기 병행 표시 + scoringVersion 필드 추가 |

**Phase 2 전환 시 필수 조치**:
1. AnalysisRequest에 `scoringVersion` 필드 추가
2. AI 리포트에 "분석 정밀도 향상" 안내 자동 삽입
3. 기존 분석 결과에 "(구 기준)" 뱃지 표시

---

## 구현 순서

### Phase 1 (즉시 — 스코어링 영향 미미)
```
1. 소상공인 상가정보 → competition 보조 데이터
2. 주차장 DB 적재 + infraBonus 확장
3. 문화시설 DB 적재 + infraBonus 확장
4. 행안부 인구 → KOSIS fallback
5. 부동산원 임대동향 → AI 리포트 참고
6. 공시지가 → AI 리포트 참고
7. 가계동향 → AI 리포트 참고
```

### Phase 2 (데이터 실측 후 — 박사님 재검토 필수)
```
1. 경기도 카드소비 API 실호출 → 데이터 분포 확보
2. 서울 교차검증 (골목상권 vs 카드소비 vitality)
3. 정규화 기준값 확정 → 박사님 재검토
4. 국세청 API 업종 세분화 확인
5. 비서울 vitality + survival 구현
6. 가중치 전환 + scoringVersion 관리
```

---

## 참조 문서

- `/Users/juno/work/my/docs/api-technical-specs.md` — 10개 API 기술 명세 상세
- `/Users/juno/work/my/docs/public-api-candidates.md` — 연동 후보 원본
- `/Users/juno/work/my/docs/dev-guide.md` — 아키텍처 + 스코어링 레퍼런스
