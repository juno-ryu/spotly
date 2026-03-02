import type { InsightData, InsightItem } from "../types";

/** 버스 접근성 관련 인사이트 규칙 */
export function busRules(data: InsightData): InsightItem[] {
  const items: InsightItem[] = [];
  const bus = data.bus;

  if (!bus) return items;

  if (bus.hasBusStop) {
    if (bus.nearestStop) {
      // 가장 가까운 정류장 데이터 있음 (TAGO 기반: 노선 수만 제공)
      const { name, distanceMeters, routeCount } = bus.nearestStop;

      items.push({
        type: "text",
        emoji: "\uD83D\uDE8C",
        text: `버스 정류장: ${name} ${distanceMeters}m (${routeCount}개 노선)`,
        sub: "대중교통 접근성 양호",
        category: "fact",
      });

      // 정류장 다수 (5개 이상)
      if (bus.stopCount >= 5) {
        items.push({
          type: "text",
          emoji: "\uD83D\uDE8F",
          text: `반경 내 버스 정류장 ${bus.stopCount}개 밀집`,
          sub: "다양한 노선이 경유하여 접근성이 높습니다",
          category: "fact",
        });
      }
    } else {
      // 정류장은 있지만 상세 데이터 없음
      const nearest = bus.stopsInRadius[0];
      items.push({
        type: "text",
        emoji: "\uD83D\uDE8C",
        text: `버스 정류장: ${nearest?.name ?? "인근 정류장"} ${nearest?.distance ?? ""}m`,
        sub: `반경 내 정류장 ${bus.stopCount}개 — 대중교통 접근 가능`,
        category: "fact",
      });
    }
  } else {
    // 반경 내 버스 정류장 없음
    items.push({
      type: "text",
      emoji: "\uD83D\uDE8C",
      text: "반경 500m 내 버스 정류장 없음",
      sub: "대중교통(버스) 접근성이 낮습니다",
      category: "fact",
    });
  }

  return items;
}
