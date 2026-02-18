import { formatRadius } from "@/lib/format";
import type { CompetitionAnalysis } from "@/features/analysis/lib/scoring/types";
import type { VitalityAnalysis } from "@/features/analysis/lib/scoring/vitality";

/** 소상공인 창업 분석 AI 리포트 — 시스템 프롬프트 */
export const ANALYSIS_SYSTEM_PROMPT = `너는 직접 가게를 3번 창업해보고, 지금은 소상공인 상권 분석 컨설턴트로 일하고 있는 10년 차 전문가야.
창업 초보자가 "여기서 이 장사하면 될까요?"라고 물어보면, 데이터를 보고 솔직하게 답해주는 역할이야.

## 너의 말투
- 창업 카페에서 선배가 후배한테 얘기해주듯, 편하지만 핵심은 정확하게.
- "~입니다" 체가 아니라 "~해요", "~거든요", "~이에요" 체로 써.
- 숫자를 말할 때는 반드시 근거 데이터를 같이 언급해. "좋아 보여요"처럼 막연하게 쓰지 마.
- 장밋빛으로만 포장하지 마. 위험한 건 "솔직히 좀 걱정되는 부분이에요"라고 직접 말해.

## 지표 해석 가이드

### 경쟁 강도 (0~100, 높을수록 경쟁 약함 = 유리)
- A등급(80+): "경쟁업체가 적어서 진입 여건이 좋아요" — 밀집도, 직접경쟁 비율을 구체적으로 언급
- B등급(60~79): "경쟁은 있지만 포화 상태는 아니에요" — 차별화 전략 필요
- C등급(40~59): "보통 수준의 경쟁이에요" — 차별화 포인트 강조
- D~F등급(39 이하): "이미 포화 상태예요" — 동일 업종 수, 프랜차이즈 비율 강조
- 프랜차이즈 20~40%는 검증된 상권, 60%+ 이면 개인 매장 생존 어려움 경고

### 상권 활력도 (0~100, 서울 전용, 높을수록 활력 높음)
3지표 복합:
- **점포당 매출**: 같은 업종 기준 이 지역의 점포당 분기 매출. "점포당 월 평균 X만원" 형태로 표현해.
- **상권변화지표**: 다이나믹(성장) → 상권확장 → 상권축소 → 정체 순으로 위험. HH(정체)이면 "상권이 정체되어 있어요"라고.
- **유동인구**: 분기 총 유동인구. 피크 시간대와 주 연령대를 교차 분석해.

### 인사이트 데이터 (스코어링 미반영, 참고 정보)
- 폐업률: 5% 초과면 "폐업률이 다소 높은 편" 경고, 5% 이하면 안정적
- 상주인구: 세대수 1.5만+ 배달/생활밀착 유리, 5천 미만 유동인구 의존도 높음
- 유동인구 피크 vs 매출 피크: 일치하면 강점, 어긋나면 "실제 소비 시간대가 다를 수 있어요" 분석

## 데이터 없는 항목
- 비서울 지역이면 상권 활력도 데이터가 없어. "경쟁 강도만으로 판단할게요"라고 먼저 말하고 분석해.
- 데이터 없는 항목은 추측하지 말고 "이 지역은 해당 데이터가 없어서 판단하기 어려워요"라고 솔직하게.

## 한국 상권에서 꼭 고려할 것
- 프랜차이즈 밀집 지역이면 개인 창업자한테는 불리할 수 있어
- 치킨/피자 같은 배달 업종은 주거 밀도가 경쟁보다 중요해
- 역세권, 학원가, 오피스 상권은 업종 궁합이 다르니 그에 맞게 조언해

## 제언 쓸 때 규칙
- "열심히 하세요" 같은 뻔한 말 금지
- "배달앱 입점 후 초기 3개월은 프로모션에 집중하세요", "인근 오피스 점심 수요를 잡으려면 11시 반 전에 오픈하세요"처럼 실행할 수 있는 구체적 행동을 제안해

## 마무리
- detailedAnalysis 마지막에 "이 리포트는 공공 데이터 기반 참고 자료예요. 최종 창업 결정은 현장 답사와 전문가 상담을 병행해서 신중하게 판단하세요."라는 안내를 꼭 넣어.

## 출력
- 반드시 유효한 JSON만 응답해. 다른 텍스트는 절대 넣지 마.
- 한국어로 써.`;

/** Claude 분석 리포트 — 사용자 메시지 (데이터 + 출력 형식) */
export function buildAnalysisPrompt(params: {
  address: string;
  industryName: string;
  radius: number;
  competition: CompetitionAnalysis;
  vitality: VitalityAnalysis | null;
}): string {
  const { competition: c, vitality: v } = params;
  const radiusLabel = formatRadius(params.radius);

  // 경쟁 강도 섹션
  const competitionSection = `### 경쟁 강도: ${c.competitionScore.grade}등급 (${c.competitionScore.score}점/100)
- 매장 밀집도: 약 ${c.densityPerMeter}m마다 1개 매장 (기준: ${c.densityBaseline}m)
- 직접 경쟁: ${c.directCompetitorCount}개 (${(c.directCompetitorRatio * 100).toFixed(0)}%)
- 간접 경쟁: ${c.indirectCompetitorCount}개
- 프랜차이즈: ${c.franchiseCount}개 (${(c.franchiseRatio * 100).toFixed(0)}%)${
    c.franchiseBrandNames.length > 0
      ? `\n- 감지된 브랜드: ${c.franchiseBrandNames.join(", ")}`
      : ""
  }`;

  // 상권 활력도 섹션 (서울 전용)
  let vitalitySection = "";
  if (v) {
    const d = v.details;
    const monthlyPerStore = d.storeCount > 0
      ? Math.round(d.salesPerStore / 3 / 10000)
      : 0;

    vitalitySection = `

### 상권 활력도: ${v.vitalityScore.grade}등급 (${v.vitalityScore.score}점/100)
- 점포당 매출 점수: ${v.salesScore}/100
- 상권변화 점수: ${v.changeScore}/100
- 유동인구 점수: ${v.footTrafficScore}/100

#### 매출 현황
- 분기 추정매출: ${Math.round(d.estimatedQuarterlySales / 10000).toLocaleString()}만원
- 점포당 월 평균: ${monthlyPerStore.toLocaleString()}만원 (${d.storeCount}개 점포)
- 매출 피크: ${d.peakTimeSlot} | 주 소비층: ${d.mainAgeGroup}

#### 상권 상태
- 상권변화: ${d.changeIndexName ?? "미확인"}
- 개업률: ${d.openRate}% / 폐업률: ${d.closeRate}%${
      d.floatingPopulation
        ? `

#### 유동인구 (분기 합산)
- 총 유동인구: ${d.floatingPopulation.totalFloating.toLocaleString()}명
- 성비: 남성 ${Math.round(d.floatingPopulation.maleRatio * 100)}% / 여성 ${Math.round((1 - d.floatingPopulation.maleRatio) * 100)}%
- 유동인구 피크: ${d.floatingPopulation.peakDay} ${d.floatingPopulation.peakTimeSlot}
- 주 연령대: ${d.floatingPopulation.mainAgeGroup}`
        : ""
    }${
      d.residentPopulation
        ? `

#### 상주인구
- 총 상주인구: ${d.residentPopulation.totalResident.toLocaleString()}명
- 총 세대수: ${d.residentPopulation.totalHouseholds.toLocaleString()}세대`
        : ""
    }`;
  }

  return `이 자리에서 ${params.industryName} 창업하려고 해요. 분석 데이터 보고 솔직하게 알려주세요.

## 분석 대상
- 위치: ${params.address}
- 업종: ${params.industryName}
- 반경: ${radiusLabel}

## 수집 데이터

${competitionSection}${vitalitySection}${
    !v
      ? "\n\n> 비서울 지역으로 상권 활력도(매출/유동인구) 데이터가 없습니다."
      : ""
  }

## 출력 형식 (아래 JSON 구조로만 응답)
{
  "verdict": "추천" | "조건부 추천" | "주의" | "비추천",
  "summary": "한 줄 종합 판단 (50자 이내)",
  "strengths": ["강점 1", "강점 2", "강점 3"],
  "risks": ["위험 1", "위험 2", "위험 3"],
  "recommendations": ["실행 가능한 구체적 제언 1", "제언 2", "제언 3"],
  "detailedAnalysis": "3~5문단의 상세 분석 (마크다운 지원)"
}`;
}
