import type { KakaoResponse, Coordinate, RegionInfo } from "./types";

const KAKAO_BASE_URL = "https://dapi.kakao.com/v2/local";

const USE_MOCK = !process.env.KAKAO_REST_API_KEY;

/** Kakao REST API 공통 fetch */
async function kakaoFetch<T>(path: string, params: Record<string, string>): Promise<KakaoResponse<T>> {
  const url = new URL(`${KAKAO_BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`Kakao API 오류: ${res.status} ${res.statusText}`);
  }

  return res.json();
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

  // 법정동(B) 타입 우선, 없으면 행정동(H)
  const region =
    data.documents.find((d) => d.region_type === "B") ?? data.documents[0];

  if (!region) {
    throw new Error("좌표에 해당하는 지역 정보를 찾을 수 없습니다");
  }

  return {
    code: region.code,
    region1: region.region_1depth_name,
    region2: region.region_2depth_name,
    region3: region.region_3depth_name,
    districtCode: region.code.substring(0, 5),
  };
}

/** 키워드 장소 검색 */
export async function searchByKeyword(
  keyword: string,
  coordinate?: Coordinate,
  radius?: number,
): Promise<
  Array<{
    place_name: string;
    address_name: string;
    x: string;
    y: string;
    category_name: string;
  }>
> {
  if (USE_MOCK) {
    return [];
  }

  const params: Record<string, string> = { query: keyword };
  if (coordinate) {
    params.x = String(coordinate.longitude);
    params.y = String(coordinate.latitude);
  }
  if (radius) {
    params.radius = String(radius);
  }

  const data = await kakaoFetch<{
    place_name: string;
    address_name: string;
    x: string;
    y: string;
    category_name: string;
  }>("/search/keyword.json", params);

  return data.documents;
}
