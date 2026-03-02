import type { Grade } from "../../scoring/types";
import type { InsightRule, InsightItem } from "../types";

/** 경쟁 등급별 밀집도 해석 */
export const DENSITY_GRADE_TEXT: Record<Grade, { emoji: string; text: string }> = {
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

  // 0. 동종업체 0개 — places.totalCount 기준 (Kakao 실제 총 수)
  // directCompetitorCount는 샘플(최대 15개) 기반이라 신뢰 불가 → totalCount 사용
  // 경쟁자 없음 = 100점이지만, 수요 자체가 없는 지역일 수 있으므로 신중함을 안내
  const totalCount = data.places?.totalCount ?? 0;
  if (totalCount === 0) {
    insights.push({
      type: "text",
      emoji: "⚠️",
      text: "주변 동종업체가 없어요",
      sub: "경쟁자가 없다는 건 긍정적이지만, 수요 자체가 없는 지역일 수 있습니다. 상권 활성도를 신중히 검토하세요",
      category: "fact",
    });
  }

  // 1. 밀집도 — 경쟁 등급 기반
  if (competition.densityPerMeter > 0) {
    const { emoji, text } = DENSITY_GRADE_TEXT[grade];
    insights.push({
      type: "text",
      emoji,
      text,
      sub: `약 ${competition.densityPerMeter}m마다 1개 매장`,
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
    // 프랜차이즈 0건: 경쟁 등급에 따라 해석이 다름
    // 좋은 등급(A/B)이면 실제로 경쟁이 적은 것, 나쁜 등급(D/F)이면 상권 비활성화 가능성
    const isLowCompetition = grade === "A" || grade === "B";
    insights.push({
      type: "text",
      emoji: isLowCompetition ? "✅" : "⚠️",
      text: isLowCompetition
        ? "주변에 프랜차이즈가 매우 적어요"
        : "프랜차이즈가 진출하지 않은 상권이에요",
      sub: isLowCompetition
        ? undefined
        : "상권 활성도가 낮을 수 있어 신중한 검토가 필요해요",
      category: "scoring",
    });
  }

  return insights;
};
