"use client";

import {
  getScoreLevel,
  SCORE_LEVEL_LABEL,
} from "@/constants/enums/score-level";

interface ScoreGaugeProps {
  score: number;
}

/** 점수 등급별 색상 */
function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "stroke-green-400";
  if (score >= 60) return "stroke-blue-400";
  if (score >= 40) return "stroke-yellow-400";
  return "stroke-red-400";
}

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const level = getScoreLevel(score);
  const label = SCORE_LEVEL_LABEL[level];
  const circumference = 2 * Math.PI * 60;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="160" height="160" viewBox="0 0 160 160">
        {/* 배경 원 */}
        <circle
          cx="80"
          cy="80"
          r="60"
          fill="none"
          className="stroke-muted"
          strokeWidth="12"
        />
        {/* 진행 원 */}
        <circle
          cx="80"
          cy="80"
          r="60"
          fill="none"
          className={getScoreBg(score)}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
        />
        {/* 점수 텍스트 */}
        <text
          x="80"
          y="72"
          textAnchor="middle"
          className={`fill-current ${getScoreColor(score)} text-3xl font-bold`}
          fontSize="32"
        >
          {score}
        </text>
        <text
          x="80"
          y="96"
          textAnchor="middle"
          className="fill-muted-foreground text-sm"
          fontSize="14"
        >
          / 100점
        </text>
      </svg>
      <span
        className={`text-lg font-bold ${getScoreColor(score)}`}
      >
        {label}
      </span>
    </div>
  );
}
