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


/** 학교 접근성 관련 인사이트 룰 — 팩트 표시만, 점수화 없음 */
export function schoolRules(data: InsightData): InsightItem[] {
  const school = data.school;
  const industry = data.industryName;
  if (!school) return [];

  const isAcademy = industry.includes("학원");
  const { grade } = calcSchoolGrade(school, isAcademy);

  // 학교 이름 나열 (거리순, 최대 4곳)
  const sorted = school.schools.slice(0, 4);
  const nameList = sorted.map((s) => `${s.name} ${Math.round(s.distanceMeters)}m`).join(", ");
  const factText =
    school.totalCount > 4
      ? `${nameList} 외 ${school.totalCount - 4}곳`
      : nameList || `반경 내 학교 ${school.totalCount}곳`;

  // 학원 외 업종은 팩트로만 표시 (학교 데이터는 학원과 직접 관련)
  const category = isAcademy ? "scoring" : "fact";

  return [
    {
      type: "text",
      emoji: "🏫",
      text: factText,
      sub: undefined,
      category,
    },
  ];
}
