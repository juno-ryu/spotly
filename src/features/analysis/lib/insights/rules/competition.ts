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


/** 경쟁 분석 룰 — 등급(A/B/C/D/F) 기반 인사이트 */
export const competitionRules: InsightRule = (data) => {
  const competition = data.competition;
  if (!competition) return [];

  const grade = (competition.competitionScore?.grade ?? "C") as Grade;
  const industry = data.industryName;
  const insights: InsightItem[] = [];

  // 프랜차이즈 개념이 해당 없는 업종 (학원·병의원·부동산)
  const isFranchiseIrrelevant =
    industry.includes("학원") ||
    industry.includes("병원") ||
    industry.includes("의원") ||
    industry.includes("치과") ||
    industry.includes("한의") ||
    industry.includes("부동산");

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

  // 1. 밀집도 — 직접/인접 경쟁 세부 분류 (헤더 sub와 중복 방지)
  if (competition.densityPerMeter > 0) {
    const { emoji } = DENSITY_GRADE_TEXT[grade];
    const total = competition.directCompetitorCount + competition.indirectCompetitorCount;
    insights.push({
      type: "text",
      emoji,
      text: `직접 경쟁 ${competition.directCompetitorCount}개 · 인접 업종 ${competition.indirectCompetitorCount}개`,
      sub: `총 ${total}개 · 약 ${Math.round(competition.densityPerMeter)}m마다 1개 (반경 샘플 기준)`,
      category: "scoring",
    });
  }

  // 2. 프랜차이즈 현황 — 학원·병의원·부동산은 프랜차이즈 개념이 없으므로 숨김
  if (!isFranchiseIrrelevant) {
    if (competition.franchiseCount > 0) {
      const total = competition.directCompetitorCount + competition.indirectCompetitorCount;
      const ratio = total > 0 ? Math.round((competition.franchiseCount / total) * 100) : 0;
      const brands = competition.franchiseBrandNames;
      const brandText =
        brands.length > 0
          ? brands.slice(0, 5).join(", ") + (brands.length > 5 ? ` 외 ${brands.length - 5}개` : "")
          : undefined;

      insights.push({
        type: "text",
        emoji: "🏷️",
        text: `프랜차이즈 ${competition.franchiseCount}개 (${ratio}%)`,
        sub: brandText,
        category: "scoring",
      });
    } else {
      // 프랜차이즈 0건: 경쟁자가 모두 독립 점포
      const isLowCompetition = grade === "A" || grade === "B";
      insights.push({
        type: "text",
        emoji: isLowCompetition ? "✅" : "📊",
        text: isLowCompetition
          ? "프랜차이즈 없음 (독립 점포 상권)"
          : "프랜차이즈 없음 (소규모 독립 점포 밀집)",
        sub: undefined,
        category: "scoring",
      });
    }
  }

  return insights;
};
