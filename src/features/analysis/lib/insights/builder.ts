import type { InsightData, InsightItem, InsightRule } from "./types";
import { competitionRules } from "./rules/competition";
import { populationRules } from "./rules/population";

/** 등록된 룰 목록 — 새 룰 추가 시 여기에 push */
const ALL_RULES: InsightRule[] = [competitionRules, populationRules];

/** 모든 룰을 실행하여 인사이트 목록 생성 */
export function buildInsights(data: InsightData): InsightItem[] {
  return ALL_RULES.flatMap((rule) => rule(data));
}

/** 경쟁강도 지표 인사이트 */
export function buildCompetitionInsights(data: InsightData): InsightItem[] {
  return competitionRules(data);
}

/** 상권 활력도 지표 인사이트 */
export function buildVitalityInsights(data: InsightData): InsightItem[] {
  return populationRules(data);
}
