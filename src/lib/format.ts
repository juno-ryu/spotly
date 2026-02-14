/** 반경(m) → 사용자 친화적 라벨 (예: 500m, 1.5km) */
export function formatRadius(radius: number): string {
  return radius >= 1000 ? `${radius / 1000}km` : `${radius}m`;
}
