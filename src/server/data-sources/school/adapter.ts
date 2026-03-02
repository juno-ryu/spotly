import { prisma } from "@/server/db/prisma";
import { SCHOOL_RADIUS } from "@/features/analysis/lib/constants";

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

/** 도(degree) → 라디안 변환 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine 공식으로 두 좌표 간 거리(미터) 계산
 * 지구 반경 6371km 기준
 */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  const { latitude, longitude } = params;

  const MAX_RADIUS = SCHOOL_RADIUS.HIGH;

  // bounding box pre-filter — 최대 반경(고등학교 1500m) 기준으로 인덱스 활용
  const latDelta = MAX_RADIUS / 111_000;
  const lngDelta = MAX_RADIUS / (111_000 * Math.cos(toRad(latitude)));

  const candidates = await prisma.school.findMany({
    where: {
      lat: { gte: latitude - latDelta, lte: latitude + latDelta },
      lng: { gte: longitude - lngDelta, lte: longitude + lngDelta },
    },
    select: { name: true, level: true, lat: true, lng: true, address: true },
  });

  // 각 학교에 거리 계산 후 학교급별 반경 필터 적용
  const withDistance = candidates.map(
    (s): SchoolItem & { radiusLimit: number } => {
      const level = s.level as SchoolItem["level"];
      const radiusLimit =
        level === "초등학교"
          ? SCHOOL_RADIUS.ELEMENTARY
          : level === "중학교"
            ? SCHOOL_RADIUS.MIDDLE
            : SCHOOL_RADIUS.HIGH;
      return {
        name: s.name,
        level,
        distanceMeters: Math.round(
          haversineMeters(latitude, longitude, s.lat, s.lng),
        ),
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        radiusLimit,
      };
    },
  );

  const inRadius: SchoolItem[] = withDistance
    .filter((s) => s.distanceMeters <= s.radiusLimit)
    .map(({ radiusLimit: _r, ...rest }) => rest)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const elementaryCount = inRadius.filter((s) => s.level === "초등학교").length;
  const middleCount = inRadius.filter((s) => s.level === "중학교").length;
  const highCount = inRadius.filter((s) => s.level === "고등학교").length;

  console.log(
    `[학교 DB] 초(500m) ${elementaryCount}건 / 중(1000m) ${middleCount}건 / 고(1500m) ${highCount}건`,
  );

  return {
    elementaryCount,
    middleCount,
    highCount,
    totalCount: inRadius.length,
    schools: inRadius,
  };
}
