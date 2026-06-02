import { z } from "zod";

/** 창업 결정 토글 */
export const Decision = {
  /** 시작할게요 */
  WILL_START: "WILL_START",
  /** 검토 중 */
  CONSIDERING: "CONSIDERING",
  /** 보류 */
  WILL_NOT: "WILL_NOT",
  /** 이미 운영 중 */
  ALREADY_STARTED: "ALREADY_STARTED",
} as const;
export type Decision = (typeof Decision)[keyof typeof Decision];

/** 결정별 한국어 라벨 (UI 표시 + 토글 순서) */
export const DECISION_LABEL: Record<Decision, string> = {
  [Decision.WILL_START]: "시작할게요",
  [Decision.CONSIDERING]: "검토 중",
  [Decision.WILL_NOT]: "보류",
  [Decision.ALREADY_STARTED]: "이미 운영 중",
};

/** 토글 표시 순서 — Object.keys 순서에 의존하지 않도록 명시 */
export const DECISION_ORDER: readonly Decision[] = [
  Decision.WILL_START,
  Decision.CONSIDERING,
  Decision.WILL_NOT,
  Decision.ALREADY_STARTED,
];

const decisionEnum = z.enum([
  Decision.WILL_START,
  Decision.CONSIDERING,
  Decision.WILL_NOT,
  Decision.ALREADY_STARTED,
]);

/** 후기 제출 입력 — 클라이언트가 채우는 폼 */
export const submitReviewSchema = z.object({
  reportId: z.string().min(1),
  rating: z
    .number()
    .int("별점을 선택해주세요")
    .min(1, "별점을 선택해주세요")
    .max(5),
  decision: decisionEnum,
  comment: z
    .string()
    .trim()
    .max(500, "코멘트는 500자 이내로 입력해주세요")
    .optional(),
  isPublic: z.boolean(),
});
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

/** 후기 요약 — Server Component → ReviewSummary 로 전달 */
export const reviewSummarySchema = z.object({
  total: z.number().int().min(0),
  averageRating: z.number().nullable(),
  decisionCounts: z.record(decisionEnum, z.number().int().min(0)),
  publicComments: z.array(
    z.object({
      id: z.string(),
      rating: z.number().int(),
      decision: decisionEnum,
      comment: z.string(),
      authorName: z.string().nullable(),
      createdAt: z.string(), // ISO
    }),
  ),
  mine: z
    .object({
      id: z.string(),
      rating: z.number().int(),
      decision: decisionEnum,
      comment: z.string().nullable(),
      authorName: z.string().nullable(),
      isPublic: z.boolean(),
      createdAt: z.string(),
    })
    .nullable(),
});
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;
