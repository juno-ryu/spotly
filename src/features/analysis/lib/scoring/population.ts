import type { PopulationMetrics } from "@/server/data-sources/kosis/adapter";
import { normalize, scoreToGrade } from "./types";
import type { IndicatorScore } from "./types";

export interface PopulationAnalysis {
  /** 인구 점수 (0~100) */
  populationScore: number;
  /** 세대 수 점수 (0~100) */
  householdScore: number;
  /** 종합 인구 지표 점수 */
  score: IndicatorScore;
  /** 원본 데이터 */
  details: {
    totalPopulation: number;
    households: number;
    /** 읍면동 단위 여부 (false=시군구 단위) */
    isDongLevel: boolean;
  };
}

export function analyzePopulation(data: PopulationMetrics): PopulationAnalysis {
  // 읍면동(isDongLevel=true) vs 시군구(isDongLevel=false) 단위에 따라 정규화 범위 다름
  // 실제 전국 KOSIS 2024년 데이터 기반 보정:
  //   읍면동 — 중앙값 10,469명 / 90%ile 31,863명 / 최대 116,836명
  //   시군구 — 중앙값 186,882명 / 90%ile 488,348명 / 최대 1,193,005명
  // min=하위 25% 수준, max=상위 10% 수준 → 중간 지역이 C~B 등급 분포
  const populationScore = data.isDongLevel
    ? Math.round(normalize(data.totalPopulation, 3_000, 40_000) * 100)
    : Math.round(normalize(data.totalPopulation, 50_000, 600_000) * 100);

  // 세대 수 정규화 (실제 분포 기반)
  const householdScore = data.isDongLevel
    ? Math.round(normalize(data.households, 1_000, 15_000) * 100)
    : Math.round(normalize(data.households, 20_000, 200_000) * 100);

  // 인구(60%) + 세대(40%) 가중 합산
  const totalScore = Math.round(populationScore * 0.6 + householdScore * 0.4);
  const { grade, gradeLabel } = scoreToGrade(totalScore);

  return {
    populationScore,
    householdScore,
    score: { score: totalScore, grade, gradeLabel },
    details: {
      totalPopulation: data.totalPopulation,
      households: data.households,
      isDongLevel: data.isDongLevel,
    },
  };
}
