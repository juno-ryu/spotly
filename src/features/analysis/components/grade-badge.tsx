"use client";

import { Badge } from "@/components/ui/badge";
import { getGrade, GRADE_BG, GRADE_LABEL, type IndicatorGrade } from "@/features/analysis/lib/grade";

interface GradeBadgeProps {
  totalScore: number;
}

/** 총점 기반 등급 배지 — 숫자 점수 미노출, 등급만 표시 */
export function GradeBadge({ totalScore }: GradeBadgeProps) {
  const grade = getGrade(totalScore);
  const label = GRADE_LABEL[grade];
  const badgeClass = GRADE_BG[grade];

  return (
    <div className="flex flex-col items-center">
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full border-[3px] ${badgeClass}`}>
        <span className="text-lg font-black">{grade}</span>
      </div>
      <p className="text-[10px] font-bold mt-0.5">종합 {grade}등급</p>
    </div>
  );
}
