import { Redis } from "@upstash/redis";
import { hasApiKey } from "@/lib/env";

/** Redis 클라이언트 (키 없으면 null) */
const redis = hasApiKey.redis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/** 캐시 TTL 상수 (초 단위) */
export const CACHE_TTL = {
  /** 24시간 (사업장 데이터는 일별 갱신) */
  NPS: 24 * 60 * 60,
  /** 7일 (사업자 상태는 자주 변경 안됨) */
  NTS: 7 * 24 * 60 * 60,
  /** 30일 (월별 갱신) */
  REAL_ESTATE: 30 * 24 * 60 * 60,
  /** 30일 (월별 갱신) */
  KOSIS: 30 * 24 * 60 * 60,
  /** 7일 (서울시 골목상권 분기별 갱신 데이터) */
  SEOUL: 7 * 24 * 60 * 60,
  /** 24시간 (분석 결과) */
  ANALYSIS: 24 * 60 * 60,
} as const;

/** 캐시 우선 조회, 미스 시 fetcher 실행 후 저장. Redis 없으면 항상 fetcher 직행. */
export async function cachedFetch<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (!redis) return fetcher();

  const cached = await redis.get<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  await redis.set(key, data, { ex: ttl });
  return data;
}
