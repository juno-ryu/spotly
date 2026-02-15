import { z } from "zod";

/** 분석 요청 입력 */
export const analysisRequestSchema = z.object({
  address: z.string().trim().min(1, "주소를 입력해주세요"),
  industryCode: z.string().min(1, "업종을 선택해주세요"),
  industryName: z.string(),
  radius: z
    .number()
    .refine(
      (v) => [500, 1000, 3000].includes(v),
      "유효하지 않은 반경입니다",
    ),
  latitude: z.number().min(33).max(39),
  longitude: z.number().min(124).max(132),
  /** 법정동코드 앞 5자리 (클라이언트에서 직접 전달, 없으면 서버 지오코딩 폴백) */
  districtCode: z.string().trim().length(5).optional(),
});
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

/** 항목별 점수 */
export const scoreBreakdownSchema = z.object({
  /** 상권 활력도 (0~30) */
  vitality: z.number().min(0).max(30),
  /** 경쟁 강도 (0~25, 역비례) */
  competition: z.number().min(0).max(25),
  /** 생존율 (0~20) */
  survival: z.number().min(0).max(20),
  /** 주거 밀도 (0~15) */
  residential: z.number().min(0).max(15),
  /** 소득 수준 (0~10) */
  income: z.number().min(0).max(10),
});
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

/** 주변 사업장 정보 */
export const nearbyBusinessSchema = z.object({
  name: z.string(),
  address: z.string(),
  employeeCount: z.number(),
  status: z.enum(["active", "suspended", "closed"]),
  monthlyTrend: z.array(z.number()),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export type NearbyBusiness = z.infer<typeof nearbyBusinessSchema>;

/** 신뢰도 (v2) */
export const scoreConfidenceSchema = z.object({
  /** 종합 신뢰도 (0~1) */
  overall: z.number().min(0).max(1),
  /** 지표별 신뢰도 */
  breakdown: z.object({
    vitality: z.number().min(0).max(1),
    competition: z.number().min(0).max(1),
    survival: z.number().min(0).max(1),
    residential: z.number().min(0).max(1),
    income: z.number().min(0).max(1),
  }),
});
export type ScoreConfidence = z.infer<typeof scoreConfidenceSchema>;

/** 분석 결과 응답 */
export const analysisResultSchema = z.object({
  id: z.string(),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]),
  address: z.string(),
  industryName: z.string(),
  radius: z.number(),
  totalScore: z.number().nullable(),
  scoreDetail: scoreBreakdownSchema.nullable(),
  /** 신뢰도 (v2, nullable — 이전 데이터 호환) */
  confidence: scoreConfidenceSchema.nullable().optional(),
  nearbyBusinesses: z.array(nearbyBusinessSchema).nullable(),
  aiSummary: z.string().nullable(),
  createdAt: z.string(),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
