import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "분석 중",
  description: "입력하신 주소와 업종을 기반으로 창업 입지를 분석하고 있습니다. AI가 공공데이터를 종합해 100점 만점 리포트를 생성해드려요.",
  robots: { index: false },
};
import { BackButton } from "@/components/back-button";
import { AnalysisResult } from "@/features/analysis/components/analysis-result";
import { AnalysisResultSkeleton } from "@/features/analysis/components/analysis-result-skeleton";
import { executeAnalysis, type AnalyzeParams } from "@/features/analysis/actions";
import { createSupabaseServer } from "@/server/supabase/server";

/** searchParams에서 분석 파라미터 추출. 필수값 누락 시 null 반환 */
function parseSearchParams(sp: Record<string, string | string[] | undefined>): AnalyzeParams | null {
  const lat = Number(sp.lat);
  const lng = Number(sp.lng);
  const address = typeof sp.address === "string" ? sp.address : "";
  const code = typeof sp.code === "string" ? sp.code : "";
  const keyword = typeof sp.keyword === "string" ? sp.keyword : "";
  const radius = Number(sp.radius);

  if (!lat || !lng || !address || !code || !keyword || !radius) return null;

  return { lat, lng, address, code, keyword, radius };
}

/** 분석 실행 + 결과 표시 — Suspense 내부에서 비동기 실행 */
async function AnalysisLoader({ params }: { params: AnalyzeParams }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const data = await executeAnalysis(params);
  return <AnalysisResult data={data} isAuthenticated={!!user} />;
}

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parseSearchParams(sp);

  // 필수 파라미터 누락 시 업종 선택 페이지로 리다이렉트
  if (!params) redirect("/industry");

  return (
    <>
      <BackButton />
      <Suspense fallback={<AnalysisResultSkeleton />}>
        <AnalysisLoader params={params} />
      </Suspense>
    </>
  );
}
