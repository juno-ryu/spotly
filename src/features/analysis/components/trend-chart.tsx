"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// 차트 색상 팔레트
const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"] as const;

interface TrendChartProps {
  /** 사업장별 월별 직원 수 데이터 */
  businesses: Array<{
    name: string;
    monthlyTrend: number[];
  }>;
}

/** 최근 12개월 직원 수 추이 라인 차트 */
export function TrendChart({ businesses }: TrendChartProps) {
  // 데이터가 있는 사업장만 필터
  const validBusinesses = useMemo(
    () => businesses.filter((b) => b.monthlyTrend && b.monthlyTrend.length > 0),
    [businesses],
  );

  // Recharts 데이터 변환: [{month, 사업장A, 사업장B, ...}, ...]
  const chartData = useMemo(() => {
    if (validBusinesses.length === 0) return [];

    const now = new Date();
    const labels: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(`${d.getMonth() + 1}월`);
    }

    return labels.map((label, idx) => {
      const point: Record<string, string | number> = { month: label };
      validBusinesses.slice(0, 5).forEach((biz) => {
        const trend = biz.monthlyTrend;
        const offset = 12 - trend.length;
        point[biz.name] = idx >= offset ? trend[idx - offset] : 0;
      });
      return point;
    });
  }, [validBusinesses]);

  if (validBusinesses.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        추이 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
            label={{
              value: "직원 수",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value}명`]}
          />
          {validBusinesses.slice(0, 5).map((biz, idx) => (
            <Line
              key={`${biz.name}-${idx}`}
              type="monotone"
              dataKey={biz.name}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {/* 범례 */}
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {validBusinesses.slice(0, 5).map((biz, idx) => (
          <span key={`${biz.name}-${idx}`} className="flex items-center gap-1 text-xs">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
            />
            {biz.name}
          </span>
        ))}
      </div>
    </div>
  );
}
