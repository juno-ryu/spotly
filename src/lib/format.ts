/**
 * 반경(m) → 사용자 친화적 라벨 (예: 500m, 1.5km, 1km).
 * 1000m 이상은 km 단위 + 소수 1자리, 정수일 때 .0 생략.
 */
export function formatRadius(radius: number): string {
  if (radius < 1000) return `${radius}m`;
  return `${(radius / 1000).toFixed(1).replace(/\.0$/, "")}km`;
}
