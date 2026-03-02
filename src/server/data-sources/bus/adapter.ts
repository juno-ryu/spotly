import {
  fetchNearbyBusStations,
  type BusStationWithRoutes,
} from "./client";

/** 버스 접근성 분석 결과 */
export interface BusAnalysis {
  /** 반경 내 버스 정류장 존재 여부 */
  hasBusStop: boolean;
  /** 가장 가까운 정류장 정보 (없으면 null) */
  nearestStop: BusStationWithRoutes | null;
  /** 반경 내 전체 정류장 수 */
  stopCount: number;
  /** 반경 내 모든 정류장 목록 */
  stopsInRadius: Array<{
    /** 정류장명 */
    name: string;
    /** 분석 좌표로부터의 거리(m) */
    distance: number;
    /** 위도 */
    latitude: number;
    /** 경도 */
    longitude: number;
  }>;
  /** 가장 가까운 정류장의 경유 노선 수 */
  totalRouteCount: number;
}

/**
 * 좌표 기반 버스 접근성 분석.
 *
 * TAGO BusSttnInfoInqireService 기반:
 * 1. getCrdntPrxmtSttnList — 위경도 → 인근 정류소 목록
 * 2. getSttnThrghRouteList — 정류소 ID → 경유 노선 목록
 */
export async function fetchBusAnalysis(params: {
  latitude: number;
  longitude: number;
  /** 행정구역코드 — TAGO cityCode 자동 결정에 사용. 미전달 시 서울(11) 기본값. */
  regionCode?: string;
}): Promise<BusAnalysis> {
  const stations = await fetchNearbyBusStations({
    latitude: params.latitude,
    longitude: params.longitude,
    numOfRows: 5,
    regionCode: params.regionCode,
  });

  if (stations.length === 0) {
    console.log("[버스] 인근 버스 정류소 없음");
    return {
      hasBusStop: false,
      nearestStop: null,
      stopCount: 0,
      stopsInRadius: [],
      totalRouteCount: 0,
    };
  }

  const nearestStop = stations[0];

  console.log(
    `[버스] 가장 가까운 정류소: ${nearestStop.name}(${nearestStop.distanceMeters}m), ${nearestStop.routeCount}개 노선`,
  );

  return {
    hasBusStop: true,
    nearestStop,
    stopCount: stations.length,
    stopsInRadius: stations.map((s) => ({
      name: s.name,
      distance: s.distanceMeters,
      latitude: s.latitude,
      longitude: s.longitude,
    })),
    totalRouteCount: nearestStop.routeCount,
  };
}
