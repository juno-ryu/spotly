"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startAnalysis } from "@/features/analysis/actions";
import { ArrowLeft } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { useWizardStore } from "@/features/analysis/stores/wizard-store";
import { RadiusBottomSheet } from "@/features/analysis/components/radius-bottom-sheet";
import { DEFAULT_MAP_ZOOM } from "@/features/onboarding/constants/regions";
import { useGeolocation } from "../hooks/use-geolocation";
import { useReverseGeocode } from "../hooks/use-reverse-geocode";
import { useNearbyPlaces } from "../hooks/use-nearby-places";
import { FullscreenMap } from "./fullscreen-map";
import { LocationBottomSheet } from "./location-bottom-sheet";
import { CenterPin } from "./center-pin";
import { RadiusMap } from "./radius-map";

type Phase = "location" | "radius";

/** 위치 확정 후 radius phase에서 사용할 데이터 */
interface ConfirmedLocation {
  lat: number;
  lng: number;
  address: string;
  districtCode: string;
  dongName: string | null;
  adminDongCode: string | null;
  zoom: number;
}

/** Step 4+5 통합: 위치 선택 → 반경 설정 (단일 페이지, phase 전환) */
export function MapRadiusStep() {
  const router = useRouter();
  const { position } = useGeolocation();
  const { selectedRegion, selectedIndustry } = useWizardStore();
  const {
    result: geocodeResult,
    isLoading: isGeocoding,
    reverseGeocode,
  } = useReverseGeocode();

  const [phase, setPhase] = useState<Phase>("location");
  const [confirmedLocation, setConfirmedLocation] =
    useState<ConfirmedLocation | null>(null);

  // --- Location phase 상태 ---
  const [isMapMoving, setIsMapMoving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  // 온보딩에서 선택한 지역 좌표 (없으면 GPS 폴백)
  const initialLat = selectedRegion?.latitude ?? position.latitude;
  const initialLng = selectedRegion?.longitude ?? position.longitude;
  const initialZoom = selectedRegion?.zoom ?? DEFAULT_MAP_ZOOM;

  const centerLatRef = useRef(initialLat);
  const centerLngRef = useRef(initialLng);

  // --- Radius phase 상태 ---
  const [radius, setRadius] = useState(300);
  const [isPending, startTransition] = useTransition();

  // 카카오 Places 키워드 검색 (radius phase에서만 활성)
  const { places, totalCount: nearbyTotalCount } = useNearbyPlaces({
    keyword: phase === "radius" ? (selectedIndustry?.name ?? "") : "",
    lat: confirmedLocation?.lat ?? 0,
    lng: confirmedLocation?.lng ?? 0,
    radius,
  });

  // --- Location phase 핸들러 ---

  const handleCenterChanged = useCallback(
    (lat: number, lng: number) => {
      centerLatRef.current = lat;
      centerLngRef.current = lng;
      reverseGeocode(lat, lng);
    },
    [reverseGeocode],
  );

  const handleDragStateChange = useCallback((isDragging: boolean) => {
    setIsMapMoving(isDragging);
  }, []);

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

  // "여기서 분석하기" → radius phase로 전환
  const handleConfirmLocation = useCallback(() => {
    setConfirmedLocation({
      lat: centerLatRef.current,
      lng: centerLngRef.current,
      address:
        geocodeResult?.address ??
        `${centerLatRef.current.toFixed(4)}, ${centerLngRef.current.toFixed(4)}`,
      districtCode: geocodeResult?.districtCode ?? "",
      dongName: geocodeResult?.dongName ?? null,
      adminDongCode: geocodeResult?.adminDongCode ?? null,
      zoom: initialZoom,
    });
    setPhase("radius");
    // 브라우저 히스토리에 radius 상태 푸시 (뒤로가기 지원)
    window.history.pushState({ phase: "radius" }, "");
  }, [geocodeResult, initialZoom]);

  // --- Radius phase 핸들러 ---

  const handleRadiusChange = useCallback((newRadius: number) => {
    setRadius(newRadius);
  }, []);

  const handleBackToLocation = useCallback(() => {
    setPhase("location");
    setConfirmedLocation(null);
    // pushState로 추가한 radius 항목을 히스토리에서 제거
    // → location phase에서 router.back() 시 /region으로 정상 이동
    window.history.back();
  }, []);

  // 분석 시작 — Server Action으로 분석 완료 후 결과 페이지로 redirect
  const handleAnalyze = useCallback(() => {
    if (!confirmedLocation) return;
    startTransition(async () => {
      await startAnalysis({
        address: confirmedLocation.address,
        latitude: confirmedLocation.lat,
        longitude: confirmedLocation.lng,
        industryCode: selectedIndustry?.code ?? "",
        industryName: selectedIndustry?.name ?? "",
        radius,
        districtCode: confirmedLocation.districtCode || undefined,
        adminDongCode: confirmedLocation.adminDongCode || undefined,
        dongName: confirmedLocation.dongName || undefined,
      });
    });
  }, [confirmedLocation, selectedIndustry, radius, startTransition]);

  // 브라우저 뒤로가기(popstate) 처리
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // radius phase에서 브라우저 뒤로가기 → location phase로 복귀
      // handleBackToLocation에서 이미 state를 변경하므로, 브라우저 기본 뒤로가기 시에만 처리
      if (phase === "radius" && e.state?.phase !== "radius") {
        setPhase("location");
        setConfirmedLocation(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [phase]);

  // --- 렌더링 ---

  if (phase === "location") {
    return (
      <div className="fixed inset-0">
        <BackButton />
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
          onConfirm={handleConfirmLocation}
          centerAddress={geocodeResult?.address ?? null}
          isGeocoding={isGeocoding}
        />
      </div>
    );
  }

  // Phase: radius
  return (
    <div className="fixed inset-0">
      <button
        type="button"
        onClick={handleBackToLocation}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md"
        aria-label="위치 선택으로 돌아가기"
      >
        <ArrowLeft className="h-5 w-5 text-gray-700" />
      </button>
      <RadiusMap
        centerLat={confirmedLocation!.lat}
        centerLng={confirmedLocation!.lng}
        initialZoom={confirmedLocation!.zoom}
        radius={radius}
        onRadiusChange={handleRadiusChange}
        currentPosition={position}
        places={places}
      />
      <RadiusBottomSheet
        address={confirmedLocation!.address}
        industryName={selectedIndustry?.name ?? ""}
        radius={radius}
        nearbyCount={nearbyTotalCount}
        onAnalyze={handleAnalyze}
        isSubmitting={isPending}
      />
    </div>
  );
}
