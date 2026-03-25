import { prisma } from "@/server/db/prisma";
import { getDistanceMeters } from "@/lib/geo-utils";

/** 반경 내 학교 단일 항목 */
export interface SchoolItem {
  name: string;
  level: "초등학교" | "중학교" | "고등학교";
  distanceMeters: number;
  address: string;
  lat: number;
  lng: number;
}

/** 학교 접근성 분석 결과 */
export interface SchoolAnalysis {
  /** 반경 내 초등학교 수 */
  elementaryCount: number;
  /** 반경 내 중학교 수 */
  middleCount: number;
  /** 반경 내 고등학교 수 */
  highCount: number;
  /** 전체 학교 수 */
  totalCount: number;
  /** 반경 내 학교 목록 (거리순) */
  schools: SchoolItem[];
}


/**
 * 좌표 기준 반경 내 학교 분석.
 *
 * 1단계: 위경도 범위로 DB pre-filter (인덱스 활용)
 * 2단계: Haversine 정밀 필터 (앱 레벨)
 * 전국 학교 수 ~12,000개라 pre-filter 후 앱 레벨 Haversine 가능
 */
export async function fetchSchoolAnalysis(params: {
  latitude: number;
  longitude: number;
  radius: number;
}): Promise<SchoolAnalysis> {
  const { latitude, longitude, radius } = params;

  // bounding box pre-filter — 인덱스 활용
  const latDelta = radius / 111_000;
  const lngDelta = radius / (111_000 * Math.cos((latitude * Math.PI) / 180));

  const candidates = await prisma.school.findMany({
    where: {
      lat: { gte: latitude - latDelta, lte: latitude + latDelta },
      lng: { gte: longitude - lngDelta, lte: longitude + lngDelta },
    },
    select: { name: true, level: true, lat: true, lng: true, address: true },
  });

  // Haversine 정밀 필터 — 사용자 선택 반경 기준
  const inRadius: SchoolItem[] = candidates
    .map(
      (s): SchoolItem => ({
        name: s.name,
        level: s.level as SchoolItem["level"],
        distanceMeters: Math.round(
          getDistanceMeters(latitude, longitude, s.lat, s.lng),
        ),
        address: s.address,
        lat: s.lat,
        lng: s.lng,
      }),
    )
    .filter((s) => s.distanceMeters <= radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const elementaryCount = inRadius.filter((s) => s.level === "초등학교").length;
  const middleCount = inRadius.filter((s) => s.level === "중학교").length;
  const highCount = inRadius.filter((s) => s.level === "고등학교").length;

  console.log(
    `[학교 DB] 반경 ${radius}m — 초 ${elementaryCount}건 / 중 ${middleCount}건 / 고 ${highCount}건`,
  );

  return {
    elementaryCount,
    middleCount,
    highCount,
    totalCount: inRadius.length,
    schools: inRadius,
  };
}
