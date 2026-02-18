import { formatRadius } from "@/lib/format";
import type { ScoreBreakdown } from "@/features/analysis/schema";
import { getIndicatorGrades } from "@/features/analysis/lib/grade";
import type { GolmokAggregated } from "@/server/data-sources/seoul-golmok/client";

/** 소상공인 창업 분석 AI 리포트 — 시스템 프롬프트 */
export const ANALYSIS_SYSTEM_PROMPT = `너는 직접 가게를 3번 창업해보고, 지금은 소상공인 상권 분석 컨설턴트로 일하고 있는 10년 차 전문가야.
창업 초보자가 "여기서 이 장사하면 될까요?"라고 물어보면, 데이터를 보고 솔직하게 답해주는 역할이야.

## 너의 말투
- 창업 카페에서 선배가 후배한테 얘기해주듯, 편하지만 핵심은 정확하게.
- "~입니다" 체가 아니라 "~해요", "~거든요", "~이에요" 체로 써.
- 숫자를 말할 때는 반드시 근거 데이터를 같이 언급해. "좋아 보여요"처럼 막연하게 쓰지 마.
- 장밋빛으로만 포장하지 마. 위험한 건 "솔직히 좀 걱정되는 부분이에요"라고 직접 말해.

## 점수 보는 법
- 80점 이상: 꽤 괜찮은 자리예요. 그래도 방심은 금물이니까 주의할 점도 꼭 짚어줘.
- 60~79점: 가능성은 있는데 약점을 어떻게 커버할지 구체적 전략을 제안해.
- 40~59점: 솔직히 위험 요소가 많아요. 정말 하고 싶다면 이것만큼은 해결해야 한다고 알려줘.
- 39점 이하: 지금 이 자리에서 이 업종은 추천 못 해요. 이유를 명확히 설명하고, 차라리 이런 대안은 어떤지 제시해.

## 지표별로 이렇게 해석해 (A~F 등급, 퍼센트 기준)
각 지표는 A(80%+, 매우 우수) ~ F(20% 미만, 부족)로 등급화되어 있어. 등급과 퍼센트를 함께 언급해서 설명해.
- **상권 활력도**: A~B등급이면 "주변 가게들이 활발하게 운영되고 직원도 늘고 있어요"로, D~F면 "상권이 침체되어 있어요"라고. 구체 수치(직원수, 신규 창업 비율)를 꼭 언급해.
- **경쟁 강도**: A~B등급이면 경쟁이 적어서 유리해요. D~F면 "이미 경쟁업체가 포화 상태예요"라고. 반경 내 동일 업종 수를 언급해.
- **생존율**: A~B등급이면 "이 동네 같은 업종 생존율이 높아요". D~F면 "10곳 중 X곳이 문 닫았어요"처럼 와닿게.
- **주거 밀도**: 배달 장사면 "주변 배후 수요가 탄탄해요/부족해요" 식으로. 아파트 거래 건수를 언급해.
- **소득 수준**: 아파트 시세 기반. "이 동네 구매력이 있는/없는 편이에요"처럼. 평균 거래가를 언급해.

## 한국 상권에서 꼭 고려할 것
- 프랜차이즈 밀집 지역이면 개인 창업자한테는 불리할 수 있어
- 치킨/피자 같은 배달 업종은 주거 밀도가 경쟁보다 중요해
- 역세권, 학원가, 오피스 상권은 업종 궁합이 다르니 그에 맞게 조언해
- 신도시나 재개발 지역은 "지금 데이터는 이렇지만, 입주 시작하면 달라질 수 있어요"라고 미래도 언급해

## 서울시 골목상권 빅데이터 활용 (해당 시)
- 추정매출 데이터가 있으면 "월 예상 매출 범위"를 구체적으로 제시해. 분기 매출을 3으로 나눈 값 기준으로.
- 피크 시간대와 요일 정보로 "언제 오픈하고, 주말 운영 전략은 어떻게 할지" 구체적으로 제안해.
- 프랜차이즈 비율(프랜차이즈 점포수/전체 점포수)이 70% 이상이면 "프랜차이즈 포화 상태"라고 경고해.
- 상권변화지표가 LL(정체)이면 위험 요소로, HH(다이나믹)나 HL(상권확장)이면 강점으로 언급해.
- 주 소비 연령대와 성별 정보를 활용해 타겟 마케팅 전략을 구체적으로 제안해.
- 유동인구 데이터가 있으면 매출 피크 시간대와 유동인구 피크 시간대를 교차 분석해. 두 피크가 일치하면 강점, 어긋나면 "유동인구는 많지만 실제 소비로 이어지는 시간대가 다를 수 있어요"라고 분석해.
- 상주인구/세대수 데이터가 있으면 배후 수요를 판단해. 세대수 1만+ 이면 배달/생활밀착 업종에 유리, 3천 미만이면 유동인구 의존도가 높다고 판단해.

## 제언 쓸 때 규칙
- "열심히 하세요" 같은 뻔한 말 금지
- "배달앱 입점 후 초기 3개월은 프로모션에 집중하세요", "인근 오피스 점심 수요를 잡으려면 11시 반 전에 오픈하세요"처럼 실행할 수 있는 구체적 행동을 제안해

## 마무리
- detailedAnalysis 마지막에 "이 리포트는 공공 데이터 기반 참고 자료예요. 최종 창업 결정은 현장 답사와 전문가 상담을 병행해서 신중하게 판단하세요."라는 안내를 꼭 넣어.

## 출력
- 반드시 유효한 JSON만 응답해. 다른 텍스트는 절대 넣지 마.
- 한국어로 써.`;

const GRADE_INDICATOR_LABELS: Record<keyof ScoreBreakdown, string> = {
  vitality: "상권 활력도",
  competition: "경쟁 강도",
  survival: "생존율",
  residential: "주거 밀도",
  income: "소득 수준",
};

/** scoreDetail → "- 상권 활력도: B등급 (75%)" 형태 문자열 */
function formatScoreGrades(scoreDetail: ScoreBreakdown): string {
  const grades = getIndicatorGrades(scoreDetail);
  return (Object.keys(grades) as (keyof ScoreBreakdown)[])
    .map((key) => {
      const { grade, percent } = grades[key];
      return `- ${GRADE_INDICATOR_LABELS[key]}: ${grade}등급 (${percent}%)`;
    })
    .join("\n");
}

/** Claude 분석 리포트 — 사용자 메시지 (데이터 + 출력 형식) */
export function buildAnalysisPrompt(params: {
  address: string;
  industryName: string;
  radius: number;
  totalScore: number;
  scoreDetail: ScoreBreakdown;
  businessCount: number;
  activeCount: number;
  suspendedCount: number;
  closedCount: number;
  avgApartmentPrice: number;
  transactionCount: number;
  population?: {
    totalPopulation: number;
    households: number;
  };
  golmok?: GolmokAggregated;
}): string {
  const survivalRate =
    params.activeCount + params.closedCount > 0
      ? Math.round(
          (params.activeCount / (params.activeCount + params.closedCount)) * 100,
        )
      : 0;

  const radiusLabel = formatRadius(params.radius);

  const priceLabel =
    params.avgApartmentPrice > 0
      ? `${params.avgApartmentPrice.toLocaleString()}만원`
      : "데이터 없음";

  return `이 자리에서 ${params.industryName} 창업하려고 해요. 분석 데이터 보고 솔직하게 알려주세요.

## 분석 대상
- 위치: ${params.address}
- 업종: ${params.industryName}
- 반경: ${radiusLabel}

## 수집 데이터

### 상권 현황
- 동일 업종 사업장: ${params.businessCount}개
- 활성: ${params.activeCount}개 / 휴업: ${params.suspendedCount}개 / 폐업: ${params.closedCount}개
- 생존율: ${survivalRate}%

### 종합 스코어 (100점 만점)
- **종합: ${params.totalScore}점**
${formatScoreGrades(params.scoreDetail)}

### 부동산 시세
- 평균 아파트 거래가: ${priceLabel}
- 최근 거래 건수: ${params.transactionCount}건
${
  params.population
    ? `
### 인구 현황 (통계청 KOSIS)
- 총 인구: ${params.population.totalPopulation.toLocaleString()}명
- 세대수: ${params.population.households.toLocaleString()}세대`
    : ""
}${
  params.golmok
    ? `

### 서울시 골목상권 분석 (빅데이터)
- 분기 추정매출: ${(params.golmok.estimatedQuarterlySales / 10000).toLocaleString()}만원 (건당 평균 ${params.golmok.salesCount > 0 ? Math.round(params.golmok.estimatedQuarterlySales / params.golmok.salesCount).toLocaleString() : "-"}원)
- 매출 피크: ${params.golmok.peakDay}, ${params.golmok.peakTimeSlot}
- 평일/주말 매출 비율: 평일 ${Math.round(params.golmok.weekdayRatio * 100)}% / 주말 ${Math.round((1 - params.golmok.weekdayRatio) * 100)}%
- 주 소비층: ${params.golmok.mainAgeGroup} ${params.golmok.mainGender}
- 점포 현황: ${params.golmok.storeCount}개 (프랜차이즈 ${params.golmok.franchiseCount}개, 개인 ${params.golmok.storeCount - params.golmok.franchiseCount}개)
- 유사업종 점포수: ${params.golmok.similarStoreCount}개
- 개업률: ${params.golmok.openRate}% / 폐업률: ${params.golmok.closeRate}%${
      params.golmok.changeIndex
        ? `
- 상권변화지표: ${params.golmok.changeIndex}(${params.golmok.changeIndexName})`
        : ""
    }${
      params.golmok.avgOperatingMonths
        ? `
- 운영 사업체 평균 영업기간: ${params.golmok.avgOperatingMonths}개월`
        : ""
    }${
      params.golmok.floatingPopulation
        ? `\n\n#### 유동인구 (분기 합산)
- 총 유동인구: ${params.golmok.floatingPopulation.totalFloating.toLocaleString()}명
- 성비: 남성 ${Math.round(params.golmok.floatingPopulation.maleRatio * 100)}% / 여성 ${Math.round((1 - params.golmok.floatingPopulation.maleRatio) * 100)}%
- 유동인구 피크: ${params.golmok.floatingPopulation.peakDay} ${params.golmok.floatingPopulation.peakTimeSlot}
- 주 연령대: ${params.golmok.floatingPopulation.mainAgeGroup}`
        : ""
    }${
      params.golmok.residentPopulation
        ? `\n\n#### 상주인구
- 총 상주인구: ${params.golmok.residentPopulation.totalResident.toLocaleString()}명
- 총 세대수: ${params.golmok.residentPopulation.totalHouseholds.toLocaleString()}세대`
        : ""
    }`
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
