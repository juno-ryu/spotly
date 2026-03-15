import type { Grade } from "../../scoring/types";
import { scoreToGrade } from "../../scoring/types";
import type { MedicalAnalysis } from "../../../../../server/data-sources/medical/adapter";
import type { InsightData, InsightItem } from "../types";

/** 의료시설 접근성 등급 산출 */
export function calcMedicalGrade(medical: MedicalAnalysis): { score: number; grade: Grade } {
  const distanceScore = (() => {
    const d = medical.hospitals[0]?.distanceMeters ?? Infinity;
    if (d <= 300) return 100;
    if (d <= 500) return 80;
    if (d <= 1000) return 55;
    if (d <= 2000) return 30;
    if (d <= 3000) return 15;
    return 0;
  })();

  // 종별 가중치: 추후 종별 데이터 확보 시 보정 (현재는 count * 5 단순 처리)
  const facilityScore = Math.min(100, medical.count * 5);

  const score = Math.round(distanceScore * 0.4 + facilityScore * 0.6);
  return { score, ...scoreToGrade(score) };
}

/** 약국 업종 — 등급별 해석 텍스트 */
export const MEDICAL_GRADE_TEXT_PHARMACY: Record<Grade, { emoji: string; text: string }> = {
  A: { emoji: "💊", text: "의료 밀집 지역으로 약국 최적 입지예요" },
  B: { emoji: "💊", text: "병원이 충분해 처방전 수요가 안정적이에요" },
  C: { emoji: "💊", text: "병원이 있지만 처방전 물량이 보통이에요" },
  D: { emoji: "💊", text: "병원이 적어 처방전 수요 확보가 어려울 수 있어요" },
  F: { emoji: "💊", text: "병원이 거의 없어 약국 입지로 부적합해요" },
};

/** 일반 업종 — 등급별 해석 텍스트 */
export const MEDICAL_GRADE_TEXT_GENERAL: Record<Grade, { emoji: string; text: string }> = {
  A: { emoji: "🏥", text: "의료시설이 밀집한 지역이에요 — 병원 방문객 유동인구가 많아요" },
  B: { emoji: "🏥", text: "병원 인근이에요 — 방문객 유동인구가 안정적으로 형성돼요" },
  C: { emoji: "🏥", text: "의료시설이 있어 일부 방문객 수요가 있어요" },
  D: { emoji: "🏥", text: "의료시설이 적어 방문객 효과는 제한적이에요" },
  F: { emoji: "🏥", text: "반경 내 의료시설이 거의 없어요" },
};

export function medicalRules(data: InsightData): InsightItem[] {
  const medical = data.medical;
  const industry = data.industryName;

  if (!medical || !medical.hasHospital) return [];

  const { grade } = calcMedicalGrade(medical);
  const isPharmacy = industry.includes("약국");

  const { count, hospitals, searchRadius } = medical;

  // 팩트 수치: 병원명 + 거리 나열 또는 반경 Xm · N곳
  const factText =
    count >= 5
      ? `반경 ${searchRadius}m · ${count}곳`
      : count <= 2
        ? hospitals.map((h) => `${h.name} ${h.distanceMeters}m`).join(", ")
        : `${hospitals.slice(0, 2).map((h) => `${h.name} ${h.distanceMeters}m`).join(", ")} 외 ${count - 2}곳`;

  const emoji = isPharmacy
    ? MEDICAL_GRADE_TEXT_PHARMACY[grade].emoji
    : MEDICAL_GRADE_TEXT_GENERAL[grade].emoji;

  // 약국·편의점만 병의원 밀집이 매출에 직접 영향 → scoring, 나머지는 참고 팩트만
  const isRelevant = isPharmacy || industry.includes("편의점");
  const category = isRelevant ? "scoring" : "fact";

  return [
    {
      type: "text",
      emoji,
      text: factText,
      sub: undefined,
      category,
    },
  ];
}
