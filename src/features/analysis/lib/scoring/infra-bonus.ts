// 생활인프라 접근성 보너스 (Infrastructure Accessibility Bonus)
// 박사님(scoring-engine-validator) 조건부 승인 — 2026-03-08

import { calcBusGrade } from "../insights/rules/bus";
import { calcMedicalGrade } from "../insights/rules/medical";
import { calcSchoolGrade } from "../insights/rules/school";
import { calcUniversityGrade } from "../insights/rules/university";
import type { BusAnalysis } from "@/server/data-sources/bus/adapter";
import type { MedicalAnalysis } from "@/server/data-sources/medical/adapter";
import type { SchoolAnalysis } from "@/server/data-sources/school/adapter";
import type { UniversityAnalysis } from "@/server/data-sources/university/adapter";

// 업종별 인프라 가중치 매트릭스
// H=0.30, M=0.15, L=0.05, X=0.00 (dev-guide.md H/M/L/X 기준)
const INDUSTRY_WEIGHTS: Record<string, { bus: number; school: number; univ: number; med: number }> =
  {
    음식점: { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 },
    한식: { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 },
    카페: { bus: 0.15, school: 0.15, univ: 0.30, med: 0.05 },
    커피: { bus: 0.15, school: 0.15, univ: 0.30, med: 0.05 },
    편의점: { bus: 0.05, school: 0.15, univ: 0.30, med: 0.05 },
    학원: { bus: 0.05, school: 0.30, univ: 0.05, med: 0.00 },
    미용: { bus: 0.05, school: 0.05, univ: 0.15, med: 0.05 },
    의류: { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 },
    부동산: { bus: 0.05, school: 0.15, univ: 0.05, med: 0.05 },
    약국: { bus: 0.05, school: 0.05, univ: 0.05, med: 0.30 },
    분식: { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 },
    중식: { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 },
    일식: { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 },
    치킨: { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 },
    병원: { bus: 0.05, school: 0.05, univ: 0.05, med: 0.30 },
    의원: { bus: 0.05, school: 0.05, univ: 0.05, med: 0.30 },
  };

const DEFAULT_WEIGHTS = { bus: 0.10, school: 0.10, univ: 0.15, med: 0.05 };

const MAX_BONUS = 15; // 최대 가산점

// 업종명에서 가중치 매트릭스 조회
function getIndustryWeights(industryName: string) {
  for (const [key, weights] of Object.entries(INDUSTRY_WEIGHTS)) {
    if (industryName.includes(key)) return weights;
  }
  return DEFAULT_WEIGHTS;
}

export interface InfraBonusResult {
  score: number; // 0~15
  breakdown: {
    bus: number;
    school: number;
    university: number;
    medical: number;
  };
}

export function calcInfraBonus(params: {
  bus: BusAnalysis | null;
  school: SchoolAnalysis | null;
  university: UniversityAnalysis | null;
  medical: MedicalAnalysis | null;
  industryName: string;
}): InfraBonusResult {
  const weights = getIndustryWeights(params.industryName);
  const isAcademy = params.industryName.includes("학원");

  const busScore = params.bus ? calcBusGrade(params.bus).score : 0;
  const schoolScore = params.school ? calcSchoolGrade(params.school, isAcademy).score : 0;
  const univScore = params.university ? calcUniversityGrade(params.university).score : 0;
  const medScore = params.medical ? calcMedicalGrade(params.medical).score : 0;

  const weightedSum =
    busScore * weights.bus +
    schoolScore * weights.school +
    univScore * weights.univ +
    medScore * weights.med;

  const totalWeight = weights.bus + weights.school + weights.univ + weights.med;
  const normalizedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    score: Math.round((normalizedScore * MAX_BONUS) / 100),
    breakdown: { bus: busScore, school: schoolScore, university: univScore, medical: medScore },
  };
}
