import { redis } from "@/server/cache/redis";
import { ANON_QUOTA_KEY, ANON_TTL } from "./constants";

/**
 * 익명 quota를 이미 사용했는지 확인.
 *
 * Redis 미설정 환경(로컬 등)에서는 false 반환 — 개발 흐름을 막지 않기 위한 의도적 분기.
 */
export async function isAnonymousQuotaUsed(anonymousId: string): Promise<boolean> {
  if (!redis) return false;
  const value = await redis.get(ANON_QUOTA_KEY(anonymousId));
  return value !== null;
}

/**
 * 익명 quota 소비 — Redis에 7일 TTL로 마킹.
 *
 * Phase 2 호출 규약: `executeAnalysis()` *성공 직후* 호출한다.
 * 실패 시 호출하지 않으면 사용자가 재시도 가능.
 *
 * Redis 미설정 시 no-op (개발 환경 친화).
 */
export async function markAnonymousQuotaUsed(anonymousId: string): Promise<void> {
  if (!redis) return;
  await redis.set(ANON_QUOTA_KEY(anonymousId), "1", { ex: ANON_TTL.seconds });
}
