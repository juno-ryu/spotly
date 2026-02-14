"use client";

import { useCallback, useRef, useState } from "react";
import {
  useWizardStore,
  WizardStep,
} from "@/features/analysis/stores/wizard-store";
import { DEFAULT_MAP_ZOOM } from "@/features/onboarding/constants/regions";
import { useGeolocation } from "../hooks/use-geolocation";
import { useReverseGeocode } from "../hooks/use-reverse-geocode";
import { FullscreenMap } from "./fullscreen-map";
import { LocationBottomSheet } from "./location-bottom-sheet";
import { CenterPin } from "./center-pin";

/** Step 4: 전체화면 지도 + 센터 핀 위치 선택 */
export function MapStep() {
  const { position } = useGeolocation();
  const {
    setSelectedLocation,
    setStep,
    selectedRegion,
  } = useWizardStore();
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

  // "여기서 분석하기" 확인 — LOCATION_INDUSTRY 스킵하고 RADIUS_SETTING으로
  const handleConfirm = useCallback(() => {
    setSelectedLocation({
      latitude: centerLatRef.current,
      longitude: centerLngRef.current,
      address:
        geocodeResult?.address ??
        `${centerLatRef.current.toFixed(4)}, ${centerLngRef.current.toFixed(4)}`,
    });
    setStep(WizardStep.RADIUS_SETTING);
  }, [geocodeResult, setSelectedLocation, setStep]);

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
