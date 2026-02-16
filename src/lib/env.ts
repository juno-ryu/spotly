import { z } from "zod";

/**
 * 환경 변수 스키마.
 *
 * - 필수: DATABASE_URL만 필수 (Prisma가 항상 필요)
 * - 나머지 외부 API 키: optional → 없으면 모킹/비활성 모드로 전환
 */
const envSchema = z.object({
  /** 백엔드 API 기본 URL (서버 전용) */
  API_URL: z.string().url().optional(),
  /** 클라이언트에서 접근 가능한 API URL */
  NEXT_PUBLIC_API_URL: z.string().url().optional(),

  /** PostgreSQL 데이터베이스 연결 URL */
  DATABASE_URL: z.string().min(1, "DATABASE_URL은 필수입니다"),

  /** Upstash Redis REST URL (없으면 캐시 비활성) */
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  /** Upstash Redis REST 토큰 */
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  /** 공공데이터포털(data.go.kr) 통합 인증키 (없으면 모킹 모드) */
  DATA_GO_KR_API_KEY: z.string().optional(),

  /** Kakao 지도 JavaScript SDK 앱 키 (없으면 지도 비활성) */
  NEXT_PUBLIC_KAKAO_MAP_APP_KEY: z.string().optional(),
  /** Kakao REST API 키 (서버 전용, 없으면 지오코딩 모킹) */
  KAKAO_REST_API_KEY: z.string().optional(),

  /** Anthropic Claude API 키 (없으면 AI 리포트 비활성) */
  ANTHROPIC_API_KEY: z.string().optional(),

  /** 서울시 열린데이터 API 키 (선택) */
  SEOUL_OPEN_API_KEY: z.string().optional(),
  /** 통계청 KOSIS API 키 (선택) */
  KOSIS_API_KEY: z.string().optional(),
  /** 공정거래위원회 가맹사업거래 API 키 (선택) */
  FRANCHISE_OPEN_API_KEY: z.string().optional(),
});

export const env = envSchema.parse({
  API_URL: process.env.API_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  DATA_GO_KR_API_KEY: process.env.DATA_GO_KR_API_KEY,
  NEXT_PUBLIC_KAKAO_MAP_APP_KEY: process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY,
  KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  SEOUL_OPEN_API_KEY: process.env.SEOUL_OPEN_API_KEY,
  KOSIS_API_KEY: process.env.KOSIS_API_KEY,
  FRANCHISE_OPEN_API_KEY: process.env.FRANCHISE_OPEN_API_KEY,
});

/** 외부 API 키 존재 여부 헬퍼 */
export const hasApiKey = {
  dataGoKr: Boolean(env.DATA_GO_KR_API_KEY),
  kakaoMap: Boolean(env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY),
  kakaoRest: Boolean(env.KAKAO_REST_API_KEY),
  anthropic: Boolean(env.ANTHROPIC_API_KEY?.startsWith("sk-ant-")),
  redis: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
  kosis: Boolean(env.KOSIS_API_KEY),
  seoul: Boolean(env.SEOUL_OPEN_API_KEY),
  franchise: Boolean(env.FRANCHISE_OPEN_API_KEY),
} as const;
