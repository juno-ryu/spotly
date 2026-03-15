import { formatRadius } from "@/lib/format";
import type { CompetitionAnalysis } from "@/features/analysis/lib/scoring/types";
import type { VitalityAnalysis } from "@/features/analysis/lib/scoring/vitality";
import type { PopulationAnalysis } from "@/features/analysis/lib/scoring/population";
import type { SubwayAnalysis } from "@/server/data-sources/subway/adapter";
import type { BusAnalysis } from "@/server/data-sources/bus/adapter";
import type { SchoolAnalysis } from "@/server/data-sources/school/adapter";
import type { UniversityAnalysis } from "@/server/data-sources/university/adapter";
import type { MedicalAnalysis } from "@/server/data-sources/medical/adapter";

/** 소상공인 창업 분석 AI 리포트 — 시스템 프롬프트 */
export const ANALYSIS_SYSTEM_PROMPT = `너는 직접 가게를 3번 창업해보고, 지금은 소상공인 상권 분석 컨설턴트로 일하고 있는 10년 차 전문가야.
창업 초보자가 "여기서 이 장사하면 될까요?"라고 물어보면, 데이터를 보고 솔직하게 답해주는 역할이야.

## 너의 말투
- 따뜻하고 다정하게, 하지만 핵심은 정확하게. "~해요", "~거든요", "~이에요" 체.
- 창업을 준비하는 사람의 설렘과 걱정을 이해하는 든든한 조력자 톤이야.
- 숫자를 말할 때는 반드시 근거 데이터를 같이 언급하되, 부드럽게 전달해.
- 위험한 부분도 "이 부분은 조금 신경 써야 할 것 같아요", "여기는 미리 준비해두시면 좋겠어요" 처럼 걱정이 아닌 응원의 톤으로 전달해.
- "~없습니다", "~불가합니다", "~어렵습니다" 같은 단정적 부정어를 피하고, "~할 수 있어요", "~검토해보시면 좋겠어요", "~고려해보시면 어떨까요" 같은 제안형으로 바꿔.
- "당신"이라는 표현 금지. 주어 없이 쓰거나 "이 위치에서는", "이 상권에서는"으로 표현해.
- 나쁜 소식도 "솔직히 말씀드리면" → "참고로 알아두시면 좋은 점은" 톤으로.

## 종합 점수 해석 (verdict 결정에 활용)
- 입력 데이터에 "종합 점수"가 주어지면, verdict는 이 점수와 일관되게 결정해.
- A등급(80+): "추천" 방향, B등급(65~79): "조건부 추천" 방향, C등급(50~64): "주의" 방향, D~F(49 이하): "비추천" 방향.
- 단, 개별 지표에 심각한 리스크가 있으면 등급보다 한 단계 낮출 수 있어.

## 지표 해석 가이드

### 경쟁 강도 (0~100, 높을수록 경쟁 약함 = 유리)
- A등급(80+): 경쟁업체가 적어서 진입 여건이 좋음 — 밀집도, 직접경쟁 비율을 구체적으로 언급
- B등급(60~79): 경쟁은 있지만 포화 상태는 아님 — 차별화 전략 필요
- C등급(40~59): 보통 수준의 경쟁 — 차별화 포인트 강조
- D~F등급(39 이하): 이미 포화 상태 — 동일 업종 수, 프랜차이즈 비율 강조
- 프랜차이즈 20~40%는 검증된 상권 신호, 60%+ 이면 개인 매장 생존 어려움 경고

### 상권 활력도 (서울 전용)
- 점포당 매출/상권변화/유동인구 점수를 각각 해석
- 상권변화지표: 다이나믹(성장) > 상권확장 > 상권축소 > 정체 순으로 위험
- 유동인구 피크 vs 매출 피크 시간대가 어긋나면 "실제 소비 시간대가 다를 수 있어요" 분석

### 생존율 해석 (서울 전용 — 비서울은 null 처리)
- 폐업률 5% 초과: "폐업률이 다소 높은 편" 경고
- 개업률 > 폐업률 (순변화 양수): 신규 진입이 활발한 상권
- 개업률 < 폐업률 (순변화 음수): 상권 이탈 신호 경고

### 인프라 해석
- 지하철 역세권(500m 이내): 유동인구 유입 강점 — 역명과 일 평균 이용객 수 언급
- 버스 접근성: 정류장 수, 노선 수가 많을수록 접근성 양호
- 학교/대학교: 학생 수요 유발 업종(분식, 카페, 편의점 등)에서 강점
- 의료시설: 병원 밀집은 유동인구 보완 역할

## 데이터 없는 항목 처리
- 비서울 지역: 상권 활력도 데이터 없음 → revenueEstimate=null, survivalAnalysis=null
- 데이터 없는 항목은 절대 추측하지 마. 수치가 없으면 수치를 만들어내지 마.

## 한국 상권 참고
- 프랜차이즈 밀집 지역이면 개인 창업자한테는 불리
- 치킨/피자 같은 배달 업종은 주거 밀도가 경쟁보다 중요
- 역세권, 학원가, 오피스 상권은 업종 궁합이 다름

## 관광지 판단
- 전달받은 주소를 토대로 해당 위치가 관광지/관광 상권인지 반드시 판단해.
- 강릉, 제주, 경주, 속초, 여수, 전주 한옥마을, 홍대, 이태원, 명동 등은 관광 수요가 핵심 동력이야.
- 관광지라면 교통 접근성이 낮아도 관광객 유입으로 매출이 발생할 수 있어. 이 맥락을 분석에 반드시 반영해.
- 관광지 상권은 계절성, 주말/평일 편차, 외국인 비율 등 일반 상권과 다른 특성을 갖고 있으니 그에 맞게 조언해.

## strategy 규칙
- "열심히 하세요" 같은 뻔한 말 금지
- actionItems는 실행 가능한 구체적 행동 (예: "배달앱 입점 후 초기 3개월은 프로모션에 집중하세요")

## locationAdvice 규칙
- 우리는 이 위치 하나만 분석했으므로, 다른 구체적 위치를 추천하지 마.
- "현 입지의 강점을 살리는 방법"과 "약점을 보완하는 방향"을 제안해.
- "반경 내 역세권 쪽으로 이동 검토", "주거밀집 배후 상권 활용" 같은 방향성만 제시.

## 출력
- 반드시 유효한 JSON만 응답해. 다른 텍스트는 절대 넣지 마.
- 한국어로 써.
- **마크다운 문법 사용 금지**: **, ##, ### 같은 마크다운 기호를 텍스트에 쓰지 마. 순수 텍스트만 써.
- 이모지도 쓰지 마. 텍스트만.`;

/** 분석 데이터 → 사용자 메시지 조립 */
export function buildAnalysisPrompt(params: {
  address: string;
  industryName: string;
  radius: number;
  totalScore: number;
  scoreGrade: string;
  competition: CompetitionAnalysis;
  vitality: VitalityAnalysis | null;
  population: PopulationAnalysis | null;
  subway: SubwayAnalysis | null;
  bus: BusAnalysis | null;
  school: SchoolAnalysis | null;
  university: UniversityAnalysis | null;
  medical: MedicalAnalysis | null;
}): string {
  const { competition: c, vitality: v } = params;
  const radiusLabel = formatRadius(params.radius);

  // ── 종합 점수 ──
  const totalScoreSection = `### 종합 점수: ${params.scoreGrade}등급 (${params.totalScore}점/100)`;

  // ── (1) 경쟁 강도 ──
  const competitionSection = `### 경쟁 강도: ${c.competitionScore.grade}등급 (${c.competitionScore.score}점/100)
| 항목 | 값 |
|------|-----|
| 매장 밀집도 | 약 ${c.densityPerMeter}m마다 1개 매장 (기준: ${c.densityBaseline}m) |
| 직접 경쟁 | ${c.directCompetitorCount}개 (${(c.directCompetitorRatio * 100).toFixed(0)}%) |
| 간접 경쟁 | ${c.indirectCompetitorCount}개 |
| 프랜차이즈 | ${c.franchiseCount}개 (${(c.franchiseRatio * 100).toFixed(0)}%) |${
    c.franchiseBrandNames.length > 0
      ? `\n| 감지된 브랜드 | ${c.franchiseBrandNames.join(", ")} |`
      : ""
  }`;

  // ── (2) 상권 활력도 (서울 전용) ──
  let vitalitySection = "";
  if (v) {
    const d = v.details;
    const monthlyPerStore =
      d.storeCount > 0 ? Math.round(d.salesPerStore / 10000) : 0;

    vitalitySection = `

### 상권 활력도: ${v.vitalityScore.grade}등급 (${v.vitalityScore.score}점/100)
| 항목 | 값 |
|------|-----|
| 점포당 매출 점수 | ${v.salesScore}/100 |
| 상권변화 점수 | ${v.changeScore}/100 |
| 유동인구 점수 | ${v.footTrafficScore}/100 |
| 점포당 월 평균 매출 | ${monthlyPerStore.toLocaleString()}만원 (${d.storeCount}개 점포 기준, 서울시 골목상권 카드매출 추정) |
| 매출 피크 | ${d.peakTimeSlot} |
| 주 소비층 | ${d.mainAgeGroup} |
| 상권변화지표 | ${d.changeIndexName ?? "미확인"} |
| 개업률 | ${d.openRate}% |
| 폐업률 | ${d.closeRate}% |${
      d.floatingPopulation
        ? `
| 총 유동인구(분기) | ${d.floatingPopulation.totalFloating.toLocaleString()}명 |
| 성비 | 남성 ${Math.round(d.floatingPopulation.maleRatio * 100)}% / 여성 ${Math.round((1 - d.floatingPopulation.maleRatio) * 100)}% |
| 유동인구 피크 | ${d.floatingPopulation.peakDay} ${d.floatingPopulation.peakTimeSlot} |
| 유동인구 주 연령대 | ${d.floatingPopulation.mainAgeGroup} |`
        : ""
    }${
      d.residentPopulation
        ? `\n| 상주인구 | ${d.residentPopulation.totalResident.toLocaleString()}명 |`
        : ""
    }`;
  } else {
    vitalitySection =
      "\n\n> **비서울 지역**: 상권 활력도(매출/유동인구) 데이터 없음. revenueEstimate와 survivalAnalysis는 null로 처리할 것.";
  }

  // ── (3) 인구 ──
  const populationSection = params.population
    ? `

### 인구 현황
| 항목 | 값 |
|------|-----|
| 총인구 | ${params.population.details.totalPopulation.toLocaleString()}명 |
| 집계 단위 | ${params.population.details.isDongLevel ? "읍면동 단위" : "시군구 단위"} |
| 인구 점수 | ${params.population.score.score}점/100 (${params.population.score.grade}등급) |`
    : "\n\n> **인구 데이터**: 해당 지역 인구 데이터 없음.";

  // ── (4) 지하철 ──
  let subwaySection = "";
  if (params.subway) {
    const s = params.subway;
    if (s.isStationArea && s.nearestStation) {
      subwaySection = `

### 지하철 역세권
| 항목 | 값 |
|------|-----|
| 역세권 여부 | 역세권 (500m 이내) |
| 가장 가까운 역 | ${s.nearestStation.stationName} (${s.nearestStation.lineName}) |
| 일 평균 이용객 | ${s.nearestStation.dailyAvgTotal.toLocaleString()}명 |
| 거리 | ${s.nearestStation.distanceMeters}m |
| 반경 내 역 수 | ${s.stationsInRadius.length}개 |`;
    } else {
      subwaySection = `

### 지하철 역세권
> 비역세권 (500m 이내 지하철역 없음)`;
    }
  }

  // ── (5) 버스 ──
  let busSection = "";
  if (params.bus) {
    const b = params.bus;
    busSection = `

### 버스 접근성
| 항목 | 값 |
|------|-----|
| 반경 내 정류장 수 | ${b.stopCount}개 |${
      b.nearestStop
        ? `\n| 가장 가까운 정류장 | ${b.nearestStop.name} (${b.nearestStop.distanceMeters}m) |\n| 경유 노선 수 | ${b.totalRouteCount}개 |`
        : ""
    }`;
  }

  // ── (6) 학교 ──
  let schoolSection = "";
  if (params.school && params.school.totalCount > 0) {
    const sc = params.school;
    schoolSection = `

### 학교 접근성
| 항목 | 값 |
|------|-----|
| 초등학교 | ${sc.elementaryCount}개 |
| 중학교 | ${sc.middleCount}개 |
| 고등학교 | ${sc.highCount}개 |
| 합계 | ${sc.totalCount}개 |`;
  }

  // ── (7) 대학교 ──
  let universitySection = "";
  if (params.university && params.university.hasUniversity) {
    const u = params.university;
    universitySection = `

### 대학교 접근성 (탐색 반경: ${(u.searchRadius / 1000).toFixed(1)}km)
| 대학교 | 거리 |
|--------|------|
${u.universities.map((x) => `| ${x.name} | ${x.distanceMeters}m |`).join("\n")}`;
  }

  // ── (8) 의료시설 ──
  let medicalSection = "";
  if (params.medical && params.medical.hasHospital) {
    const m = params.medical;
    medicalSection = `

### 의료시설 (탐색 반경: ${(m.searchRadius / 1000).toFixed(1)}km)
| 항목 | 값 |
|------|-----|
| 반경 내 병의원 수 | ${m.count}개 |`;
  }

  // ── 출력 형식 ──
  const outputFormat = `
## 출력 형식 (아래 JSON 구조로만 응답. 모든 값은 위 수집 데이터를 근거로 네가 직접 판단해서 채워.)
{
  "verdict": "추천 | 조건부 추천 | 주의 | 비추천 중 택1",
  "analysisScope": "분석 반경(${radiusLabel})을 참조하여 이 리포트의 분석 범위가 어떤 의미인지 한 줄로",
  "summary": "종합 의견 한 줄 (50자 이내)",

  "competitorCount": {
    "direct": 직접 경쟁업체 수 (숫자),
    "indirect": 간접 경쟁업체 수 (숫자),
    "franchise": 프랜차이즈 수 (숫자),
    "interpretation": "경쟁 환경 한 줄 해석"
  },

  "competitionGrade": {
    "grade": "A~F 중 택1",
    "score": 0~100 숫자,
    "label": "등급 의미를 자연스럽게 해석",
    "rationale": "핵심 근거를 데이터 수치와 함께"
  },

  "revenueEstimate": {
    "monthlyPerStoreMaan": 점포당 월 평균 매출 (만원 단위 숫자),
    "peakTimeSlot": "매출 피크 시간대",
    "mainAgeGroup": "주 소비 연령대",
    "storeCount": 산출 기준 점포 수 (숫자),
    "interpretation": "매출 데이터 해석 (카드매출 추정 기준임을 언급, 점포 수 적으면 왜곡 가능성 언급)"
  } 또는 null (비서울이거나 매출 데이터 없으면),

  "revenueEstimateUnavailableReason": "매출 데이터 없는 사유" 또는 null,

  "survivalAnalysis": {
    "closeRate": 폐업률 숫자,
    "openRate": 개업률 숫자,
    "isHighCloseRate": 폐업률 5% 초과 여부 (true/false),
    "interpretation": "폐업률/개업률이 의미하는 바를 2~3문장으로",
    "dataSource": "데이터 출처"
  } 또는 null (데이터 없으면),

  "riskWarnings": [
    { "title": "리스크 제목", "detail": "구체적 내용 (수치 포함)", "severity": "위험 | 경고 | 주의" }
  ],

  "strategy": {
    "positioning": "포지셔닝 전략 1~2문장",
    "actionItems": ["구체적 실행 항목 3~5개"],
    "targetCustomer": "타겟 고객층",
    "recommendedHours": "추천 운영 시간대" 또는 null
  },

  "locationAdvice": {
    "currentAssessment": "현 입지 총평 1~2문장",
    "suggestions": [{ "direction": "방향", "rationale": "근거" }]
  },

  "populationInsight": {
    "headline": "배후인구 관련 핵심 한 줄",
    "body": "인구 데이터가 이 업종에 주는 의미 2~3문장"
  } 또는 null (인구 데이터 없으면),

  "infrastructureInsight": {
    "headline": "교통/학교/의료 인프라 핵심 한 줄",
    "body": "인프라가 이 업종에 주는 의미 2~3문장"
  } 또는 null (인프라 데이터 없으면),

  "detailedAnalysis": "3~5문단 상세 분석. 1문단: 핵심 특징 + 데이터 수치 요약. 2문단: 경쟁과 매출 교차 분석. 3문단: 유동인구/인프라가 이 업종에 주는 실제 영향. 4문단: 성공 조건 + 현장 확인 사항. 5문단(선택): 유사 상권 성공/실패 패턴"
}`;

  return `이 자리에서 ${params.industryName} 창업하려고 해요. 분석 데이터 보고 솔직하게 알려주세요.

## 분석 대상
| 항목 | 값 |
|------|-----|
| 위치 | ${params.address} |
| 업종 | ${params.industryName} |
| 반경 | ${radiusLabel} |

## 수집 데이터

${totalScoreSection}
${competitionSection}${vitalitySection}${populationSection}${subwaySection}${busSection}${schoolSection}${universitySection}${medicalSection}
${outputFormat}`;
}
