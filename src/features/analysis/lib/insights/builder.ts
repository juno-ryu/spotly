import type { InsightData, InsightItem, InsightRule } from "./types";
import { competitionRules } from "./rules/competition";
import { populationRules } from "./rules/population";

/** 등록된 룰 목록 — 새 룰 추가 시 여기에 push */
const ALL_RULES: InsightRule[] = [competitionRules, populationRules];

/** 모든 룰을 실행하여 인사이트 목록 생성 */
export function buildInsights(data: InsightData): InsightItem[] {
  return ALL_RULES.flatMap((rule) => rule(data));
}
