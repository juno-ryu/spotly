import { Suspense } from "react";
import { prisma } from "@/server/db/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { AnalysisResult } from "@/features/analysis/components/analysis-result";
import { AnalysisResultSkeleton } from "@/features/analysis/components/analysis-result-skeleton";
import { executeAnalysis } from "@/features/analysis/actions";

/** 분석 실행 + 결과 표시 — Suspense로 감싸면 분석 완료까지 스켈레톤 표시 */
async function AnalysisLoader({ id }: { id: string }) {
  await executeAnalysis(id);

  const analysis = await prisma.analysisRequest.findUnique({ where: { id } });
  if (!analysis) notFound();

  if (analysis.status === "FAILED") {
    return (
      <div className="rounded-xl bg-muted/50 py-12 text-center px-4 space-y-4">
        <p className="text-destructive font-medium">분석에 실패했습니다.</p>
        <p className="text-sm text-muted-foreground">잠시 후 다시 시도해주세요.</p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
        >
          다시 시도
        </Link>
      </div>
    );
  }

  return <AnalysisResult data={analysis} />;
}

export default async function AnalysisResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 존재 여부 먼저 확인
  const exists = await prisma.analysisRequest.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) notFound();

  return (
    <>
      <BackButton />
      <Suspense fallback={<AnalysisResultSkeleton />}>
        <AnalysisLoader id={id} />
      </Suspense>
    </>
  );
}
