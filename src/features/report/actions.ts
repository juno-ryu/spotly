"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/server/db/prisma";
import { hasApiKey } from "@/lib/env";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "./lib/prompt-builder";
import { aiReportSchema } from "./schema";

export async function generateReport(analysisId: string) {
  if (!hasApiKey.anthropic) {
    return {
      success: false as const,
      error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.",
    };
  }
  const analysis = await prisma.analysisRequest.findUnique({
    where: { id: analysisId },
  });

  if (!analysis || analysis.status !== "COMPLETED") {
    return { success: false as const, error: "분석이 완료되지 않았습니다" };
  }

  if (analysis.aiReportJson) {
    return { success: true as const, data: analysis.aiReportJson };
  }

  const reportData = analysis.reportData as Record<string, unknown> | null;
  const scoreDetail = analysis.scoreDetail as Record<string, number> | null;

  if (!scoreDetail || !reportData) {
    return { success: false as const, error: "분석 데이터가 없습니다" };
  }

  const businesses = (reportData.businesses as Array<{ status: string }>) ?? [];

  const prompt = buildAnalysisPrompt({
    address: analysis.address,
    industryName: analysis.industryName,
    radius: analysis.radius,
    totalScore: analysis.totalScore ?? 0,
    scoreDetail: {
      vitality: scoreDetail.vitality ?? 0,
      competition: scoreDetail.competition ?? 0,
      survival: scoreDetail.survival ?? 0,
      residential: scoreDetail.residential ?? 0,
      income: scoreDetail.income ?? 0,
    },
    businessCount: businesses.length,
    activeCount: businesses.filter((b) => b.status === "active").length,
    suspendedCount: businesses.filter((b) => b.status === "suspended").length,
    closedCount: businesses.filter((b) => b.status === "closed").length,
    avgApartmentPrice: (reportData.avgApartmentPrice as number) ?? 0,
    transactionCount: (reportData.transactionCount as number) ?? 0,
    population: reportData.population as
      | { totalPopulation: number; households: number }
      | undefined,
    golmok: reportData.golmok as
      | Parameters<typeof buildAnalysisPrompt>[0]["golmok"]
      | undefined,
  });

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";
    // Claude가 ```json ... ``` 코드블록으로 감쌀 수 있으므로 제거
    const text = rawText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    const reportJson = aiReportSchema.parse(JSON.parse(text));

    await prisma.analysisRequest.update({
      where: { id: analysisId },
      data: {
        aiSummary: reportJson.summary,
        aiReportJson: JSON.parse(JSON.stringify(reportJson)),
      },
    });

    return { success: true as const, data: reportJson };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("AI 리포트 생성 실패:", errMsg, error);
    return {
      success: false as const,
      error: `AI 리포트 생성 중 오류: ${errMsg}`,
    };
  }
}
