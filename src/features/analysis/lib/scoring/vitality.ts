import type { CommercialVitalityData } from "@/server/data-sources/seoul-golmok/adapter";
import { normalize, scoreToGrade, type IndicatorScore } from "./types";

/** 상권 활력도 분석 결과 (서울 전용) */
export interface VitalityAnalysis {
  /** 점포당 매출 점수 (0~100) */
  salesScore: number;
  /** 상권 변화 점수 (0~100) */
  changeScore: number;
  /** 유동인구 점수 (0~100) */
  footTrafficScore: number;
  /** 종합 점수 (가중 합산) */
  vitalityScore: IndicatorScore;
  /** 원본 상세 데이터 (UI/인사이트/프롬프트용) */
  details: {
    /** 분기 추정매출 (원) */
    estimatedQuarterlySales: number;
    /** 점포당 분기 매출 (원) */
    salesPerStore: number;
    /** 폐업률(%) — 절대 건수 기반 */
    closeRate: number;
    /** 개업률(%) — 절대 건수 기반 */
    openRate: number;
    /** 상권변화지표명 */
    changeIndexName: string | null;
    /** 총 점포수 */
    storeCount: number;
    /** 피크 시간대 (매출 기준) */
    peakTimeSlot: string;
    /** 주 소비 연령대 (매출 기준) */
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
 * 점포당 매출 점수
 * 분기 점포당 매출 500만원~1.5억원 범위로 정규화
 *
 * 근거: 서울 골목상권 실데이터 분석 (2025 3Q, 2,030건)
 * - p25: 3,083만원 / p50: 1.015억 / p75: 3.15억
 * - min 500만 = 하위 15% 절삭 (극소매출 상권)
 * - max 1.5억 = p90 수준 (상위 18%가 100점)
 */
function calcSalesScore(salesPerStore: number): number {
  return normalize(salesPerStore, 5_000_000, 150_000_000) * 100;
}

/**
 * 상권 변화 점수
 * 서울시 상권변화지표 4등급을 점수로 변환
 * LL(다이나믹) > LH(상권확장) > HL(상권축소) > HH(정체)
 */
function calcChangeScore(changeIndex: string | null): number {
  if (!changeIndex) return 50; // 데이터 없으면 중립

  const CHANGE_SCORES: Record<string, number> = {
    LL: 90, // 다이나믹 — 활발하게 성장
    LH: 70, // 상권확장 — 확장세
    HL: 40, // 상권축소 — 축소세
    HH: 20, // 정체 — 정체
  };

  return CHANGE_SCORES[changeIndex] ?? 50;
}

/**
 * 유동인구 점수: 분기 총 유동인구 기준 0~100
 *
 * 근거: 서울 골목상권 실데이터 분석 (2025 2Q, 1,086건)
 * - p25: 26만명 / p50: 59만명 / p75: 114만명 / p90: 176만명
 * - min 5만 = 하위 4% 절삭 (극소유동 상권)
 * - max 200만 = p95 수준 (중앙값 → 28점, 변별력 확보)
 */
function calcFootTrafficScore(totalFloating: number): number {
  return Math.round(normalize(totalFloating, 50_000, 2_000_000) * 100);
}

/** 하위 점수의 가중 합산 비율 (3지표 체계) */
const WEIGHTS = {
  /** 유동인구 데이터 있을 때 */
  withFootTraffic: {
    sales: 0.35,
    change: 0.30,
    footTraffic: 0.35,
  },
  /** 유동인구 데이터 없을 때 (2지표 fallback) */
  withoutFootTraffic: {
    sales: 0.55,
    change: 0.45,
    footTraffic: 0,
  },
} as const;

/**
 * 서울 골목상권 데이터로부터 상권 활력도를 산출한다.
 * 3지표 체계: 점포당 매출(35%) + 상권변화(30%) + 유동인구(35%)
 * 점수 범위: 0~100 (높을수록 활력이 높은 상권)
 */
export function analyzeVitality(
  data: CommercialVitalityData,
): VitalityAnalysis {
  // 점포당 매출 계산
  const salesPerStore =
    data.storeCount > 0
      ? data.estimatedQuarterlySales / data.storeCount
      : data.estimatedQuarterlySales;

  const salesScore = calcSalesScore(salesPerStore);
  const changeScore = calcChangeScore(data.changeIndex);

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
    changeScore * w.change +
    footTrafficScore * w.footTraffic;

  const rounded = Math.round(totalScore);
  const { grade, gradeLabel } = scoreToGrade(rounded);

  return {
    salesScore: Math.round(salesScore),
    changeScore: Math.round(changeScore),
    footTrafficScore: Math.round(footTrafficScore),
    vitalityScore: { score: rounded, grade, gradeLabel },
    details: {
      estimatedQuarterlySales: data.estimatedQuarterlySales,
      salesPerStore: Math.round(salesPerStore),
      closeRate: data.closeRate,
      openRate: data.openRate,
      changeIndexName: data.changeIndexName,
      storeCount: data.storeCount,
      peakTimeSlot: data.peakTimeSlot,
      mainAgeGroup: data.mainAgeGroup,
      floatingPopulation: data.floatingPopulation,
      residentPopulation: data.residentPopulation,
    },
  };
}
