import type { CommercialVitalityData } from "@/server/data-sources/seoul-golmok/adapter";
import type { SubwayAnalysis } from "@/server/data-sources/subway/adapter";
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
    /** 지하철 역세권 정보 */
    subway?: {
      stationName: string;
      lineName: string;
      dailyAvgTotal: number;
      distanceMeters: number;
    };
  };
}

/**
 * 점포당 매출 점수
 * 분기 점포당 매출 500만원~1.5억원 범위로 정규화
 *
 * 근거: 서울 골목상권 실데이터 분석 (2025 3Q, 2,030건)
 * - min 500만 = 극소매출 상권 절삭
 * - max 1.5억 = 상위 매출 상권 기준 (p50~p60 수준)
 * 주의: 정규화 범위 자체의 변경은 scoring-engine-validator 검토 필요
 */
/**
 * 점포당 월 매출 점수 (0~100)
 *
 * 로그 정규화 적용: 매출 분포의 우편향 보정 + 중하위 구간 변별력 확보
 * - 서울 골목상권 카드 추정치 기준 현실 분포 반영
 * - min 50만원: 실질 영업 활동 하한
 * - max 3,000만원: 카드 추정치 기반 최우수 상권 상한
 */
function calcSalesScore(salesPerStore: number): number {
  if (salesPerStore <= 0) return 0;
  const logVal = Math.log(Math.max(salesPerStore, 1));
  const logMin = Math.log(500_000);
  const logMax = Math.log(30_000_000);
  const score = Math.max(0, Math.min(1, (logVal - logMin) / (logMax - logMin)));
  return Math.round(score * 100);
}

/**
 * 상권 변화 점수
 * 서울시 상권변화지표 4등급을 점수로 변환
 * LL(다이나믹) > LH(상권확장) > HL(상권축소) > HH(정체)
 */
function calcChangeScore(changeIndex: string | null): number {
  if (!changeIndex) return 50; // 데이터 없으면 중립

  const CHANGE_SCORES: Record<string, number> = {
    LH: 85, // 확장기 — 신규 진입 활발, 시장 성장 중
    HL: 55, // 안정/성숙기 — 기존 사업체 안정적 유지
    HH: 30, // 포화 — 기존 업체 견고하나 신규 기회 제한
    LL: 30, // 다이나믹 — 회전 빠르지만 신규 기회도 존재, HH와 동급 (V-11)
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
  if (totalFloating <= 0) return 0;
  // 로그 정규화: 유동인구의 우편향 분포 보정
  // ln(5000)=8.52, ln(2000000)=14.51 (실제 데이터 p95 기준)
  const logVal = Math.log(Math.max(totalFloating, 1));
  const logMin = Math.log(5_000);
  const logMax = Math.log(2_000_000);
  const score = Math.max(0, Math.min(1, (logVal - logMin) / (logMax - logMin)));
  return Math.round(score * 100);
}

/**
 * 지하철 승하차 기반 유동인구 점수: 일평균 승하차 인원 기준 0~100
 *
 * 로그 정규화: 지하철 승하차의 극단적 편차 보정
 * - min 10,000명: 소규모 역 하한 (예: 남태령, 응봉)
 * - max 300,000명: 대형 역 상한 (예: 강남, 홍대입구)
 * - 거리 감쇠: 500m 기준, 가까울수록 보너스 (최대 10%)
 */
function calcSubwayFootTrafficScore(
  dailyAvgTotal: number,
  distanceMeters: number,
): number {
  if (dailyAvgTotal <= 0) return 0;
  const logVal = Math.log(Math.max(dailyAvgTotal, 1));
  const logMin = Math.log(10_000);
  const logMax = Math.log(300_000);
  const baseScore = Math.max(
    0,
    Math.min(1, (logVal - logMin) / (logMax - logMin)),
  );
  // 거리 감쇠: 구간별 계단식 (100m 이내 1.4배 ~ 500m 초과 0.85배)
  const distanceFactor =
    distanceMeters <= 100 ? 1.4 :
    distanceMeters <= 200 ? 1.3 :
    distanceMeters <= 300 ? 1.15 :
    distanceMeters <= 500 ? 1.0 :
    0.85;
  return Math.round(Math.min(100, baseScore * distanceFactor * 100));
}

/** 하위 점수의 가중 합산 비율 (3지표 체계) */
const WEIGHTS = {
  /** 유동인구 데이터 있을 때 */
  withFootTraffic: {
    sales: 0.35,
    change: 0.30,
    footTraffic: 0.35,
  },
  /** 유동인구 데이터 없을 때 (2지표 fallback)
   * change 0.45 → 0.35로 하향: 동일 매출에서 changeIndex만으로
   * D/B 등급 역전이 발생하는 과대 가중치 문제 수정
   * (scoring-engine-validator 검증 완료 2026-03-03) */
  withoutFootTraffic: {
    sales: 0.65,
    change: 0.35,
    footTraffic: 0,
  },
} as const;

/**
 * 서울 골목상권 데이터로부터 상권 활력도를 산출한다.
 * 3지표 체계: 점포당 매출(35%) + 상권변화(30%) + 유동인구(35%)
 * 점수 범위: 0~100 (높을수록 활력이 높은 상권)
 */
export function analyzeVitality(
  data: CommercialVitalityData | null,
  subway?: SubwayAnalysis | null,
): VitalityAnalysis {
  // 지하철 기반 유동인구 점수
  const subwayScore =
    subway?.nearestStation
      ? calcSubwayFootTrafficScore(
          subway.nearestStation.dailyAvgTotal,
          subway.nearestStation.distanceMeters,
        )
      : 0;

  // 골목상권 데이터 없이 subway만 있는 경우 (비서울 수도권)
  if (!data) {
    const rounded = Math.round(subwayScore * WEIGHTS.withFootTraffic.footTraffic);
    const { grade, gradeLabel } = scoreToGrade(rounded);
    return {
      salesScore: 0,
      changeScore: 0,
      footTrafficScore: subwayScore,
      vitalityScore: { score: rounded, grade, gradeLabel },
      details: {
        estimatedQuarterlySales: 0,
        salesPerStore: 0,
        closeRate: 0,
        openRate: 0,
        changeIndexName: null,
        storeCount: 0,
        peakTimeSlot: "",
        mainAgeGroup: "",
        subway: subway?.nearestStation
          ? {
              stationName: subway.nearestStation.stationName,
              lineName: subway.nearestStation.lineName,
              dailyAvgTotal: subway.nearestStation.dailyAvgTotal,
              distanceMeters: subway.nearestStation.distanceMeters,
            }
          : undefined,
      },
    };
  }

  // 점포당 월 매출 계산 (API 데이터는 분기 매출이므로 3으로 나눔)
  const monthlyTotal = data.estimatedQuarterlySales / 3;
  // storeCount=0이면 점포당 매출 산출 불가 → 0으로 처리 (과대 추정 방지)
  const salesPerStore =
    data.storeCount > 0 ? monthlyTotal / data.storeCount : 0;

  const salesScore = calcSalesScore(salesPerStore);
  const changeScore = calcChangeScore(data.changeIndex);

  // 유동인구 점수: 골목상권 유동인구 vs 지하철 승하차 중 높은 쪽 채택
  const golmokFootTraffic = data.floatingPopulation
    ? calcFootTrafficScore(data.floatingPopulation.totalFloating)
    : 0;
  const footTrafficScore = Math.max(golmokFootTraffic, subwayScore);
  const hasFootTraffic = footTrafficScore > 0;

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
      subway: subway?.nearestStation
        ? {
            stationName: subway.nearestStation.stationName,
            lineName: subway.nearestStation.lineName,
            dailyAvgTotal: subway.nearestStation.dailyAvgTotal,
            distanceMeters: subway.nearestStation.distanceMeters,
          }
        : undefined,
    },
  };
}
