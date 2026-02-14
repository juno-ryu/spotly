/* eslint-disable @typescript-eslint/no-explicit-any */

/** Kakao Maps JS SDK 글로벌 타입 선언 */
declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: any) => any;
        LatLng: new (lat: number, lng: number) => any;
        Marker: new (options: any) => any;
        MarkerImage: new (src: string, size: any, options?: any) => any;
        Size: new (width: number, height: number) => any;
        Point: new (x: number, y: number) => any;
        Circle: new (options: any) => any;
        InfoWindow: new (options: any) => any;
        CustomOverlay: new (options: any) => any;
        ZoomControl: new () => any;
        ControlPosition: { RIGHT: any };
        event: {
          addListener: (target: any, type: string, handler: () => void) => void;
          removeListener: (target: any, type: string, handler: () => void) => void;
          /** 지도 이벤트 일시 차단 (CustomOverlay 드래그 시 필수) */
          preventMap: () => void;
        };
        services: {
          Places: new () => {
            /** 키워드 장소 검색 */
            keywordSearch: (
              keyword: string,
              callback: (
                result: KakaoPlaceResult[],
                status: string,
                pagination: KakaoPlacesPagination,
              ) => void,
              options?: {
                size?: number;
                page?: number;
                /** 중심 경도 (좌표 기반 검색) */
                x?: string;
                /** 중심 위도 (좌표 기반 검색) */
                y?: string;
                /** 검색 반경 (미터, 최대 20000) */
                radius?: number;
              },
            ) => void;
          };
          /** 역지오코딩 서비스 */
          Geocoder: new () => {
            /** 좌표 → 주소 변환 */
            coord2Address: (
              lng: number,
              lat: number,
              callback: (
                result: KakaoGeocoderResult[],
                status: string,
              ) => void,
            ) => void;
          };
          Status: {
            OK: string;
            ZERO_RESULT: string;
            ERROR: string;
          };
        };
      };
    };
  }

  /** 카카오 지번 주소 */
  interface KakaoAddress {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    mountain_yn: string;
    main_address_no: string;
    sub_address_no: string;
  }

  /** 카카오 도로명 주소 */
  interface KakaoRoadAddress {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    road_name: string;
    underground_yn: string;
    main_building_no: string;
    sub_building_no: string;
    building_name: string;
    zone_no: string;
  }

  /** 카카오 Geocoder coord2Address 결과 */
  interface KakaoGeocoderResult {
    address: KakaoAddress;
    road_address: KakaoRoadAddress | null;
  }

  /** 카카오 Places 키워드 검색 결과 */
  interface KakaoPlaceResult {
    id: string;
    place_name: string;
    address_name: string;
    road_address_name: string;
    x: string;
    y: string;
    category_name: string;
    category_group_code: string;
    phone: string;
  }

  /** 카카오 Places 검색 페이지네이션 */
  interface KakaoPlacesPagination {
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    current: number;
    /** 다음 페이지 결과 요청 */
    nextPage: () => void;
    /** 이전 페이지 결과 요청 */
    prevPage: () => void;
    /** 특정 페이지 결과 요청 */
    gotoPage: (page: number) => void;
  }
}

export {};
