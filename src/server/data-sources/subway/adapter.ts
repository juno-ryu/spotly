import { searchByKeyword } from "@/server/data-sources/kakao/client";
import type { Coordinate } from "@/server/data-sources/types";
import {
  aggregateDailyTraffic,
  getSubwayDailyTraffic,
  normalizeStationName,
  type SubwayTrafficData,
} from "./client";

/** 역세권 판정 반경 (미터) */
const STATION_RADIUS = 500;

/** 역세권 분석 결과 */
export interface SubwayAnalysis {
  /** 역세권 여부 (500m 이내 지하철역 존재) */
  isStationArea: boolean;
  /** 가장 가까운 역 정보 (역세권일 때만) */
  nearestStation: SubwayTrafficData | null;
  /** 반경 내 모든 역 목록 */
  stationsInRadius: Array<{
    name: string;
    distance: number;
    /** 카카오 검색 결과 위도 */
    latitude: number;
    /** 카카오 검색 결과 경도 */
    longitude: number;
  }>;
}

/**
 * 좌표 기반 역세권 분석
 *
 * 1. 카카오 키워드 검색으로 반경 내 지하철역 탐색 (SW8 카테고리)
 * 2. 가장 가까운 역의 승하차 데이터 조회
 * 3. 일평균 승하차 인원 집계
 */
export async function fetchSubwayAnalysis(params: {
  latitude: number;
  longitude: number;
}): Promise<SubwayAnalysis> {
  const coordinate: Coordinate = {
    latitude: params.latitude,
    longitude: params.longitude,
  };

  // 1단계: 카카오 키워드 검색으로 반경 내 지하철역 탐색
  // category_group_code SW8 = 지하철역
  const result = await searchByKeyword(
    "지하철역",
    coordinate,
    STATION_RADIUS,
    1,
  );

  // SW8(지하철역) 카테고리만 필터
  const subwayPlaces = result.documents.filter(
    (doc) => doc.category_group_code === "SW8",
  );

  if (subwayPlaces.length === 0) {
    console.log("[지하철] 반경 500m 이내 지하철역 없음 → 비역세권");
    return {
      isStationArea: false,
      nearestStation: null,
      stationsInRadius: [],
    };
  }

  // 거리순 정렬 (카카오 Places의 y=위도, x=경도 저장)
  const sorted = subwayPlaces
    .map((p) => ({
      name: p.place_name,
      distance: Number(p.distance) || 0,
      latitude: parseFloat(p.y),
      longitude: parseFloat(p.x),
    }))
    .sort((a, b) => a.distance - b.distance);

  console.log(
    `[지하철] 반경 내 역 ${sorted.length}개: ${sorted.map((s) => `${s.name}(${s.distance}m)`).join(", ")}`,
  );

  // 2단계: 가장 가까운 역의 승하차 데이터 조회
  const nearest = sorted[0];
  const normalizedName = normalizeStationName(nearest.name);

  let nearestStation: SubwayTrafficData | null = null;
  try {
    const dailyRows = await getSubwayDailyTraffic(normalizedName);
    nearestStation = aggregateDailyTraffic(
      dailyRows,
      normalizedName,
      nearest.distance,
    );

    if (nearestStation) {
      console.log(
        `[지하철] ${normalizedName}역: 일평균 승하차 ${nearestStation.dailyAvgTotal.toLocaleString()}명 (${nearestStation.days}일 집계)`,
      );
    }
  } catch (err) {
    console.warn(`[지하철] ${normalizedName}역 승하차 데이터 조회 실패:`, err);
  }

  return {
    isStationArea: true,
    nearestStation,
    stationsInRadius: sorted,
  };
}
