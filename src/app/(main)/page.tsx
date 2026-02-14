"use client";

import { useCallback } from "react";
import { OnboardingFlow } from "@/features/onboarding/components/onboarding-flow";
import { MapStep } from "@/features/map/components/map-step";
import { LocationIndustryStep } from "@/features/map/components/location-industry-step";
import { RadiusSettingStep } from "@/features/map/components/radius-setting-step";
import {
  useWizardStore,
  WizardStep,
} from "@/features/analysis/stores/wizard-store";
import type { OnboardingIndustry } from "@/features/onboarding/constants/industries";
import type { OnboardingRegion } from "@/features/onboarding/constants/regions";

/**
 * Phase 2 홈 — 대화형 위자드 진입점
 * Step 1~3(온보딩) → Step 4(지도) → Step 5(반경) → 이후 추후 구현
 */
export default function HomePage() {
  const { step, setStep, setSelectedIndustry, setSelectedRegion } =
    useWizardStore();

  const handleOnboardingComplete = useCallback(
    (industry: OnboardingIndustry, region: OnboardingRegion) => {
      setSelectedIndustry({ code: industry.ksicCode, name: industry.name });
      setSelectedRegion({
        name: region.name,
        latitude: region.latitude,
        longitude: region.longitude,
        zoom: region.zoom,
      });
      setStep(WizardStep.MAP_SEARCH);
    },
    [setSelectedIndustry, setSelectedRegion, setStep],
  );

  return (
    <>
      {/* Step 4: 지도 검색 */}
      {step === WizardStep.MAP_SEARCH && <MapStep />}

      {/* Step 5: 위치 확정 + 업종 선택 (기존 호환용 유지) */}
      {step === WizardStep.LOCATION_INDUSTRY && <LocationIndustryStep />}

      {/* Step 6: 반경 설정 */}
      {step === WizardStep.RADIUS_SETTING && <RadiusSettingStep />}

      {/* Step 1~3: 온보딩 오버레이 */}
      {step === WizardStep.ONBOARDING && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}
    </>
  );
}
