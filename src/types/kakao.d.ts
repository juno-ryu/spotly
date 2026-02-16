/** Kakao Maps JS SDK 글로벌 타입 선언 */

/** 카카오 맵 인스턴스 */
interface KakaoMapInstance {
  setCenter: (latlng: KakaoLatLng) => void;
  getCenter: () => KakaoLatLng;
  setLevel: (level: number) => void;
  getLevel: () => number;
  addControl: (control: KakaoMapControl, position: number) => void;
  removeControl: (control: KakaoMapControl) => void;
  setBounds: (bounds: KakaoLatLngBounds) => void;
  getProjection: () => KakaoMapProjection;
}

/** 카카오 맵 프로젝션 */
interface KakaoMapProjection {
  coordsFromContainerPoint: (point: KakaoPoint) => KakaoLatLng;
  containerPointFromCoords: (latlng: KakaoLatLng) => KakaoPoint;
}

/** 카카오 위경도 */
interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

/** 카카오 사이즈 */
interface KakaoSize {
  width: number;
  height: number;
}

/** 카카오 포인트 */
interface KakaoPoint {
  x: number;
  y: number;
}

/** 카카오 마커 */
interface KakaoMarker {
  setMap: (map: KakaoMapInstance | null) => void;
  getPosition: () => KakaoLatLng;
  setPosition: (latlng: KakaoLatLng) => void;
}

/** 카카오 원형 오버레이 */
interface KakaoCircle {
  setMap: (map: KakaoMapInstance | null) => void;
  setPosition: (latlng: KakaoLatLng) => void;
  setRadius: (radius: number) => void;
}

/** 카카오 커스텀 오버레이 */
interface KakaoCustomOverlay {
  setMap: (map: KakaoMapInstance | null) => void;
  getMap: () => KakaoMapInstance | null;
  setPosition: (latlng: KakaoLatLng) => void;
}

/** 카카오 인포윈도우 */
interface KakaoInfoWindow {
  open: (map: KakaoMapInstance, marker: KakaoMarker) => void;
  close: () => void;
  setMap: (map: KakaoMapInstance | null) => void;
}

/** 카카오 마커 이미지 */
interface KakaoMarkerImage {
  _src: string;
}

/** 카카오 지도 컨트롤 */
interface KakaoMapControl {
  setMap?: (map: KakaoMapInstance | null) => void;
}

/** 카카오 LatLngBounds */
interface KakaoLatLngBounds {
  extend: (latlng: KakaoLatLng) => void;
}

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: { center: KakaoLatLng; level?: number }) => KakaoMapInstance;
        LatLng: new (lat: number, lng: number) => KakaoLatLng;
        Marker: new (options: { position: KakaoLatLng; map?: KakaoMapInstance; image?: KakaoMarkerImage }) => KakaoMarker;
        MarkerImage: new (src: string, size: KakaoSize, options?: { offset?: KakaoPoint }) => KakaoMarkerImage;
        Size: new (width: number, height: number) => KakaoSize;
        Point: new (x: number, y: number) => KakaoPoint;
        Circle: new (options: {
          center: KakaoLatLng;
          radius: number;
          strokeWeight?: number;
          strokeColor?: string;
          strokeOpacity?: number;
          strokeStyle?: string;
          fillColor?: string;
          fillOpacity?: number;
        }) => KakaoCircle;
        InfoWindow: new (options: { content?: string | HTMLElement; position?: KakaoLatLng }) => KakaoInfoWindow;
        CustomOverlay: new (options: {
          content: string | HTMLElement;
          position: KakaoLatLng;
          yAnchor?: number;
          xAnchor?: number;
          clickable?: boolean;
          zIndex?: number;
        }) => KakaoCustomOverlay;
        ZoomControl: new () => KakaoMapControl;
        ControlPosition: { RIGHT: number; TOPRIGHT: number };
        LatLngBounds: new () => KakaoLatLngBounds;
        event: {
          addListener: (target: object, type: string, handler: (...args: unknown[]) => void) => void;
          removeListener: (target: object, type: string, handler: (...args: unknown[]) => void) => void;
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
          /** 지오코딩 서비스 */
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
            /** 좌표 → 행정구역 코드 변환 */
            coord2RegionCode: (
              lng: number,
              lat: number,
              callback: (
                result: { region_type: string; code: string; address_name: string }[],
                status: string,
              ) => void,
            ) => void;
            /** 주소 → 좌표 변환 */
            addressSearch: (
              address: string,
              callback: (
                result: { x: string; y: string; address_name: string }[],
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
