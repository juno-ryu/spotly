# Design: preview-redesign (인사이트 미리보기 리디자인)

> 작성일: 2026-03-15
> Plan 참조: `docs/01-plan/features/preview-redesign.plan.md`
> 상태: 설계 완료 (v2 — 피드백 반영)

---

## 1. 현재 구조 분석

### 1-1. 라우트

| 라우트 | 페이지 | 역할 |
|--------|--------|------|
| `/analyze/[id]` | `AnalysisResultPage` | 전체 인사이트 (바텀시트 + 지도) |
| `/report/[id]` | `ReportPage` | AI 리포트만 (종합판단 + 강점/위험/제언) |

### 1-2. 현재 `/analyze/[id]` 바텀시트 구성

```
┌──────────────────────────────────┐
│ [드래그 핸들]                      │
│ Header: "📍 OO동 부근 반경 300m   │
│         OO업종 23개를 찾았어요"     │
│                                    │
│ [경고 배너] (지표 20점 미만 시)      │
│                                    │
│ Accordion (7개 섹션, 업종별 순서)    │
│   ├ competition                    │
│   ├ vitality (서울만)              │
│   ├ transit (지하철+버스)           │
│   ├ school                        │
│   ├ university                    │
│   ├ medical                       │
│   └ population                    │
│                                    │
│ [CTA] 🔒 AI 맞춤 리포트 잠금 해제   │ ← ReportUpsellDialog 열림
└──────────────────────────────────┘
```

### 1-3. 핵심 발견

- `ReportUpsellDialog`가 이미 존재: 후기 캐러셀 + 비교 테이블 + 생성 버튼
- `COMPARISON_ITEMS`, `TESTIMONIALS` 상수가 다이얼로그 안에 정의됨
- `totalScore` 필드가 DB에 있지만 **현재 바텀시트에서 총점/등급을 보여주지 않음**
- `scoreDetail` JSON에 개별 지표 점수+등급이 있으나 **노출되지 않음**

### 1-4. 데이터 흐름

```
prisma.analysisRequest (DB)
  ├── totalScore: number           ← 총점 (0~100)
  ├── scoreDetail: Json            ← { competition, vitality?, population?, survival? }
  ├── reportData: Json             ← AnalysisResult 전체 (places, subway, bus, ...)
  ├── aiReportJson: Json | null    ← AI 리포트 (생성 전 null)
  ├── address, industryName, radius
  └── status: PENDING | PROCESSING | COMPLETED | FAILED
```

---

## 2. 설계 원칙

### 2-1. 숫자 점수 비노출 정책

**모든 화면에서 숫자 점수(67점 등)를 표시하지 않는다.** 등급(A/B/C/D/F)만 표기한다.

이유: 데이터 정밀도의 한계(읍면동 단위 인구, 카드 매출 기반 등)로 인해
숫자 점수는 과도한 정밀도를 암시하며, 향후 책임 소재 리스크가 있다.

| 등급 | 라벨 | 색상 |
|------|------|------|
| A | 우수한 입지 | emerald-500 |
| B | 양호한 입지 | violet-500 |
| C | 보통 수준 | amber-500 |
| D | 주의 필요 | orange-500 |
| F | 신중한 검토 필요 | red-500 |

### 2-2. AI 리포트 = 전문가 상담

인사이트 데이터를 그대로 보여주는 것은 유료 가치가 아니다.
**AI 리포트는 데이터를 소화하여 전문가 어투로 조언하는 콘텐츠**이어야 한다.
인사이트 데이터는 AI 프롬프트의 입력값이지, 리포트 페이지의 출력물이 아니다.

→ 기존 Accordion 인사이트를 리포트 페이지로 이동하지 않는다.
→ 리포트 페이지는 AI 생성 콘텐츠만 표시한다 (기존 ReportViewer 유지).
→ AI 프롬프트 품질 개선은 Phase 3에서 다룬다.

### 2-3. 컴포넌트 정책

**모든 UI 컴포넌트는 shadcn/ui 기반으로 구성한다.**
커스텀 컴포넌트 직접 구현을 지양하고, shadcn에서 가장 유사한 컴포넌트를 가져와 조합한다.

| 용도 | shadcn 컴포넌트 |
|------|-----------------|
| 등급 카드 | `Card`, `CardContent` |
| 지표 카드 그리드 | `Card` + CSS Grid |
| CTA 버튼 | `Button` (variant="default", size="lg") |
| 결제유도 페이지 체크리스트 | `Card` + custom list |
| 후기 섹션 | `Card` + `Avatar` |
| 페이지 레이아웃 | 기존 프로젝트 레이아웃 패턴 따름 |
| 배지 (등급 표시) | `Badge` |

---

## 3. 목표 구조

### 3-1. 라우트

| 라우트 | 페이지 | 역할 | 변경 |
|--------|--------|------|------|
| `/analyze/[id]` | `AnalysisResultPage` | **미리보기** (등급 + 지표 카드 + CTA) | 축소 |
| `/analyze/[id]/purchase` | `PurchasePage` | **결제유도** (가치 설명 + 후기 + 결제) | 신규 |
| `/report/[id]` | `ReportPage` | **AI 리포트** (전문가 상담형 콘텐츠) | 유지 |

### 3-2. `/analyze/[id]` — 미리보기 (변경 후)

```
┌──────────────────────────────────┐
│            [배경: 지도]            │ ← 유지
│                                    │
│ ┌────────────────────────────────┐ │
│ │ [드래그 핸들]                    │ │
│ │                                │ │
│ │ "📍 OO동 · 카페 · 반경 300m"   │ │ ← Header 유지
│ │                                │ │
│ │        ┌──────────┐           │ │
│ │        │  B등급     │           │ │ ← 등급만 (숫자 없음)
│ │        │양호한 입지  │           │ │
│ │        └──────────┘           │ │
│ │                                │ │
│ │  ┌────────┬────────┬────────┐│ │
│ │  │🏪 경쟁  │👥 인구  │🚇 교통 ││ │ ← MetricCard
│ │  │  C등급  │  B등급  │  A등급 ││ │    등급만 + 한줄 팩트
│ │  │동종 23곳│32,450명│강남역   ││ │
│ │  └────────┴────────┴────────┘│ │
│ │                                │ │
│ │  [AI 전문가 분석 받기 →]        │ │ ← CTA → /purchase
│ │                                │ │
│ └────────────────────────────────┘ │
└──────────────────────────────────┘
```

**제거**: 7개 Accordion, 경고 배너, ReportUpsellDialog, COMPARISON_ITEMS, TESTIMONIALS
**추가**: GradeBadge, MetricCards
**유지**: 배경 지도, 드래그 핸들, Header, 바텀시트 구조

### 3-3. `/analyze/[id]/purchase` — 결제유도 페이지 (신규)

```
┌──────────────────────────────────┐
│ [← 뒤로]                          │
│                                    │
│    OO동 카페 입지                  │
│    B등급 · 양호한 입지              │
│                                    │
│ ── 리포트에 포함되는 내용 ──       │
│                                    │
│  ✅ AI 전문가의 입지 종합 판단      │
│  ✅ 경쟁 환경 심층 분석             │
│  ✅ 맞춤 실행 전략 제안             │
│  ✅ 위험 요소 사전 경고             │
│  ✅ PDF 다운로드                   │
│                                    │
│ ── 실제 사용자 후기 ──             │ ← TESTIMONIALS 이동
│  ┌────────────────────────┐      │
│  │ "강남에서 카페 창업 전에  │      │
│  │  받아봤는데 정말 도움..."  │      │
│  │        — 김OO 대표님      │      │
│  └────────────────────────┘      │
│                                    │
│  ┌────────────────────────────┐  │
│  │   AI 전문가 분석 받기       │  │ ← Phase 1: 바로 /report 이동
│  │                             │  │ ← Phase 2: PG 결제
│  └────────────────────────────┘  │
│                                    │
└──────────────────────────────────┘
```

### 3-4. `/report/[id]` — AI 리포트 (변경 없음)

기존 `ReportViewer` 그대로 유지. AI가 생성한 콘텐츠만 표시.

```
종합 판단 (verdict + Badge)
강점 / 위험 / 제언 (3 cards)
상세 분석 (prose text)
PDF 다운로드
```

> Phase 3에서 AI 프롬프트를 대화형 전문가 톤으로 개선.
> Phase 3에서 InsightSections는 만들지 않고, 데이터를 Claude에게 넘겨서 직접 소화시킴.

---

## 4. 컴포넌트 설계

### 4-1. 변경/신규 파일 목록

```
src/features/analysis/components/
├── analysis-result.tsx          ← 대폭 축소 (미리보기 모드)
├── grade-badge.tsx              ← 신규: 총 등급 배지
└── metric-cards.tsx             ← 신규: 지표 카드 (등급 + 한줄 팩트)

src/app/(main)/analyze/[id]/
├── page.tsx                     ← 수정 (유지)
└── purchase/
    └── page.tsx                 ← 신규: 결제유도 페이지
```

### 4-2. `GradeBadge` 컴포넌트 (신규)

```typescript
// src/features/analysis/components/grade-badge.tsx
"use client";

interface GradeBadgeProps {
  totalScore: number;  // 내부에서 등급 계산용, UI에 숫자 노출 안 함
}

// 사용하는 shadcn 컴포넌트: Badge
// totalScore → getGrade() → 등급 문자 + 라벨 + 색상
```

**UI**:
```
┌──────────────────┐
│      B등급        │  ← Badge variant에 등급별 색상
│   양호한 입지      │  ← text-sm text-muted-foreground
└──────────────────┘
```

### 4-3. `MetricCards` 컴포넌트 (신규)

```typescript
// src/features/analysis/components/metric-cards.tsx
"use client";

interface MetricCardsProps {
  scoreDetail: ScoreDetail;
  reportData: ReportData;  // 한줄 팩트 추출용
  isSeoul: boolean;
}

// 사용하는 shadcn 컴포넌트: Card, CardContent
```

**지표 선택 및 한줄 팩트 매핑**:

| 지역 | 카드 1 | 카드 2 | 카드 3 |
|------|--------|--------|--------|
| 서울 | 🏪 경쟁: `competition.grade` + 동종 N곳 | 📈 활력도: `vitality.grade` + 유동인구 | 👥 인구: `population.grade` + N명 |
| 비서울 | 🏪 경쟁: `competition.grade` + 동종 N곳 | 👥 인구: `population.grade` + N명 | — |

**한줄 팩트 동적 생성** (비서울/데이터 부족 대응):

```typescript
// 각 카드의 한줄 팩트는 available 데이터에서 추출
const competitionFact = places?.totalCount
  ? `동종 ${places.totalCount}곳`
  : "데이터 수집 완료";

const populationFact = population?.details?.totalPopulation
  ? `${population.details.totalPopulation.toLocaleString()}명`
  : "인구 데이터 확인됨";

// 교통 팩트 (서울에서 활력도 대신 사용하는 경우 등)
const transitFact = subway?.stations?.[0]
  ? `${subway.stations[0].stationName}역 ${Math.round(subway.stations[0].distanceMeters)}m`
  : bus?.totalRoutes
    ? `버스 ${bus.totalRoutes}개 노선`
    : null;
```

**비서울 레이아웃**:
```
서울 (3개):
┌────────┬────────┬────────┐
│경쟁 C   │활력 B   │인구 B   │
│동종 23곳│유동 4.2만│32,450명│
└────────┴────────┴────────┘

비서울 (2개):
┌──────────────┬──────────────┐
│  🏪 경쟁 C    │  👥 인구 B    │
│  동종 5곳     │  24,300명    │
└──────────────┴──────────────┘

강릉 등 데이터 적은 지역 (2개):
┌──────────────┬──────────────┐
│  🏪 경쟁 B    │  👥 인구 C    │
│  동종 3곳     │  18,200명    │
└──────────────┴──────────────┘
```

### 4-4. `analysis-result.tsx` 수정 (축소)

```typescript
// 변경 전: ~800줄 (바텀시트 + 7개 Accordion + ReportUpsellDialog)
// 변경 후: ~200줄 (바텀시트 + GradeBadge + MetricCards + CTA)

export function AnalysisResult({ data }: AnalysisResultProps) {
  // ── 유지 ──
  // sheetRef, handleRef, 드래그/스냅 로직 (touch + mouse)
  // Header 컴포넌트 (주소 + 반경 + 업종 + 업체수)
  // CompetitorMap 배경 지도
  // SourceTicker

  // ── 제거 ──
  // reportDialogOpen state
  // insightData 구성 + buildXxxInsights/Header 호출 7개
  // getSectionOrder, shouldHideUniversitySection, MEDICAL_KEYWORDS, SectionKey
  // lowScoreWarnings 로직 + 경고 배너
  // Accordion 전체 (~200줄)
  // ReportUpsellDialog (~55줄) + COMPARISON_ITEMS + TESTIMONIALS + animStyles

  // ── 추가 ──
  const report = data.reportData as Record<string, unknown> | undefined;
  const scoreDetail = data.scoreDetail as ScoreDetail | undefined;
  const isSeoul = !!scoreDetail?.vitality;

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* 배경 지도 — 유지 */}
      <CompetitorMap ... />

      {/* 바텀시트 — 축소 */}
      <div ref={sheetRef} ...>
        <div ref={handleRef} ... /> {/* 드래그 핸들 */}
        <Header ... />

        <div className="flex-1 overflow-y-auto px-4 pb-10 mt-3 space-y-4">
          <GradeBadge totalScore={data.totalScore} />
          <MetricCards
            scoreDetail={scoreDetail}
            reportData={report}
            isSeoul={isSeoul}
          />
        </div>

        {/* CTA — /purchase로 이동 */}
        <div className="shrink-0 px-4 pb-3 pt-2 border-t bg-background">
          {data.aiReportJson ? (
            <Button asChild variant="default" size="lg" className="w-full h-12">
              <Link href={`/report/${data.id}`}>
                이전에 받은 리포트 보기 →
              </Link>
            </Button>
          ) : (
            <Button asChild variant="default" size="lg" className="w-full h-12">
              <Link href={`/analyze/${data.id}/purchase`}>
                AI 전문가 분석 받기 →
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 4-5. `/analyze/[id]/purchase/page.tsx` (신규)

```typescript
// src/app/(main)/analyze/[id]/purchase/page.tsx

export default async function PurchasePage({ params }) {
  const { id } = await params;
  const analysis = await prisma.analysisRequest.findUnique({
    where: { id },
    select: {
      id: true, address: true, industryName: true,
      totalScore: true, aiReportJson: true,
    },
  });

  if (!analysis) notFound();
  // 이미 리포트가 있으면 리포트 페이지로 리다이렉트
  if (analysis.aiReportJson) redirect(`/report/${id}`);

  return <PurchaseClient analysis={analysis} />;
}
```

```typescript
// src/features/analysis/components/purchase-client.tsx
"use client";

// 사용하는 shadcn 컴포넌트: Card, CardContent, Button, Avatar, Badge

// TESTIMONIALS, COMPARISON_ITEMS를 analysis-result.tsx에서 이동
// 기존 ReportUpsellDialog의 UI 요소를 페이지로 재구성

// Phase 1: CTA 클릭 → generateReport() → /report/[id] 이동
// Phase 2: CTA 클릭 → PG 결제 → 성공 시 generateReport() → /report/[id]

interface PurchaseClientProps {
  analysis: {
    id: string;
    address: string;
    industryName: string;
    totalScore: number;
  };
}
```

**UI 구조**:

```
BackButton

Card (등급 요약)
  ├── address + industryName
  ├── GradeBadge (등급 + 라벨)

Card (포함 내용)
  ├── ✅ AI 전문가의 입지 종합 판단
  ├── ✅ 경쟁 환경 심층 분석
  ├── ✅ 맞춤 실행 전략 제안
  ├── ✅ 위험 요소 사전 경고
  └── ✅ PDF 다운로드

Card (후기) — TESTIMONIALS
  ├── Avatar + 이름
  └── 후기 텍스트

Button (CTA)
  ├── Phase 1: "무료로 AI 분석 받기" → generateReport() + redirect
  └── Phase 2: "₩9,900 결제하고 분석 받기" → PG → redirect
```

---

## 5. 데이터 흐름

### 5-1. 미리보기 (`/analyze/[id]`)

```
DB → AnalysisRequest (전체)
  ↓
AnalysisResultPage (Server Component)
  ↓
AnalysisResult (Client Component)
  ├── data.totalScore → GradeBadge (등급 계산)
  ├── data.scoreDetail → MetricCards (지표별 등급)
  ├── data.reportData → MetricCards (한줄 팩트 추출)
  └── data.reportData.centerLat/Lng → CompetitorMap
```

### 5-2. 결제유도 (`/analyze/[id]/purchase`)

```
DB → AnalysisRequest (select: id, address, industryName, totalScore, aiReportJson)
  ↓
PurchasePage (Server Component) — aiReportJson 존재 시 /report로 리다이렉트
  ↓
PurchaseClient (Client Component)
  ├── GradeBadge (등급 표시)
  ├── 포함 내용 리스트
  ├── 후기 캐러셀
  └── CTA → generateReport() → router.push(/report/[id])
```

### 5-3. AI 리포트 (`/report/[id]`)

```
DB → AnalysisRequest (select: id, address, industryName, aiReportJson)
  ↓
ReportPage (Server Component)
  ↓
ReportViewer (Client Component) — 기존 그대로
  ├── verdict + Badge
  ├── strengths / risks / recommendations cards
  ├── detailedAnalysis prose
  └── PDF download
```

---

## 6. CTA 동작

### Phase 1 (결제 미구현)

```
미리보기 → [AI 전문가 분석 받기 →] → /purchase 페이지
         → [무료로 AI 분석 받기] 버튼 → generateReport() Server Action
         → 성공 → /report/[id] 리다이렉트
```

### Phase 2 (결제 구현 후)

```
미리보기 → [AI 전문가 분석 받기 →] → /purchase 페이지
         → [₩9,900 결제] → PG 결제 팝업
         → 성공 → generateReport() + /report/[id] 리다이렉트
```

---

## 7. 마이그레이션 전략

### 7-1. 기존 코드 재활용

| 기존 코드 | 행방 |
|----------|------|
| `Header` 컴포넌트 | `analysis-result.tsx`에 유지 |
| 드래그/스냅 로직 | `analysis-result.tsx`에 유지 |
| `CompetitorMap` | `analysis-result.tsx`에 유지 |
| `SourceTicker` | `analysis-result.tsx`에 유지 |
| `Insight` 컴포넌트 | 제거 (리포트 페이지에서 미사용) |
| `getSectionOrder()` | 제거 |
| `shouldHideUniversitySection()` | 제거 |
| `MEDICAL_KEYWORDS`, `SectionKey` | 제거 |
| `ReportUpsellDialog` | 제거 → `purchase-client.tsx`로 재구성 |
| `COMPARISON_ITEMS` | `purchase-client.tsx`로 이동 |
| `TESTIMONIALS` | `purchase-client.tsx`로 이동 |
| Accordion 인사이트 로직 | 제거 (AI가 데이터 소화) |

### 7-2. 구현 순서

```
Step 1. grade-badge.tsx 작성
  - shadcn Badge 기반
  - totalScore → getGrade() → 등급 + 라벨 + 색상

Step 2. metric-cards.tsx 작성
  - shadcn Card 기반
  - scoreDetail에서 등급 추출 + reportData에서 한줄 팩트
  - 서울 3개 / 비서울 2개 동적 그리드

Step 3. analysis-result.tsx 축소
  - Accordion/인사이트 코드 전부 제거
  - GradeBadge + MetricCards 삽입
  - CTA를 Link(Button)로 /purchase 연결
  - ReportUpsellDialog + 관련 상수 제거

Step 4. purchase/page.tsx + purchase-client.tsx 작성
  - TESTIMONIALS, COMPARISON_ITEMS 이동
  - Phase 1: 무료 체험 버튼 → generateReport() → /report 이동
  - 기존 ReportUpsellDialog의 UI 요소 페이지로 재배치

Step 5. 검증
  - 미리보기: 등급 + 지표카드(2~3개) + CTA 정상 표시
  - 결제유도: 포함 내용 + 후기 + CTA 정상 동작
  - 리포트: 기존 AI 리포트 정상 표시
  - 비서울: 2개 카드 정상 레이아웃
  - 반응형(모바일) 확인
```

---

## 8. 비서울 및 데이터 부족 대응

### 8-1. MetricCards 동적 처리

비서울, 또는 강릉 같은 데이터 적은 지역에서도 **최소 경쟁+인구 2개 카드는 항상 표시**.

| 지역 | 가용 지표 | 카드 수 |
|------|----------|---------|
| 서울 | 경쟁 + 활력도 + 인구 | 3개 |
| 비서울 광역시 | 경쟁 + 인구 | 2개 |
| 비서울 시군 | 경쟁 + 인구 | 2개 |

경쟁(`competition`)과 인구(`population`)는 전국 커버:
- Kakao Places → 경쟁 업체 수 (전국)
- KOSIS → 배후 인구 (전국)

### 8-2. 한줄 팩트 우선순위

카드 안의 한줄 팩트도 동적:

| 지표 | 팩트 소스 | 전국 커버 | fallback |
|------|----------|----------|----------|
| 경쟁 | `places.totalCount` | ✅ 전국 | "데이터 수집 완료" |
| 활력도 | `vitality.floatingPopulation` | ❌ 서울만 | (카드 자체 미표시) |
| 인구 | `population.totalPopulation` | ✅ 전국 | "인구 데이터 확인됨" |

---

## 9. 삭제 대상 코드 (analysis-result.tsx)

| 항목 | 줄 수 (약) |
|------|-----------|
| `ReportUpsellDialog` 함수 | ~55줄 |
| `COMPARISON_ITEMS`, `TESTIMONIALS`, `animStyles` | ~50줄 |
| `reportDialogOpen` state | ~2줄 |
| `insightData` 구성 + `buildXxx` 호출 14개 | ~30줄 |
| `getSectionOrder`, `shouldHideUniversitySection`, `MEDICAL_KEYWORDS`, `SectionKey` | ~40줄 |
| `lowScoreWarnings` 로직 + 배너 UI | ~15줄 |
| Accordion `sectionOrder.map()` 전체 | ~200줄 |
| 관련 import문 | ~10줄 |
| **합계** | **~400줄 제거** |

**예상**: ~800줄 → ~200줄 (약 75% 감소)

---

## 10. 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| scoreDetail 타입이 Prisma Json (any) | `as ScoreDetail` 타입 단언 + nullish 체크 |
| 비서울에서 카드 2개뿐 | CSS Grid `grid-cols-2` / `grid-cols-3` 동적 전환 |
| TESTIMONIALS/COMPARISON_ITEMS 이동 시 import 정리 | purchase-client.tsx에서 재정의 |
| Phase 1에서 /purchase → 무료 체험이 어색할 수 있음 | "지금은 무료 체험 기간입니다" 문구로 자연스럽게 처리 |
| 기존 URL 북마크 | `/analyze/[id]`, `/report/[id]` 라우트 변경 없음 |
| 인사이트 Accordion 코드 완전 삭제 후 복구 어려움 | git history에서 복구 가능. 또한 인사이트 빌더/룰 파일은 그대로 유지 (프롬프트 입력용) |
