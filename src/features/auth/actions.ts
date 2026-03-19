"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createSupabaseServer } from "@/server/supabase/server";

/** OAuth 로그인 전 returnTo 경로를 쿠키에 저장 */
async function saveReturnTo(formData?: FormData) {
  const returnTo = formData?.get("returnTo") as string | null;
  if (returnTo?.startsWith("/")) {
    const cookieStore = await cookies();
    cookieStore.set("auth_return_to", returnTo, {
      maxAge: 300,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
}

/** Google OAuth 로그인 시작 */
export async function signInWithGoogle(formData?: FormData) {
  await saveReturnTo(formData);

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) throw new Error("Google 로그인 실패");
  redirect(data.url);
}

/** Kakao OAuth 로그인 시작 */
export async function signInWithKakao(formData?: FormData) {
  await saveReturnTo(formData);

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) throw new Error("카카오 로그인 실패");
  redirect(data.url);
}

/** 로그아웃 */
export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
