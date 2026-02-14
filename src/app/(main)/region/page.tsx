"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RegionSelector } from "@/features/onboarding/components/region-selector";
import { useWizardStore } from "@/features/analysis/stores/wizard-store";
import { useWizardGuard } from "@/features/analysis/hooks/use-wizard-guard";
import type { OnboardingRegion } from "@/features/onboarding/constants/regions";
import type { OnboardingIndustry } from "@/features/onboarding/constants/industries";

/** Step 3: 지역 선택 */
export default function RegionPage() {
  const router = useRouter();
  const { isReady } = useWizardGuard(["selectedIndustry"]);
  const selectedIndustry = useWizardStore((s) => s.selectedIndustry);
  const setSelectedRegion = useWizardStore((s) => s.setSelectedRegion);

  useEffect(() => {
    router.prefetch("/map");
  }, [router]);

  const handleNext = useCallback(
    (region: OnboardingRegion) => {
      setSelectedRegion({
        name: region.name,
        latitude: region.latitude,
        longitude: region.longitude,
        zoom: region.zoom,
      });
      router.push("/map");
    },
    [setSelectedRegion, router],
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (!isReady || !selectedIndustry) return null;

  // wizard-store의 SelectedIndustry → OnboardingIndustry 변환
  const industryProp: OnboardingIndustry = {
    emoji: selectedIndustry.emoji,
    name: selectedIndustry.name,
    keyword: "",
    ksicCode: selectedIndustry.code,
    seoulCode: "",
  };

  return (
    <RegionSelector
      selectedIndustry={industryProp}
      onNext={handleNext}
      onBack={handleBack}
    />
  );
}
