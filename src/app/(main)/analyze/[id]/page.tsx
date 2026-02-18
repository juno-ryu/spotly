import { prisma } from "@/server/db/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { AnalysisResult } from "@/features/analysis/components/analysis-result";

export default async function AnalysisResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

const analysis = await prisma.analysisRequest.findUnique({
    where: { id },
  });

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

  return (
    <>
      <BackButton />
      <AnalysisResult data={analysis} />
    </>
  );
}
