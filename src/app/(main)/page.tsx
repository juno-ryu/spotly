import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/server/supabase/server";
import { WelcomePageClient } from "@/features/onboarding/components/welcome-page-client";

export const metadata: Metadata = {
  title: "스팟리 - AI 창업 입지 분석",
  description: "주소와 업종만 입력하면 AI가 공공데이터로 창업 입지를 분석해드려요. 경쟁 강도, 유동인구, 교통, 인프라를 종합한 100점 만점 리포트.",
  alternates: {
    canonical: "https://spotly-beta.vercel.app",
  },
  openGraph: {
    title: "스팟리 - AI 창업 입지 분석",
    description: "주소와 업종만 입력하면 AI가 공공데이터로 창업 입지를 분석해드려요. 경쟁 강도, 유동인구, 교통, 인프라를 종합한 100점 만점 리포트.",
  },
};

/** 웰컴 페이지 — 로그인 상태면 /industry로 바로 이동 */
export default async function HomePage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/industry");

  return <WelcomePageClient />;
}
