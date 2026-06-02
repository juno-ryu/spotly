"use server";

import { createSupabaseServer } from "@/server/supabase/server";
import { getOrCreateAnonymousId } from "@/server/anonymous/cookie";

/**
 * 분석 진입 준비 — 클라이언트(map-radius-step)에서 router.push 직전에 호출.
 *
 * 분석 자체에는 게이트가 없다. 비로그인 사용자에게 쿠키를 발급해
 * 추후 AI 리포트 quota 체크 및 가입 시 이력 승계에 사용한다.
 *
 * - 로그인 사용자: 통과
 * - 비로그인: 익명 ID 쿠키 발급 + 통과
 */
export type PrepareAnalysisEntryResult =
  | { isAnonymous: false }
  | { isAnonymous: true; anonymousId: string };

export async function prepareAnalysisEntry(): Promise<PrepareAnalysisEntryResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { isAnonymous: false };
  }

  const anonymousId = await getOrCreateAnonymousId();
  return { isAnonymous: true, anonymousId };
}
