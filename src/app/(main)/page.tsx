import type { Metadata } from "next";
import { WelcomePageClient } from "@/features/onboarding/components/welcome-page-client";

export const metadata: Metadata = {
  title: "스팟리 - AI 창업 입지 분석",
  description: "주소와 업종만 입력하면 AI가 공공데이터로 창업 입지를 분석해드려요. 경쟁 강도, 유동인구, 교통, 인프라를 종합한 100점 만점 리포트.",
  alternates: {
    canonical: "https://spotly.website",
  },
  openGraph: {
    title: "스팟리 - AI 창업 입지 분석",
    description: "주소와 업종만 입력하면 AI가 공공데이터로 창업 입지를 분석해드려요. 경쟁 강도, 유동인구, 교통, 인프라를 종합한 100점 만점 리포트.",
  },
};

/** 웰컴 페이지 */
export default async function HomePage() {
  return <WelcomePageClient />;
}
