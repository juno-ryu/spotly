import { normalize, scoreToGrade } from "./types";
import type { IndicatorScore } from "./types";

/** 생존율 분석 결과 */
export interface SurvivalAnalysis {
  /** 폐업률 기반 점수 (0~100) */
  closeScore: number;
  /** 순변화(개업률-폐업률) 기반 점수 (0~100) */
  netChangeScore: number;
  /** 종합 생존율 점수 (가중 합산) */
  survivalScore: IndicatorScore;
  /** 원본 상세 데이터 */
  details: {
    /** 폐업률 (%) */
    closeRate: number;
    /** 개업률 (%) */
    openRate: number;
    /** 순변화율 (openRate - closeRate) */
    netChangeRate: number;
  };
}

/**
 * 폐업률 시그모이드 점수 계산
 * - 폐업률 5% 기준 중간점(50점), 낮을수록 높은 점수
 */
function calcCloseScore(closeRate: number): number {
  // 박사님 승인 2026-03-15: 선형 역정규화로 교체
  // 0%=100점, 5%=67점, 10%=33점, 15%=0점
  // 기존 시그모이드 대비 저폐업률 지역 점수 상향 + 해석 직관성 향상
  return Math.round((1 - normalize(closeRate, 0, 15)) * 100);
}

/**
 * 순변화(개업률 - 폐업률) 점수 계산
 * - -5%~+10% 범위 정규화
 */
function calcNetChangeScore(openRate: number, closeRate: number): number {
  const netChange = openRate - closeRate;
  // V-08: 대칭 범위로 변경 — netChange=0(균형) → 50점(중립)
  return normalize(netChange, -7.5, 7.5) * 100;
}

/**
 * 생존율 분석 (서울 골목상권 전용)
 * - vitality.details.closeRate / openRate 기반
 * - 비서울은 골목상권 데이터 없으므로 null 반환
 */
export function analyzeSurvival(
  closeRate: number | null,
  openRate: number | null,
): SurvivalAnalysis | null {
  // 비서울: 골목상권 데이터 없음
  if (closeRate === null || openRate === null) return null;

  // 박사님 승인 2026-03-15: 0/0은 골목상권 데이터 부재로 판단, null 처리
  if (closeRate === 0 && openRate === 0) return null;

  const closeScore = calcCloseScore(closeRate);
  // 박사님 승인 공식: closeScore × 0.6 + netChangeScore × 0.4
  const netChangeScore = calcNetChangeScore(openRate, closeRate);
  const rawScore = closeScore * 0.6 + netChangeScore * 0.4;

  const rounded = Math.round(rawScore);
  const { grade, gradeLabel } = scoreToGrade(rounded);

  return {
    closeScore: Math.round(closeScore),
    netChangeScore: Math.round(netChangeScore),
    survivalScore: { score: rounded, grade, gradeLabel },
    details: {
      closeRate,
      openRate,
      netChangeRate: openRate - closeRate,
    },
  };
}
