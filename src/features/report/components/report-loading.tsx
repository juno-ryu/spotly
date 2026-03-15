"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const DATA_STEPS = [
  "국민연금(NPS) 사업체 데이터",
  "카카오 주변 상권 데이터",
  "서울 골목상권 활력 데이터",
  "인구 데이터",
  "버스·지하철 교통 데이터",
  "학교·대학·의료 인프라 데이터",
];

const AI_STEP = "AI가 리포트를 작성하고 있습니다";

// 각 단계 간 딜레이 (ms)
const STEP_INTERVAL = 2200;

type StepStatus = "done" | "active" | "pending";

function getStatus(index: number, activeIndex: number): StepStatus {
  if (index < activeIndex) return "done";
  if (index === activeIndex) return "active";
  return "pending";
}

function StepItem({
  label,
  status,
  isAi,
}: {
  label: string;
  status: StepStatus;
  isAi?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 transition-all duration-500"
      style={{
        opacity: status === "pending" ? 0.35 : 1,
        transform: status === "pending" ? "translateY(4px)" : "translateY(0)",
      }}
    >
      {/* 아이콘 영역 */}
      <span className="w-5 h-5 flex items-center justify-center shrink-0">
        {status === "done" && (
          <span className="text-emerald-500 text-base leading-none">✓</span>
        )}
        {(status === "active") && (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        )}
        {status === "pending" && (
          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 block mx-auto" />
        )}
      </span>

      {/* 텍스트 */}
      <span
        className={
          status === "done"
            ? "text-sm text-foreground"
            : status === "active"
              ? "text-sm font-medium text-foreground"
              : "text-sm text-muted-foreground"
        }
      >
        {isAi ? label : status === "done" ? `${label} 수집 완료` : status === "active" ? `${label} 취합 중...` : label}
      </span>
    </div>
  );
}

export function ReportLoading() {
  // 0 ~ DATA_STEPS.length: DATA_STEPS 인덱스
  // DATA_STEPS.length: AI 단계 (마지막, 항상 active)
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeIndex >= DATA_STEPS.length) return;

    const timer = setTimeout(() => {
      setActiveIndex((prev) => prev + 1);
    }, STEP_INTERVAL);

    return () => clearTimeout(timer);
  }, [activeIndex]);

  const isAiActive = activeIndex >= DATA_STEPS.length;

  return (
    <div className="flex flex-col justify-center min-h-[60vh] px-6">
      <div className="w-full max-w-sm space-y-3">
        {/* 제목 */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">
          데이터 수집 중
        </p>

        {/* 데이터 수집 단계 */}
        {DATA_STEPS.map((label, i) => (
          <StepItem
            key={label}
            label={label}
            status={getStatus(i, activeIndex)}
          />
        ))}

        {/* 구분선 */}
        <div className="border-t border-border/50 my-4" />

        {/* AI 작성 단계 */}
        <StepItem
          label={AI_STEP}
          status={isAiActive ? "active" : "pending"}
          isAi
        />
      </div>
    </div>
  );
}
