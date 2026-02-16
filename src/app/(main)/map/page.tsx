"use client";

import { MapRadiusStep } from "@/features/map/components/map-radius-step";
import { useWizardGuard } from "@/features/analysis/hooks/use-wizard-guard";

/** Step 4+5: 지도 위치 선택 + 반경 설정 */
export default function MapPage() {
  const { isReady } = useWizardGuard(["selectedIndustry", "selectedRegion"]);

  if (!isReady) return null;

  return <MapRadiusStep />;
}
