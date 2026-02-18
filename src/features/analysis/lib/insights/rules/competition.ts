import type { Grade } from "../../scoring/types";
import type { InsightRule, InsightItem } from "../types";

/** 경쟁 등급별 밀집도 해석 */
const DENSITY_GRADE_TEXT: Record<Grade, { emoji: string; text: string }> = {
  A: { emoji: "🟢", text: "경쟁업체가 적어 진입 여건이 좋아요" },
  B: { emoji: "🔵", text: "경쟁이 있지만 여유 있는 편이에요" },
  C: { emoji: "🟡", text: "보통 수준의 경쟁이에요" },
  D: { emoji: "🟠", text: "경쟁이 치열한 편이에요" },
  F: { emoji: "🔴", text: "매장이 매우 밀집해 과포화 상태예요" },
};

/** 경쟁 등급별 프랜차이즈 해석 */
const FRANCHISE_GRADE_TEXT: Record<Grade, string> = {
  A: "적당한 프랜차이즈 비율로 상권 활력이 좋아요",
  B: "프랜차이즈와 개인 매장이 적절히 공존해요",
  C: "프랜차이즈 비율이 보통 수준이에요",
  D: "프랜차이즈 비중이 높아 개인 매장 경쟁이 치열해요",
  F: "프랜차이즈 포화 상권으로 개인 창업 시 주의가 필요해요",
};

/** 경쟁 분석 룰 — 등급(A/B/C/D/F) 기반 인사이트 */
export const competitionRules: InsightRule = (data) => {
  const competition = data.competition;
  if (!competition) return [];

  const grade = (competition.competitionScore?.grade ?? "C") as Grade;
  const insights: InsightItem[] = [];

  // 1. 밀집도 — 경쟁 등급 기반
  if (competition.densityPerMeter > 0) {
    const { emoji, text } = DENSITY_GRADE_TEXT[grade];
    insights.push({
      type: "text",
      emoji,
      text,
      sub: `약 ${competition.densityPerMeter}m마다 1개 매장 (${grade}등급)`,
      category: "scoring",
    });
  }

  // 2. 프랜차이즈 현황 — 경쟁 등급 기반
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
      text: FRANCHISE_GRADE_TEXT[grade],
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
