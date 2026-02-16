/** 두 좌표 사이 거리 계산 (미터) — Haversine 공식 */
export function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 중심점에서 남쪽으로 주어진 거리만큼 떨어진 좌표 (드래그 핸들 위치) */
export function getPointAtDistance(
  centerLat: number,
  centerLng: number,
  distanceMeters: number,
): { lat: number; lng: number } {
  const dLat = -distanceMeters / 111320;
  return { lat: centerLat + dLat, lng: centerLng };
}

/** 반경을 50m 단위로 스냅 + 100~3000m 클램프 */
export function snapRadius(meters: number): number {
  const snapped = Math.round(meters / 50) * 50;
  return Math.max(100, Math.min(3000, snapped));
}
