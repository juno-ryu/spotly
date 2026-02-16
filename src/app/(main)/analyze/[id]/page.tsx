import { BackButton } from "@/components/back-button";
import { AnalysisResult } from "@/features/analysis/components/analysis-result";

export default async function AnalysisResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <BackButton />
      <AnalysisResult analysisId={id} />
    </>
  );
}
