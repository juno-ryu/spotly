"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/server/db/prisma";
import { hasApiKey } from "@/lib/env";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "./lib/prompt-builder";
import { aiReportSchema } from "./schema";
import { scoreToGrade } from "@/features/analysis/lib/scoring/types";
import { createSupabaseServer } from "@/server/supabase/server";
import { getOrCreateAnonymousId } from "@/server/anonymous/cookie";
import {
  isAnonymousQuotaUsed,
  markAnonymousQuotaUsed,
} from "@/server/anonymous/quota";
import type { AnalysisData } from "@/features/analysis/actions";

/**
 * AI 리포트 생성 자격 확인 — 클라이언트가 비싼 generation 전에 게이트 분기에 쓰는 lightweight 체크.
 * Claude 호출이나 DB write 없음. UX 최적화 (GeneratingProgress 깜빡임 방지).
 *
 * 보안은 generateReport에서 다시 한 번 검증한다 (서버 신뢰의 단일 진실).
 */
export async function checkReportEligibility(): Promise<
  { allowed: true } | { allowed: false; reason: "anonymous_quota_exhausted" }
> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return { allowed: true };

  const anonymousId = await getOrCreateAnonymousId();
  const used = await isAnonymousQuotaUsed(anonymousId);
  if (used) {
    return { allowed: false, reason: "anonymous_quota_exhausted" };
  }
  return { allowed: true };
}

/** AI 리포트 생성 + DB 최초 저장. 클라이언트에서 분석 데이터를 직접 받는다. (places 제외) */
export async function generateReport(analysisData: Omit<AnalysisData, "places">) {
  if (!hasApiKey.anthropic) {
    return {
      success: false as const,
      error: "ANTHROPIC_API_KEY가 설정되지 않았습니다.",
    };
  }

  // 인증·익명 quota 사전 체크 — Claude 호출 전에 막아 비용 차단
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let anonymousId: string | null = null;
  if (!user) {
    // 쿠키 없으면 발급 (직접 URL 진입 케이스 대응). 게이트는 Redis quota로만 판단
    anonymousId = await getOrCreateAnonymousId();
    const used = await isAnonymousQuotaUsed(anonymousId);
    if (used) {
      return {
        success: false as const,
        error: "ANONYMOUS_QUOTA_EXHAUSTED" as const,
        reason: "anonymous_quota_exhausted" as const,
      };
    }
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

    // AI 리포트 생성 시 DB 최초 INSERT
    // 비로그인이면 anonymousId 저장 — 가입 시 migrateAnonymousToUser가 userId로 승계
    const record = await prisma.analysisReport.create({
      data: {
        address: analysisData.address,
        industryName: analysisData.industryName,
        totalScore: analysisData.totalScore,
        scoreDetail: analysisData.scoreDetail ? JSON.parse(JSON.stringify(analysisData.scoreDetail)) : undefined,
        lat: analysisData.centerLatitude,
        lng: analysisData.centerLongitude,
        aiReportJson: JSON.parse(JSON.stringify(reportJson)),
        userId: user?.id ?? null,
        anonymousId: user ? null : anonymousId,
      },
    });

    // 비로그인 성공 시 quota 마킹 — 이후 호출 차단
    if (!user && anonymousId) {
      await markAnonymousQuotaUsed(anonymousId);
    }

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
