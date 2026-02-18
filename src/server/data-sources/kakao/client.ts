import type { KakaoResponse, Coordinate, RegionInfo } from "../types";

const KAKAO_BASE_URL = "https://dapi.kakao.com/v2/local";

const USE_MOCK = !process.env.KAKAO_REST_API_KEY;
const IS_DEV = process.env.NODE_ENV === "development";

/** Kakao REST API 공통 fetch */
async function kakaoFetch<T>(path: string, params: Record<string, string>): Promise<KakaoResponse<T>> {
  const url = new URL(`${KAKAO_BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  if (IS_DEV) console.log(`[API 요청] Kakao ${path} — ${JSON.stringify(params)}`);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.warn(`[Kakao API] ${res.status} ${res.statusText} — ${path}`, errorBody);
    throw new Error(`Kakao API 오류: ${res.status} ${res.statusText}`);
  }

  const data: KakaoResponse<T> = await res.json();
  if (IS_DEV) console.log(`[API 응답] Kakao ${path} — ${data.documents.length}건`);
  return data;
}

/** 주소 → 좌표 변환 */
export async function addressToCoord(address: string): Promise<Coordinate | null> {
  if (USE_MOCK) {
    // 모킹: 강남구 역삼동 기본 좌표
    return { latitude: 37.4979, longitude: 127.0276 };
  }

  const data = await kakaoFetch<{
    x: string;
    y: string;
    address_name: string;
  }>("/search/address.json", { query: address });

  if (data.documents.length === 0) return null;

  const doc = data.documents[0];
  return {
    latitude: parseFloat(doc.y),
    longitude: parseFloat(doc.x),
  };
}

/** 좌표 → 법정동 코드 변환 */
export async function coordToRegion(latitude: number, longitude: number): Promise<RegionInfo> {
  if (USE_MOCK) {
    // 모킹: 강남구 역삼동 기본 정보
    return {
      code: "1168010100",
      region1: "서울특별시",
      region2: "강남구",
      region3: "역삼동",
      districtCode: "11680",
      adminDongCode: "1168058000",
      dongName: "역삼동",
    };
  }

  const data = await kakaoFetch<{
    region_type: string;
    code: string;
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
  }>("/geo/coord2regioncode.json", {
    x: String(longitude),
    y: String(latitude),
  });

  // 법정동(B) + 행정동(H) 각각 추출
  const bjd = data.documents.find((d) => d.region_type === "B");
  const hjd = data.documents.find((d) => d.region_type === "H");
  const region = bjd ?? data.documents[0];

  if (!region) {
    throw new Error("좌표에 해당하는 지역 정보를 찾을 수 없습니다");
  }

  return {
    code: region.code,
    region1: region.region_1depth_name,
    region2: region.region_2depth_name,
    region3: region.region_3depth_name,
    districtCode: region.code.substring(0, 5),
    adminDongCode: hjd?.code,
    dongName: bjd?.region_3depth_name ?? region.region_3depth_name,
  };
}

/** 카카오 키워드 검색 결과 원본 타입 */
export type KakaoPlaceDocument = {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
  distance: string;
};

/** 키워드 장소 검색 (페이지네이션 지원) */
export async function searchByKeyword(
  keyword: string,
  coordinate?: Coordinate,
  radius?: number,
  maxPages: number = 1,
): Promise<{ documents: KakaoPlaceDocument[]; meta: { total_count: number; pageable_count: number; is_end: boolean } }> {
  if (USE_MOCK) {
    return { documents: [], meta: { total_count: 0, pageable_count: 0, is_end: true } };
  }

  const allResults: KakaoPlaceDocument[] = [];
  let lastMeta = { total_count: 0, pageable_count: 0, is_end: true };

  for (let page = 1; page <= maxPages; page++) {
    try {
      const params: Record<string, string> = {
        query: keyword,
        size: "15",
        page: String(page),
      };
      if (coordinate) {
        params.x = String(coordinate.longitude);
        params.y = String(coordinate.latitude);
      }
      if (radius) {
        params.radius = String(Math.min(radius, 20000));
      }

      const data = await kakaoFetch<KakaoPlaceDocument>("/search/keyword.json", params);
      allResults.push(...data.documents);
      lastMeta = {
        total_count: data.meta.total_count,
        pageable_count: data.meta.pageable_count ?? 0,
        is_end: data.meta.is_end ?? true,
      };

      if (data.meta.is_end) break;
    } catch (err) {
      console.warn(`[Kakao Places] 페이지 ${page} 실패:`, err);
      break;
    }
  }

  return { documents: allResults, meta: lastMeta };
}
