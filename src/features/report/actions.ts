"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/server/db/prisma";
import { hasApiKey } from "@/lib/env";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "./lib/prompt-builder";
import { aiReportSchema } from "./schema";
import { scoreToGrade } from "@/features/analysis/lib/scoring/types";
import { createSupabaseServer } from "@/server/supabase/server";
import type { AnalysisData } from "@/features/analysis/actions";

/** AI 리포트 생성 + DB 최초 저장. 클라이언트에서 분석 데이터를 직접 받는다. (places 제외) */
export async function generateReport(analysisData: Omit<AnalysisData, "places">) {
  if (!hasApiKey.anthropic) {
    return {
      success: false as const,
      error: "ANTHROPIC_API_KEY가 설정되지 않았습니다.",
    };
  }

  const { grade: scoreGrade } = scoreToGrade(analysisData.totalScore);

  const prompt = buildAnalysisPrompt({
    address: analysisData.address,
    industryName: analysisData.industryName,
    radius: analysisData.radius,
    totalScore: analysisData.totalScore,
    scoreGrade,
    competition: analysisData.competition,
    vitality: analysisData.vitality,
    population: analysisData.populationAnalysis,
    subway: analysisData.subway,
    bus: analysisData.bus,
    school: analysisData.school,
    university: analysisData.university,
    medical: analysisData.medical,
  });

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const text = rawText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    const parsed = JSON.parse(text);

    // 내부 사고 필드 제거 (DB 저장 불필요)
    delete parsed._reasoning;
    delete parsed._confidence;
    delete parsed._counterpoint;

    const reportJson = aiReportSchema.parse(parsed);

    // 현재 로그인 사용자 ID 조회
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    // AI 리포트 생성 시 DB 최초 INSERT
    const record = await prisma.analysisReport.create({
      data: {
        address: analysisData.address,
        industryName: analysisData.industryName,
        totalScore: analysisData.totalScore,
        scoreDetail: analysisData.scoreDetail ? JSON.parse(JSON.stringify(analysisData.scoreDetail)) : undefined,
        aiReportJson: JSON.parse(JSON.stringify(reportJson)),
        userId: user?.id ?? null,
      },
    });

    return { success: true as const, id: record.id, data: reportJson };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("AI 리포트 생성 실패:", errMsg, error);
    return {
      success: false as const,
      error: `AI 리포트 생성 중 오류: ${errMsg}`,
    };
  }
}
