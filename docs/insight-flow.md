# 인사이트 플로우 — 0 → 100 전체 흐름

> 마지막 업데이트: 2026-03-08

---

## 0단계: 사용자 입력

```
[웹 폼] 주소 입력 + 업종 선택 + 반경 선택
         ↓
[Kakao Geocoding] 주소 → 위도/경도 + 행정동코드 + 법정동코드
         ↓
startAnalysis() — Server Action (actions.ts)
```

---

## 1단계: 데이터 수집 (병렬)

```
runAnalysis() — analysis-orchestrator.ts
        │
        ├── [1] Kakao Places         → 경쟁업체 목록 (전국, 사용자 반경)
        ├── [2] 서울 골목상권         → 매출/점포/유동인구/상주인구 (서울만)
        ├── [3] KOSIS 인구            → 배후 인구 (전국)
        ├── [4] 지하철               → 역세권 (서울·부산·대구·광주·대전)
        │                              서울: 열린데이터광장 CardSubwayTime
        │                              지방: odcloud 자동변환 API (regionCode 26/27/29/30)
        ├── [5] 버스 (TAGO)          → 정류장·노선수 (전국)
        ├── [6] 학교 DB              → 초중고 (전국)
        ├── [7] 대학교 Kakao          → 대학교 (전국)
        └── [8] 병의원 Kakao          → 종합병원 (전국)
                      ↓
           Promise.allSettled — 실패해도 null로 격리
```

---

## 2단계: 스코어링

```
[경쟁 분석]      analyzeCompetition()  → competitionScore (0~100)
[활력도 분석]    analyzeVitality()     → vitalityScore    (서울만, null 가능)
[인구 분석]      analyzePopulation()   → populationScore  (전국)

총점 calcTotalScore():
  서울:  vitality×35% + competition×25% + population×20% + survival×20%
  비서울: competition×55% + population×45%
```

---

## 3단계: DB 저장 + Redis 캐시

```
prisma.analysisRequest.update({
  totalScore,
  scoreDetail: { competition, vitality, population, survival },
  reportData: AnalysisResult 전체 JSON
})
         ↓
Redis: 골목상권·KOSIS·지하철·버스 데이터 캐시 (TTL 7~30일)
         ↓
클라이언트에 analysis.id 반환 → 폴링 시작
```

---

## 4단계: 클라이언트 렌더링

```
AnalysisResult 컴포넌트 (analysis-result.tsx)
         │
         ├── report.reportData에서 각 분석 결과 꺼냄
         │
         └── InsightData 구성:
               {
                 competition, vitality, places,
                 industryName, radius,
                 subway, bus, school,
                 university, medical, population
               }
```

---

## 5단계: 인사이트 생성 (핵심)

각 섹션 빌더 함수가 InsightData를 받아 InsightItem[] 반환.

```
buildCompetitionInsights(insightData)  → 경쟁강도 카드
buildPopulationInsights(insightData)   → 상권활력도/유동인구 카드
buildSubwayInsights(insightData)       → 역세권 카드
buildBusInsights(insightData)          → 버스 접근성 카드  ← 배달 업종 return []
buildSchoolInsights(insightData)       → 학교 카드         ← 학원만 category:"scoring"
buildUniversityInsights(insightData)   → 대학교 카드       ← 부동산/의료/학원 return []
buildMedicalInsights(insightData)      → 병의원 카드       ← 약국/편의점만 category:"scoring"

combinedRiskInsights(insightData)      → 위험 조합 패턴
  ├── 유령 상권   (유동인구 낮음 + 매출 낮음 + 폐업률 높음)
  ├── 레드오션    (경쟁 과포화 + 프랜차이즈 60%+)
  ├── 거품 상권   (개업률↑ + 폐업률↑ + HL 상권변화)
  ├── 수요 부족   (배후인구 5천 미만 + 유동인구 1만 미만)
  └── 교통 사각지대 (역세권 아님 + 버스 3개 미만) ← 배달 업종 제외
```

### 업종별 분기 요약 (2026-03-08 개편)

| 섹션 | 업종 조건 | 동작 |
|------|----------|------|
| 학교 | 학원 | `category: "scoring"` |
| 학교 | 그 외 | `category: "fact"` |
| 대학교 | 부동산·병원·의원·치과·한의·학원 | `return []` (숨김) |
| 대학교 | 카페·음식·의류 등 수혜 업종 | `category: "scoring"` + 방학 리스크 경고 |
| 병의원 | 약국·편의점 | `category: "scoring"` |
| 병의원 | 그 외 | `category: "fact"` |
| 버스 | 배달 업종 | `return []` (숨김) |
| 교통사각지대 | 배달 업종 | 패턴 제외 |

---

## 6단계: InsightItem → UI 렌더링

```typescript
interface InsightItem {
  type: "text";
  emoji: string;
  text: string;    // 핵심 메시지
  sub?: string;    // 수치/상세 설명
  category: "scoring" | "fact";
}
```

- `"scoring"` → 점수에 반영된 근거 카드 (강조 표시)
- `"fact"` → 참고 정보 카드 (덜 강조)

---

## 파일 맵

| 역할 | 파일 |
|------|------|
| Server Action | `src/features/analysis/actions.ts` |
| 데이터 수집 | `src/features/analysis/lib/analysis-orchestrator.ts` |
| 인사이트 타입 | `src/features/analysis/lib/insights/types.ts` |
| 인사이트 빌더 | `src/features/analysis/lib/insights/builder.ts` |
| 룰 파일들 | `src/features/analysis/lib/insights/rules/*.ts` |
| UI 컴포넌트 | `src/features/analysis/components/analysis-result.tsx` |

---

## ⚠️ 알려진 이슈

`builder.ts`의 `getRulesForIndustry()` 업종별 정렬 로직은 현재 **미사용 상태**.
UI(`analysis-result.tsx`)가 `buildInsights()` 대신 개별 빌더 함수를 직접 호출하므로
섹션 순서가 컴포넌트에 하드코딩되어 있음.

→ 섹션 정렬을 실제로 적용하려면 `analysis-result.tsx` 수정 필요 (`senior-frontend-architect` 담당).
