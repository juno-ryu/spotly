"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ScoreBreakdown } from "@/features/analysis/schema";
import { getGrade, GRADE_HEX } from "@/features/analysis/lib/grade";

interface PopulationInsightCardProps {
  populationScore: NonNullable<ScoreBreakdown["population"]>;
  headline: string;
  body: string;
  /** AI가 판단한 외부 수요 의존도 (0~100) */
  exteriorDependencyPercent?: number;
  /** AI가 작성한 의존도 해석 */
  exteriorDependencyLabel?: string;
}

/** 인구 지표 시각화 카드 — 점수/등급 강조 + 외부 의존도 게이지 + AI 인사이트 */
export function PopulationInsightCard({
  populationScore,
  headline,
  body,
  exteriorDependencyPercent,
  exteriorDependencyLabel,
}: PopulationInsightCardProps) {
  const exteriorDependency = exteriorDependencyPercent ?? 0;

  return (
    <div className="space-y-3">
      {/* 지표 카드 2열 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="py-3">
          <CardContent className="px-4 space-y-1.5">
            <p className="text-[10px] text-muted-foreground">👥 배후 인구</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">
                {populationScore.score}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {populationScore.gradeLabel}
            </p>
          </CardContent>
        </Card>

        {exteriorDependency > 0 && (
        <Card className="py-3">
          <CardContent className="px-4 space-y-1.5">
            <p className="text-[10px] text-muted-foreground">🚶 외부 의존도</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">
                {exteriorDependency}
              </span>
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <Progress
              value={exteriorDependency}
              className="h-1.5"
              indicatorColor={GRADE_HEX[getGrade(100 - exteriorDependency)]}
            />
            {exteriorDependencyLabel && (
              <p className="text-[10px] text-muted-foreground">{exteriorDependencyLabel}</p>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* AI 분석 본문 */}
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
