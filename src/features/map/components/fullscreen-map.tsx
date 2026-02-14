"use client";

import { useEffect, useRef, useCallback, type MutableRefObject } from "react";
import { useKakaoMap } from "@/features/map/components/kakao-map-provider";

interface FullscreenMapProps {
  /** 지도 중심 위도 */
  centerLat: number;
  /** 지도 중심 경도 */
  centerLng: number;
  /** 초기 줌 레벨 (온보딩 지역 선택 기반) */
  initialZoom?: number;
  /** 선택된 위치 마커 (Step 4에서 사용) */
  selectedPosition?: { latitude: number; longitude: number } | null;
  /** 현위치 (파란 점) */
  currentPosition?: { latitude: number; longitude: number } | null;
  /** 지도 중심 좌표 변경 시 콜백 (idle 이벤트) */
  onCenterChanged?: (lat: number, lng: number) => void;
  /** 드래그 상태 변경 콜백 (센터 핀 애니메이션용) */
  onDragStateChange?: (isDragging: boolean) => void;
  /** 외부에서 panTo 호출을 위한 ref */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapRef?: MutableRefObject<any>;
  /** 주변 경쟁업체 (Kakao Places 검색 결과) */
  places?: KakaoPlaceResult[];
}

/** 전체화면 카카오맵 (센터 핀 패턴) */
export function FullscreenMap({
  centerLat,
  centerLng,
  initialZoom,
  selectedPosition,
  currentPosition,
  onCenterChanged,
  onDragStateChange,
  mapRef,
  places = [],
}: FullscreenMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placeMarkersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placeOverlaysRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeOverlayRef = useRef<any>(null);
  const onCenterChangedRef = useRef(onCenterChanged);
  onCenterChangedRef.current = onCenterChanged;
  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;
  const { isLoaded } = useKakaoMap();

  // 지도 1회 초기화
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || !window.kakao?.maps) return;
    if (mapInstanceRef.current) return;

    const kakao = window.kakao;
    const center = new kakao.maps.LatLng(centerLat, centerLng);

    const map = new kakao.maps.Map(mapContainerRef.current, {
      center,
      level: initialZoom ?? 5,
    });

    mapInstanceRef.current = map;

    // 외부 ref 연결
    if (mapRef) {
      mapRef.current = map;
    }

    // idle 이벤트: 지도 이동 완료 시 중심 좌표 콜백
    kakao.maps.event.addListener(map, "idle", () => {
      const latlng = map.getCenter();
      onCenterChangedRef.current?.(latlng.getLat(), latlng.getLng());
    });

    // 드래그 상태 이벤트
    kakao.maps.event.addListener(map, "dragstart", () => {
      onDragStateChangeRef.current?.(true);
    });
    kakao.maps.event.addListener(map, "dragend", () => {
      onDragStateChangeRef.current?.(false);
    });

    // 줌 변경 시에도 이동 애니메이션
    kakao.maps.event.addListener(map, "zoom_start", () => {
      onDragStateChangeRef.current?.(true);
    });
    kakao.maps.event.addListener(map, "zoom_changed", () => {
      onDragStateChangeRef.current?.(false);
    });

    // 초기 idle 수동 발동 (초기 주소 표시)
    const latlng = map.getCenter();
    onCenterChangedRef.current?.(latlng.getLat(), latlng.getLng());

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // GPS 수신 시 지도 중심 이동 (최초 1회만)
  const hasMovedToGps = useRef(false);
  useEffect(() => {
    if (!mapInstanceRef.current || !window.kakao?.maps || hasMovedToGps.current)
      return;
    const kakao = window.kakao;
    mapInstanceRef.current.panTo(new kakao.maps.LatLng(centerLat, centerLng));
    hasMovedToGps.current = true;
  }, [centerLat, centerLng]);

  // 현위치 마커 (파란 점)
  useEffect(() => {
    if (!mapInstanceRef.current || !currentPosition || !window.kakao?.maps)
      return;

    const kakao = window.kakao;

    if (currentMarkerRef.current) {
      currentMarkerRef.current.setMap(null);
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
      <circle cx="8" cy="8" r="6" fill="#3b82f6" stroke="white" stroke-width="2"/>
    </svg>`;

    const marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(
        currentPosition.latitude,
        currentPosition.longitude,
      ),
      map: mapInstanceRef.current,
      image: new kakao.maps.MarkerImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        new kakao.maps.Size(16, 16),
        { offset: new kakao.maps.Point(8, 8) },
      ),
    });

    currentMarkerRef.current = marker;
  }, [currentPosition]);

  // 선택 위치 마커 (Step 4에서 사용)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.kakao?.maps) return;

    const kakao = window.kakao;

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null);
    }

    if (!selectedPosition) return;

    const latLng = new kakao.maps.LatLng(
      selectedPosition.latitude,
      selectedPosition.longitude,
    );

    const marker = new kakao.maps.Marker({
      position: latLng,
      map: mapInstanceRef.current,
    });

    selectedMarkerRef.current = marker;
    mapInstanceRef.current.panTo(latLng);
  }, [selectedPosition]);

  // 경쟁업체 마커 (places 변경 시 이전 마커 제거 후 재생성)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.kakao?.maps) return;
    const kakao = window.kakao;
    const map = mapInstanceRef.current;

    placeMarkersRef.current.forEach((m) => m.setMap(null));
    placeOverlaysRef.current.forEach((o) => o.setMap(null));
    placeMarkersRef.current = [];
    placeOverlaysRef.current = [];
    if (activeOverlayRef.current) {
      activeOverlayRef.current.setMap(null);
      activeOverlayRef.current = null;
    }

    if (places.length === 0) return;

    const MARKER_COLOR = "#7c3aed";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="${MARKER_COLOR}" stroke="white" stroke-width="2"/></svg>`;
    const markerImage = new kakao.maps.MarkerImage(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      new kakao.maps.Size(20, 20),
      { offset: new kakao.maps.Point(10, 10) },
    );

    places.forEach((place) => {
      const position = new kakao.maps.LatLng(
        parseFloat(place.y),
        parseFloat(place.x),
      );

      const marker = new kakao.maps.Marker({
        position,
        map,
        image: markerImage,
      });

      const overlayContent = document.createElement("div");
      overlayContent.innerHTML = `
        <div style="
          padding:8px 12px;font-size:13px;min-width:140px;max-width:220px;
          color:#333;background:#fff;border-radius:8px;border:1px solid #ddd;
          box-shadow:0 2px 6px rgba(0,0,0,0.15);transform:translateY(-100%);
          margin-bottom:12px;position:relative;
        ">
          <strong style="display:block;margin-bottom:2px;">${place.place_name}</strong>
          <span style="color:#666;font-size:12px;">${place.road_address_name || place.address_name}</span>
          <div style="
            position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);
            width:0;height:0;border-left:8px solid transparent;
            border-right:8px solid transparent;border-top:8px solid #fff;
            filter:drop-shadow(0 1px 1px rgba(0,0,0,0.1));
          "></div>
        </div>
      `;

      const overlay = new kakao.maps.CustomOverlay({
        content: overlayContent,
        position,
        yAnchor: 1,
        clickable: true,
      });

      kakao.maps.event.addListener(marker, "click", () => {
        if (activeOverlayRef.current) {
          activeOverlayRef.current.setMap(null);
        }
        overlay.setMap(map);
        activeOverlayRef.current = overlay;
      });

      placeMarkersRef.current.push(marker);
      placeOverlaysRef.current.push(overlay);
    });

    const closeOverlay = () => {
      if (activeOverlayRef.current) {
        activeOverlayRef.current.setMap(null);
        activeOverlayRef.current = null;
      }
    };
    kakao.maps.event.addListener(map, "click", closeOverlay);

    return () => {
      kakao.maps.event.removeListener(map, "click", closeOverlay);
    };
  }, [places]);

  /** 현위치로 이동 */
  const moveToCurrentPosition = useCallback(() => {
    if (!mapInstanceRef.current || !currentPosition || !window.kakao?.maps)
      return;
    const kakao = window.kakao;
    mapInstanceRef.current.panTo(
      new kakao.maps.LatLng(
        currentPosition.latitude,
        currentPosition.longitude,
      ),
    );
  }, [currentPosition]);

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">지도를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      <div ref={mapContainerRef} className="fixed inset-0" />

      {/* 현위치 버튼 */}
      <button
        type="button"
        onClick={moveToCurrentPosition}
        className="fixed right-4 bottom-40 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-lg border"
        aria-label="현위치로 이동"
      >
        <span className="text-lg">◎</span>
      </button>
    </>
  );
}
