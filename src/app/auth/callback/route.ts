import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/server/supabase/server";

/** Google OAuth 콜백 처리 — code를 세션으로 교환 후 홈으로 redirect */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/`);
}
