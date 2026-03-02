import type { InsightData, InsightItem } from "../types";

/** 버스 접근성 관련 인사이트 규칙 */
/** "해운대구2" → "2번", "115-1" → "115-1번" */
function formatRouteNo(raw: string): string {
  const stripped = raw.replace(/^[가-힣]+/, "").trim();
  return stripped ? `${stripped}번` : raw;
}

export function busRules(data: InsightData): InsightItem[] {
  const items: InsightItem[] = [];
  const bus = data.bus;

  if (!bus) return items;

  if (bus.hasBusStop) {
    if (bus.nearestStop) {
      const { name, distanceMeters, routeCount, routes } = bus.nearestStop;

      const formatted = routes.map(formatRouteNo);
      const routeLabel =
        routeCount > 0
          ? formatted.slice(0, 5).join(", ") +
            (routeCount > 5 ? ` 외 ${routeCount - 5}개` : "")
          : null;

      items.push({
        type: "text",
        emoji: "\uD83D\uDE8C",
        text: `버스 정류장: ${name} ${distanceMeters}m (${routeCount}개 노선)`,
        sub: routeLabel ? `운행 노선: ${routeLabel}` : "대중교통 접근성 양호",
        category: "fact",
      });

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
