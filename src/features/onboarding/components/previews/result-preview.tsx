import { GRADIENT_TEXT_STYLE as GRADIENT_STYLE } from "@/constants/site";
import { formatRadius } from "@/lib/format";
import { GRADE_HEX, type IndicatorGrade } from "@/features/analysis/lib/grade";
import type { PreviewData } from "../../lib/get-random-preview-report";
import { FakeMap } from "./fake-map";

interface ResultPreviewProps {
  preview: PreviewData;
}

/** preview fold 에서 표시할 기본 반경(m) */
const DEFAULT_PREVIEW_RADIUS = 300;

/**
 * Fold 6 — AnalysisResult 시각 재현.
 * FakeMap 배경 + 분석 결과 바텀시트 (사이드이펙트 0).
 */
export function ResultPreview({ preview }: ResultPreviewProps) {
  const gradeColor =
    GRADE_HEX[preview.grade as IndicatorGrade] ?? "#6b7280";
  const competitorCount = preview.aiReportJson?.competitorCount?.direct;
  const competitionScore = preview.scoreDetail?.competition?.score;
  const populationScore = preview.scoreDetail?.population?.score;
  const vitalityScore = preview.scoreDetail?.vitality?.score;

  return (
    <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
      {/* 배경 가짜 지도 */}
      <FakeMap radius={DEFAULT_PREVIEW_RADIUS} />

      {/* 바텀시트 */}
      <div className="absolute bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t flex flex-col overflow-hidden max-h-[85%]">
        {/* 드래그 핸들 (visual) */}
        <div className="flex justify-center pt-3 pb-3 shrink-0">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* 헤더 + 등급 */}
        <div className="shrink-0 px-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-white text-2xl font-black"
                style={{ background: gradeColor }}
              >
                {preview.grade}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-foreground/80 break-keep leading-snug">
                📍{" "}
                <span className="font-bold" style={GRADIENT_STYLE}>
                  {preview.address}
                </span>{" "}
                부근
              </p>
              <p className="text-[13px] text-foreground/80">
                반경{" "}
                <span className="font-bold" style={GRADIENT_STYLE}>
                  {formatRadius(DEFAULT_PREVIEW_RADIUS)}
                </span>{" · "}
                <span className="font-bold" style={GRADIENT_STYLE}>
                  {preview.industryName}
                </span>
                {competitorCount != null && (
                  <>
                    {" "}
                    <span className="font-bold" style={GRADIENT_STYLE}>
                      {competitorCount}개
                    </span>
                  </>
                )}
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">
                ✨ AI 판정: {preview.verdict}
              </p>
            </div>
          </div>
        </div>

        {/* 메트릭 카드 */}
        <div className="flex-1 overflow-hidden px-4 pb-4 mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="종합 점수" value={preview.totalScore} unit="/100" tone="primary" />
            {competitionScore != null && (
              <MetricCard label="경쟁 강도" value={Math.round(competitionScore)} unit="/100" />
            )}
            {vitalityScore != null && (
              <MetricCard label="상권 활력도" value={Math.round(vitalityScore)} unit="/100" />
            )}
            {populationScore != null && (
              <MetricCard label="배후 인구" value={Math.round(populationScore)} unit="/100" />
            )}
          </div>

          <div className="rounded-lg border bg-card p-3 text-[12px] text-muted-foreground space-y-1">
            <div>🚇 인근 지하철 · 🚌 버스 노선</div>
            <div>🏫 학교 · 🏥 의료 · 🎓 대학교</div>
          </div>
        </div>

        {/* CTA — visual only */}
        <div className="shrink-0 px-4 pb-3 pt-3 border-t bg-background">
          <div className="w-full h-12 rounded-xl bg-violet-600 text-white font-bold text-base flex items-center justify-center">
            AI 맞춤 리포트 받기
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  tone?: "default" | "primary";
}

function MetricCard({ label, value, unit, tone = "default" }: MetricCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === "primary" ? "border-violet-200 bg-violet-50/50" : "bg-card"
      }`}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold ${
          tone === "primary" ? "text-violet-600" : "text-foreground"
        }`}
      >
        {value}
        <span className="text-[11px] font-normal text-muted-foreground">
          {unit}
        </span>
      </p>
    </div>
  );
}
