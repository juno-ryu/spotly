"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useWizardStore } from "@/features/analysis/stores/wizard-store";
import { DEFAULT_MAP_ZOOM } from "@/features/onboarding/constants/regions";
import { useGeolocation } from "../hooks/use-geolocation";
import { useNearbyPlaces } from "../hooks/use-nearby-places";
import { RadiusMap } from "./radius-map";
import { RadiusBottomSheet } from "@/features/analysis/components/radius-bottom-sheet";

/** Step 5: 반경 설정 + 경쟁업체 표시 (중심 고정, 반경만 조절) */
export function RadiusSettingStep() {
  const router = useRouter();
  const { position } = useGeolocation();
  const { selectedLocation, selectedIndustry, selectedRegion, setSelectedLocation } =
    useWizardStore();
  const [radius, setRadius] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialCenter = selectedLocation ?? position;

  // 경쟁업체 검색 (고정 센터 기반)
  const { places } = useNearbyPlaces({
    keyword: selectedIndustry?.name ?? "",
    lat: initialCenter.latitude,
    lng: initialCenter.longitude,
    radius,
  });

  const handleRadiusChange = useCallback((newRadius: number) => {
    setRadius(newRadius);
  }, []);

  // 분석 시작 — POST /api/analyze → 결과 페이지로 이동
  const handleAnalyze = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    setSelectedLocation({
      latitude: initialCenter.latitude,
      longitude: initialCenter.longitude,
      address:
        selectedLocation?.address ??
        `${initialCenter.latitude.toFixed(4)}, ${initialCenter.longitude.toFixed(4)}`,
    });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address:
            selectedLocation?.address ??
            `${initialCenter.latitude.toFixed(4)}, ${initialCenter.longitude.toFixed(4)}`,
          latitude: initialCenter.latitude,
          longitude: initialCenter.longitude,
          industryCode: selectedIndustry?.code ?? "",
          industryName: selectedIndustry?.name ?? "",
          radius,
        }),
      });

      if (!res.ok) {
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();
      router.push(`/analyze/${data.id}`);
    } catch {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    initialCenter,
    selectedLocation,
    selectedIndustry,
    radius,
    setSelectedLocation,
    router,
  ]);

  // 주소 표시
  const displayAddress =
    selectedLocation?.name ?? selectedLocation?.address ?? "";

  return (
    <div className="fixed inset-0">
      <RadiusMap
        centerLat={initialCenter.latitude}
        centerLng={initialCenter.longitude}
        initialZoom={selectedRegion?.zoom ?? DEFAULT_MAP_ZOOM}
        radius={radius}
        onRadiusChange={handleRadiusChange}
        currentPosition={position}
        places={places}
      />
      <RadiusBottomSheet
        address={displayAddress}
        industryName={selectedIndustry?.name ?? ""}
        radius={radius}
        onAnalyze={handleAnalyze}
        nearbyCount={places.length}
      />
    </div>
  );
}
