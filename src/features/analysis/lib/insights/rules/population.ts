import { scoreToGrade, type Grade } from "../../scoring/types";
import type { InsightRule, InsightItem } from "../types";

/** 매출 등급별 해석 */
const SALES_GRADE_TEXT: Record<Grade, { emoji: string; text: string }> = {
  A: { emoji: "💰", text: "점포당 매출이 매우 높은 상권이에요" },
  B: { emoji: "📈", text: "점포당 매출이 양호한 편이에요" },
  C: { emoji: "💵", text: "점포당 매출이 보통 수준이에요" },
  D: { emoji: "📉", text: "점포당 매출이 다소 낮은 편이에요" },
  F: { emoji: "🔴", text: "점포당 매출이 매우 낮아요" },
};

/** 유동인구 등급별 해석 */
const FOOT_TRAFFIC_GRADE_TEXT: Record<Grade, { emoji: string; text: string }> = {
  A: { emoji: "🔥", text: "유동인구가 매우 많은 상권이에요" },
  B: { emoji: "🚶", text: "유동인구가 꽤 활발한 편이에요" },
  C: { emoji: "🟡", text: "유동인구가 보통 수준이에요" },
  D: { emoji: "🟠", text: "유동인구가 다소 적은 편이에요" },
  F: { emoji: "🏚️", text: "유동인구가 매우 적어요" },
};

/** 상권 활력도 인사이트 룰 — 등급(A/B/C/D/F) 기반 */
export const populationRules: InsightRule = (data) => {
  const vitality = data.vitality;
  if (!vitality) return [];

  const insights: InsightItem[] = [];
  const d = vitality.details;
  const { floatingPopulation, closeRate } = d;
  const industry = data.industryName;

  // 1. 매출 규모 — salesScore → 등급
  if (d.storeCount > 0 && d.salesPerStore > 0) {
    const { grade } = scoreToGrade(vitality.salesScore);
    const monthlyPerStore = Math.round(d.salesPerStore / 3 / 10000);
    const { emoji, text } = SALES_GRADE_TEXT[grade];

    insights.push({
      type: "text",
      emoji,
      text,
      sub: `점포당 월 평균 ${monthlyPerStore.toLocaleString()}만원 (${grade}등급) · 피크: ${d.peakTimeSlot} · 주 소비층: ${d.mainAgeGroup}`,
      category: "scoring",
    });

    // C-04: 카드 결제 기반 매출 한계 안내 — 현금 거래 비율 높은 업종에서 실제보다 낮을 수 있음
    // 서울 골목상권 API는 카드 매출만 집계. 재래시장 식당, 분식 등 현금 비중 높은 업종은 과소추정 가능
    const isCashHeavy =
      industry.includes("한식") ||
      industry.includes("분식") ||
      industry.includes("시장") ||
      industry.includes("국밥");
    if (isCashHeavy) {
      insights.push({
        type: "text",
        emoji: "ℹ️",
        text: "매출 수치가 실제보다 낮을 수 있어요",
        sub: "서울 골목상권 통계는 카드 결제 매출 기반입니다. 현금 거래 비율이 높은 업종(한식·분식 등)은 실제 매출이 표시된 수치보다 높을 수 있어요",
        category: "fact",
      });
    }
  }

  // 2. 유동인구 규모 — footTrafficScore → 등급
  if (floatingPopulation) {
    const { grade } = scoreToGrade(vitality.footTrafficScore);
    const total = floatingPopulation.totalFloating;
    const { emoji, text } = FOOT_TRAFFIC_GRADE_TEXT[grade];

    insights.push({
      type: "text",
      emoji,
      text,
      sub: `분기 ${(total / 10_000).toFixed(0)}만명 (${grade}등급) · 피크: ${floatingPopulation.peakDay} ${floatingPopulation.peakTimeSlot} · 주 연령대: ${floatingPopulation.mainAgeGroup}`,
      category: "scoring",
    });
  } else if (d.subway && vitality.footTrafficScore > 0) {
    // 골목상권 유동인구 데이터 없음 — 지하철 승하차 기반 대체 점수 사용 중
    // 사용자가 점수의 근거를 투명하게 알 수 있도록 팩트 메시지 표시
    const { grade } = scoreToGrade(vitality.footTrafficScore);
    const { emoji, text } = FOOT_TRAFFIC_GRADE_TEXT[grade];

    insights.push({
      type: "text",
      emoji,
      text,
      sub: `${d.subway.stationName}역 일평균 승하차 ${(d.subway.dailyAvgTotal / 10_000).toFixed(1)}만명 기반 (${grade}등급) · 골목상권 유동인구 데이터 없음`,
      category: "scoring",
    });
    insights.push({
      type: "text",
      emoji: "ℹ️",
      text: "유동인구 데이터를 지하철 승하차로 대체했어요",
      sub: "서울 외 지역이거나 상권코드 미매칭으로 골목상권 데이터가 없습니다. 지하철 승하차 수를 유동인구 대리 지표로 사용했어요",
      category: "fact",
    });
  }

  // 3. 폐업률 (스코어링 미반영, 참고 정보)
  if (closeRate > 5) {
    insights.push({
      type: "text",
      emoji: "⚠️",
      text: "폐업률이 다소 높은 편이에요",
      sub: `분기 폐업률 ${closeRate.toFixed(1)}%`,
      category: "fact",
    });
  } else if (closeRate > 0) {
    insights.push({
      type: "text",
      emoji: "📊",
      text: "폐업률이 안정적인 수준이에요",
      sub: `분기 폐업률 ${closeRate.toFixed(1)}%`,
      category: "fact",
    });
  }

  // 4. C-07: 상권변화지표 업종별 해석 차이 안내
  // HH(정체) 지표는 일반적으로 부정적이지만, 일부 업종에서는 "안정"을 의미할 수 있음
  // 사용자에게 맥락을 제공해 오해를 방지
  if (d.changeIndexName) {
    const isChangeIndexHH = d.changeIndexName.startsWith("HH");
    const isBoundaryIndustry =
      industry.includes("부동산") ||
      industry.includes("학원") ||
      industry.includes("병원") ||
      industry.includes("의원") ||
      industry.includes("치과") ||
      industry.includes("한의");

    if (isChangeIndexHH && isBoundaryIndustry) {
      insights.push({
        type: "text",
        emoji: "ℹ️",
        text: "상권변화지표 해석 주의",
        sub: `HH(${d.changeIndexName}) 상권은 일반적으로 정체를 의미하지만, ${industry} 업종은 오랜 영업 가게가 많은 "안정 상권"으로 볼 수도 있어요. 현장 방문으로 직접 확인하세요`,
        category: "fact",
      });
    }
  }

  return insights;
};
