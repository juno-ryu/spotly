import type { ScoreBreakdown } from "../schema";
import {
  SCORING_WEIGHTS,
  COMPETITION_BASE_DENSITY,
  SURVIVAL_THRESHOLDS,
  RESIDENTIAL_THRESHOLDS,
  NATIONAL_AVG_APT_PRICE,
  NATIONAL_AVG_POP_DENSITY,
  REGIONAL_COEFF_RANGE,
  TRADE_RATE_THRESHOLDS,
  VOLUME_INDEX_THRESHOLDS,
} from "../constants/scoring";
// TODO: 스코어링 엔진 전면 개편 예정 — NPS 제거 후 새 데이터 소스 연동 시 재작성
// 현재 미사용 (api/analyze에서 totalScore: 0으로 하드코딩)
/** @deprecated 구 데이터 구조 — 추후 개편 시 재정의 */
interface AggregatedData {
  businesses: Array<{ status: string }>;
  totalBusinessCount: number;
  populationSurvivalRate: number;
  radius: number;
  industryCode: string;
  transactionCount: number;
  avgApartmentPrice: number;
  population?: { totalPopulation: number; households: number };
  golmok?: { changeIndex: string; closeRate: number };
}

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

/** 소수점 첫째 자리 반올림 */
function roundTenth(v: number): number {
  return Math.round(v * 10) / 10;
}

/** 소수점 둘째 자리 반올림 */
function roundHundredth(v: number): number {
  return Math.round(v * 100) / 100;
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
    return roundTenth(sigmoid * maxScore);
  }

  return roundTenth(ratio * maxScore);
}

/**
 * 상권 활력도 (0~30): 2-요소 복합 지표
 * 1. 사업장 규모 (80%): 해당 구 NPS 등록 사업장 수 (상권 볼륨)
 * 2. 활성 비율 (20%): NPS 가입 유지 비율 (참고 수준, 탈퇴≠폐업이라 신뢰도 낮음)
 */
function calculateVitality(data: AggregatedData): number {
  const { businesses, totalBusinessCount } = data;
  if (businesses.length === 0) return SCORING_WEIGHTS.VITALITY * 0.5;

  const maxScore = SCORING_WEIGHTS.VITALITY;

  // (1) 사업장 규모 (80%): 등록 사업장 수가 많을수록 활발한 상권
  const volumeScore = normalize(totalBusinessCount, 5, 80, maxScore) * 0.8;

  // (2) 활성 비율 (20%): NPS 가입 유지 비율 (참고)
  const activeCount = businesses.filter((b) => b.status === "active").length;
  const activeRatio =
    businesses.length > 0 ? activeCount / businesses.length : 0;
  const activeScore = activeRatio * maxScore * 0.2;

  return roundTenth(activeScore + volumeScore);
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
    Math.min(
      regionPopDensity / NATIONAL_AVG_POP_DENSITY,
      REGIONAL_COEFF_RANGE.MAX,
    ),
  );

  // v2: 기준밀도 — 등록 업종은 지역계수 보정, 미등록은 실측밀도 기반
  const registeredDensity = COMPETITION_BASE_DENSITY[industryCode];
  const baseDensity =
    registeredDensity != null
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
 * 생존율 (0~20): NPS 모집단 생존율
 * NPS 가입유지율은 과거 탈퇴 사업장이 포함되어 낮게 산출되므로
 * 임계값을 현실적으로 완화 (MIN 0.3, MAX 0.8, linear)
 */
function calculateSurvival(data: AggregatedData): number {
  const { businesses, populationSurvivalRate } = data;

  if (businesses.length === 0 && populationSurvivalRate === 0)
    return SCORING_WEIGHTS.SURVIVAL * 0.5;

  return normalize(
    populationSurvivalRate,
    SURVIVAL_THRESHOLDS.MIN_RATE,
    SURVIVAL_THRESHOLDS.MAX_RATE,
    SCORING_WEIGHTS.SURVIVAL,
  );
}

/**
 * 주거 밀도 (0~15): 인구 데이터 유무·단위에 따라 3단계 산출
 * - 인구 없음: 거래건수만 (v1 fallback)
 * - 동 단위 인구 (세대수 없음): 인구수 50% + 거래건수 50%
 * - 구 단위 인구 (세대수 있음): 4요소 복합 지표
 */
function calculateResidential(
  transactionCount: number,
  population?: {
    totalPopulation: number;
    households: number;
  },
): number {
  const maxScore = SCORING_WEIGHTS.RESIDENTIAL;

  // KOSIS 데이터 없으면 v1 fallback (거래건수만)
  if (!population) {
    return normalize(
      transactionCount,
      RESIDENTIAL_THRESHOLDS.MIN_TRANSACTIONS,
      RESIDENTIAL_THRESHOLDS.MAX_TRANSACTIONS,
      maxScore,
    );
  }

  // 동 단위 (세대수 없음): 인구수 + 거래건수 2요소
  if (population.households === 0) {
    // 동 인구 임계값: 3,000명(소규모)~30,000명(대규모, 일반 동 기준)
    const populationScore = normalize(
      population.totalPopulation,
      3000,
      30000,
      maxScore,
    );
    const transactionScore = normalize(
      transactionCount,
      RESIDENTIAL_THRESHOLDS.MIN_TRANSACTIONS,
      RESIDENTIAL_THRESHOLDS.MAX_TRANSACTIONS,
      maxScore,
    );
    const combined = populationScore * 0.5 + transactionScore * 0.5;
    return roundTenth(combined);
  }

  // 구 단위 (세대수 있음): 4요소 복합 지표
  const tradeRate = transactionCount / (population.households / 1000);
  const tradeRateScore = normalize(
    tradeRate,
    TRADE_RATE_THRESHOLDS.MIN,
    TRADE_RATE_THRESHOLDS.MAX,
    maxScore,
  );

  const dynamicMax = Math.max(50, population.households / 500);
  const dynamicMin = Math.max(5, population.households / 5000);
  const absoluteScore = normalize(
    transactionCount,
    dynamicMin,
    dynamicMax,
    maxScore,
  );

  const householdScore = normalize(
    population.households,
    5000,
    150000,
    maxScore,
  );
  const populationScore = normalize(
    population.totalPopulation,
    10000,
    500000,
    maxScore,
  );

  // 거래건수 20% + 거래율 25% + 세대수 30% + 인구수 25%
  const combined =
    absoluteScore * 0.2 +
    tradeRateScore * 0.25 +
    householdScore * 0.3 +
    populationScore * 0.25;

  return roundTenth(combined);
}

/**
 * 소득 수준 (0~10): v2 가격비율 70% + 거래규모 지수 30%
 */
function calculateIncome(
  avgAptPrice: number,
  transactionCount: number,
): number {
  if (avgAptPrice === 0) return SCORING_WEIGHTS.INCOME * 0.5;

  const maxScore = SCORING_WEIGHTS.INCOME;

  // v2: 가격 비율 (70%)
  const priceRatio = avgAptPrice / NATIONAL_AVG_APT_PRICE;
  const priceScore = normalize(priceRatio, 0.5, 2.0, maxScore) * 0.7;

  // v2: 거래규모 지수 (30%)
  const volumeIndex = (transactionCount * avgAptPrice) / 10000;
  const volumeScore =
    normalize(
      volumeIndex,
      VOLUME_INDEX_THRESHOLDS.MIN,
      VOLUME_INDEX_THRESHOLDS.MAX,
      maxScore,
    ) * 0.3;

  return roundTenth(priceScore + volumeScore);
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
      roundTenth(corrected.vitality * (1 + bonus)),
    );
  }

  // 경쟁강도 포화지수 감산 (v2): 폐업률 10% 초과 시 경쟁 점수 하향
  if (golmok.closeRate > 10) {
    const saturationPenalty = Math.min((golmok.closeRate - 10) / 30, 1) * 0.15;
    corrected.competition =
      roundTenth(corrected.competition * (1 - saturationPenalty));
  }

  return corrected;
}

/** 신뢰도 산출 */
function calculateConfidence(data: AggregatedData): ScoreConfidence {
  const {
    totalBusinessCount,
    businesses,
    population,
    golmok,
    transactionCount,
  } = data;

  // 활력도 신뢰도: 사업장 데이터 존재 여부
  const vitalityConf = businesses.length > 0 ? 0.7 : 0.3;

  // 경쟁강도 신뢰도: 인구 데이터 + 골목상권
  const hasPopulation = population ? 1.0 : 0.5;
  const hasGolmok = golmok ? 1.0 : 0.8;
  const competitionConf = hasPopulation * 0.6 + hasGolmok * 0.4;

  // 생존율 신뢰도: NPS 데이터 규모 + 골목상권
  const hasSufficientData = totalBusinessCount >= 10 ? 0.7 : 0.4;
  const survivalConf = hasSufficientData + (golmok ? 0.3 : 0);

  // 주거밀도 신뢰도
  const residentialConf = population ? 0.9 : 0.5;

  // 소득 신뢰도
  const incomeConf = transactionCount > 0 ? 0.8 : 0.3;

  // 종합: 가중치 비례 합산
  const overall = roundHundredth(
    (vitalityConf * SCORING_WEIGHTS.VITALITY +
      competitionConf * SCORING_WEIGHTS.COMPETITION +
      survivalConf * SCORING_WEIGHTS.SURVIVAL +
      residentialConf * SCORING_WEIGHTS.RESIDENTIAL +
      incomeConf * SCORING_WEIGHTS.INCOME) /
      100,
  );

  return {
    overall,
    breakdown: {
      vitality: roundHundredth(vitalityConf),
      competition: roundHundredth(competitionConf),
      survival: roundHundredth(survivalConf),
      residential: roundHundredth(residentialConf),
      income: roundHundredth(incomeConf),
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
  const residential = calculateResidential(
    data.transactionCount,
    data.population,
  );
  const income = calculateIncome(data.avgApartmentPrice, data.transactionCount);

  let breakdown: ScoreBreakdown = {
    vitality: roundTenth(vitality),
    competition: roundTenth(competition),
    survival: roundTenth(survival),
    residential: roundTenth(residential),
    income: roundTenth(income),
  };

  // TODO: 골목상권 보정 — 지역별 통일성 확보 후 재활성화 예정
  // breakdown = applyGolmokCorrection(breakdown, data.golmok);

  const total = roundTenth(
    breakdown.vitality +
      breakdown.competition +
      breakdown.survival +
      breakdown.residential +
      breakdown.income,
  );

  const confidence = calculateConfidence(data);

  return { total, breakdown, confidence };
}
