// 생활인프라 접근성 보너스 (Infrastructure Accessibility Bonus)
// 박사님(scoring-engine-validator) 조건부 승인 — 2026-03-08

import { calcBusGrade } from "../insights/rules/bus";
import { calcSubwayGrade } from "../insights/rules/subway";
import type { SubwayAnalysis } from "@/server/data-sources/subway/adapter";
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
    음식점: { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 }, // 합 0.55
    한식:   { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 }, // 합 0.55
    카페:   { bus: 0.10, school: 0.10, univ: 0.30, med: 0.05 }, // 합 0.55
    커피:   { bus: 0.10, school: 0.10, univ: 0.30, med: 0.05 }, // 합 0.55
    편의점: { bus: 0.05, school: 0.15, univ: 0.30, med: 0.05 }, // 합 0.55
    학원:   { bus: 0.10, school: 0.30, univ: 0.10, med: 0.05 }, // 합 0.55
    미용:   { bus: 0.10, school: 0.10, univ: 0.25, med: 0.10 }, // 합 0.55
    의류:   { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 }, // 합 0.55
    부동산: { bus: 0.10, school: 0.15, univ: 0.10, med: 0.20 }, // 합 0.55
    약국:   { bus: 0.05, school: 0.05, univ: 0.10, med: 0.35 }, // 합 0.55
    분식:   { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 }, // 합 0.55
    중식:   { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 }, // 합 0.55
    일식:   { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 }, // 합 0.55
    치킨:   { bus: 0.15, school: 0.05, univ: 0.30, med: 0.05 }, // 합 0.55
    병원:   { bus: 0.05, school: 0.05, univ: 0.10, med: 0.35 }, // 합 0.55
    의원:   { bus: 0.05, school: 0.05, univ: 0.10, med: 0.35 }, // 합 0.55
  };

const DEFAULT_WEIGHTS = { bus: 0.15, school: 0.10, univ: 0.20, med: 0.10 } // 합 0.55;

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
    bus: number | null;
    school: number | null;
    university: number | null;
    medical: number | null;
    transit: number | null; // max(subway, bus) — 비서울 infraAccess용
  };
}

export function calcInfraBonus(params: {
  bus: BusAnalysis | null;
  school: SchoolAnalysis | null;
  university: UniversityAnalysis | null;
  medical: MedicalAnalysis | null;
  industryName: string;
  /** subway: 비서울에서 transit 점수에 활용. 서울은 vitality에서 이미 반영하므로 null 전달 */
  subway: SubwayAnalysis | null;
}): InfraBonusResult {
  const weights = getIndustryWeights(params.industryName);
  const isAcademy = params.industryName.includes("학원");

  // transit 점수: max(subway, bus) — 둘 다 null이면 null (인프라 부재로 처리)
  // 박사님 승인 2026-03-15: transit을 독립 항목으로 infraBonus에 편입
  const subwayScore = params.subway ? calcSubwayGrade(params.subway).score : null;
  const busScore = params.bus ? calcBusGrade(params.bus).score : null;
  const transitScore =
    subwayScore !== null && busScore !== null
      ? Math.max(subwayScore, busScore)
      : subwayScore ?? busScore ?? null;

  // V-06: null인 인프라는 가중치 계산에서 제외 (API 실패 ≠ 인프라 부재)
  // bus는 transit으로 통합 — bus 단독 가중치는 transit 가중치로 전환
  const items: { score: number; weight: number; key: string }[] = [];

  if (transitScore !== null) items.push({ score: transitScore, weight: weights.bus, key: "transit" });
  // 박사님 승인 2026-03-15: count=0이면 해당 인프라 "없음" → null과 동일하게 가중치 제외
  // API 실패(null)와 "반경 내 시설 없음"(count=0)을 동일 취급하여 역설적 점수 왜곡 방지
  if (params.school && params.school.totalCount > 0) items.push({ score: calcSchoolGrade(params.school, isAcademy).score, weight: weights.school, key: "school" });
  if (params.university && params.university.count > 0) items.push({ score: calcUniversityGrade(params.university).score, weight: weights.univ, key: "univ" });
  if (params.medical && params.medical.count > 0) items.push({ score: calcMedicalGrade(params.medical).score, weight: weights.med, key: "med" });

  // 모든 인프라가 null이면 score: 0 반환
  if (items.length === 0) {
    return {
      score: 0,
      breakdown: { bus: null, school: null, university: null, medical: null, transit: null },
    };
  }

  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  const weightedSum = items.reduce((sum, i) => sum + i.score * i.weight, 0);
  const normalizedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    score: Math.round((normalizedScore * MAX_BONUS) / 100),
    breakdown: {
      bus: params.bus ? busScore : null,
      school: (params.school && params.school.totalCount > 0) ? (items.find(i => i.key === "school")?.score ?? null) : null,
      university: (params.university && params.university.count > 0) ? (items.find(i => i.key === "univ")?.score ?? null) : null,
      medical: (params.medical && params.medical.count > 0) ? (items.find(i => i.key === "med")?.score ?? null) : null,
      transit: transitScore,
    },
  };
}
