"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { WelcomeScreen } from "./welcome-screen";
import { useWizardStore } from "@/features/analysis/stores/wizard-store";
import type { PreviewData } from "@/features/onboarding/lib/get-random-preview-report";

interface WelcomePageClientProps {
  preview: PreviewData | null;
  reviewSection: React.ReactNode;
}

export function WelcomePageClient({ preview, reviewSection }: WelcomePageClientProps) {
  const router = useRouter();
  const reset = useWizardStore((s) => s.reset);

  const handleNext = useCallback(() => {
    reset();
    router.push("/industry");
  }, [reset, router]);

  return (
    <WelcomeScreen
      onNext={handleNext}
      preview={preview}
      reviewSection={reviewSection}
    />
  );
}
