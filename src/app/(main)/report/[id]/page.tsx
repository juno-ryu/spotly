export const dynamic = "force-dynamic";

import { prisma } from "@/server/db/prisma";
import { notFound } from "next/navigation";
import { ReportViewer } from "@/features/report/components/report-viewer";
import type { AiReport } from "@/features/report/schema";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const analysis = await prisma.analysisRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      address: true,
      industryName: true,
      aiReportJson: true,
    },
  });

  if (!analysis) notFound();

  return (
    <div className="py-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{analysis.address}</h1>
        <p className="text-muted-foreground">{analysis.industryName} · AI 리포트</p>
      </div>

      <ReportViewer
        analysisId={id}
        initialReport={analysis.aiReportJson as AiReport | null}
      />
    </div>
  );
}
