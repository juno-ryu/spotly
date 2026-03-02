import { searchByCategory } from "@/server/data-sources/kakao/client";
import { MEDICAL_RADIUS } from "@/features/analysis/lib/constants";

/** 의료시설 종별 */
export type MedicalCategory = "종합병원" | "병원" | "의원" | "기타";

export interface HospitalItem {
  /** 시설명 */
  name: string;
  /** 분석 좌표 기준 직선거리 (미터) */
  distanceMeters: number;
  /** 종별 (category_name 기반 분류) */
  category: MedicalCategory;
  /** 위도 */
  latitude: number;
  /** 경도 */
  longitude: number;
}

export interface MedicalAnalysis {
  /** 반경 내 병의원 존재 여부 */
  hasHospital: boolean;
  /** 반경 내 병의원 수 */
  count: number;
  /** 반경 내 병의원 목록 (거리순) */
  hospitals: HospitalItem[];
}

/** Kakao category_name → 종별 분류 */
// Kakao distance 필드가 "0"을 반환하는 경우가 있으므로 좌표로 직접 계산
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyMedical(categoryName: string): MedicalCategory {
  if (categoryName.includes("종합병원")) return "종합병원";
  if (categoryName.includes("병원")) return "병원";
  if (categoryName.includes("의원")) return "의원";
  return "기타";
}

export async function fetchMedicalAnalysis(params: {
  latitude: number;
  longitude: number;
}): Promise<MedicalAnalysis> {
  const { latitude, longitude } = params;

  // HP8: 병원 카테고리 그룹 코드
  const { documents } = await searchByCategory(
    "HP8",
    { latitude, longitude },
    MEDICAL_RADIUS,
    3,
  );

  const hospitals: HospitalItem[] = documents
    // 반경 필터 — Kakao distance 필드가 "0"을 반환하는 버그가 있으므로 Haversine으로 직접 계산
    .filter((doc) => haversineMeters(latitude, longitude, parseFloat(doc.y), parseFloat(doc.x)) <= MEDICAL_RADIUS)
    .map((doc) => ({
      name: doc.place_name,
      distanceMeters: Math.round(haversineMeters(latitude, longitude, parseFloat(doc.y), parseFloat(doc.x))),
      category: classifyMedical(doc.category_name),
      latitude: parseFloat(doc.y),
      longitude: parseFloat(doc.x),
    }))
    // 동네 의원은 상권 형성 효과가 없으므로 종합병원·병원만 포함
    .filter((h) => h.category === "종합병원" || h.category === "병원")
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  console.log(`[의료시설] 반경 ${MEDICAL_RADIUS}m — ${hospitals.length}건 (종합병원·병원 한정)`);

  return {
    hasHospital: hospitals.length > 0,
    count: hospitals.length,
    hospitals,
  };
}
