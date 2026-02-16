import type { InsightRule, InsightItem } from "../types";

/** 매장 간 거리 임계값 */
const DENSITY_THRESHOLDS = [
  { min: 300, text: "매장 사이 거리가 꽤 넓은 편이에요" },
  { min: 150, text: "매장 간 거리가 적당한 편이에요" },
  { min: 80, text: "매장끼리 가까운 편이에요" },
  { min: 0, text: "매장이 매우 밀집해 있어요" },
] as const;

/** 경쟁 등급별 프랜차이즈 해석 */
const FRANCHISE_GRADE_TEXT: Record<string, string> = {
  A: "적당한 프랜차이즈 비율은 상권 활력이 좋다는 신호예요",
  B: "프랜차이즈와 개인 매장이 적절히 공존하는 상권이에요",
  C: "프랜차이즈 비율이 보통 수준이에요",
  D: "프랜차이즈 비중이 높아 개인 매장 경쟁이 다소 치열해요",
  F: "프랜차이즈 포화 상권으로 개인 창업 시 주의가 필요해요",
};

/** 경쟁 분석 룰 */
export const competitionRules: InsightRule = (data) => {
  const competition = data.competition;
  if (!competition) return [];

  const grade = competition.competitionScore?.grade ?? "C";
  const insights: InsightItem[] = [];

  // 1. 매장 간 거리
  if (competition.densityPerMeter > 0) {
    const dist = competition.densityPerMeter;
    const threshold = DENSITY_THRESHOLDS.find((t) => dist >= t.min);
    insights.push({
      type: "text",
      emoji: "📏",
      text: threshold?.text ?? DENSITY_THRESHOLDS.at(-1)!.text,
      sub: `약 ${dist}m마다 1개 매장`,
      category: "scoring",
    });
  }

  // 3. 프랜차이즈 현황 — 등급 해석이 메인, 브랜드명이 서브
  if (competition.franchiseCount > 0) {
    const brands = competition.franchiseBrandNames;
    const brandSub =
      brands.length > 0
        ? brands.slice(0, 5).join(", ") +
          (brands.length > 5 ? ` 외 ${brands.length - 5}개` : "")
        : undefined;

    insights.push({
      type: "text",
      emoji: "🏷️",
      text: FRANCHISE_GRADE_TEXT[grade] ?? FRANCHISE_GRADE_TEXT.C,
      sub: brandSub,
      category: "scoring",
    });
  } else {
    insights.push({
      type: "text",
      emoji: "✅",
      text: "주변에 프랜차이즈가 매우 적어요",
      category: "scoring",
    });
  }

  return insights;
};
