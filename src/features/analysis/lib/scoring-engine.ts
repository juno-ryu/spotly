import type { ScoreBreakdown } from "../schema";
import {
  SCORING_WEIGHTS,
  VITALITY_THRESHOLDS,
  COMPETITION_BASE_DENSITY,
  SURVIVAL_THRESHOLDS,
  RESIDENTIAL_THRESHOLDS,
  NATIONAL_AVG_APT_PRICE,
  NATIONAL_AVG_POP_DENSITY,
  REGIONAL_COEFF_RANGE,
  TRADE_RATE_THRESHOLDS,
  VOLUME_INDEX_THRESHOLDS,
} from "../constants/scoring";
import type { AggregatedData } from "./data-aggregator";

/** 신뢰도 정보 (v2) */
export interface ScoreConfidence {
  /** 종합 신뢰도 (0~1) */
  overall: number;
  /** 지표별 신뢰도 */
  breakdown: {
    vitality: number;
    competition: number;
    survival: number;
    residential: number;
    income: number;
  };
}

/** 스코어 계산 결과 */
export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
  /** 신뢰도 (v2) */
  confidence: ScoreConfidence;
}

/** 선형 보간: min~max 범위를 0~maxScore로 정규화 */
function normalize(
  value: number,
  min: number,
  max: number,
  maxScore: number,
  curve: "linear" | "sigmoid" = "linear",
): number {
  if (value <= min) return 0;
  if (value >= max) return maxScore;

  const ratio = (value - min) / (max - min);

  if (curve === "sigmoid") {
    const k = 6;
    const sigmoid = 1 / (1 + Math.exp(-k * (ratio - 0.5)));
    return Math.round(sigmoid * maxScore * 10) / 10;
  }

  return Math.round(ratio * maxScore * 10) / 10;
}

/**
 * 상권 활력도 (0~30): v2 4-요소 복합 지표
 * 1. 신규 창업 비율 (25%): 최근 2년 내 가입(개업) 사업장 비율
 * 2. 평균 직원 규모 (30%): 활성 사업장의 평균 직원수 (모집단 보정)
 * 3. 활성 비율 (25%): 전체 대비 활성 사업장 비율
 * 4. 추이 모멘텀 (20%): 12개월 순증가/감소 방향
 */
function calculateVitality(data: AggregatedData): number {
  const { businesses, totalBusinessCount, sampledCount, monthlyTrendData } = data;
  if (businesses.length === 0) return SCORING_WEIGHTS.VITALITY * 0.5;

  const maxScore = SCORING_WEIGHTS.VITALITY;
  const { NEW_BIZ_WEIGHT, AVG_EMPLOYEE_WEIGHT, ACTIVE_RATIO_WEIGHT, MOMENTUM_WEIGHT, MAX_AVG_EMPLOYEES, NEW_BIZ_MONTHS } = VITALITY_THRESHOLDS;

  // (1) 신규 창업 비율
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - NEW_BIZ_MONTHS);
  const cutoffStr = `${cutoffDate.getFullYear()}${String(cutoffDate.getMonth() + 1).padStart(2, "0")}01`;

  const bizWithDate = businesses.filter((b) => b.adptDt);
  const newBizCount = bizWithDate.filter((b) => (b.adptDt ?? "") >= cutoffStr).length;
  const newBizRatio = bizWithDate.length > 0 ? newBizCount / bizWithDate.length : 0;
  const newBizScore = Math.min(newBizRatio / 0.5, 1) * maxScore * NEW_BIZ_WEIGHT;

  // (2) 평균 직원 규모 (v2: totalCount 보정)
  const activeWithEmployees = businesses.filter((b) => b.status === "active" && b.employeeCount > 0);
  const sampleAvg = activeWithEmployees.length > 0
    ? activeWithEmployees.reduce((sum, b) => sum + b.employeeCount, 0) / activeWithEmployees.length
    : 0;
  // 샘플이 모집단의 일부일 경우 하향 보정
  const adjustmentFactor = totalBusinessCount > 0
    ? sampledCount / Math.min(totalBusinessCount, 50)
    : 1;
  const adjustedAvg = sampleAvg * Math.min(adjustmentFactor, 1);
  const employeeScore = Math.min(adjustedAvg / MAX_AVG_EMPLOYEES, 1) * maxScore * AVG_EMPLOYEE_WEIGHT;

  // (3) 활성 비율
  const activeCount = businesses.filter((b) => b.status === "active").length;
  const activeRatio = businesses.length > 0 ? activeCount / businesses.length : 0;
  const activeScore = activeRatio * maxScore * ACTIVE_RATIO_WEIGHT;

  // (4) 추이 모멘텀 (v2): 순증가 월 비율
  let momentumScore = maxScore * MOMENTUM_WEIGHT * 0.5; // 기본값: 중립
  if (monthlyTrendData.length > 0) {
    const positiveMonths = monthlyTrendData.filter((t) => t.newCount > t.lossCount).length;
    const negativeMonths = monthlyTrendData.filter((t) => t.newCount < t.lossCount).length;
    const momentum = (positiveMonths - negativeMonths) / monthlyTrendData.length;
    // -1(쇠퇴) ~ +1(성장) → 0 ~ maxScore
    momentumScore = normalize(momentum, -0.5, 0.5, maxScore) * MOMENTUM_WEIGHT;
  }

  return Math.round((newBizScore + employeeScore + activeScore + momentumScore) * 10) / 10;
}

/**
 * 경쟁 강도 (0~25, 역비례): v2 인구밀도 보정 + 실측밀도 fallback
 */
function calculateCompetition(
  businessCount: number,
  radiusM: number,
  industryCode: string,
  totalBusinessCount: number,
  population?: { totalPopulation: number; households: number },
): number {
  const radiusKm = radiusM / 1000;
  const areaKm2 = Math.PI * radiusKm * radiusKm;
  const density = totalBusinessCount / areaKm2;

  // v2: 인구밀도 보정 계수
  const regionPopDensity = population
    ? population.totalPopulation / areaKm2
    : NATIONAL_AVG_POP_DENSITY;
  const regionalCoeff = Math.max(
    REGIONAL_COEFF_RANGE.MIN,
    Math.min(regionPopDensity / NATIONAL_AVG_POP_DENSITY, REGIONAL_COEFF_RANGE.MAX),
  );

  // v2: 기준밀도 — 등록 업종은 지역계수 보정, 미등록은 실측밀도 기반
  const registeredDensity = COMPETITION_BASE_DENSITY[industryCode];
  const baseDensity = registeredDensity != null
    ? registeredDensity * regionalCoeff
    : (totalBusinessCount / areaKm2) * 1.2; // fallback: 실측밀도 × 1.2

  const maxDensity = baseDensity * 2;
  return normalize(
    maxDensity - density,
    0,
    maxDensity,
    SCORING_WEIGHTS.COMPETITION,
    "sigmoid",
  );
}

/**
 * 생존율 (0~20): v2 모집단 생존율 + 시간 가중
 */
function calculateSurvival(
  data: AggregatedData,
): number {
  const { businesses, populationSurvivalRate, sampledCount, totalBusinessCount, golmok } = data;

  const total = businesses.filter((b) => b.status === "active" || b.status === "closed").length;
  if (total === 0 && populationSurvivalRate === 0) return SCORING_WEIGHTS.SURVIVAL * 0.5;

  // v2: 시간 가중 생존율 (상세 조회 사업장 기준, adptDt 있는 것만)
  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const twoYearStr = `${twoYearsAgo.getFullYear()}${String(twoYearsAgo.getMonth() + 1).padStart(2, "0")}01`;
  const fiveYearStr = `${fiveYearsAgo.getFullYear()}${String(fiveYearsAgo.getMonth() + 1).padStart(2, "0")}01`;

  const withDate = businesses.filter((b) => b.adptDt);
  let timeWeightedRate = populationSurvivalRate; // fallback

  if (withDate.length >= 5) {
    const recent = withDate.filter((b) => (b.adptDt ?? "") >= twoYearStr);
    const mid = withDate.filter((b) => (b.adptDt ?? "") >= fiveYearStr && (b.adptDt ?? "") < twoYearStr);
    const old = withDate.filter((b) => (b.adptDt ?? "") < fiveYearStr);

    const survivalOf = (arr: typeof withDate) =>
      arr.length > 0 ? arr.filter((b) => b.status === "active").length / arr.length : 0;

    timeWeightedRate =
      survivalOf(recent) * 0.5 +
      survivalOf(mid) * 0.3 +
      survivalOf(old) * 0.2;
  }

  // v2: 모집단 + 시간가중 복합
  let finalRate: number;

  if (golmok && golmok.closeRate > 0) {
    // 서울: 골목상권 블렌딩 (데이터 품질 기반 동적 비중)
    const golmokSurvivalRate = (100 - golmok.closeRate) / 100;
    const npsWeight = Math.min(sampledCount / 20, 0.7);
    const golmokWeight = 1 - npsWeight;
    finalRate = populationSurvivalRate * npsWeight + golmokSurvivalRate * golmokWeight;
  } else {
    // 비서울: 모집단 60% + 시간가중 40%
    finalRate = populationSurvivalRate * 0.6 + timeWeightedRate * 0.4;
  }

  return normalize(
    finalRate,
    SURVIVAL_THRESHOLDS.MIN_RATE,
    SURVIVAL_THRESHOLDS.MAX_RATE,
    SCORING_WEIGHTS.SURVIVAL,
    "sigmoid",
  );
}

/**
 * 주거 밀도 (0~15): v2 세대당 거래율 + 동적 임계값
 */
function calculateResidential(
  transactionCount: number,
  population?: {
    totalPopulation: number;
    households: number;
  },
): number {
  const maxScore = SCORING_WEIGHTS.RESIDENTIAL;

  // KOSIS 데이터 없으면 v1 fallback
  if (!population) {
    return normalize(
      transactionCount,
      RESIDENTIAL_THRESHOLDS.MIN_TRANSACTIONS,
      RESIDENTIAL_THRESHOLDS.MAX_TRANSACTIONS,
      maxScore,
    );
  }

  // v2: 세대당 거래율 (1000세대당)
  const tradeRate = population.households > 0
    ? transactionCount / (population.households / 1000)
    : 0;
  const tradeRateScore = normalize(
    tradeRate,
    TRADE_RATE_THRESHOLDS.MIN,
    TRADE_RATE_THRESHOLDS.MAX,
    maxScore,
  );

  // v2: 동적 임계값
  const dynamicMax = Math.max(50, population.households / 500);
  const dynamicMin = Math.max(5, population.households / 5000);
  const absoluteScore = normalize(transactionCount, dynamicMin, dynamicMax, maxScore);

  // 세대수 기반 점수
  const householdScore = normalize(population.households, 5000, 150000, maxScore);

  // 인구수 기반 점수
  const populationScore = normalize(population.totalPopulation, 10000, 500000, maxScore);

  // v2 복합 지표: 거래건수 20% + 거래율 25% + 세대수 30% + 인구수 25%
  const combined =
    absoluteScore * 0.20 +
    tradeRateScore * 0.25 +
    householdScore * 0.30 +
    populationScore * 0.25;

  return Math.round(combined * 10) / 10;
}

/**
 * 소득 수준 (0~10): v2 가격비율 70% + 거래규모 지수 30%
 */
function calculateIncome(avgAptPrice: number, transactionCount: number): number {
  if (avgAptPrice === 0) return SCORING_WEIGHTS.INCOME * 0.5;

  const maxScore = SCORING_WEIGHTS.INCOME;

  // v2: 가격 비율 (70%)
  const priceRatio = avgAptPrice / NATIONAL_AVG_APT_PRICE;
  const priceScore = normalize(priceRatio, 0.5, 2.0, maxScore) * 0.7;

  // v2: 거래규모 지수 (30%)
  const volumeIndex = (transactionCount * avgAptPrice) / 10000;
  const volumeScore = normalize(
    volumeIndex,
    VOLUME_INDEX_THRESHOLDS.MIN,
    VOLUME_INDEX_THRESHOLDS.MAX,
    maxScore,
  ) * 0.3;

  return Math.round((priceScore + volumeScore) * 10) / 10;
}

/**
 * 골목상권 보정 팩터 적용 (서울 한정)
 * HH/LH 상권변화지표에 따른 활력도 보정
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

  // 경쟁강도 포화지수 감산 (v2): 폐업률 10% 초과 시 경쟁 점수 하향
  if (golmok.closeRate > 10) {
    const saturationPenalty = Math.min((golmok.closeRate - 10) / 30, 1) * 0.15;
    corrected.competition = Math.round(
      corrected.competition * (1 - saturationPenalty) * 10,
    ) / 10;
  }

  return corrected;
}

/** 신뢰도 산출 (v2) */
function calculateConfidence(data: AggregatedData): ScoreConfidence {
  const { sampledCount, totalBusinessCount, businesses, population, golmok, transactionCount } = data;

  // 활력도 신뢰도: 샘플 커버리지
  const vitalityConf = totalBusinessCount > 0
    ? Math.min(sampledCount / totalBusinessCount, 1.0)
    : 0.5;

  // 경쟁강도 신뢰도: 인구 데이터 + 골목상권
  const hasPopulation = population ? 1.0 : 0.5;
  const hasGolmok = golmok ? 1.0 : 0.8;
  const competitionConf = hasPopulation * 0.6 + hasGolmok * 0.4;

  // 생존율 신뢰도: 샘플 커버리지 + 시계열 + 골목상권
  const sampleCoverage = totalBusinessCount > 0
    ? Math.min(sampledCount / totalBusinessCount, 1.0)
    : 0.3;
  const hasTimeSeries = businesses.filter((b) => b.adptDt).length / Math.max(businesses.length, 1);
  const survivalConf = sampleCoverage * 0.4 + hasTimeSeries * 0.3 + (golmok ? 0.3 : 0);

  // 주거밀도 신뢰도
  const residentialConf = population ? 0.9 : 0.5;

  // 소득 신뢰도
  const hasTransactions = transactionCount > 0 ? 0.8 : 0.3;
  const incomeConf = hasTransactions;

  // 종합: 가중치 비례 합산
  const overall = Math.round((
    vitalityConf * SCORING_WEIGHTS.VITALITY +
    competitionConf * SCORING_WEIGHTS.COMPETITION +
    survivalConf * SCORING_WEIGHTS.SURVIVAL +
    residentialConf * SCORING_WEIGHTS.RESIDENTIAL +
    incomeConf * SCORING_WEIGHTS.INCOME
  ) / 100 * 100) / 100;

  return {
    overall,
    breakdown: {
      vitality: Math.round(vitalityConf * 100) / 100,
      competition: Math.round(competitionConf * 100) / 100,
      survival: Math.round(survivalConf * 100) / 100,
      residential: Math.round(residentialConf * 100) / 100,
      income: Math.round(incomeConf * 100) / 100,
    },
  };
}

/** 종합 점수 계산 (v2) */
export function calculateTotalScore(data: AggregatedData): ScoreResult {
  const vitality = calculateVitality(data);

  const competition = calculateCompetition(
    data.businesses.length,
    data.radius,
    data.industryCode,
    data.totalBusinessCount,
    data.population,
  );

  const survival = calculateSurvival(data);
  const residential = calculateResidential(data.transactionCount, data.population);
  const income = calculateIncome(data.avgApartmentPrice, data.transactionCount);

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

  const confidence = calculateConfidence(data);

  return { total, breakdown, confidence };
}
