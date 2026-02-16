import * as kakaoGeocoding from "@/server/data-sources/kakao-geocoding";

export interface KakaoPlace {
  id: string;
  name: string;
  phone: string;
  address: string;
  roadAddress: string;
  latitude: number;
  longitude: number;
  category: string;
  categoryGroupCode: string;
  categoryGroupName: string;
  placeUrl: string;
  distance: number;
}

/** 카카오 Places API 원시 결과 */
export interface KakaoPlacesRaw {
  /** 반경 내 전체 매장 수 (카카오 meta.total_count) */
  totalCount: number;
  /** 실제 가져온 샘플 수 (최대 45개) */
  fetchedCount: number;
  /** 샘플 매장 목록 */
  places: KakaoPlace[];
}

/** 카카오 Places API에서 주변 매장 원시 데이터를 가져온다. */
export async function fetchKakaoPlaces(params: {
  keyword: string;
  latitude: number;
  longitude: number;
  radius: number;
}): Promise<KakaoPlacesRaw> {
  const { documents, meta } = await kakaoGeocoding.searchByKeyword(
    params.keyword,
    { latitude: params.latitude, longitude: params.longitude },
    params.radius,
    3,
  );

  const places: KakaoPlace[] = documents.map((r) => ({
    id: r.id,
    name: r.place_name,
    phone: r.phone,
    address: r.address_name,
    roadAddress: r.road_address_name,
    latitude: parseFloat(r.y),
    longitude: parseFloat(r.x),
    category: r.category_name,
    categoryGroupCode: r.category_group_code,
    categoryGroupName: r.category_group_name,
    placeUrl: r.place_url,
    distance: parseInt(r.distance, 10) || 0,
  }));

  console.log(
    `[Kakao Places] 조회 성공: "${params.keyword}" 반경 ${params.radius}m — 총 ${meta.total_count}건 (샘플 ${places.length}건)`,
  );

  return {
    totalCount: meta.total_count,
    fetchedCount: places.length,
    places,
  };
}
