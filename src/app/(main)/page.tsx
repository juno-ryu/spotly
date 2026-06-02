import type { Metadata } from "next";
import { WelcomePageClient } from "@/features/onboarding/components/welcome-page-client";
import { getRandomPreviewData } from "@/features/onboarding/lib/get-random-preview-report";
import { ReviewSection } from "@/features/review/components/review-section";

export const metadata: Metadata = {
  title: "스팟리 - AI 창업 입지 분석",
  description: "주소와 업종만 입력하면 AI가 공공데이터로 창업 입지를 분석해드려요. 경쟁 강도, 유동인구, 교통, 인프라를 종합한 100점 만점 리포트.",
  alternates: {
    canonical: "https://spotly.website/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://spotly.website",
    siteName: "스팟리 - AI 창업 입지 분석",
    title: "스팟리 - AI 창업 입지 분석",
    description: "주소와 업종만 입력하면 AI가 공공데이터로 창업 입지를 분석해드려요. 경쟁 강도, 유동인구, 교통, 인프라를 종합한 100점 만점 리포트.",
    images: [
      {
        url: "https://spotly.website/api/og",
        width: 1200,
        height: 630,
        alt: "스팟리 - AI 창업 입지 분석",
      },
    ],
  },
};

/** 매 요청마다 새 랜덤 prview 선택 — Math.random() SSR/hydration mismatch 방지 */
export const dynamic = "force-dynamic";

/** 웰컴 페이지 */
export default async function HomePage() {
  const preview = await getRandomPreviewData();

  // ReviewSection 은 server component — page 에서 element 로 만들어 client 컴포넌트에 ReactNode 로 전달
  const reviewSection = preview ? (
    <ReviewSection
      reportId={preview.id}
      reportOwnerId={null}
      currentUserId={null}
      returnTo={`/report/${preview.id}`}
    />
  ) : null;

  return <WelcomePageClient preview={preview} reviewSection={reviewSection} />;
}
