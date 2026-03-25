import { searchByKeyword } from "@/server/data-sources/kakao/client";
import { UNIVERSITY_SEARCH_RADIUS } from "@/features/analysis/lib/constants";
import { getDistanceMeters } from "@/lib/geo-utils";



/**
 * 대학교명 정규화 — "홍익대학교 세종캠퍼스 도서관" → "홍익대학교"
 * 같은 캠퍼스 내 건물들을 동일 대학으로 묶기 위해 "대학교" 이후 텍스트를 제거한다.
 */
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

/** regionCode 앞 2자리 → 시/도명 매핑 (카카오 address_name 첫 단어 기준) */
const REGION_CODE_TO_SIDO: Record<string, string> = {
  "11": "서울",
  "26": "부산",
  "27": "대구",
  "28": "인천",
  "29": "광주",
  "30": "대전",
  "31": "울산",
  "36": "세종",
  "41": "경기",
  "43": "충북",
  "44": "충남",
  "46": "전남",
  "47": "경북",
  "48": "경남",
  "50": "제주",
};

/**
 * 카카오 place의 address_name에서 시/도명을 추출.
 * "서울 마포구 xxx" → "서울", "경상남도 창원시 xxx" → "경남"
 */
function extractSido(addressName: string): string {
  const first = addressName.split(" ")[0] ?? "";
  // 축약형 → 정식명 역매핑 (경기도→경기, 경상남도→경남 등)
  const LONG_TO_SHORT: Record<string, string> = {
    경기도: "경기",
    강원도: "강원",
    충청북도: "충북",
    충청남도: "충남",
    전라북도: "전북",
    전라남도: "전남",
    경상북도: "경북",
    경상남도: "경남",
    제주특별자치도: "제주",
    세종특별자치시: "세종",
  };
  return LONG_TO_SHORT[first] ?? first;
}

export async function fetchUniversityAnalysis(params: {
  latitude: number;
  longitude: number;
  radius: number;
  /** 검색 좌표의 행정구역 코드 — 타 지역 부속기관 오탐 방지에 사용 */
  regionCode?: string;
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

  // 검색 좌표의 시/도명 (regionCode 앞 2자리로 결정)
  const searchSido = params.regionCode
    ? (REGION_CODE_TO_SIDO[params.regionCode.slice(0, 2)] ?? null)
    : null;

  // 대학교 부속기관 키워드 — 본교/분교가 아닌 시설로 판단
  const SUBSIDIARY_KEYWORDS = ["평생교육원", "기술창업원", "어학원", "사이버", "원격"];

  // 1) 반경 필터 (Kakao가 radius 밖 결과도 반환하므로 재필터)
  const filtered = documents
    // place_name에 "대학교" 포함 + category_name도 "대학교"여야 실제 대학교
    // ("파스쿠찌 가천대학교" 같은 카페/식당은 category_name이 다름)
    .filter((doc) => doc.place_name.includes("대학교") && doc.category_name.includes("대학교"))
    // 부속기관 키워드 포함 시 제외 (평생교육원, 기술창업원 등이 타 지역에 등록된 오탐 방지)
    .filter((doc) => !SUBSIDIARY_KEYWORDS.some((kw) => doc.place_name.includes(kw)))
    // Kakao distance 필드가 "0"을 반환하는 버그가 있으므로 Haversine으로 직접 계산
    .filter((doc) => getDistanceMeters(latitude, longitude, parseFloat(doc.y), parseFloat(doc.x)) <= searchRadius)
    // 시/도 불일치 제거 — 카카오가 타 지역 동명 부속기관을 반환하는 오탐 방지
    // (예: 부산에서 검색 시 "서울 마포구" 소재 서강대학교가 반환되는 경우)
    .filter((doc) => {
      if (!searchSido) return true; // regionCode 없으면 필터 건너뜀
      const placeSido = extractSido(doc.address_name);
      if (!placeSido) return true; // address_name 파싱 실패 시 통과
      if (placeSido !== searchSido) {
        console.log(
          `[대학교] 시/도 불일치 제외: ${doc.place_name} (${doc.address_name}) ≠ 검색지역 ${searchSido}`,
        );
        return false;
      }
      return true;
    });

  // 2) 대학교명 기준 중복 제거 — 가장 가까운 것 1개만 유지
  const seen = new Map<string, UniversityItem>();
  for (const doc of filtered) {
    const normalized = normalizeUnivName(doc.place_name);
    const dist = Math.round(getDistanceMeters(latitude, longitude, parseFloat(doc.y), parseFloat(doc.x)));
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
