import { z } from "zod";

/** 분석 요청 입력 */
export const analysisRequestSchema = z.object({
  address: z.string().trim().min(1, "주소를 입력해주세요"),
  industryCode: z.string().min(1, "업종을 선택해주세요"),
  industryName: z.string(),
  radius: z
    .number()
    .min(100, "반경은 최소 100m입니다")
    .max(3000, "반경은 최대 3000m입니다"),
  latitude: z.number().min(33).max(39),
  longitude: z.number().min(124).max(132),
  /** 법정동코드 앞 5자리 (클라이언트에서 직접 전달, 없으면 서버 지오코딩 fallback) */
  districtCode: z.string().trim().length(5).optional(),
  /** 행정동코드 10자리 (클라이언트 Kakao SDK에서 전달, KOSIS 읍면동 인구 조회용) */
  adminDongCode: z.string().trim().length(10).optional(),
  /** 동 이름 (예: "역삼동") */
  dongName: z.string().trim().optional(),
});
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

/** 지표별 점수 (0~100, 등급 포함) */
const indicatorScoreSchema = z.object({
  score: z.number().min(0).max(100),
  grade: z.string(),
  gradeLabel: z.string(),
});

/** 스코어 상세 — 2지표 독립 체계 (v3) */
export const scoreBreakdownSchema = z.object({
  /** 경쟁 강도 (0~100, Kakao Places 기반, 전국) */
  competition: indicatorScoreSchema,
  /** 상권 활력도 (0~100, 서울 골목상권 기반, 서울 전용) */
  vitality: indicatorScoreSchema.nullable(),
});
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

/** 분석 결과 응답 */
export const analysisResultSchema = z.object({
  id: z.string(),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]),
  address: z.string(),
  industryName: z.string(),
  radius: z.number(),
  totalScore: z.number().nullable(),
  scoreDetail: scoreBreakdownSchema.nullable(),
  aiSummary: z.string().nullable(),
  createdAt: z.string(),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
