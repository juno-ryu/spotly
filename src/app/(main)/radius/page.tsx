"use client";

import { RadiusSettingStep } from "@/features/map/components/radius-setting-step";
import { useWizardGuard } from "@/features/analysis/hooks/use-wizard-guard";

/** Step 5: 반경 설정 + 경쟁업체 */
export default function RadiusPage() {
  const { isReady } = useWizardGuard([
    "selectedIndustry",
    "selectedRegion",
    "selectedLocation",
  ]);

  if (!isReady) return null;

  return <RadiusSettingStep />;
}
