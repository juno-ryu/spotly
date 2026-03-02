import type { InsightData, InsightItem, InsightRule } from "./types";
import { competitionRules } from "./rules/competition";
import { populationRules } from "./rules/population";
import { subwayRules } from "./rules/subway";
import { busRules } from "./rules/bus";
import { schoolRules } from "./rules/school";
import { universityRules } from "./rules/university";
import { medicalRules } from "./rules/medical";

/** 등록된 룰 목록 — 새 룰 추가 시 여기에 push */
const ALL_RULES: InsightRule[] = [competitionRules, populationRules, subwayRules, busRules, schoolRules, universityRules, medicalRules];

/** 모든 룰을 실행하여 인사이트 목록 생성 */
export function buildInsights(data: InsightData): InsightItem[] {
  return [...ALL_RULES.flatMap((rule) => rule(data)), ...combinedRiskInsights(data)];
}

/**
 * 위험 신호 조합 패턴 감지 — 복수의 지표가 동시에 나쁜 경우 명시적 경고
 *
 * 단일 지표 인사이트로는 포착되지 않는 복합 위험 패턴을 감지한다.
 * 각 패턴은 독립적으로 평가되며 해당하는 경우 모두 반환된다.
 */
export function combinedRiskInsights(data: InsightData): InsightItem[] {
  const items: InsightItem[] = [];
  const vitality = data.vitality;
  const competition = data.competition;
  const population = data.population;
  const subway = data.subway;
  const bus = data.bus;

  // 1. 유령 상권: 유동인구 낮음 + 추정매출 매우 낮음 + 폐업률 높음
  // 상권이 사실상 침체 상태 — 신규 입점 시 생존 가능성 매우 낮음
  if (vitality) {
    const d = vitality.details;
    const hasLowFootTraffic = vitality.footTrafficScore < 30;
    const hasLowSales = d.salesPerStore > 0 && vitality.salesScore < 20;
    const hasHighCloseRate = d.closeRate > 8;

    if (hasLowFootTraffic && hasLowSales && hasHighCloseRate) {
      items.push({
        type: "text",
        emoji: "🚨",
        text: "유령 상권 위험 신호",
        sub: `유동인구 낮음 + 점포당 매출 매우 낮음 + 분기 폐업률 ${d.closeRate.toFixed(1)}% — 상권이 사실상 침체 상태입니다. 신규 입점을 신중히 검토하세요`,
        category: "fact",
      });
    }
  }

  // 2. 레드오션: 경쟁점수 매우 낮음(경쟁 과포화) + 프랜차이즈 비율 60% 초과
  // 대형 브랜드가 장악한 지역 — 개인 매장 생존이 어려운 구조
  if (competition) {
    const isOverCrowded = (competition.competitionScore?.score ?? 100) < 20;
    const isFranchiseDominated = competition.franchiseRatio > 60;

    if (isOverCrowded && isFranchiseDominated) {
      items.push({
        type: "text",
        emoji: "🚨",
        text: "레드오션 경고",
        sub: `대형 브랜드(프랜차이즈 ${competition.franchiseRatio.toFixed(0)}%)가 과밀한 지역 — 개인 매장은 가격 경쟁에서 불리합니다`,
        category: "fact",
      });
    }
  }

  // 3. 거품 상권: 개업률 10% 초과 + 폐업률 8% 초과 + 상권변화지표 HL(성숙/축소)
  // 창업 러시 후 대량 폐업이 반복되는 불안정 상권
  if (vitality) {
    const d = vitality.details;
    const isHighOpenRate = d.openRate > 10;
    const isHighCloseRate = d.closeRate > 8;
    // HL = 첫 글자(생존 사업체 영업기간) 높음, 둘째 글자(폐업 사업체 영업기간) 낮음 → 오래된 가게만 살아남는 성숙/축소 상권
    const isHlChange = vitality.details.changeIndexName?.startsWith("HL") ?? false;

    if (isHighOpenRate && isHighCloseRate && isHlChange) {
      items.push({
        type: "text",
        emoji: "⚠️",
        text: "거품 상권 경고",
        sub: `개업률 ${d.openRate.toFixed(1)}% + 폐업률 ${d.closeRate.toFixed(1)}% — 창업 러시 후 대량 폐업이 반복되는 불안정 상권입니다`,
        category: "fact",
      });
    }
  }

  // 4. 수요 부족: 배후인구 5,000명 미만 + 유동인구 10,000명 미만
  // 고객 기반 자체가 부족한 지역 — 어떤 업종이든 기본 수요 확보가 어려움
  if (population) {
    const totalPop = population.details.totalPopulation;
    const isLowResident = totalPop < 5_000;
    const floatingTotal = vitality?.details.floatingPopulation?.totalFloating ?? 0;
    const isLowFloating = floatingTotal > 0 && floatingTotal < 10_000;

    if (isLowResident && isLowFloating) {
      items.push({
        type: "text",
        emoji: "⚠️",
        text: "수요 부족 경고",
        sub: `배후인구 ${totalPop.toLocaleString()}명 + 유동인구 ${(floatingTotal / 10_000).toFixed(1)}만명 — 고객 기반이 매우 부족한 지역입니다`,
        category: "fact",
      });
    }
  }

  // 5. 교통 사각지대: 역세권 아님 + 버스 노선 3개 미만
  // 대중교통으로 접근하기 매우 어려운 입지 — 유동인구 확보에 불리
  const isNotSubwayArea = subway ? !subway.isStationArea : false;
  const busRouteCount = bus?.nearestStop?.routeCount ?? 0;
  const hasLowBusRoute = busRouteCount > 0 && busRouteCount < 3;

  if (isNotSubwayArea && hasLowBusRoute) {
    items.push({
      type: "text",
      emoji: "⚠️",
      text: "교통 사각지대 경고",
      sub: `역세권 아님 + 버스 노선 ${busRouteCount}개 — 대중교통 접근성이 매우 낮습니다. 도보 유동인구 확보에 불리한 입지입니다`,
      category: "fact",
    });
  }

  return items;
}

/** 경쟁강도 지표 인사이트 */
export function buildCompetitionInsights(data: InsightData): InsightItem[] {
  return competitionRules(data);
}

/** 배후 인구 지표 인사이트 */
export function buildPopulationInsights(data: InsightData): InsightItem[] {
  return populationRules(data);
}

/** 지하철 역세권 인사이트 */
export function buildSubwayInsights(data: InsightData): InsightItem[] {
  return subwayRules(data);
}

/** 버스 접근성 인사이트 */
export function buildBusInsights(data: InsightData): InsightItem[] {
  return busRules(data);
}

/** 학교 접근성 인사이트 */
export function buildSchoolInsights(data: InsightData): InsightItem[] {
  return schoolRules(data);
}

/** 대학교 접근성 인사이트 */
export function buildUniversityInsights(data: InsightData): InsightItem[] {
  return universityRules(data);
}

/** 의료시설 접근성 인사이트 */
export function buildMedicalInsights(data: InsightData): InsightItem[] {
  return medicalRules(data);
}
