import { z } from "zod";

/** AI 리포트 응답 */
export const aiReportSchema = z.object({
  /** 종합 판단 (추천/조건부 추천/주의/비추천) */
  verdict: z.enum(["추천", "조건부 추천", "주의", "비추천"]),
  /** 분석 범위 안내 (예: "반경 300m 균형 분석 기준으로 살펴봤어요") */
  analysisScope: z.string(),
  /** 한 줄 종합 판단 (50자 이내) */
  summary: z.string(),

  /** (1) 경쟁업체 수 */
  competitorCount: z.object({
    direct: z.number(),
    indirect: z.number(),
    franchise: z.number(),
    /** 한 줄 해석 (데이터 수치 포함) */
    interpretation: z.string(),
  }),

  /** (2) 경쟁강도 등급 */
  competitionGrade: z.object({
    grade: z.string(),
    score: z.number(),
    label: z.string(),
    /** 핵심 근거 (데이터 기반) */
    rationale: z.string(),
  }),

  /** (3) 예상 매출 범위 — 서울(vitality 있을 때)만 산출, 비서울은 null */
  revenueEstimate: z
    .object({
      /** 점포당 월 평균 매출 (만원) */
      monthlyPerStoreMaan: z.number(),
      peakTimeSlot: z.string(),
      mainAgeGroup: z.string(),
      /** 매출 산출 기준 점포 수 */
      storeCount: z.number(),
      /** 매출 해석 — "점포 수가 적으면 왜곡 가능성" 맥락 포함 */
      interpretation: z.string(),
    })
    .nullable(),

  /** 비서울 등 매출 데이터 없을 때 사유 */
  revenueEstimateUnavailableReason: z.string().nullable().optional(),

  /** (4) 생존율 분석 — 비서울(데이터 없음)은 null */
  survivalAnalysis: z
    .object({
      closeRate: z.number(),
      openRate: z.number(),
      isHighCloseRate: z.boolean(),
      /** 2~3문장 해석 */
      interpretation: z.string(),
      dataSource: z.string(),
    })
    .nullable(),

  /** (5) 리스크 경고 */
  riskWarnings: z.array(
    z.object({
      title: z.string(),
      /** 구체적 내용 (데이터 수치 포함) */
      detail: z.string(),
      severity: z.enum(["위험", "경고", "주의"]),
    }),
  ),

  /** (6) 맞춤형 창업 전략 */
  strategy: z.object({
    positioning: z.string(),
    actionItems: z.array(z.string()),
    targetCustomer: z.string(),
    recommendedHours: z.string().nullable(),
  }),

  /** (7) 입지 활용 전략 및 보완 제안 */
  locationAdvice: z.object({
    /** 현 입지 총평 (1~2문장) */
    currentAssessment: z.string(),
    /** 활용/보완 방향 제안 */
    suggestions: z.array(
      z.object({
        direction: z.string(),
        rationale: z.string(),
      }),
    ),
  }),

  /** (8) 배후 인구 분석 — 데이터 없으면 null */
  populationInsight: z
    .object({
      headline: z.string(),
      body: z.string(),
    })
    .nullable(),

  /** (9) 주변 인프라 분석 (교통·학교·의료 등) */
  infrastructureInsight: z
    .object({
      headline: z.string(),
      body: z.string(),
    })
    .nullable(),

  /** 상세 분석 (3~5문단, 마크다운 지원) */
  detailedAnalysis: z.string(),
});
export type AiReport = z.infer<typeof aiReportSchema>;
