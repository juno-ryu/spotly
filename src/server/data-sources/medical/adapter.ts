import { searchByCategory, searchByKeyword } from "@/server/data-sources/kakao/client";
import { MEDICAL_SEARCH_RADIUS } from "@/features/analysis/lib/constants";
import { getDistanceMeters } from "@/lib/geo-utils";

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
  /** 실제 탐색에 사용한 반경 (MEDICAL_SEARCH_RADIUS = 3000m 고정) */
  searchRadius: number;
}


/** category_name + place_name으로 상급병원 여부 판별
 * - 종합병원: category_name에 "종합병원" 포함 (서울아산병원 등)
 * - 의료원: place_name에 "의료원" 포함 (성남시의료원 등 — Kakao에서 "병원"으로 분류)
 * - 대학병원: place_name에 "대학병원" 포함
 */
function classifyMedical(categoryName: string, placeName: string): MedicalCategory {
  if (categoryName.includes("종합병원")) return "종합병원";
  if (placeName.includes("의료원") || placeName.includes("대학병원")) return "종합병원";
  if (categoryName.includes("병원")) return "병원";
  if (categoryName.includes("의원")) return "의원";
  return "기타";
}

export async function fetchMedicalAnalysis(params: {
  latitude: number;
  longitude: number;
  radius: number;
}): Promise<MedicalAnalysis> {
  const { latitude, longitude } = params;
  // 사용자 선택 반경과 무관하게 3000m 고정 탐색 — 종합병원·의료원은 넓게 분포
  const searchRadius = MEDICAL_SEARCH_RADIUS;
  const coord = { latitude, longitude };

  // 1) HP8 카테고리 검색 (병원 전체)
  const { documents: hp8Docs } = await searchByCategory("HP8", coord, searchRadius, 3);

  // 2) 키워드 검색으로 보완 — Kakao가 HP8 외 카테고리로 분류하는 종합병원/의료원 포착
  const [kwResult1, kwResult2] = await Promise.all([
    searchByKeyword("종합병원", coord, searchRadius, 1),
    searchByKeyword("의료원", coord, searchRadius, 1),
  ]);

  // 중복 제거 (place_id 기준)
  const seen = new Set<string>();
  const allDocs = [...hp8Docs, ...kwResult1.documents, ...kwResult2.documents].filter((doc) => {
    if (seen.has(doc.id)) return false;
    seen.add(doc.id);
    return true;
  });

  const hospitals: HospitalItem[] = allDocs
    .map((doc) => ({
      name: doc.place_name,
      distanceMeters: Math.round(getDistanceMeters(latitude, longitude, parseFloat(doc.y), parseFloat(doc.x))),
      category: classifyMedical(doc.category_name, doc.place_name),
      latitude: parseFloat(doc.y),
      longitude: parseFloat(doc.x),
    }))
    .filter((h) => h.distanceMeters <= searchRadius && h.category === "종합병원")
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  console.log(`[의료시설] 반경 ${searchRadius}m — ${hospitals.length}건 (상급병원 한정)`);

  return {
    hasHospital: hospitals.length > 0,
    count: hospitals.length,
    hospitals,
    searchRadius,
  };
}
