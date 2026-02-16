import { BackButton } from "@/components/back-button";
import { AnalysisForm } from "@/features/analysis/components/analysis-form";

export default function AnalyzePage() {
  return (
    <div className="py-4">
      <BackButton />
      <AnalysisForm />
    </div>
  );
}
