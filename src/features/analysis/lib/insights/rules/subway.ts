import type { InsightData, InsightItem } from "../types";

/** 역세권 관련 인사이트 규칙 */
export function subwayRules(data: InsightData): InsightItem[] {
  const items: InsightItem[] = [];
  const subway = data.subway;

  if (!subway) return items;

  if (subway.isStationArea) {
    if (subway.nearestStation) {
      // nearestStation 데이터 있음: 역명 + 승하차 인원 표시
      const { stationName, lineName, dailyAvgTotal, distanceMeters } =
        subway.nearestStation;
      const formatted = dailyAvgTotal.toLocaleString();

      items.push({
        type: "text",
        emoji: "🚇",
        text: `역세권 입지: ${stationName}역(${lineName}) ${distanceMeters}m`,
        sub: `일평균 승하차 ${formatted}명 — 유동인구 유입 기대`,
        category: "fact",
      });

      // 대형역 (일평균 10만명 이상)
      if (dailyAvgTotal >= 100_000) {
        items.push({
          type: "text",
          emoji: "🔥",
          text: "대형 역세권으로 높은 유동인구 확보",
          sub: `${stationName}역은 일평균 ${formatted}명이 이용하는 주요 역입니다`,
          category: "scoring",
        });
      }
    } else {
      // 역세권이지만 승하차 데이터 없음 (API 실패 등)
      const nearest = subway.stationsInRadius[0];
      items.push({
        type: "text",
        emoji: "🚇",
        text: `역세권 입지: ${nearest?.name ?? "인근 지하철역"} ${nearest?.distance ?? ""}m`,
        sub: "유동인구 데이터를 불러올 수 없지만 역세권 입지입니다",
        category: "fact",
      });
    }
  } else {
    // 비역세권
    if (subway.stationsInRadius.length === 0) {
      items.push({
        type: "text",
        emoji: "🚶",
        text: "반경 500m 내 지하철역 없음",
        sub: "대중교통 접근성이 낮아 도보 유입이 제한될 수 있습니다",
        category: "fact",
      });
    }
  }

  return items;
}
