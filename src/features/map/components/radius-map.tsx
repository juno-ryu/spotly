"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useKakaoMap } from "./kakao-map-provider";
import {
  getDistanceMeters,
  getPointAtDistance,
  snapRadius,
  formatRadius,
} from "@/lib/geo-utils";

interface RadiusMapProps {
  centerLat: number;
  centerLng: number;
  radius: number;
  onRadiusChange: (radius: number) => void;
  /** 초기 줌 레벨 (카카오맵 level, 기본 5) */
  initialZoom?: number;
  /** 현위치 (파란 점) */
  currentPosition?: { latitude: number; longitude: number } | null;
  /** 주변 경쟁업체 (Kakao Places 검색 결과) */
  places?: KakaoPlaceResult[];
  /** 지도 중심 좌표 변경 시 콜백 (idle 이벤트) — 없으면 중심 고정 + 마커 표시 */
  onCenterChanged?: (lat: number, lng: number) => void;
  /** 드래그 상태 변경 콜백 (센터 핀 애니메이션용) */
  onDragStateChange?: (isDragging: boolean) => void;
}

/** 반경 조절 + 지도 중심 이동이 가능한 전체화면 지도 */
export function RadiusMap({
  centerLat,
  centerLng,
  radius,
  onRadiusChange,
  initialZoom = 5,
  currentPosition,
  places = [],
  onCenterChanged,
  onDragStateChange,
}: RadiusMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleOverlayRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labelOverlayRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placeMarkersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placeOverlaysRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeOverlayRef = useRef<any>(null);
  const radiusRef = useRef(radius);
  const onRadiusChangeRef = useRef(onRadiusChange);
  onRadiusChangeRef.current = onRadiusChange;
  radiusRef.current = radius;

  // 동적 중심 좌표 (지도 이동 시 업데이트)
  const centerLatRef = useRef(centerLat);
  const centerLngRef = useRef(centerLng);
  const onCenterChangedRef = useRef(onCenterChanged);
  onCenterChangedRef.current = onCenterChanged;
  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;

  const [isDragging, setIsDragging] = useState(false);

  const { isLoaded } = useKakaoMap();

  // 지도 + 반경 원 + 드래그 핸들 1회 초기화
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || !window.kakao?.maps) return;
    if (mapRef.current) return;

    const kakao = window.kakao;
    const center = new kakao.maps.LatLng(centerLat, centerLng);

    const map = new kakao.maps.Map(mapContainerRef.current, {
      center,
      level: initialZoom,
    });
    mapRef.current = map;

    // 중심 고정 모드(onCenterChanged 없음)일 때 고정 마커 표시
    if (!onCenterChangedRef.current) {
      const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48" fill="none">
        <path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="#7c3aed"/>
        <circle cx="18" cy="18" r="8" fill="white"/>
      </svg>`;
      new kakao.maps.Marker({
        position: center,
        map,
        image: new kakao.maps.MarkerImage(
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg)}`,
          new kakao.maps.Size(36, 48),
          { offset: new kakao.maps.Point(18, 48) },
        ),
      });
    }

    // 반경 원
    const circle = new kakao.maps.Circle({
      center,
      radius: radiusRef.current,
      strokeWeight: 2,
      strokeColor: "#7c3aed",
      strokeOpacity: 0.6,
      fillColor: "#7c3aed",
      fillOpacity: 0.12,
    });
    circle.setMap(map);
    circleRef.current = circle;

    // 드래그 핸들 + 반경 라벨 (하나의 컨테이너)
    const handlePos = getPointAtDistance(centerLat, centerLng, radiusRef.current);
    const handleContent = document.createElement("div");
    handleContent.innerHTML = `
      <div data-handle-dot style="
        width: 20px; height: 20px; border-radius: 50%;
        background: white; border: 3px solid #7c3aed;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transition: transform 0.15s ease;
      "></div>
      <div data-handle-label style="
        background: #7c3aed; color: white; font-size: 13px; font-weight: 700;
        padding: 4px 12px; border-radius: 12px; white-space: nowrap;
        box-shadow: 0 2px 6px rgba(124,58,237,0.4);
        margin-top: 4px;
      ">${formatRadius(radiusRef.current)}</div>
    `;
    handleContent.style.cssText = `
      display: flex; flex-direction: column; align-items: center;
      padding: 10px;
      touch-action: none; cursor: grab; user-select: none;
    `;

    const handleOverlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(handlePos.lat, handlePos.lng),
      content: handleContent,
      yAnchor: 0.3,
      xAnchor: 0.5,
      zIndex: 10,
    });
    handleOverlay.setMap(map);
    handleOverlayRef.current = handleOverlay;

    // labelOverlayRef는 handleContent 내부 라벨 엘리먼트를 참조
    const labelEl = handleContent.querySelector("[data-handle-label]") as HTMLDivElement;
    labelOverlayRef.current = { labelEl, overlay: handleOverlay };

    // ─── idle 이벤트: 지도 중심 이동 시 원 + 핸들 재배치 (onCenterChanged가 있을 때만) ───
    kakao.maps.event.addListener(map, "idle", () => {
      if (!onCenterChangedRef.current) return;

      const latlng = map.getCenter();
      const newLat = latlng.getLat();
      const newLng = latlng.getLng();

      centerLatRef.current = newLat;
      centerLngRef.current = newLng;

      // 반경 원 중심 이동
      circle.setPosition(new kakao.maps.LatLng(newLat, newLng));

      // 핸들 재배치
      const newHandlePos = getPointAtDistance(newLat, newLng, radiusRef.current);
      handleOverlay.setPosition(new kakao.maps.LatLng(newHandlePos.lat, newHandlePos.lng));

      onCenterChangedRef.current(newLat, newLng);
    });

    // ─── 드래그 상태 이벤트 (센터 핀 애니메이션) ───
    kakao.maps.event.addListener(map, "dragstart", () => {
      onDragStateChangeRef.current?.(true);
    });
    kakao.maps.event.addListener(map, "dragend", () => {
      onDragStateChangeRef.current?.(false);
    });
    kakao.maps.event.addListener(map, "zoom_start", () => {
      onDragStateChangeRef.current?.(true);
    });
    kakao.maps.event.addListener(map, "zoom_changed", () => {
      onDragStateChangeRef.current?.(false);
    });

    // ─── 드래그 핸들 이벤트 (터치 + 마우스) ───
    let dragging = false;
    let prevSnapped = radiusRef.current;

    /** 드래그 시작 공통 로직 */
    const startDrag = () => {
      dragging = true;
      setIsDragging(true);
      const dot = handleContent.querySelector("[data-handle-dot]") as HTMLDivElement;
      if (dot) dot.style.transform = "scale(1.3)";
      handleContent.style.cursor = "grabbing";
      try { navigator?.vibrate?.(10); } catch { /* 무시 */ }
    };

    /** 드래그 이동 공통 로직 — 동적 중심 기준 거리 계산 */
    const moveDrag = (clientX: number, clientY: number) => {
      if (!dragging) return;
      const container = mapContainerRef.current!;
      const rect = container.getBoundingClientRect();
      const projection = map.getProjection();
      const point = new kakao.maps.Point(
        clientX - rect.left,
        clientY - rect.top,
      );
      const pointerLatLng = projection.coordsFromContainerPoint(point);

      const dist = getDistanceMeters(
        centerLatRef.current,
        centerLngRef.current,
        pointerLatLng.getLat(),
        pointerLatLng.getLng(),
      );
      const snapped = snapRadius(dist);

      circle.setRadius(snapped);
      const newPos = getPointAtDistance(centerLatRef.current, centerLngRef.current, snapped);
      handleOverlay.setPosition(new kakao.maps.LatLng(newPos.lat, newPos.lng));
      labelEl.textContent = formatRadius(snapped);

      if (snapped !== prevSnapped) {
        prevSnapped = snapped;
        try { navigator?.vibrate?.(5); } catch { /* 무시 */ }
      }

      radiusRef.current = snapped;
    };

    /** 드래그 종료 공통 로직 */
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      setIsDragging(false);
      const dot = handleContent.querySelector("[data-handle-dot]") as HTMLDivElement;
      if (dot) dot.style.transform = "scale(1)";
      handleContent.style.cursor = "grab";
      onRadiusChangeRef.current(radiusRef.current);
    };

    // ─── 터치 이벤트 ───
    const onTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      kakao.maps.event.preventMap();
      startDrag();
    };
    const onTouchMove = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => endDrag();

    // ─── 마우스 이벤트 (데스크톱) ───
    const onMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      kakao.maps.event.preventMap();
      startDrag();
    };
    const onMouseMove = (e: MouseEvent) => {
      moveDrag(e.clientX, e.clientY);
    };
    const onMouseUp = () => endDrag();

    handleContent.addEventListener("touchstart", onTouchStart, { passive: false });
    handleContent.addEventListener("touchmove", onTouchMove, { passive: false });
    handleContent.addEventListener("touchend", onTouchEnd);
    handleContent.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    // 지도 드래그 중 핸들 터치 방지
    kakao.maps.event.addListener(map, "drag", () => {
      if (dragging) return;
    });

    // 초기 콜백 발동
    onCenterChangedRef.current?.(centerLat, centerLng);

    return () => {
      handleContent.removeEventListener("touchstart", onTouchStart);
      handleContent.removeEventListener("touchmove", onTouchMove);
      handleContent.removeEventListener("touchend", onTouchEnd);
      handleContent.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      circle.setMap(null);
      handleOverlay.setMap(null);
      if (currentMarkerRef.current) currentMarkerRef.current.setMap(null);
      mapRef.current = null;
      circleRef.current = null;
      handleOverlayRef.current = null;
      labelOverlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // 반경 외부 변경 시 동기화 (동적 중심 기준)
  useEffect(() => {
    if (!circleRef.current || !handleOverlayRef.current || !labelOverlayRef.current || !window.kakao?.maps)
      return;
    const kakao = window.kakao;
    circleRef.current.setRadius(radius);
    const pos = getPointAtDistance(centerLatRef.current, centerLngRef.current, radius);
    handleOverlayRef.current.setPosition(new kakao.maps.LatLng(pos.lat, pos.lng));
    const ref = labelOverlayRef.current as { labelEl: HTMLDivElement; overlay: unknown };
    if (ref.labelEl) ref.labelEl.textContent = formatRadius(radius);
  }, [radius]);

  // 현위치 마커
  useEffect(() => {
    if (!mapRef.current || !currentPosition || !window.kakao?.maps) return;
    const kakao = window.kakao;
    if (currentMarkerRef.current) currentMarkerRef.current.setMap(null);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
      <circle cx="8" cy="8" r="6" fill="#3b82f6" stroke="white" stroke-width="2"/>
    </svg>`;
    currentMarkerRef.current = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(currentPosition.latitude, currentPosition.longitude),
      map: mapRef.current,
      image: new kakao.maps.MarkerImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        new kakao.maps.Size(16, 16),
        { offset: new kakao.maps.Point(8, 8) },
      ),
    });
  }, [currentPosition]);

  // NPS 사업장 마커 (places 또는 맵 로드 변경 시 재생성)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    const kakao = window.kakao;
    const map = mapRef.current;

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
  }, [places, isLoaded]);

  /** 현위치로 이동 */
  const moveToCurrentPosition = useCallback(() => {
    if (!mapRef.current || !currentPosition || !window.kakao?.maps) return;
    const kakao = window.kakao;
    mapRef.current.panTo(
      new kakao.maps.LatLng(currentPosition.latitude, currentPosition.longitude),
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

      {/* 드래그 중 반경 표시 오버레이 */}
      {isDragging && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-violet-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">
          반경 {formatRadius(radius)}
        </div>
      )}

      {/* 현위치 버튼 */}
      <button
        type="button"
        onClick={moveToCurrentPosition}
        className="fixed right-4 bottom-44 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-lg border"
        aria-label="현위치로 이동"
      >
        <span className="text-lg">◎</span>
      </button>
    </>
  );
}
