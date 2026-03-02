import type { InsightData, InsightItem } from "../types";

export function universityRules(data: InsightData): InsightItem[] {
  const university = data.university;
  const industry = data.industryName;
  const radius = data.radius;

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

  /** 대학가 수혜 업종 — 방학 리스크가 매출에 직접 영향을 주는 업종 */
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
    text: `반경 ${radius}m — 대학교 ${count}곳 (${nameList})`,
    sub: isBeneficiary
      ? "대학가 핵심 상권 — 학기 중 젊은 유동인구 밀집"
      : "대학교 인근 — 학기 중 유동인구 풍부",
    category: "fact",
  });

  // 수혜 업종은 방학 리스크를 별도 경고로 강조
  // 카페·음식점·의류는 대학생 비율이 높아 방학(1~2월, 7~8월) 매출이 30~50% 급감 가능
  if (isBeneficiary) {
    items.push({
      type: "text",
      emoji: "⚠️",
      text: "방학 기간 매출 급감 주의",
      sub: "대학가 업종은 여름(7~8월)·겨울(1~2월) 방학 시 매출이 30~50% 감소할 수 있습니다. 방학 시즌 운영 계획을 미리 준비하세요",
      category: "fact",
    });
  }

  return items;
}
