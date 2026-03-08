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


/** 학교 접근성 관련 인사이트 룰 */
export function schoolRules(data: InsightData): InsightItem[] {
  const school = data.school;
  const industry = data.industryName;
  if (!school || school.totalCount === 0) return [];

  const isAcademy = industry.includes("학원");
  const items: InsightItem[] = [];

  // 가장 가까운 학교 목록 (거리순, 최대 3곳)
  const sorted = school.schools.slice(0, 3);
  if (sorted.length > 0) {
    const nameList = sorted.map((s) => `${s.name}(${Math.round(s.distanceMeters)}m)`).join(", ");
    const moreText = school.totalCount > 3 ? ` 외 ${school.totalCount - 3}곳` : "";
    items.push({
      type: "text",
      emoji: "🏫",
      text: `${nameList}${moreText}`,
      sub: undefined,
      category: "fact",
    });
  }

  // 종류별 분포
  const kinds: string[] = [];
  if (school.elementaryCount > 0) kinds.push(`초등학교 ${school.elementaryCount}곳`);
  if (school.middleCount > 0) kinds.push(`중학교 ${school.middleCount}곳`);
  if (school.highCount > 0) kinds.push(`고등학교 ${school.highCount}곳`);
  if (kinds.length > 0) {
    items.push({
      type: "text",
      emoji: "📊",
      text: kinds.join(" · "),
      sub: undefined,
      category: "fact",
    });
  }

  // 학원 업종 시 수요 평가
  if (isAcademy) {
    const { grade } = calcSchoolGrade(school, true);
    const comment =
      grade === "A"
        ? "학원 수요 유입에 유리한 환경입니다"
        : grade === "B" || grade === "C"
          ? "학원 수요를 어느 정도 기대할 수 있는 환경입니다"
          : "반경 내 학교 수가 적어 학원 수요는 제한적일 수 있습니다";
    items.push({
      type: "text",
      emoji: grade === "A" ? "✅" : grade === "B" || grade === "C" ? "🟡" : "⚠️",
      text: comment,
      sub: undefined,
      category: "scoring",
    });
  }

  return items;
}
