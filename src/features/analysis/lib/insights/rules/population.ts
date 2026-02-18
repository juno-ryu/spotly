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
  const { floatingPopulation, residentPopulation, closeRate } = d;

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
  }

  // 3. 상주인구 배후 수요 (스코어링 미반영, 참고 정보)
  if (residentPopulation) {
    const households = residentPopulation.totalHouseholds;

    if (households >= 15_000) {
      insights.push({
        type: "text",
        emoji: "👨‍👩‍👧‍👦",
        text: "배후 세대수가 풍부해 안정적인 수요가 있어요",
        sub: `총 ${households.toLocaleString()}세대`,
        category: "fact",
      });
    } else if (households >= 5_000) {
      insights.push({
        type: "text",
        emoji: "🏡",
        text: "배후 세대가 적정 규모예요",
        sub: `총 ${households.toLocaleString()}세대`,
        category: "fact",
      });
    } else {
      insights.push({
        type: "text",
        emoji: "📉",
        text: "배후 세대수가 적어 유동인구 의존도가 높아요",
        sub: `총 ${households.toLocaleString()}세대`,
        category: "fact",
      });
    }
  }

  // 4. 폐업률 (스코어링 미반영, 참고 정보)
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

  return insights;
};
