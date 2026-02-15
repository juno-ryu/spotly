"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useGeolocation } from "../hooks/use-geolocation";
import { useNearbyPlaces } from "../hooks/use-nearby-places";
import { RadiusMap } from "./radius-map";
import { RadiusBottomSheet } from "@/features/analysis/components/radius-bottom-sheet";
import type { PopulationData } from "@/server/data-sources/kosis-client";

interface RadiusSettingStepProps {
  centerLat: number;
  centerLng: number;
  address: string;
  industryCode: string;
  industryName: string;
  districtCode: string;
  zoom?: number;
  serverData: {
    npsTotalCount: number;
    npsActiveCount: number;
    avgEmployeeCount: number;
    employeeGrowthRate: number | null;
    transactionCount: number;
    avgAptPrice: number;
    districtTransactionCount: number;
    population: PopulationData | null;
    dongName: string | null;
  };
}

/** Step 5: 반경 설정 + 카카오 Places 마커 표시 (NPS는 분석용) */
export function RadiusSettingStep({
  centerLat,
  centerLng,
  address,
  industryCode,
  industryName,
  districtCode,
  zoom,
  serverData,
}: RadiusSettingStepProps) {
  const router = useRouter();
  const { position } = useGeolocation();
  const [radius, setRadius] = useState(200);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 카카오 Places 키워드 검색 (반경 기반, 좌표 중심)
  const { places } = useNearbyPlaces({
    keyword: industryName,
    lat: centerLat,
    lng: centerLng,
    radius,
  });

  const handleRadiusChange = useCallback((newRadius: number) => {
    setRadius(newRadius);
  }, []);

  // 분석 시작 — POST /api/analyze → 결과 페이지로 이동
  const handleAnalyze = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          latitude: centerLat,
          longitude: centerLng,
          industryCode,
          industryName,
          radius,
          districtCode,
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
  }, [isSubmitting, centerLat, centerLng, address, industryCode, industryName, radius, districtCode, router]);

  return (
    <div className="fixed inset-0">
      <RadiusMap
        centerLat={centerLat}
        centerLng={centerLng}
        initialZoom={zoom}
        radius={radius}
        onRadiusChange={handleRadiusChange}
        currentPosition={position}
        places={places}
      />
      <RadiusBottomSheet
        address={address}
        industryCode={industryCode}
        industryName={industryName}
        radius={radius}
        onAnalyze={handleAnalyze}
        npsTotalCount={serverData.npsTotalCount}
        npsActiveCount={serverData.npsActiveCount}
        avgEmployeeCount={serverData.avgEmployeeCount}
        employeeGrowthRate={serverData.employeeGrowthRate}
        nearbyCount={places.length}
        transactionCount={serverData.transactionCount}
        avgAptPrice={serverData.avgAptPrice}
        districtTransactionCount={serverData.districtTransactionCount}
        population={serverData.population}
        dongName={serverData.dongName}
      />
    </div>
  );
}
