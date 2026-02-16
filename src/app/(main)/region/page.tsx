"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/back-button";
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
        districtCode: region.districtCode,
      });

      router.push("/map");
    },
    [setSelectedRegion, router],
  );

  if (!isReady || !selectedIndustry) return null;

  const industryProp: OnboardingIndustry = {
    emoji: selectedIndustry.emoji,
    name: selectedIndustry.name,
    keyword: "",
    ksicCode: selectedIndustry.code,
    seoulCode: "",
  };

  return (
    <>
      <BackButton />
      <RegionSelector
        selectedIndustry={industryProp}
        onNext={handleNext}
      />
    </>
  );
}
