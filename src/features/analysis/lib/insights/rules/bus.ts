import type { Grade } from "../../scoring/types";
import { scoreToGrade } from "../../scoring/types";
import type { BusAnalysis } from "../../../../../server/data-sources/bus/adapter";
import type { InsightData, InsightItem } from "../types";

/** 버스 접근성 등급 산출 */
export function calcBusGrade(bus: BusAnalysis): { score: number; grade: Grade } {
  const distanceScore = (() => {
    const d = bus.nearestStop?.distanceMeters ?? Infinity;
    if (d <= 100) return 100;
    if (d <= 200) return 80;
    if (d <= 300) return 60;
    if (d <= 500) return 35;
    return 0;
  })();

  const routeScore = (() => {
    const r = bus.nearestStop?.routeCount ?? 0;
    if (r >= 10) return 100;
    if (r >= 7) return 80;
    if (r >= 4) return 60;
    if (r >= 2) return 40;
    if (r >= 1) return 20;
    return 0;
  })();

  const densityScore = (() => {
    const s = bus.stopCount;
    if (s >= 8) return 100;
    if (s >= 5) return 75;
    if (s >= 3) return 50;
    if (s >= 1) return 25;
    return 0;
  })();

  const score = Math.round(distanceScore * 0.4 + routeScore * 0.35 + densityScore * 0.25);
  return { score, ...scoreToGrade(score) };
}


/** 버스 접근성 관련 인사이트 규칙 */
/** "해운대구2" → "2번", "115-1" → "115-1번" */
function formatRouteNo(raw: string): string {
  const stripped = raw.replace(/^[가-힣]+/, "").trim();
  return stripped ? `${stripped}번` : raw;
}

export function busRules(data: InsightData): InsightItem[] {
  const bus = data.bus;
  if (!bus) return [];

  // 배달 업종은 교통 접근성이 매출에 무관 → 섹션 숨김
  const isDeliveryOnly = data.industryName.includes("배달");
  if (isDeliveryOnly) return [];

  const { grade } = calcBusGrade(bus);
  const items: InsightItem[] = [];

  // 팩트 수치: 정류장명 거리 · 노선 수 (노선번호)
  const nearest = bus.nearestStop;
  if (nearest) {
    const formatted = nearest.routes.map(formatRouteNo);
    const routeLabel =
      nearest.routeCount > 0
        ? formatted.slice(0, 5).join(", ") +
          (nearest.routeCount > 5 ? ` 외 ${nearest.routeCount - 5}개` : "")
        : null;
    const emoji = grade === "A" || grade === "B" ? "🚌" : "🚏";
    items.push({
      type: "text",
      emoji,
      text: `${nearest.name} ${nearest.distanceMeters}m · ${nearest.routeCount}개 노선`,
      sub: routeLabel ? `(${routeLabel})` : undefined,
      category: "scoring",
    });
  } else {
    items.push({
      type: "text",
      emoji: "🚏",
      text: `반경 내 정류장 ${bus.stopCount}개`,
      sub: undefined,
      category: "scoring",
    });
  }

  return items;
}
