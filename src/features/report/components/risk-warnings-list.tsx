"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { AiReport } from "../schema";

interface RiskWarningsListProps {
  riskWarnings: NonNullable<AiReport["riskWarnings"]>;
}

/** 위험도별 Alert 배경/테두리 색상 */
function severityClass(severity: "위험" | "경고" | "주의"): string {
  switch (severity) {
    case "위험":
      return "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30";
    case "경고":
      return "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30";
    case "주의":
      return "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30";
  }
}

/** 위험도별 Badge 색상 */
function severityBadgeClass(severity: "위험" | "경고" | "주의"): string {
  switch (severity) {
    case "위험":
      return "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300";
    case "경고":
      return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300";
    case "주의":
      return "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300";
  }
}

/** 위험도별 이모지 */
const SEVERITY_EMOJI: Record<string, string> = {
  위험: "🔴",
  경고: "🟠",
  주의: "🟡",
};

/** 리스크 경고 목록 — 위험도별 색상 구분 Alert, 왼쪽 정렬 */
export function RiskWarningsList({ riskWarnings }: RiskWarningsListProps) {
  return (
    <div className="space-y-3 text-left">
      {riskWarnings.map((risk, i) => (
        <Alert key={i} className={`${severityClass(risk.severity)} py-3`}>
          <AlertDescription className="space-y-1 text-left">
            {/* 제목 행 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>{SEVERITY_EMOJI[risk.severity]}</span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${severityBadgeClass(risk.severity)}`}
              >
                {risk.severity}
              </Badge>
              <span className="text-sm font-semibold text-foreground">
                {risk.title}
              </span>
            </div>
            {/* 상세 내용 */}
            <p className="text-xs text-muted-foreground leading-relaxed pl-0.5">
              {risk.detail}
            </p>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
