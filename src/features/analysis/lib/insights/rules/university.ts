import type { Grade } from "../../scoring/types";
import { scoreToGrade } from "../../scoring/types";
import type { UniversityAnalysis } from "../../../../../server/data-sources/university/adapter";
import type { InsightData, InsightItem } from "../types";

/** 대학교 접근성 등급 산출 */
export function calcUniversityGrade(university: UniversityAnalysis): { score: number; grade: Grade } {
  const distanceScore = (() => {
    const d = university.universities[0]?.distanceMeters ?? Infinity;
    if (d <= 500) return 100;
    if (d <= 1000) return 75;
    if (d <= 1500) return 45;
    if (d <= 2000) return 20;
    return 0;
  })();

  const countScore = (() => {
    const c = university.count;
    if (c >= 3) return 100;
    if (c === 2) return 70;
    if (c === 1) return 40;
    return 0;
  })();

  const score = Math.round(distanceScore * 0.6 + countScore * 0.4);
  return { score, ...scoreToGrade(score) };
}

/** 수혜 업종(카페·음식·의류 등) — 등급별 해석 텍스트 */
export const UNIV_GRADE_TEXT_BENEFICIARY: Record<Grade, { emoji: string; text: string }> = {
  A: { emoji: "🎓", text: "대학가 핵심 상권으로 젊은 소비층이 풍부해요" },
  B: { emoji: "🎓", text: "대학 인근이라 학생 수요를 기대할 수 있어요" },
  C: { emoji: "🎓", text: "대학이 있지만 핵심 상권과는 다소 거리가 있어요" },
  D: { emoji: "🎓", text: "대학 영향권 가장자리로 수혜가 제한적이에요" },
  F: { emoji: "🎓", text: "대학 인근이 아닌 입지예요" },
};

/** 일반 업종 — 등급별 해석 텍스트 */
export const UNIV_GRADE_TEXT_GENERAL: Record<Grade, { emoji: string; text: string }> = {
  A: { emoji: "🎓", text: "대학 밀집 지역으로 유동인구가 많아요" },
  B: { emoji: "🎓", text: "대학 인근이라 젊은 층 유입을 기대할 수 있어요" },
  C: { emoji: "🎓", text: "대학이 있지만 직접적 영향은 보통이에요" },
  D: { emoji: "🎓", text: "대학과 거리가 있어 학생 수요는 적어요" },
  F: { emoji: "🎓", text: "대학 인근이 아닌 입지예요" },
};

export function universityRules(data: InsightData): InsightItem[] {
  const university = data.university;
  const industry = data.industryName;

  if (!university || !university.hasUniversity) return [];

  // 부동산·의료·학원은 대학 인근 여부가 매출에 거의 영향 없음 → 섹션 숨김
  const isIrrelevant =
    industry.includes("부동산") ||
    industry.includes("병원") ||
    industry.includes("의원") ||
    industry.includes("치과") ||
    industry.includes("한의") ||
    industry.includes("학원");
  if (isIrrelevant) return [];

  const { grade } = calcUniversityGrade(university);

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

  const { count, universities } = university;
  const nearest = universities[0];
  const distanceM = Math.round(nearest.distanceMeters);

  // 팩트 수치: 대학명 등 N곳 · 가장 가까운 곳 Xm
  const nameList =
    count <= 3
      ? universities.map((u) => u.name).join(", ")
      : `${universities.slice(0, 3).map((u) => u.name).join(", ")} 외 ${count - 3}곳`;

  const factText = count === 1 ? `${nearest.name} ${distanceM}m` : `${nameList} 등 ${count}곳`;
  const factSub = count > 1 ? `가장 가까운 곳 ${distanceM}m` : undefined;

  const emoji = isBeneficiary
    ? UNIV_GRADE_TEXT_BENEFICIARY[grade].emoji
    : UNIV_GRADE_TEXT_GENERAL[grade].emoji;

  const items: InsightItem[] = [
    {
      type: "text",
      emoji,
      text: factText,
      sub: factSub,
      category: "scoring",
    },
  ];

  // 수혜 업종은 방학 리스크를 별도 경고로 강조
  // 카페·음식점·의류는 대학생 비율이 높아 방학(1~2월, 7~8월) 매출이 30~50% 급감 가능
  if (isBeneficiary) {
    items.push({
      type: "text",
      emoji: "⚠️",
      text: "방학(7~8월·1~2월) 매출 30~50% 감소 가능",
      sub: "대학생 비율 높은 업종은 방학 기간 수요 급감",
      category: "fact",
    });
  }

  return items;
}
