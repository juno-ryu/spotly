"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Business {
  name: string;
  address: string;
  employeeCount: number;
  status: "active" | "suspended" | "closed";
  monthlyTrend: number[];
}

interface BusinessTableProps {
  businesses: Business[];
}

const STATUS_CONFIG = {
  active: { label: "활성", variant: "default" as const },
  suspended: { label: "휴업", variant: "secondary" as const },
  closed: { label: "폐업", variant: "destructive" as const },
};

/** 6개월 추이 계산 */
function calculateTrend(trend: number[]): { text: string; positive: boolean } {
  if (trend.length < 2) return { text: "-", positive: true };

  const mid = Math.floor(trend.length / 2);
  const recent = trend.slice(mid);
  const prev = trend.slice(0, mid);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;

  if (prevAvg === 0) return { text: "-", positive: true };

  const change = ((recentAvg - prevAvg) / prevAvg) * 100;
  const positive = change >= 0;

  return {
    text: `${positive ? "+" : ""}${change.toFixed(1)}%`,
    positive,
  };
}

export function BusinessTable({ businesses }: BusinessTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>사업장명</TableHead>
          <TableHead className="text-right">직원 수</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="text-right">6개월 추이</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {businesses.map((biz, i) => {
          const trend = calculateTrend(biz.monthlyTrend);
          const statusConfig = STATUS_CONFIG[biz.status];

          return (
            <TableRow key={i}>
              <TableCell className="font-medium">{biz.name}</TableCell>
              <TableCell className="text-right">{biz.employeeCount}명</TableCell>
              <TableCell>
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              </TableCell>
              <TableCell
                className={`text-right font-mono ${
                  trend.positive ? "text-green-400" : "text-red-400"
                }`}
              >
                {trend.text}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
