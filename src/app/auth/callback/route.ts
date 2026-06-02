import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/server/supabase/server";
import { readAnonymousId, clearAnonymousId } from "@/server/anonymous/cookie";
import { migrateAnonymousToUser } from "@/server/anonymous/repository";

/** OAuth 콜백 — code를 세션으로 교환 + 익명 분석 이력 승계 + returnTo로 redirect */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  if (code) {
    const supabase = await createSupabaseServer();
    await supabase.auth.exchangeCodeForSession(code);

    // 익명 분석 이력 승계 — best-effort. 실패해도 가입 자체는 성공.
    try {
      const anonymousId = await readAnonymousId();
      if (anonymousId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await migrateAnonymousToUser(anonymousId, user.id);
          await clearAnonymousId();
        }
      }
    } catch (error) {
      // 마이그레이션 실패는 로그만 — 가입 흐름은 막지 않는다
      console.error("[auth/callback] anonymous migration failed:", error);
    }
  }

  // returnTo 쿠키 읽고 삭제
  const cookieStore = await cookies();
  const returnTo = cookieStore.get("auth_return_to")?.value;
  cookieStore.delete("auth_return_to");

  const redirectPath = returnTo?.startsWith("/") ? returnTo : "/industry";
  return NextResponse.redirect(`${origin}${redirectPath}`);
}
