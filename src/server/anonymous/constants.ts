/** 익명 분석 식별 HTTP-only 쿠키 이름 */
export const ANON_COOKIE_NAME = "spotly_anon_id";

/** 익명 quota·쿠키 보관 기간 */
export const ANON_TTL = {
  /** 초 단위 (쿠키 Max-Age, Redis EX 옵션) */
  seconds: 7 * 24 * 60 * 60,
  /** 일 단위 (사용자 안내 메시지) */
  days: 7,
} as const;

/** Redis 키 prefix — quota 사용 여부 표시 */
export const ANON_QUOTA_KEY = (anonymousId: string): string =>
  `anon:${anonymousId}:used`;
