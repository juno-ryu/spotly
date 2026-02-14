"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ScoreBreakdown } from "../schema";
import {
  getIndicatorGrades,
  GRADE_BG,
  GRADE_LABEL,
  type IndicatorGradeInfo,
} from "../lib/grade";

interface ScoreBreakdownChartProps {
  breakdown: ScoreBreakdown;
}

const INDICATOR_LABELS: Record<keyof ScoreBreakdown, string> = {
  vitality: "상권 활력도",
  competition: "경쟁 강도",
  survival: "생존율",
  residential: "주거 밀도",
  income: "소득 수준",
};

const INDICATOR_ORDER: (keyof ScoreBreakdown)[] = [
  "vitality",
  "competition",
  "survival",
  "residential",
  "income",
];

function GradeBadge({ info }: { info: IndicatorGradeInfo }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold",
        GRADE_BG[info.grade],
      )}
      title={GRADE_LABEL[info.grade]}
    >
      {info.grade}
    </span>
  );
}

export function ScoreBreakdownChart({ breakdown }: ScoreBreakdownChartProps) {
  const grades = getIndicatorGrades(breakdown);

  return (
    <div className="space-y-4">
      {INDICATOR_ORDER.map((key) => {
        const info = grades[key];
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <GradeBadge info={info} />
                <span>{INDICATOR_LABELS[key]}</span>
              </div>
              <span className="font-mono text-sm font-medium">
                {info.percent}%
              </span>
            </div>
            <Progress value={info.percent} className="h-2" />
          </div>
        );
      })}
    </div>
  );
}
