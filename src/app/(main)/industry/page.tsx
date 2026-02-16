"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { IndustrySelector } from "@/features/onboarding/components/industry-selector";
import { useWizardStore } from "@/features/analysis/stores/wizard-store";
import type { OnboardingIndustry } from "@/features/onboarding/constants/industries";

/** Step 2: 업종 선택 */
export default function IndustryPage() {
  const router = useRouter();
  const setSelectedIndustry = useWizardStore((s) => s.setSelectedIndustry);

  useEffect(() => {
    router.prefetch("/region");
  }, [router]);

  const handleNext = useCallback(
    (industry: OnboardingIndustry) => {
      setSelectedIndustry({
        code: industry.ksicCode,
        name: industry.name,
        emoji: industry.emoji,
      });

      router.push("/region");
    },
    [setSelectedIndustry, router],
  );

  return (
    <>
      <BackButton />
      <IndustrySelector onNext={handleNext} />
    </>
  );
}
