import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/server/supabase/server";

/** Google OAuth 콜백 처리 — code를 세션으로 교환 후 홈으로 redirect */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // next 파라미터 또는 host 헤더로 올바른 origin 결정
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  if (code) {
    const supabase = await createSupabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/industry`);
}
