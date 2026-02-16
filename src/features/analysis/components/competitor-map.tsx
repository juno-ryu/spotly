"use client";

import { memo, useEffect, useRef } from "react";
import { useKakaoMap } from "@/features/map/components/kakao-map-provider";
import { useNearbyPlaces } from "@/features/map/hooks/use-nearby-places";

interface CompetitorMapProps {
  /** 분석 중심 위도 */
  centerLat: number;
  /** 분석 중심 경도 */
  centerLng: number;
  /** 분석 반경 (미터) */
  radius: number;
  /** 업종 키워드 (카카오 Places 검색용) */
  keyword: string;
  /** 전체 화면 배경 지도 모드 */
  fullScreen?: boolean;
}

const MARKER_COLOR = "#7c3aed";

/** 경쟁업체 지도 시각화 (카카오 Places 클라이언트 검색) */
export const CompetitorMap = memo(function CompetitorMap({
  centerLat,
  centerLng,
  radius,
  keyword,
  fullScreen = false,
}: CompetitorMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const { isLoaded } = useKakaoMap();

  // 스텝 5(RadiusMap)와 동일한 훅으로 주변 업체 검색
  const { places } = useNearbyPlaces({
    keyword,
    lat: centerLat,
    lng: centerLng,
    radius,
  });

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.kakao?.maps) return;

    const kakao = window.kakao;
    const center = new kakao.maps.LatLng(centerLat, centerLng);

    /* fullScreen: 바텀시트에 가려지므로 중심을 위쪽(북쪽)으로 보정 */
    const adjustedCenter = fullScreen
      ? new kakao.maps.LatLng(centerLat - (radius / 111320) * 1.5, centerLng)
      : center;

    const map = new kakao.maps.Map(mapRef.current, {
      center: adjustedCenter,
      level: radius <= 500 ? 4 : radius <= 1000 ? 5 : 7,
    });

    /* 반경 원 — violet 톤으로 통일 */
    const circle = new kakao.maps.Circle({
      center,
      radius,
      strokeWeight: 2,
      strokeColor: "#7c3aed",
      strokeOpacity: 0.6,
      strokeStyle: "solid",
      fillColor: "#7c3aed",
      fillOpacity: 0.1,
    });
    circle.setMap(map);

    /* 중심 마커 (선택 위치) */
    new kakao.maps.Marker({
      position: center,
      map,
      image: new kakao.maps.MarkerImage(
        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
        new kakao.maps.Size(24, 35),
      ),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let activeOverlay: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markers: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overlays: any[] = [];

    /* 카카오 Places 마커 — 스텝 5(RadiusMap)와 동일한 렌더링 */
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
        if (activeOverlay) activeOverlay.setMap(null);
        overlay.setMap(map);
        activeOverlay = overlay;
      });

      markers.push(marker);
      overlays.push(overlay);
    });

    kakao.maps.event.addListener(map, "click", () => {
      if (activeOverlay) {
        activeOverlay.setMap(null);
        activeOverlay = null;
      }
    });

    /* 줌 컨트롤 — fullScreen에서는 제거 */
    if (!fullScreen) {
      map.addControl(
        new kakao.maps.ZoomControl(),
        kakao.maps.ControlPosition.RIGHT,
      );
    }

    // cleanup: 마커·오버레이·원 제거 (메모리 누수 방지)
    return () => {
      markers.forEach((m) => m.setMap(null));
      overlays.forEach((o) => o.setMap(null));
      if (activeOverlay) activeOverlay.setMap(null);
      circle.setMap(null);
    };
  }, [isLoaded, centerLat, centerLng, radius, places, fullScreen]);

  /* 전체 화면 모드 (배경 지도) */
  if (fullScreen) {
    if (!isLoaded) return <div className="absolute inset-0 bg-muted" />;
    return <div ref={mapRef} className="absolute inset-0" />;
  }

  /* 기본 모드 (카드 내 임베드) */
  if (!isLoaded) {
    return (
      <div className="w-full h-[400px] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">지도를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={mapRef} className="w-full h-[400px] rounded-lg border" />
      {/* 범례 */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: MARKER_COLOR }} />
          경쟁업체
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 text-yellow-400">★</span>
          선택 위치
        </span>
      </div>
    </div>
  );
});
