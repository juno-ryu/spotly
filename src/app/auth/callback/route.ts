import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/server/supabase/server";

/** OAuth 콜백 — code를 세션으로 교환 후 returnTo 경로로 redirect */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  if (code) {
    const supabase = await createSupabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // returnTo 쿠키 읽고 삭제
  const cookieStore = await cookies();
  const returnTo = cookieStore.get("auth_return_to")?.value;
  cookieStore.delete("auth_return_to");

  const redirectPath = returnTo?.startsWith("/") ? returnTo : "/industry";
  return NextResponse.redirect(`${origin}${redirectPath}`);
}
