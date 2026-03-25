"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { ScoreBreakdown } from "@/features/analysis/schema";
import { GRADE_HEX, GRADE_BG } from "@/features/analysis/lib/grade";

interface ScoreMetricCardsProps {
  scoreDetail: ScoreBreakdown;
}

/** 지표별 설정 */
const METRIC_CONFIG = [
  { key: "competition" as const, emoji: "🏪", label: "경쟁" },
  { key: "vitality" as const, emoji: "📈", label: "활력" },
  { key: "population" as const, emoji: "👥", label: "인구" },
  { key: "survival" as const, emoji: "📊", label: "생존" },
] as const;

/** 스코어링 지표 카드 그리드 — 2×2(모바일) / 4열(데스크톱) */
export function ScoreMetricCards({ scoreDetail }: ScoreMetricCardsProps) {
  const metrics = METRIC_CONFIG.map(({ key, emoji, label }) => {
    const indicator = scoreDetail[key];
    if (!indicator) return null;
    return { key, emoji, label, indicator };
  }).filter(Boolean);

  if (metrics.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((m) => {
        if (!m) return null;
        const { key, emoji, label, indicator } = m;
        const badgeClass = GRADE_BG[indicator.grade as keyof typeof GRADE_BG] ?? GRADE_BG["C"];
        const color = GRADE_HEX[indicator.grade as keyof typeof GRADE_HEX] ?? "#ef4444";
        return (
          <Card key={key} className="py-3">
            <CardContent className="px-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {emoji} {label}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${badgeClass}`}
                >
                  {indicator.grade}
                </Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums">
                  {indicator.score}
                </span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </div>
              <Progress
                value={indicator.score}
                className="h-1.5"
                indicatorColor={color}
              />
              <p className="text-[10px] text-muted-foreground truncate">
                {indicator.gradeLabel}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
