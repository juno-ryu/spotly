"use client";

import { useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import type { ScoreBreakdown } from "../schema";
import {
  getIndicatorGrades,
  GRADE_BG,
  type IndicatorGrade,
  type IndicatorGradeInfo,
} from "../lib/grade";

/** 각 지표 인사이트에 표시할 실제 수치 */
export interface IndicatorMeta {
  /** NPS 가입 유지율 (0~1) */
  activeRatio: number;
  /** 아파트 거래 건수 */
  transactionCount: number;
  /** 평균 아파트 거래가 (만원) */
  avgAptPrice: number;
  /** 인구 (동 단위) */
  population?: { totalPopulation: number; households: number };
  /** 동 이름 (예: "역삼동") — 동 단위 인구가 있을 때만 표시 */
  dongName?: string;
}

interface ScoreBreakdownChartProps {
  breakdown: ScoreBreakdown;
  meta?: IndicatorMeta;
}

const INDICATOR_LABELS: Record<keyof ScoreBreakdown, string> = {
  vitality: "상권 활력도",
  competition: "경쟁 강도",
  survival: "생존율",
  residential: "주거 밀도",
  income: "소득 수준",
};

/** 만원 → 억/만 포맷 */
function formatPrice(v: number): string {
  if (v >= 10000) {
    const uk = Math.floor(v / 10000);
    const r = Math.round(v % 10000 / 1000) * 1000;
    return r > 0 ? `${uk}억 ${r.toLocaleString()}만` : `${uk}억`;
  }
  return `${v.toLocaleString()}만`;
}

/** 인구수 포맷 (만 단위) */
function formatPop(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1).replace(/\.0$/, "")}만`;
  return v.toLocaleString();
}

// ── 지표별 인사이트 빌더 ──

type Insight = { first: string; detail?: string };

/** 등급별 감정 표현 매핑 */
const GRADE_EMOJI: Record<IndicatorGrade, string> = {
  A: "🟢", B: "🔵", C: "🟡", D: "🟠", F: "🔴",
};

function buildVitality(grade: IndicatorGrade, meta?: IndicatorMeta): Insight {
  const e = GRADE_EMOJI[grade];
  const pct = meta ? Math.round(meta.activeRatio * 100) : null;

  const first: Record<IndicatorGrade, string> = {
    A: `${e} 상권이 활발하게 운영되고 있어요`,
    B: `${e} 상권 활력이 양호한 편이에요`,
    C: `${e} 상권 활력이 보통 수준이에요`,
    D: `${e} 상권 활력이 다소 낮아요`,
    F: `${e} 상권 활력이 많이 떨어져 있어요`,
  };

  const detail = pct !== null
    ? `주변 동일 업종 사업장 중 ${pct}%가 정상 영업 중이에요`
    : undefined;

  return { first: first[grade], detail };
}

function buildCompetition(grade: IndicatorGrade, _meta?: IndicatorMeta): Insight {
  const e = GRADE_EMOJI[grade];

  const first: Record<IndicatorGrade, string> = {
    A: `${e} 경쟁업체가 적어 진입에 유리해요`,
    B: `${e} 경쟁 수준이 적당해요`,
    C: `${e} 평균적인 경쟁 수준이에요`,
    D: `${e} 동일 업종이 밀집해 있어요`,
    F: `${e} 같은 업종이 매우 밀집해 있어요`,
  };

  const detail: Record<IndicatorGrade, string> = {
    A: "인구 대비 사업장 밀도가 낮아요",
    B: "수요가 검증된 상권이면서 과밀하지 않아요",
    C: "차별화 전략이 있다면 충분히 경쟁 가능해요",
    D: "확실한 차별점이 필요해요",
    F: "치열한 가격·서비스 경쟁이 예상돼요",
  };

  return { first: first[grade], detail: detail[grade] };
}

function buildSurvival(grade: IndicatorGrade, _meta?: IndicatorMeta): Insight {
  const e = GRADE_EMOJI[grade];

  const first: Record<IndicatorGrade, string> = {
    A: `${e} 주변 사업장 대부분이 장기 운영 중이에요`,
    B: `${e} 생존율이 양호해요`,
    C: `${e} 생존율은 평균 수준이에요`,
    D: `${e} 최근 이탈한 사업장이 눈에 띄어요`,
    F: `${e} 사업장 이탈률이 매우 높아요`,
  };

  const detail: Record<IndicatorGrade, string> = {
    A: "폐업 위험이 낮은 안정적인 상권이에요",
    B: "대부분의 사업장이 안정적으로 유지되고 있어요",
    C: "평균 수준의 폐업률이 관찰돼요",
    D: "최근 폐업한 사업장이 다소 많아요",
    F: "폐업률이 높아 신중한 검토가 필요해요",
  };

  return { first: first[grade], detail: detail[grade] };
}

function buildResidential(grade: IndicatorGrade, meta?: IndicatorMeta): Insight {
  const e = GRADE_EMOJI[grade];

  const first: Record<IndicatorGrade, string> = {
    A: `${e} 배후 주거 인구가 풍부해요`,
    B: `${e} 주거 밀도가 양호해요`,
    C: `${e} 주거 밀도는 보통이에요`,
    D: `${e} 주거 인구가 적은 편이에요`,
    F: `${e} 배후 주거 인구가 부족해요`,
  };

  const parts: string[] = [];
  if (meta) {
    // 동 단위 인구가 있으면 표시 (구 단위는 표시 안 함)
    if (meta.population && meta.dongName) {
      parts.push(`${meta.dongName} 부근 배후 주거인구 약 ${formatPop(meta.population.totalPopulation)}명`);
    }
    if (meta.transactionCount > 0) {
      parts.push(`근처 최근 아파트 거래 ${meta.transactionCount}건`);
    }
  }

  return { first: first[grade], detail: parts.length > 0 ? parts.join(" · ") : undefined };
}

function buildIncome(grade: IndicatorGrade, meta?: IndicatorMeta): Insight {
  const e = GRADE_EMOJI[grade];

  const first: Record<IndicatorGrade, string> = {
    A: `${e} 주변 소득 수준이 높아요`,
    B: `${e} 소득 수준이 양호해요`,
    C: `${e} 소득 수준은 전국 평균과 비슷해요`,
    D: `${e} 소득 수준이 낮은 편이에요`,
    F: `${e} 소득 수준이 매우 낮아요`,
  };

  const detail = meta && meta.avgAptPrice > 0
    ? `근처 평균 아파트 거래가 ${formatPrice(meta.avgAptPrice)}`
    : undefined;

  return { first: first[grade], detail };
}

const INSIGHT_BUILDERS: Record<keyof ScoreBreakdown, (grade: IndicatorGrade, meta?: IndicatorMeta) => Insight> = {
  vitality: buildVitality,
  competition: buildCompetition,
  survival: buildSurvival,
  residential: buildResidential,
  income: buildIncome,
};

// ── 컴포넌트 ──

function ScoreRow({ indicatorKey, label, info, meta }: {
  indicatorKey: keyof ScoreBreakdown;
  label: string;
  info: IndicatorGradeInfo;
  meta?: IndicatorMeta;
}) {
  const { first, detail } = INSIGHT_BUILDERS[indicatorKey](info.grade, meta);

  return (
    <div className="space-y-1">
      {/* 등급 + 라벨 - 인사이트 첫째줄 */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold",
            GRADE_BG[info.grade],
          )}
        >
          {info.grade}
        </span>
        <span className="text-sm font-medium text-foreground">
          {label} - {first}
        </span>
      </div>
      {/* 실제 수치 */}
      {detail && (
        <p className="ml-[34px] text-[12px] leading-relaxed text-muted-foreground break-keep-all">
          {detail}
        </p>
      )}
    </div>
  );
}

export const ScoreBreakdownChart = memo(function ScoreBreakdownChart({ breakdown, meta }: ScoreBreakdownChartProps) {
  const grades = useMemo(() => getIndicatorGrades(breakdown), [breakdown]);

  /** 등급(퍼센트) 높은 순으로 정렬 */
  const sortedKeys = useMemo(
    () => (Object.keys(breakdown) as (keyof ScoreBreakdown)[])
      .sort((a, b) => grades[b].percent - grades[a].percent),
    [breakdown, grades],
  );

  return (
    <div className="space-y-4">
      {sortedKeys.map((key) => (
        <ScoreRow
          key={key}
          indicatorKey={key}
          label={INDICATOR_LABELS[key]}
          info={grades[key]}
          meta={meta}
        />
      ))}
    </div>
  );
});
