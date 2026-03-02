import type { InsightData, InsightItem } from "../types";

/** 학교 접근성 관련 인사이트 룰 — 팩트 표시만, 점수화 없음 */
export function schoolRules(data: InsightData): InsightItem[] {
  const school = data.school;
  const radius = data.radius;
  const industry = data.industryName;

  if (!school) return [];

  const items: InsightItem[] = [];
  const { elementaryCount, middleCount, highCount, totalCount } = school;

  /** 학원 업종 여부 */
  const isAcademy = industry.includes("학원");

  if (totalCount === 0) {
    items.push({
      type: "text",
      emoji: "🏫",
      text: `인근 학교 없음 (반경 ${radius}m 기준)`,
      sub: isAcademy
        ? "학원 입지 핵심 요건인 학교가 없습니다 — 입지 신중 검토 필요"
        : "학교 밀집 지역이 아닙니다",
      category: "fact",
    });
    return items;
  }

  const parts: string[] = [];
  if (elementaryCount > 0) parts.push(`초등학교 ${elementaryCount}곳`);
  if (middleCount > 0) parts.push(`중학교 ${middleCount}곳`);
  if (highCount > 0) parts.push(`고등학교 ${highCount}곳`);

  const baseText = parts.join(", ");

  items.push({
    type: "text",
    emoji: "🏫",
    text: `인근 학교 — ${baseText}`,
    sub: isAcademy
      ? totalCount >= 2
        ? "학원 입지 적합 — 복수 학교로 안정적인 학생 수요 확보"
        : "학원 입지 가능 — 인근 학교 학생 수요 기대 가능"
      : totalCount >= 3
        ? "학교 밀집 지역 — 학생 유동인구가 풍부합니다"
        : "인근 학교로 인한 학생 유동인구 기대",
    category: "fact",
  });

  return items;
}
