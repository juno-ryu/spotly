import type { Grade } from "../../scoring/types";
import { scoreToGrade } from "../../scoring/types";
import type { SubwayAnalysis } from "../../../../../server/data-sources/subway/adapter";
import type { InsightData, InsightItem } from "../types";

/** 지하철 접근성 등급 산출 */
export function calcSubwayGrade(subway: SubwayAnalysis): { score: number; grade: Grade } {
  const distanceScore = (() => {
    const d = subway.nearestStation?.distanceMeters ?? Infinity;
    if (d <= 200) return 100;
    if (d <= 300) return 85;
    if (d <= 500) return 65;
    if (d <= 1000) return 35;
    return 0;
  })();

  const trafficScore = (() => {
    const t = subway.nearestStation?.dailyAvgTotal ?? 0;
    if (t >= 150_000) return 100;
    if (t >= 80_000) return 80;
    if (t >= 40_000) return 60;
    if (t >= 15_000) return 40;
    if (t >= 5_000) return 20;
    return 0;
  })();

  const score = Math.round(distanceScore * 0.5 + trafficScore * 0.5);
  return { score, ...scoreToGrade(score) };
}


/** 역세권 관련 인사이트 규칙 */
export function subwayRules(data: InsightData): InsightItem[] {
  const subway = data.subway;
  if (!subway) return [];

  const { grade } = calcSubwayGrade(subway);
  const items: InsightItem[] = [];

  const nearest = subway.nearestStation;
  const stationCount = subway.stationsInRadius.length;

  // 팩트 수치: 역명(호선) 거리 · 일평균 이용객
  const emoji = grade === "A" || grade === "B" ? "🚇" : "🗺️";
  if (nearest) {
    items.push({
      type: "text",
      emoji,
      text: `${nearest.stationName}(${nearest.lineName}) ${nearest.distanceMeters}m · 일평균 ${(nearest.dailyAvgTotal / 10000).toFixed(1)}만명`,
      sub: stationCount > 1 ? `반경 내 지하철역 ${stationCount}개` : undefined,
      category: "scoring",
    });
  } else {
    items.push({
      type: "text",
      emoji,
      text: `반경 내 지하철역 ${stationCount}개`,
      sub: undefined,
      category: "scoring",
    });
  }

  return items;
}
