import { AnalysisResult } from "@/features/analysis/components/analysis-result";

export default async function AnalysisResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="py-4">
      <AnalysisResult analysisId={id} />
    </div>
  );
}
