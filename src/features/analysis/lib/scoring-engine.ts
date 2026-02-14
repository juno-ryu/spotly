import type { ScoreBreakdown } from "../schema";
import {
  SCORING_WEIGHTS,
  VITALITY_THRESHOLDS,
  COMPETITION_BASE_DENSITY,
  SURVIVAL_THRESHOLDS,
  RESIDENTIAL_THRESHOLDS,
  NATIONAL_AVG_APT_PRICE,
} from "../constants/scoring";
import type { AggregatedData } from "./data-aggregator";

/** 스코어 계산 결과 */
export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
}

/** 선형 보간: min~max 범위를 0~maxScore로 정규화 */
function normalize(
  value: number,
  min: number,
  max: number,
  maxScore: number,
): number {
  if (value <= min) return 0;
  if (value >= max) return maxScore;
  return Math.round(((value - min) / (max - min)) * maxScore * 10) / 10;
}

/**
 * 상권 활력도 (0~30): 복합 지표
 * 1. 신규 창업 비율 (30%): 최근 2년 내 가입(개업) 사업장 비율
 * 2. 평균 직원 규모 (40%): 활성 사업장의 평균 직원수
 * 3. 활성 비율 (30%): 전체 대비 활성 사업장 비율
 */
function calculateVitality(
  businesses: AggregatedData["businesses"],
): number {
  if (businesses.length === 0) return SCORING_WEIGHTS.VITALITY * 0.5;

  const maxScore = SCORING_WEIGHTS.VITALITY;
  const { NEW_BIZ_WEIGHT, AVG_EMPLOYEE_WEIGHT, ACTIVE_RATIO_WEIGHT, MAX_AVG_EMPLOYEES, NEW_BIZ_MONTHS } = VITALITY_THRESHOLDS;

  // (1) 신규 창업 비율: adptDt가 최근 N개월 이내
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - NEW_BIZ_MONTHS);
  const cutoffStr = `${cutoffDate.getFullYear()}${String(cutoffDate.getMonth() + 1).padStart(2, "0")}01`;

  const bizWithDate = businesses.filter((b) => b.adptDt);
  const newBizCount = bizWithDate.filter((b) => (b.adptDt ?? "") >= cutoffStr).length;
  const newBizRatio = bizWithDate.length > 0 ? newBizCount / bizWithDate.length : 0;
  // 신규 비율 50% 이상이면 만점
  const newBizScore = Math.min(newBizRatio / 0.5, 1) * maxScore * NEW_BIZ_WEIGHT;

  // (2) 평균 직원 규모: 활성 사업장만
  const activeWithEmployees = businesses.filter((b) => b.status === "active" && b.employeeCount > 0);
  const avgEmployees = activeWithEmployees.length > 0
    ? activeWithEmployees.reduce((sum, b) => sum + b.employeeCount, 0) / activeWithEmployees.length
    : 0;
  const employeeScore = Math.min(avgEmployees / MAX_AVG_EMPLOYEES, 1) * maxScore * AVG_EMPLOYEE_WEIGHT;

  // (3) 활성 비율
  const activeCount = businesses.filter((b) => b.status === "active").length;
  const activeRatio = businesses.length > 0 ? activeCount / businesses.length : 0;
  const activeScore = activeRatio * maxScore * ACTIVE_RATIO_WEIGHT;

  return Math.round((newBizScore + employeeScore + activeScore) * 10) / 10;
}

/** 경쟁 강도 (0~25, 역비례): 밀도 낮을수록 높은 점수 */
function calculateCompetition(
  businessCount: number,
  radiusM: number,
  industryCode: string,
): number {
  const radiusKm = radiusM / 1000;
  const areaKm2 = Math.PI * radiusKm * radiusKm;
  const density = businessCount / areaKm2;

  const baseDensity =
    COMPETITION_BASE_DENSITY[industryCode] ??
    COMPETITION_BASE_DENSITY.default;

  // 밀도 0 → 만점, 기준밀도 2배 → 0점 (역비례)
  const maxDensity = baseDensity * 2;
  const score = normalize(
    maxDensity - density,
    0,
    maxDensity,
    SCORING_WEIGHTS.COMPETITION,
  );

  return score;
}

/** 생존율 (0~20): 활성/(활성+폐업) */
function calculateSurvival(
  activeCount: number,
  closedCount: number,
): number {
  const total = activeCount + closedCount;
  if (total === 0) return SCORING_WEIGHTS.SURVIVAL * 0.5;

  const survivalRate = activeCount / total;

  return normalize(
    survivalRate,
    SURVIVAL_THRESHOLDS.MIN_RATE,
    SURVIVAL_THRESHOLDS.MAX_RATE,
    SCORING_WEIGHTS.SURVIVAL,
  );
}

/** 주거 밀도 (0~15): 아파트 거래 + 인구 데이터 복합 지표 */
function calculateResidential(
  transactionCount: number,
  population?: {
    totalPopulation: number;
    households: number;
  },
): number {
  const maxScore = SCORING_WEIGHTS.RESIDENTIAL;

  const transactionScore = normalize(
    transactionCount,
    RESIDENTIAL_THRESHOLDS.MIN_TRANSACTIONS,
    RESIDENTIAL_THRESHOLDS.MAX_TRANSACTIONS,
    maxScore,
  );

  // KOSIS 데이터 없으면 기존 로직 100% 사용
  if (!population) return transactionScore;

  // 세대수 기반 점수 (5천~15만 세대 구간)
  const householdScore = normalize(
    population.households,
    5000,
    150000,
    maxScore,
  );

  // 인구수 기반 점수 (1만~50만 명 구간)
  const populationScore = normalize(
    population.totalPopulation,
    10000,
    500000,
    maxScore,
  );

  // 복합 지표: 거래 건수 40% + 세대수 35% + 인구수 25%
  const combined =
    transactionScore * 0.4 +
    householdScore * 0.35 +
    populationScore * 0.25;

  return Math.round(combined * 10) / 10;
}

/** 소득 수준 (0~10): 아파트 평균 거래가 / 전국 평균 */
function calculateIncome(avgAptPrice: number): number {
  if (avgAptPrice === 0) return SCORING_WEIGHTS.INCOME * 0.5;

  const ratio = avgAptPrice / NATIONAL_AVG_APT_PRICE;
  // 0.5배 → 0점, 2배 → 만점
  return normalize(ratio, 0.5, 2.0, SCORING_WEIGHTS.INCOME);
}

/**
 * 골목상권 보정 팩터 적용 (서울 한정)
 * 가중치는 변경하지 않고, 기존 지표를 골목상권 데이터로 보정
 *
 * 상권변화지표 등급 해석 (가이드 기준):
 * - HH: 생존·폐업 모두 높음 (안정적이나 경쟁 치열) → 소폭 보너스
 * - LH: 생존 낮음·폐업 높음 (신규 업체에 유리) → 보너스
 * - HL: 생존 높음·폐업 낮음 (기존 업체 강함) → 보정 없음
 * - LL: 생존·폐업 모두 낮음 (신규/재생 상권) → 보정 없음
 */
function applyGolmokCorrection(
  breakdown: ScoreBreakdown,
  golmok: AggregatedData["golmok"],
): ScoreBreakdown {
  if (!golmok) return breakdown;

  const corrected = { ...breakdown };

  // 활력도 보정: HH(안정적 경쟁) 또는 LH(신규에 유리)이면 보너스
  if (golmok.changeIndex === "HH" || golmok.changeIndex === "LH") {
    const bonus = golmok.changeIndex === "LH" ? 0.1 : 0.05;
    corrected.vitality = Math.min(
      SCORING_WEIGHTS.VITALITY,
      Math.round(corrected.vitality * (1 + bonus) * 10) / 10,
    );
  }

  // 생존율 보정: 골목상권 폐업률과 NTS 기반 생존율 가중 평균
  if (golmok.closeRate > 0) {
    // 골목상권 폐업률을 생존율로 변환 (100 - 폐업률%)하여 정규화
    const golmokSurvivalRate = (100 - golmok.closeRate) / 100;
    const ntsBasedRate = corrected.survival / SCORING_WEIGHTS.SURVIVAL;
    // NTS 70% + 골목상권 30% 가중 평균
    const blendedRate = ntsBasedRate * 0.7 + golmokSurvivalRate * 0.3;
    corrected.survival = Math.round(
      blendedRate * SCORING_WEIGHTS.SURVIVAL * 10,
    ) / 10;
  }

  return corrected;
}

/** 종합 점수 계산 */
export function calculateTotalScore(data: AggregatedData): ScoreResult {
  const vitality = calculateVitality(data.businesses);

  const activeCount = data.businesses.filter(
    (b) => b.status === "active",
  ).length;
  const closedCount = data.businesses.filter(
    (b) => b.status === "closed",
  ).length;

  const competition = calculateCompetition(
    data.businesses.length,
    data.radius,
    data.industryCode,
  );
  const survival = calculateSurvival(activeCount, closedCount);
  const residential = calculateResidential(data.transactionCount, data.population);
  const income = calculateIncome(data.avgApartmentPrice);

  let breakdown: ScoreBreakdown = {
    vitality: Math.round(vitality * 10) / 10,
    competition: Math.round(competition * 10) / 10,
    survival: Math.round(survival * 10) / 10,
    residential: Math.round(residential * 10) / 10,
    income: Math.round(income * 10) / 10,
  };

  // 골목상권 보정 적용 (서울 한정)
  breakdown = applyGolmokCorrection(breakdown, data.golmok);

  const total = Math.round(
    (breakdown.vitality +
      breakdown.competition +
      breakdown.survival +
      breakdown.residential +
      breakdown.income) *
      10,
  ) / 10;

  return { total, breakdown };
}
