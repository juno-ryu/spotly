import type { CommercialVitalityData } from "@/server/data-sources/seoul-golmok/adapter";
import { normalize, scoreToGrade, type IndicatorScore } from "./types";

/** 상권 활력도 분석 결과 (서울 전용) */
export interface VitalityAnalysis {
  /** 매출 규모 점수 (0~100) */
  salesScore: number;
  /** 생존 지표 점수 (0~100) */
  survivalScore: number;
  /** 상권 변화 점수 (0~100) */
  changeScore: number;
  /** 업종 밀도 점수 (0~100) */
  industryDensityScore: number;
  /** 유동인구 점수 (0~100) */
  footTrafficScore: number;
  /** 종합 점수 (가중 합산) */
  vitalityScore: IndicatorScore;
  /** 원본 상세 데이터 (UI 표시용) */
  details: {
    /** 분기 추정매출 (원) */
    estimatedQuarterlySales: number;
    /** 개업률(%) */
    openRate: number;
    /** 폐업률(%) */
    closeRate: number;
    /** 상권변화지표명 */
    changeIndexName: string | null;
    /** 평균 영업기간(월) */
    avgOperatingMonths: number | null;
    /** 유사업종 비율 */
    similarStoreRatio: number;
    /** 피크 시간대 */
    peakTimeSlot: string;
    /** 주 소비 연령대 */
    mainAgeGroup: string;
    /** 유동인구 */
    floatingPopulation?: {
      totalFloating: number;
      maleRatio: number;
      peakTimeSlot: string;
      peakDay: string;
      mainAgeGroup: string;
    };
    /** 상주인구 */
    residentPopulation?: {
      totalResident: number;
      totalHouseholds: number;
    };

  };
}

/**
 * 매출 규모 점수 (30%)
 * 분기 추정매출 1천만원~5억원 범위로 정규화
 */
function calcSalesScore(estimatedQuarterlySales: number): number {
  return normalize(estimatedQuarterlySales, 10_000_000, 500_000_000) * 100;
}

/**
 * 생존 지표 점수 (30%)
 * 개업률/폐업률 비율 + 영업기간 보너스/패널티
 */
function calcSurvivalScore(
  openRate: number,
  closeRate: number,
  avgOperatingMonths: number | null,
): number {
  // 개폐업 비율: 개업률이 폐업률보다 높을수록 건강
  const ratio = openRate / Math.max(closeRate, 0.1);
  let score = normalize(ratio, 0.5, 3.0) * 100;

  // 보너스: 평균 영업기간 3년(36개월) 이상이면 안정적 상권
  if (avgOperatingMonths != null && avgOperatingMonths > 36) {
    score = Math.min(100, score + 10);
  }

  // 패널티: 폐업률 15% 초과면 위험 신호
  if (closeRate > 15) {
    score = Math.max(0, score - 10);
  }

  return score;
}

/**
 * 상권 변화 점수 (20%)
 * 서울시 상권변화지표 4등급을 점수로 변환
 */
function calcChangeScore(changeIndex: string | null): number {
  if (!changeIndex) return 50; // 데이터 없으면 중립

  const CHANGE_SCORES: Record<string, number> = {
    HH: 90, // 다이나믹 — 활발하게 성장
    HL: 70, // 상권확장 — 확장세
    LH: 40, // 상권축소 — 축소세
    LL: 20, // 정체 — 정체
  };

  return CHANGE_SCORES[changeIndex] ?? 50;
}

/**
 * 업종 밀도 점수 (20%)
 * 유사업종 비율을 U자형 커브로 변환
 * - 너무 적으면: 수요 불확실
 * - 적정 수준(10~20%): 최적
 * - 과밀(40%+): 감점
 */
function calcIndustryDensityScore(
  similarStoreCount: number,
  storeCount: number,
): number {
  if (storeCount === 0) return 50; // 데이터 없으면 중립

  const ratio = similarStoreCount / storeCount;

  if (ratio < 0.05) return 70;  // 거의 없음 — 진입 기회지만 수요 불확실
  if (ratio < 0.10) return 80;  // 소수 존재 — 수요 확인됨
  if (ratio < 0.20) return 90;  // 적정 경쟁 — 최적
  if (ratio < 0.30) return 75;  // 경쟁 활발 — 아직 양호
  if (ratio < 0.40) return 60;  // 다소 과밀
  return 45;                    // 과밀
}

/** 유동인구 점수: 분기 총 유동인구 기준 0~100 */
function calcFootTrafficScore(totalFloating: number): number {
  // 10만 미만 = 0점, 500만 이상 = 100점 (선형 보간)
  return Math.round(normalize(totalFloating, 100_000, 5_000_000) * 100);
}

/** 하위 점수의 가중 합산 비율 */
const WEIGHTS = {
  /** 유동인구 데이터 있을 때 */
  withFootTraffic: {
    sales: 0.25,
    survival: 0.25,
    change: 0.15,
    industryDensity: 0.15,
    footTraffic: 0.20,
  },
  /** 유동인구 데이터 없을 때 (기존 4지표 fallback) */
  withoutFootTraffic: {
    sales: 0.30,
    survival: 0.30,
    change: 0.20,
    industryDensity: 0.20,
    footTraffic: 0,
  },
} as const;

/**
 * 서울 골목상권 데이터로부터 상권 활력도를 산출한다.
 * 점수 범위: 0~100 (높을수록 활력이 높은 상권)
 */
export function analyzeVitality(
  data: CommercialVitalityData,
): VitalityAnalysis {
  const salesScore = calcSalesScore(data.estimatedQuarterlySales);
  const survivalScore = calcSurvivalScore(
    data.openRate,
    data.closeRate,
    data.avgOperatingMonths,
  );
  const changeScore = calcChangeScore(data.changeIndex);
  const industryDensityScore = calcIndustryDensityScore(
    data.similarStoreCount,
    data.storeCount,
  );

  // 유동인구 점수 (데이터 있을 때만)
  const hasFootTraffic = !!data.floatingPopulation;
  const footTrafficScore = hasFootTraffic
    ? calcFootTrafficScore(data.floatingPopulation!.totalFloating)
    : 0;

  // 유동인구 유무에 따라 가중치 동적 선택
  const w = hasFootTraffic
    ? WEIGHTS.withFootTraffic
    : WEIGHTS.withoutFootTraffic;

  const totalScore =
    salesScore * w.sales +
    survivalScore * w.survival +
    changeScore * w.change +
    industryDensityScore * w.industryDensity +
    footTrafficScore * w.footTraffic;

  const rounded = Math.round(totalScore);
  const { grade, gradeLabel } = scoreToGrade(rounded);

  return {
    salesScore: Math.round(salesScore),
    survivalScore: Math.round(survivalScore),
    changeScore: Math.round(changeScore),
    industryDensityScore: Math.round(industryDensityScore),
    footTrafficScore: Math.round(footTrafficScore),
    vitalityScore: { score: rounded, grade, gradeLabel },
    details: {
      estimatedQuarterlySales: data.estimatedQuarterlySales,
      openRate: data.openRate,
      closeRate: data.closeRate,
      changeIndexName: data.changeIndexName,
      avgOperatingMonths: data.avgOperatingMonths,
      similarStoreRatio:
        data.storeCount > 0
          ? data.similarStoreCount / data.storeCount
          : 0,
      peakTimeSlot: data.peakTimeSlot,
      mainAgeGroup: data.mainAgeGroup,
      floatingPopulation: data.floatingPopulation,
      residentPopulation: data.residentPopulation,
    },
  };
}
