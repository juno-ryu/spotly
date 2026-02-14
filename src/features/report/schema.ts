import { z } from "zod";

/** AI 리포트 응답 */
export const aiReportSchema = z.object({
  verdict: z.enum(["추천", "조건부 추천", "주의", "비추천"]),
  summary: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
  detailedAnalysis: z.string(),
});
export type AiReport = z.infer<typeof aiReportSchema>;
