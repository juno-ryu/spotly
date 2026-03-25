"use client";

import { Progress } from "@/components/ui/progress";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import type { AiReport } from "../schema";
import { getGrade, GRADE_HEX } from "@/features/analysis/lib/grade";

interface CompetitionChartProps {
  competitorCount: NonNullable<AiReport["competitorCount"]>;
  competitionGrade: NonNullable<AiReport["competitionGrade"]>;
}

const PIE_COLORS = {
  직접: "#ef4444",
  간접: "#f97316",
  프랜차이즈: "#8b5cf6",
} as const;

const chartConfig = {
  직접: { label: "직접 경쟁", color: PIE_COLORS["직접"] },
  간접: { label: "간접 경쟁", color: PIE_COLORS["간접"] },
  프랜차이즈: { label: "프랜차이즈", color: PIE_COLORS["프랜차이즈"] },
} satisfies ChartConfig;

/** 밀집도 → grade 색상 (밀집도가 높을수록 나쁨 → 점수 반전) */
function densityColor(percent: number): string {
  return GRADE_HEX[getGrade(100 - percent)];
}

/** 경쟁사 구성 PieChart + 밀집도 Progress */
export function CompetitionChart({
  competitorCount,
  competitionGrade,
}: CompetitionChartProps) {
  const total =
    competitorCount.direct +
    competitorCount.indirect +
    (competitorCount.franchise ?? 0);

  const pieData = [
    { name: "직접", value: competitorCount.direct },
    { name: "간접", value: competitorCount.indirect },
    ...(competitorCount.franchise > 0
      ? [{ name: "프랜차이즈", value: competitorCount.franchise }]
      : []),
  ].filter((d) => d.value > 0);

  const densityPercent = competitorCount.densityPercent ?? 0;
  const densityLabel = competitorCount.densityLabel;

  return (
    <div className="space-y-4">
      {/* PieChart + 범례 */}
      {pieData.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="h-[120px] w-[120px] shrink-0">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                  strokeWidth={2}
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] ?? "#6b7280"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`약 ${value}개`, name]}
                />
              </PieChart>
            </ChartContainer>
          </div>

          {/* 범례 */}
          <div className="space-y-2 text-xs">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      PIE_COLORS[d.name as keyof typeof PIE_COLORS] ?? "#6b7280",
                  }}
                />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-medium">
                  약 {d.value}개{" "}
                  <span className="text-muted-foreground">(추정)</span>
                </span>
              </div>
            ))}
            <div className="pt-1 border-t text-muted-foreground">합계 약 {total}개</div>
          </div>
        </div>
      )}

      {/* 경쟁 밀집도 Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">경쟁 밀집도</span>
          <span className="font-medium">{densityPercent}%</span>
        </div>
        <Progress
          value={densityPercent}
          className="h-2"
          indicatorColor={densityColor(densityPercent)}
        />
        {densityLabel && (
          <p className="text-[10px] text-muted-foreground">{densityLabel}</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {competitionGrade.rationale}
      </p>
      {competitorCount.interpretation && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {competitorCount.interpretation}
        </p>
      )}
    </div>
  );
}
