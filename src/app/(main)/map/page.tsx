"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapStep } from "@/features/map/components/map-step";
import { useWizardGuard } from "@/features/analysis/hooks/use-wizard-guard";

/** Step 4: 지도 위치 조정 */
export default function MapPage() {
  const router = useRouter();
  const { isReady } = useWizardGuard(["selectedIndustry", "selectedRegion"]);

  useEffect(() => {
    router.prefetch("/radius");
  }, [router]);

  if (!isReady) return null;

  return <MapStep />;
}
