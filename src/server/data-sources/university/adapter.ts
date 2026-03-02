import { searchByKeyword } from "@/server/data-sources/kakao/client";
import { UNIVERSITY_SEARCH_RADIUS } from "@/features/analysis/lib/constants";



/**
 * 대학교명 정규화 — "홍익대학교 세종캠퍼스 도서관" → "홍익대학교"
 * 같은 캠퍼스 내 건물들을 동일 대학으로 묶기 위해 "대학교" 이후 텍스트를 제거한다.
 */
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

function normalizeUnivName(name: string): string {
  const idx = name.indexOf("대학교");
  return idx !== -1 ? name.slice(0, idx + 3).trim() : name.trim();
}

export interface UniversityItem {
  /** 대학교 이름 */
  name: string;
  /** 분석 좌표 기준 직선거리 (미터) */
  distanceMeters: number;
  /** 위도 */
  latitude: number;
  /** 경도 */
  longitude: number;
}

export interface UniversityAnalysis {
  /** 반경 내 대학교 존재 여부 */
  hasUniversity: boolean;
  /** 반경 내 대학교 수 */
  count: number;
  /** 반경 내 대학교 목록 (거리순) */
  universities: UniversityItem[];
  /** 실제 탐색에 사용한 반경 (UNIVERSITY_SEARCH_RADIUS = 2000m 고정) */
  searchRadius: number;
}

export async function fetchUniversityAnalysis(params: {
  latitude: number;
  longitude: number;
  radius: number;
}): Promise<UniversityAnalysis> {
  const { latitude, longitude } = params;
  // 사용자 선택 반경과 무관하게 2000m 고정 탐색 — 캠퍼스는 블록 단위로 넓게 분포
  const searchRadius = UNIVERSITY_SEARCH_RADIUS;

  const { documents } = await searchByKeyword(
    "대학교",
    { latitude, longitude },
    searchRadius,
    3,
  );

  // 1) 반경 필터 (Kakao가 radius 밖 결과도 반환하므로 재필터)
  const filtered = documents
    // place_name에 "대학교" 포함 + category_name도 "대학교"여야 실제 대학교
    // ("파스쿠찌 가천대학교" 같은 카페/식당은 category_name이 다름)
    .filter((doc) => doc.place_name.includes("대학교") && doc.category_name.includes("대학교"))
    // Kakao distance 필드가 "0"을 반환하는 버그가 있으므로 Haversine으로 직접 계산
    .filter((doc) => haversineMeters(latitude, longitude, parseFloat(doc.y), parseFloat(doc.x)) <= searchRadius);

  // 2) 대학교명 기준 중복 제거 — 가장 가까운 것 1개만 유지
  const seen = new Map<string, UniversityItem>();
  for (const doc of filtered) {
    const normalized = normalizeUnivName(doc.place_name);
    const dist = Math.round(haversineMeters(latitude, longitude, parseFloat(doc.y), parseFloat(doc.x)));
    const existing = seen.get(normalized);
    if (!existing || dist < existing.distanceMeters) {
      seen.set(normalized, {
        name: normalized,
        distanceMeters: dist,
        latitude: parseFloat(doc.y),
        longitude: parseFloat(doc.x),
      });
    }
  }

  const universities: UniversityItem[] = Array.from(seen.values()).sort(
    (a, b) => a.distanceMeters - b.distanceMeters,
  );

  console.log(`[대학교] 반경 ${searchRadius}m — ${universities.length}건`);

  return {
    hasUniversity: universities.length > 0,
    count: universities.length,
    universities,
    searchRadius,
  };
}
