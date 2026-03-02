import type { InsightData, InsightItem } from "../types";

export function universityRules(data: InsightData): InsightItem[] {
  const university = data.university;
  const industry = data.industryName;

  if (!university || !university.hasUniversity) return [];

  const items: InsightItem[] = [];
  const { count, universities } = university;

  const nameList =
    count <= 3
      ? universities.map((u) => u.name).join(", ")
      : `${universities
          .slice(0, 3)
          .map((u) => u.name)
          .join(", ")} 외 ${count - 3}곳`;

  /** 대학가 수혜 업종 */
  const isBeneficiary =
    industry.includes("카페") ||
    industry.includes("커피") ||
    industry.includes("음식") ||
    industry.includes("한식") ||
    industry.includes("분식") ||
    industry.includes("중식") ||
    industry.includes("일식") ||
    industry.includes("의류") ||
    industry.includes("편의점");

  items.push({
    type: "text",
    emoji: "🎓",
    text: `반경 2km — 대학교 ${count}곳 (${nameList})`,
    sub: isBeneficiary
      ? "대학가 핵심 상권 — 학기 중 젊은 유동인구 밀집. 단, 방학 기간 매출 급감 리스크 있음"
      : "대학교 인근 — 학기 중 유동인구 풍부하나 방학 기간 매출 감소 리스크 있음",
    category: "fact",
  });

  return items;
}
