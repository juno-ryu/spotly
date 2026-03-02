import {
  fetchNearbyBusStations,
  fetchSeoulNearbyBusStations,
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
  radius: number;
  regionCode?: string;
}): Promise<BusAnalysis> {
  const isSeoul = params.regionCode?.startsWith("11") ?? false;

  // 서울은 ws.bus.go.kr API 사용 (TAGO는 서울 버스 데이터 미제공)
  const allStations = isSeoul
    ? await fetchSeoulNearbyBusStations({
        latitude: params.latitude,
        longitude: params.longitude,
        radius: params.radius,
      })
    : await fetchNearbyBusStations({
        latitude: params.latitude,
        longitude: params.longitude,
        numOfRows: 5,
      });

  // 서울 API는 radius 내 결과만 반환하므로 추가 필터 불필요.
  // 비서울은 TAGO 결과를 반경 내로 필터링.
  const stations = isSeoul
    ? allStations
    : allStations.filter((s) => s.distanceMeters <= params.radius);

  if (stations.length === 0) {
    console.log(`[버스] 반경 ${params.radius}m 내 정류소 없음 (${isSeoul ? "서울" : "전국"})`);
    return {
      hasBusStop: false,
      nearestStop: null,
      stopCount: 0,
      stopsInRadius: [],
      totalRouteCount: 0,
    };
  }

  // 노선 수가 가장 많은 정류소를 대표로 선택.
  // 9m 거리 차이보다 노선 수(3개 vs 8개)가 접근성 지표로 훨씬 중요.
  const stopsWithRoutes = stations.filter((s) => s.routeCount > 0);
  const primaryStop =
    stopsWithRoutes.length > 0
      ? stopsWithRoutes.reduce((best, cur) =>
          cur.routeCount > best.routeCount ? cur : best,
        )
      : stations[0];

  console.log(
    `[버스] 반경 ${params.radius}m 내 정류소 ${stations.length}건 — 대표: ${primaryStop.name}(${primaryStop.distanceMeters}m), ${primaryStop.routeCount}개 노선`,
  );

  return {
    hasBusStop: true,
    nearestStop: primaryStop,
    stopCount: stations.length,
    stopsInRadius: stations.map((s) => ({
      name: s.name,
      distance: s.distanceMeters,
      latitude: s.latitude,
      longitude: s.longitude,
    })),
    totalRouteCount: primaryStop.routeCount,
  };
}
