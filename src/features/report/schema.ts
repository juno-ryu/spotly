import { z } from "zod";

/** AI 리포트 응답 — AI 출력 유연성을 위해 대부분 optional 허용 */
export const aiReportSchema = z.object({
  verdict: z.enum(["추천", "조건부 추천", "주의", "비추천"]),
  analysisScope: z.string().optional(),
  summary: z.string(),

  competitorCount: z.object({
    direct: z.number(),
    indirect: z.number(),
    franchise: z.number(),
    interpretation: z.string(),
    /** 경쟁 밀집도 (0~100, AI가 맥락 판단하여 산출) */
    densityPercent: z.number().optional(),
    /** 밀집도 한 줄 해석 */
    densityLabel: z.string().optional(),
  }).optional(),

  competitionGrade: z.object({
    grade: z.string(),
    score: z.number(),
    label: z.string(),
    rationale: z.string(),
  }).optional(),

  revenueEstimate: z.object({
    monthlyPerStoreMaan: z.number().optional(),
    peakTimeSlot: z.string().optional(),
    mainAgeGroup: z.string().optional(),
    storeCount: z.number().optional(),
    interpretation: z.string().optional(),
  }).nullable().optional(),

  revenueEstimateUnavailableReason: z.string().nullable().optional(),

  survivalAnalysis: z.object({
    closeRate: z.number(),
    openRate: z.number(),
    isHighCloseRate: z.boolean(),
    interpretation: z.string(),
    dataSource: z.string().optional(),
  }).nullable().optional(),

  riskWarnings: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      severity: z.enum(["위험", "경고", "주의"]),
    }),
  ).optional(),

  strategy: z.object({
    positioning: z.string(),
    actionItems: z.array(z.string()),
    targetCustomer: z.string(),
    recommendedHours: z.string().nullable().optional(),
  }).optional(),

  locationAdvice: z.object({
    currentAssessment: z.string(),
    suggestions: z.array(
      z.object({
        direction: z.string(),
        rationale: z.string(),
      }),
    ).default([]),
  }).nullable().optional(),

  populationInsight: z.object({
    headline: z.string(),
    body: z.string(),
    /** 외부 수요 의존도 (0~100, AI가 유동인구/배후인구 비율 등을 종합 판단) */
    exteriorDependencyPercent: z.number().optional(),
    /** 외부 의존도 한 줄 해석 */
    exteriorDependencyLabel: z.string().optional(),
  }).nullable().optional(),

  infrastructureInsight: z.object({
    headline: z.string(),
    body: z.string(),
  }).nullable().optional(),

  detailedAnalysis: z.string(),
});
export type AiReport = z.infer<typeof aiReportSchema>;
