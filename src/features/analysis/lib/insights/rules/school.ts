import type { Grade } from "../../scoring/types";
import { scoreToGrade } from "../../scoring/types";
import type { SchoolAnalysis } from "../../../../../server/data-sources/school/adapter";
import type { InsightData, InsightItem } from "../types";

/** 학교 접근성 등급 산출 (isAcademy: 학원 업종 여부) */
export function calcSchoolGrade(school: SchoolAnalysis, isAcademy: boolean): { score: number; grade: Grade } {
  const totalCountScore = (() => {
    const n = school.totalCount;
    if (isAcademy) {
      if (n >= 5) return 100;
      if (n >= 3) return 80;
      if (n >= 2) return 60;
      if (n >= 1) return 40;
      return 0;
    } else {
      if (n >= 5) return 80;
      if (n >= 3) return 65;
      if (n >= 2) return 50;
      if (n >= 1) return 35;
      return 0;
    }
  })();

  const diversityScore = (() => {
    const kinds = [school.elementaryCount > 0, school.middleCount > 0, school.highCount > 0].filter(Boolean).length;
    if (kinds === 3) return 100;
    if (kinds === 2) return 65;
    if (kinds === 1) return 35;
    return 0;
  })();

  const score = Math.round(
    isAcademy
      ? totalCountScore * 0.6 + diversityScore * 0.4
      : totalCountScore * 0.7 + diversityScore * 0.3,
  );
  return { score, ...scoreToGrade(score) };
}

/** 학원 업종 — 등급별 해석 텍스트 */
export const SCHOOL_GRADE_TEXT_ACADEMY: Record<Grade, { emoji: string; text: string }> = {
  A: { emoji: "🏫", text: "학원 최적 입지 — 다양한 학년의 수요가 풍부해요" },
  B: { emoji: "🏫", text: "학원 운영에 유리한 학군이에요" },
  C: { emoji: "🏫", text: "학원 수요가 있지만 학군 규모가 보통이에요" },
  D: { emoji: "🏫", text: "학교가 적어 학원 수요 확보가 어려울 수 있어요" },
  F: { emoji: "🏫", text: "학교가 없어 학원 입지로 부적합해요" },
};

/** 일반 업종 — 등급별 해석 텍스트 */
export const SCHOOL_GRADE_TEXT_GENERAL: Record<Grade, { emoji: string; text: string }> = {
  A: { emoji: "🏫", text: "학생 유동인구가 풍부한 지역이에요" },
  B: { emoji: "🏫", text: "학생 유입을 기대할 수 있는 입지예요" },
  C: { emoji: "🏫", text: "학교가 있어 일부 학생 수요가 있어요" },
  D: { emoji: "🏫", text: "학교가 적어 학생 수요는 제한적이에요" },
  F: { emoji: "🏫", text: "반경 내 학교가 없어요" },
};

/** 학교 접근성 관련 인사이트 룰 — 팩트 표시만, 점수화 없음 */
export function schoolRules(data: InsightData): InsightItem[] {
  const school = data.school;
  const industry = data.industryName;
  if (!school) return [];

  const isAcademy = industry.includes("학원");
  const { grade } = calcSchoolGrade(school, isAcademy);
  const { emoji, text } = isAcademy
    ? SCHOOL_GRADE_TEXT_ACADEMY[grade]
    : SCHOOL_GRADE_TEXT_GENERAL[grade];

  // 팩트 수치 sub 문자열 구성
  const parts: string[] = [];
  if (school.elementaryCount > 0) parts.push(`초등학교 ${school.elementaryCount}곳`);
  if (school.middleCount > 0) parts.push(`중학교 ${school.middleCount}곳`);
  if (school.highCount > 0) parts.push(`고등학교 ${school.highCount}곳`);
  const sub = parts.length > 0 ? parts.join(" · ") : undefined;

  return [
    {
      type: "text",
      emoji,
      text,
      sub,
      category: "scoring",
    },
  ];
}
