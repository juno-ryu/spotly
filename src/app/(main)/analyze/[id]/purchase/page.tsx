import { prisma } from "@/server/db/prisma";
import { notFound, redirect } from "next/navigation";
import { PurchaseClient } from "@/features/analysis/components/purchase-client";

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const analysis = await prisma.analysisRequest.findUnique({
    where: { id },
    select: {
      id: true,
      address: true,
      industryName: true,
      totalScore: true,
      aiReportJson: true,
    },
  });

  if (!analysis) notFound();

  // 이미 리포트가 생성된 경우 리포트 페이지로 이동
  if (analysis.aiReportJson) redirect(`/report/${id}`);

  return (
    <PurchaseClient
      analysis={{
        id: analysis.id,
        address: analysis.address,
        industryName: analysis.industryName,
        totalScore: analysis.totalScore ?? 0,
      }}
    />
  );
}
