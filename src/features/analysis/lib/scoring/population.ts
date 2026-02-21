import type { PopulationMetrics } from "@/server/data-sources/kosis/adapter";
import { scoreToGrade } from "./types";
import type { IndicatorScore } from "./types";

/**
 * 로그 변환 정규화 — 인구 데이터의 양의 왜도(right-skewed) 분포에 적합
 * 선형 정규화 대비 중앙값 부근 지역의 과소평가를 방지
 */
function logNormalize(value: number, min: number, max: number): number {
  if (max <= min || value <= 0) return 0;
  const logVal = Math.log(Math.max(value, min));
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Math.max(0, Math.min(1, (logVal - logMin) / (logMax - logMin)));
}

export interface PopulationAnalysis {
  /** 인구 점수 (0~100) */
  populationScore: number;
  /** 종합 인구 지표 점수 */
  score: IndicatorScore;
  /** 원본 데이터 */
  details: {
    totalPopulation: number;
    /** 읍면동 단위 여부 (false=시군구 단위) */
    isDongLevel: boolean;
  };
}

export function analyzePopulation(data: PopulationMetrics): PopulationAnalysis {
  // 로그 변환 정규화: 선형 대비 중앙값 지역의 과소평가 방지
  // 선형 정규화 시 중앙값(~1만명) 지역이 19점(D등급)이지만,
  // 로그 변환 시 약 45점(C등급)으로 실제 체감에 부합
  //
  // 읍면동(isDongLevel=true) vs 시군구(isDongLevel=false) 단위에 따라 기준 다름
  // 실제 전국 KOSIS 2024년 데이터 기반:
  //   읍면동 — 중앙값 10,469명 / 90%ile 31,863명 / 최대 116,836명
  //   시군구 — 중앙값 186,882명 / 90%ile 488,348명 / 최대 1,193,005명
  const [min, max] = data.isDongLevel
    ? [3_000, 40_000]
    : [50_000, 600_000];

  const populationScore = Math.round(logNormalize(data.totalPopulation, min, max) * 100);
  const { grade, gradeLabel } = scoreToGrade(populationScore);

  return {
    populationScore,
    score: { score: populationScore, grade, gradeLabel },
    details: {
      totalPopulation: data.totalPopulation,
      isDongLevel: data.isDongLevel,
    },
  };
}
