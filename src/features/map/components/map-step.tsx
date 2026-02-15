"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWizardStore } from "@/features/analysis/stores/wizard-store";
import { DEFAULT_MAP_ZOOM } from "@/features/onboarding/constants/regions";
import { useGeolocation } from "../hooks/use-geolocation";
import { useReverseGeocode } from "../hooks/use-reverse-geocode";
import { FullscreenMap } from "./fullscreen-map";
import { LocationBottomSheet } from "./location-bottom-sheet";
import { CenterPin } from "./center-pin";

/** Step 4: 전체화면 지도 + 센터 핀 위치 선택 */
export function MapStep() {
  const router = useRouter();
  const { position } = useGeolocation();
  const { selectedRegion, selectedIndustry } =
    useWizardStore();
  const {
    result: geocodeResult,
    isLoading: isGeocoding,
    reverseGeocode,
  } = useReverseGeocode();

  const [isMapMoving, setIsMapMoving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  // 온보딩에서 선택한 지역 좌표 (없으면 GPS 폴백)
  const initialLat = selectedRegion?.latitude ?? position.latitude;
  const initialLng = selectedRegion?.longitude ?? position.longitude;
  const initialZoom = selectedRegion?.zoom ?? DEFAULT_MAP_ZOOM;

  const centerLatRef = useRef(initialLat);
  const centerLngRef = useRef(initialLng);

  // idle 이벤트: 지도 중심 변경 시 역지오코딩
  const handleCenterChanged = useCallback(
    (lat: number, lng: number) => {
      centerLatRef.current = lat;
      centerLngRef.current = lng;
      reverseGeocode(lat, lng);
    },
    [reverseGeocode],
  );

  // 드래그 상태 변경
  const handleDragStateChange = useCallback((isDragging: boolean) => {
    setIsMapMoving(isDragging);
  }, []);

  // 검색 결과/인기 지역 선택 → 지도 이동만
  const handleMoveToLocation = useCallback(
    (location: {
      latitude: number;
      longitude: number;
      name: string;
      address: string;
    }) => {
      if (!mapRef.current || !window.kakao?.maps) return;
      const kakao = window.kakao;
      mapRef.current.panTo(
        new kakao.maps.LatLng(location.latitude, location.longitude),
      );
    },
    [],
  );

  // "여기서 분석하기" 확인 → /radius 페이지로 searchParams와 함께 이동
  const handleConfirm = useCallback(() => {
    const query = new URLSearchParams({
      districtCode: geocodeResult?.districtCode ?? "",
      dongName: geocodeResult?.dongName ?? "",
      industryCode: selectedIndustry?.code ?? "",
      industryName: selectedIndustry?.name ?? "",
      lat: String(centerLatRef.current),
      lng: String(centerLngRef.current),
      address:
        geocodeResult?.address ??
        `${centerLatRef.current.toFixed(4)}, ${centerLngRef.current.toFixed(4)}`,
      zoom: String(initialZoom),
    });
    router.push(`/radius?${query.toString()}`);
  }, [geocodeResult, selectedIndustry, initialZoom, router]);

  return (
    <div className="fixed inset-0">
      <FullscreenMap
        centerLat={initialLat}
        centerLng={initialLng}
        initialZoom={initialZoom}
        currentPosition={position}
        onCenterChanged={handleCenterChanged}
        onDragStateChange={handleDragStateChange}
        mapRef={mapRef}
      />
      <CenterPin isMoving={isMapMoving} />
      <LocationBottomSheet
        onMoveToLocation={handleMoveToLocation}
        onConfirm={handleConfirm}
        centerAddress={geocodeResult?.address ?? null}
        isGeocoding={isGeocoding}
      />
    </div>
  );
}
