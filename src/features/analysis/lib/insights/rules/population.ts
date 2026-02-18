import type { InsightRule, InsightItem } from "../types";

/** 유동인구 규모 해석 */
const FLOATING_POP_THRESHOLDS = [
  { min: 1_000_000, emoji: "🔥", text: "유동인구가 매우 많은 상권이에요" },
  { min: 300_000, emoji: "🚶", text: "유동인구가 꽤 활발한 편이에요" },
  { min: 0, emoji: "🏚️", text: "유동인구가 적은 편이에요" },
] as const;

/** 유동인구/상주인구 인사이트 룰 */
export const populationRules: InsightRule = (data) => {
  const vitality = data.vitality;
  if (!vitality) return [];

  const insights: InsightItem[] = [];
  const { floatingPopulation, residentPopulation } = vitality.details;

  // 1. 유동인구 규모
  if (floatingPopulation) {
    const total = floatingPopulation.totalFloating;
    const threshold = FLOATING_POP_THRESHOLDS.find((t) => total >= t.min)!;
    const peakInfo = `피크: ${floatingPopulation.peakDay} ${floatingPopulation.peakTimeSlot}`;
    const ageInfo = `주 연령대: ${floatingPopulation.mainAgeGroup}`;

    insights.push({
      type: "text",
      emoji: threshold.emoji,
      text: threshold.text,
      sub: `분기 ${(total / 10_000).toFixed(0)}만명 · ${peakInfo} · ${ageInfo}`,
      category: "scoring",
    });
  }

  // 2. 상주인구 배후 수요
  if (residentPopulation) {
    const households = residentPopulation.totalHouseholds;

    if (households >= 10_000) {
      insights.push({
        type: "text",
        emoji: "👨‍👩‍👧‍👦",
        text: "배후 세대수가 풍부해 안정적인 수요가 있어요",
        sub: `총 ${households.toLocaleString()}세대`,
        category: "fact",
      });
    } else if (households >= 3_000) {
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

  return insights;
};
