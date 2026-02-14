import { AnalysisSkeleton } from "@/features/analysis/components/analysis-skeleton";

export default function AnalysisResultLoading() {
  return (
    <div className="py-4">
      <AnalysisSkeleton />
    </div>
  );
}
