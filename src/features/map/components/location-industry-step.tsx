"use client";

import { useCallback } from "react";
import {
  useWizardStore,
  WizardStep,
} from "@/features/analysis/stores/wizard-store";
import { useGeolocation } from "../hooks/use-geolocation";
import { FullscreenMap } from "./fullscreen-map";
import { IndustryBottomSheet } from "@/features/analysis/components/industry-bottom-sheet";

/** Step 4: 위치 확정 + 업종 선택 (PRD Step 4) */
export function LocationIndustryStep() {
  const { position } = useGeolocation();
  const {
    selectedLocation,
    setStep,
    setSelectedIndustry,
  } = useWizardStore();

  // 주소 탭 → Step 3 복귀 (위치 재검색)
  const handleLocationChange = useCallback(() => {
    setStep(WizardStep.MAP_SEARCH);
  }, [setStep]);

  // 업종 선택 → 0.5초 후 Step 5 전환
  const handleIndustrySelect = useCallback(
    (industry: { code: string; name: string }) => {
      setSelectedIndustry(industry);
      setTimeout(() => {
        setStep(WizardStep.RADIUS_SETTING);
      }, 500);
    },
    [setSelectedIndustry, setStep],
  );

  const center = selectedLocation ?? position;

  return (
    <div className="fixed inset-0">
      <FullscreenMap
        centerLat={center.latitude}
        centerLng={center.longitude}
        currentPosition={position}
        selectedPosition={selectedLocation}
      />
      <IndustryBottomSheet
        address={selectedLocation?.name ?? selectedLocation?.address ?? "위치를 선택해주세요"}
        onLocationChange={handleLocationChange}
        onIndustrySelect={handleIndustrySelect}
      />
    </div>
  );
}
