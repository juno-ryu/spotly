"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { useWizardStore } from "@/features/analysis/stores/wizard-store";
import { RadiusBottomSheet } from "@/features/analysis/components/radius-bottom-sheet";
import { DEFAULT_MAP_ZOOM } from "@/features/onboarding/constants/regions";
import { useGeolocation } from "../hooks/use-geolocation";
import { useReverseGeocode } from "../hooks/use-reverse-geocode";
import { useNearbyPlaces } from "../hooks/use-nearby-places";
import { CenterPin } from "./center-pin";
import dynamic from "next/dynamic";

const RadiusMap = dynamic(() => import("./radius-map").then(m => m.RadiusMap), { ssr: false });

/** Step 4+5 통합: 지도 드래그로 위치/반경 동시 설정 → 단일 화면 */
export function MapRadiusStep() {
  const { position } = useGeolocation();
  const { selectedRegion, selectedIndustry } = useWizardStore();
  const {
    result: geocodeResult,
    isLoading: isGeocoding,
    reverseGeocode,
  } = useReverseGeocode();

  // 지도 이동 상태 (중심 핀 애니메이션)
  const [isMapMoving, setIsMapMoving] = useState(false);

  // 온보딩에서 선택한 지역 좌표 (없으면 GPS 폴백)
  const initialLat = selectedRegion?.latitude ?? position.latitude;
  const initialLng = selectedRegion?.longitude ?? position.longitude;
  const initialZoom = selectedRegion?.zoom ?? DEFAULT_MAP_ZOOM;

  // 동적 중심 좌표 — state로 관리해야 useNearbyPlaces가 재검색됨
  const [centerLat, setCenterLat] = useState(initialLat);
  const [centerLng, setCenterLng] = useState(initialLng);
  // ref도 함께 유지 (handleAnalyze에서 최신값 즉시 참조)
  const centerLatRef = useRef(initialLat);
  const centerLngRef = useRef(initialLng);

  const [radius, setRadius] = useState(300);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // 현재 주소 (geocode 결과 또는 좌표 표시)
  const currentAddress =
    geocodeResult?.address ??
    (isGeocoding ? "주소 불러오는 중..." : null);

  // 카카오 Places 키워드 검색 (항상 활성 — debounce 1500ms는 훅 내부 처리)
  const { places, totalCount: nearbyTotalCount } = useNearbyPlaces({
    keyword: selectedIndustry?.keyword || selectedIndustry?.name || "",
    lat: centerLat,
    lng: centerLng,
    radius,
  });

  // 지도 중심 이동 시 state + ref 모두 업데이트, reverseGeocode 호출
  const handleCenterChanged = useCallback(
    (lat: number, lng: number) => {
      centerLatRef.current = lat;
      centerLngRef.current = lng;
      setCenterLat(lat);
      setCenterLng(lng);
      reverseGeocode(lat, lng);
    },
    [reverseGeocode],
  );

  const handleDragStateChange = useCallback((isDragging: boolean) => {
    setIsMapMoving(isDragging);
  }, []);

  const handleRadiusChange = useCallback((newRadius: number) => {
    setRadius(newRadius);
  }, []);

  // 분석 시작 — searchParams로 즉시 라우트 이동 (DB 저장 없음)
  const handleAnalyze = useCallback(() => {
    setIsSubmitting(true);
    const address =
      geocodeResult?.address ??
      `${centerLatRef.current.toFixed(4)}, ${centerLngRef.current.toFixed(4)}`;
    const params = new URLSearchParams({
      lat: String(centerLatRef.current),
      lng: String(centerLngRef.current),
      address,
      code: selectedIndustry?.code ?? "",
      keyword: selectedIndustry?.keyword || selectedIndustry?.name || "",
      radius: String(radius),
    });
    router.push(`/analyze?${params.toString()}`);
  }, [geocodeResult, selectedIndustry, radius, router]);

  return (
    <div className="fixed inset-0">
      {/* 뒤로가기 → /region */}
      <BackButton />

      {/* 반경 원 포함 지도 (드래그 → 원도 함께 이동) */}
      <RadiusMap
        centerLat={initialLat}
        centerLng={initialLng}
        initialZoom={initialZoom}
        radius={radius}
        onRadiusChange={handleRadiusChange}
        currentPosition={position}
        places={places}
        onCenterChanged={handleCenterChanged}
        onDragStateChange={handleDragStateChange}
      />

      {/* 지도 중심 핀 (드래그 중 애니메이션) */}
      <CenterPin isMoving={isMapMoving} />

      {/* 바텀시트: 주소 + 반경 선택 + 분석하기 */}
      <RadiusBottomSheet
        address={currentAddress ?? "위치를 선택하세요"}
        industryName={selectedIndustry?.keyword || selectedIndustry?.name || ""}
        radius={radius}
        nearbyCount={nearbyTotalCount}
        onRadiusChange={handleRadiusChange}
        onAnalyze={handleAnalyze}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}


