/** 공공 API 공통 응답 래퍼 (data.go.kr 표준) */
export interface DataGoKrResponse<T> {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: {
        item: T[];
      };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

/** Kakao REST API 공통 응답 래퍼 */
export interface KakaoResponse<T> {
  meta: {
    total_count: number;
    pageable_count?: number;
    is_end?: boolean;
  };
  documents: T[];
}

/** 좌표 */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** 지역 정보 (Kakao 지오코딩 결과) */
export interface RegionInfo {
  /** 법정동 코드 (10자리) */
  code: string;
  /** 시/도 */
  region1: string;
  /** 시/군/구 */
  region2: string;
  /** 읍/면/동 */
  region3: string;
  /** 시군구 코드 (앞 5자리, NPS API용) */
  districtCode: string;
}
