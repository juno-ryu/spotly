"use client";

import { Badge } from "@/components/ui/badge";
import { getGrade } from "@/features/analysis/lib/grade";
import type { IndicatorGrade } from "@/features/analysis/lib/grade";

interface GradeBadgeProps {
  /** 총점 (0~100): 내부 등급 계산에만 사용, UI에 숫자 노출 안 함 */
  totalScore: number;
}

/** 등급별 라벨 (설계문서 2-1 기준) */
const GRADE_LABEL: Record<IndicatorGrade, string> = {
  A: "우수한 입지",
  B: "양호한 입지",
  C: "보통 수준",
  D: "주의 필요",
  F: "신중한 검토 필요",
};

/** 등급별 Badge 색상 클래스 (설계문서 2-1 기준) */
const GRADE_BADGE_CLASS: Record<IndicatorGrade, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  B: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800",
  C: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  D: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",
  F: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
};

/** 총점 기반 등급 배지 — 숫자 점수 미노출, 등급만 표시 */
export function GradeBadge({ totalScore }: GradeBadgeProps) {
  const grade = getGrade(totalScore);
  const label = GRADE_LABEL[grade];
  const badgeClass = GRADE_BADGE_CLASS[grade];

  return (
    <div className="flex flex-col items-center">
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full border-[3px] ${badgeClass}`}>
        <span className="text-lg font-black">{grade}</span>
      </div>
      <p className="text-[10px] font-bold mt-0.5">종합 {grade}등급</p>
    </div>
  );
}
