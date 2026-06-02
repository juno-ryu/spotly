import { cookies } from "next/headers";
import { ANON_COOKIE_NAME, ANON_TTL } from "./constants";

/** 익명 ID 쿠키 조회 — 어디서든 호출 가능 (읽기 전용) */
export async function readAnonymousId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ANON_COOKIE_NAME)?.value ?? null;
}

/**
 * 익명 ID 쿠키 조회. 없으면 새 UUID를 7일 HTTP-only 쿠키로 발급한다.
 *
 * ⚠️ Route Handler 또는 Server Action 컨텍스트에서만 호출.
 * Server Component에서 호출하면 Next.js가 `cookies().set()`을 거부하고
 * 원본 에러가 전파된다 (silent fallback 없음 — 잘못된 wiring을 production에서도
 * 즉시 노출하기 위한 의도적 fatal 처리).
 */
export async function getOrCreateAnonymousId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ANON_COOKIE_NAME)?.value;
  if (existing) return existing;

  const fresh = crypto.randomUUID();
  cookieStore.set(ANON_COOKIE_NAME, fresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANON_TTL.seconds,
  });
  return fresh;
}

/** 익명 ID 쿠키 제거 — 가입 직후 OAuth 콜백에서 호출 */
export async function clearAnonymousId(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ANON_COOKIE_NAME);
}
