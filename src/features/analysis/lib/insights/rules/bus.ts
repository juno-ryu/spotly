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

/** 버스 등급별 해석 텍스트 */
export const BUS_GRADE_TEXT: Record<Grade, { emoji: string; text: string }> = {
  A: { emoji: "🚌", text: "버스 교통이 매우 편리해요" },
  B: { emoji: "🚌", text: "버스 이용이 수월한 입지예요" },
  C: { emoji: "🚏", text: "버스 접근성이 보통이에요" },
  D: { emoji: "🚏", text: "버스 이용이 다소 불편할 수 있어요" },
  F: { emoji: "🚏", text: "버스 접근이 어려운 입지예요" },
};

/** 버스 접근성 관련 인사이트 규칙 */
/** "해운대구2" → "2번", "115-1" → "115-1번" */
function formatRouteNo(raw: string): string {
  const stripped = raw.replace(/^[가-힣]+/, "").trim();
  return stripped ? `${stripped}번` : raw;
}

export function busRules(data: InsightData): InsightItem[] {
  const bus = data.bus;
  if (!bus) return [];

  const { score, grade } = calcBusGrade(bus);
  const { emoji, text } = BUS_GRADE_TEXT[grade];
  const items: InsightItem[] = [];

  // 등급 기반 스코어링 인사이트
  const nearest = bus.nearestStop;
  let sub: string;
  if (nearest) {
    const formatted = nearest.routes.map(formatRouteNo);
    const routeLabel =
      nearest.routeCount > 0
        ? formatted.slice(0, 5).join(", ") +
          (nearest.routeCount > 5 ? ` 외 ${nearest.routeCount - 5}개` : "")
        : null;
    sub = `${nearest.name} ${nearest.distanceMeters}m · ${nearest.routeCount}개 노선${routeLabel ? ` (${routeLabel})` : ""}`;
  } else {
    sub = `반경 내 정류장 ${bus.stopCount}개`;
  }

  items.push({
    type: "text",
    emoji,
    text,
    sub,
    category: "scoring",
  });

  return items;
}
