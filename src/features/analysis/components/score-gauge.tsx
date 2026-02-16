"use client";

import {
  getScoreLevel,
  SCORE_LEVEL_LABEL,
} from "@/constants/enums/score-level";

interface ScoreGaugeProps {
  score: number;
}

/** 점수대별 통합 스타일 맵 (한 번만 조회) */
type ScoreThreshold = "excellent" | "good" | "warning" | "danger";

const SCORE_STYLES: Record<ScoreThreshold, {
  stroke: string;
  text: string;
  bg: string;
  desc: string;
}> = {
  excellent: {
    stroke: "#10b981",
    text: "text-emerald-500",
    bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    desc: "창업하기 좋은 입지에요",
  },
  good: {
    stroke: "#7c3aed",
    text: "text-violet-600",
    bg: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
    desc: "조건부로 추천할 수 있어요",
  },
  warning: {
    stroke: "#f59e0b",
    text: "text-amber-500",
    bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    desc: "신중한 검토가 필요해요",
  },
  danger: {
    stroke: "#ef4444",
    text: "text-red-500",
    bg: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
    desc: "창업 입지로 적합하지 않아요",
  },
};

function getScoreThreshold(score: number): ScoreThreshold {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "warning";
  return "danger";
}

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const level = getScoreLevel(score);
  const label = SCORE_LEVEL_LABEL[level];
  const styles = SCORE_STYLES[getScoreThreshold(score)];
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex items-center gap-5">
      {/* 게이지 */}
      <div className="relative shrink-0">
        <svg width="112" height="112" viewBox="0 0 112 112">
          <circle
            cx="56" cy="56" r={r}
            fill="none"
            className="stroke-muted"
            strokeWidth="8"
          />
          <circle
            cx="56" cy="56" r={r}
            fill="none"
            stroke={styles.stroke}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            transform="rotate(-90 56 56)"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
          <text
            x="56" y="52"
            textAnchor="middle"
            className={`fill-current ${styles.text}`}
            fontSize="24"
            fontWeight="bold"
          >
            {score}
          </text>
          <text
            x="56" y="70"
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="11"
          >
            / 100점
          </text>
        </svg>
      </div>

      {/* 등급 라벨 */}
      <div className="flex flex-col gap-1.5">
        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-bold ${styles.bg}`}>
          {label}
        </span>
        <p className="text-xs text-muted-foreground">{styles.desc}</p>
      </div>
    </div>
  );
}
