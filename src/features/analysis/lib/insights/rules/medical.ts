import type { InsightData, InsightItem } from "../types";

export function medicalRules(data: InsightData): InsightItem[] {
  const medical = data.medical;
  const industry = data.industryName;

  if (!medical || !medical.hasHospital) return [];

  const items: InsightItem[] = [];
  const { count, hospitals } = medical;

  /** 의료 수혜 업종 */
  const isPharmacy = industry.includes("약국");
  const isConvenience = industry.includes("편의점");
  const isMedicalBeneficiary = isPharmacy || isConvenience;

  const hospitalNames =
    count <= 2
      ? hospitals.map((h) => h.name).join(", ")
      : `${hospitals.slice(0, 2).map((h) => h.name).join(", ")} 외 ${count - 2}곳`;

  items.push({
    type: "text",
    emoji: "🏥",
    text: `반경 2km — 병원 ${count}곳 (${hospitalNames})`,
    sub: isPharmacy
      ? count >= 3
        ? "약국 최적 입지 — 복수 병원 인근으로 처방전 수요 안정적"
        : "병원 인근 약국 입지 — 처방전 고객 유입 기대"
      : isConvenience
        ? "병원 인근 편의점 — 환자·보호자 방문객 수요 기대"
        : count >= 5
          ? "의료 밀집 지역 — 의료 관련 유동인구 및 보호자 수요 기대"
          : "인근 의료시설로 인한 안정적 유동인구 확보",
    category: "fact",
  });

  return items;
}
