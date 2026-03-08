import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/server/supabase/server";
import { WelcomePageClient } from "@/features/onboarding/components/welcome-page-client";

/** 웰컴 페이지 — 로그인 상태면 /industry로 바로 이동 */
export default async function HomePage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/industry");

  return <WelcomePageClient isLoggedIn={false} />;
}
