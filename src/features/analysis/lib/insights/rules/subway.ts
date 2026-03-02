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

/** 지하철 등급별 해석 텍스트 */
export const SUBWAY_GRADE_TEXT: Record<Grade, { emoji: string; text: string }> = {
  A: { emoji: "🚇", text: "지하철 접근성이 매우 뛰어나요" },
  B: { emoji: "🚇", text: "지하철로 편하게 접근할 수 있어요" },
  C: { emoji: "🚉", text: "지하철 이용이 가능한 거리예요" },
  D: { emoji: "🚶", text: "지하철역이 다소 먼 편이에요" },
  F: { emoji: "🚶", text: "지하철 접근이 어려운 입지예요" },
};

/** 역세권 관련 인사이트 규칙 */
export function subwayRules(data: InsightData): InsightItem[] {
  const subway = data.subway;
  if (!subway) return [];

  const { score, grade } = calcSubwayGrade(subway);
  const { emoji, text } = SUBWAY_GRADE_TEXT[grade];
  const items: InsightItem[] = [];

  // 등급 기반 스코어링 인사이트 (역 없음 = F등급이므로 항상 출력)
  const nearest = subway.nearestStation;
  const sub = nearest
    ? `${nearest.stationName}(${nearest.lineName}) ${nearest.distanceMeters}m · 일평균 ${(nearest.dailyAvgTotal / 10000).toFixed(1)}만명`
    : subway.stationsInRadius[0]
      ? `${subway.stationsInRadius[0].name} ${subway.stationsInRadius[0].distance}m`
      : "반경 내 지하철역 없음";

  items.push({
    type: "text",
    emoji,
    text,
    sub,
    category: "scoring",
  });

  return items;
}
