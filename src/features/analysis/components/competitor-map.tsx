"use client";

import { memo, useEffect, useRef } from "react";
import { useKakaoMap } from "@/features/map/components/kakao-map-provider";
import { useNearbyPlaces } from "@/features/map/hooks/use-nearby-places";
import type { SubwayAnalysis } from "@/server/data-sources/subway/adapter";
import type { BusAnalysis } from "@/server/data-sources/bus/adapter";
import type { SchoolAnalysis } from "@/server/data-sources/school/adapter";
import type { UniversityAnalysis } from "@/server/data-sources/university/adapter";
import type { MedicalAnalysis } from "@/server/data-sources/medical/adapter";

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
  /** 지하철 역세권 분석 데이터 */
  subway?: SubwayAnalysis | null;
  /** 버스 접근성 분석 데이터 */
  bus?: BusAnalysis | null;
  /** 학교 분석 데이터 */
  school?: SchoolAnalysis | null;
  /** 대학교 분석 데이터 */
  university?: UniversityAnalysis | null;
  /** 의료시설 분석 데이터 */
  medical?: MedicalAnalysis | null;
}

const MARKER_COLOR = "#7c3aed";

/**
 * 카카오 스타일 물방울 핀 마커 (CustomOverlay용)
 * SVG 물방울 배경 + 내부 흰 원 + 이모지 오버레이
 */
/**
 * 카카오 스타일 물방울 핀 마커 (CustomOverlay용)
 * @param emoji 내부에 표시할 이모지
 * @param bgColor 핀 배경색
 * @param width SVG 너비 (기본 34, 현위치는 40 권장)
 */
function createPinMarker(emoji: string, bgColor: string, width = 34): HTMLElement {
  const height = Math.round(width * 1.32);
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "relative",
    display: "inline-flex",
    justifyContent: "center",
    cursor: "pointer",
    filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.35))",
    userSelect: "none",
  });

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const hw = width / 2;
  // 물방울 path (바깥/안쪽 공유)
  const pathD = `M${hw} 1C${hw * 0.47} 1 1 ${hw * 0.47} 1 ${hw}C1 ${height * 0.65} ${hw} ${height - 1} ${hw} ${height - 1}C${hw} ${height - 1} ${width - 1} ${height * 0.65} ${width - 1} ${hw}C${width - 1} ${hw * 0.47} ${hw * 1.53} 1 ${hw} 1Z`;

  // 바깥 물방울
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", pathD);
  path.setAttribute("fill", bgColor);

  // 내부 흰 원
  const innerCircle = document.createElementNS(svgNS, "circle");
  innerCircle.setAttribute("cx", String(hw));
  innerCircle.setAttribute("cy", String(hw));
  innerCircle.setAttribute("r", String(hw * 0.68));
  innerCircle.setAttribute("fill", "white");

  svg.append(path, innerCircle);

  const emojiEl = document.createElement("span");
  emojiEl.textContent = emoji;
  Object.assign(emojiEl.style, {
    position: "absolute",
    top: `${Math.round(width * 0.27)}px`,
    fontSize: `${Math.round(width * 0.45)}px`,
    lineHeight: "1",
    width: `${width}px`,
    textAlign: "center",
  });

  container.append(svg, emojiEl);
  return container;
}

/** 경쟁업체 지도 시각화 (카카오 Places 클라이언트 검색) */
export const CompetitorMap = memo(function CompetitorMap({
  centerLat,
  centerLng,
  radius,
  keyword,
  fullScreen = false,
  subway,
  bus,
  school,
  university,
  medical,
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

    /* 중심 마커 (선택 위치) — 보라색 핀 */
    const centerMarkerEl = createPinMarker("📍", "#7c3aed", 40);
    const centerOverlay = new kakao.maps.CustomOverlay({
      content: centerMarkerEl,
      position: center,
      yAnchor: 1.0,
    });
    centerOverlay.setMap(map);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let activeOverlay: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markers: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overlays: any[] = [];

    /* 카카오 Places 마커 — 경쟁업체 원형 (보라색) */
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="11" fill="${MARKER_COLOR}" stroke="white" stroke-width="2.5"/></svg>`;
    const markerImage = new kakao.maps.MarkerImage(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      new kakao.maps.Size(28, 28),
      { offset: new kakao.maps.Point(14, 14) },
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

      // XSS 방지: innerHTML 대신 DOM API로 안전하게 구성
      const overlayContent = document.createElement("div");

      const wrapper = document.createElement("div");
      Object.assign(wrapper.style, {
        padding: "8px 12px",
        fontSize: "13px",
        minWidth: "140px",
        maxWidth: "220px",
        color: "#333",
        background: "#fff",
        borderRadius: "8px",
        border: "1px solid #ddd",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        transform: "translateY(-100%)",
        marginBottom: "12px",
        position: "relative",
      });

      const nameEl = document.createElement("strong");
      nameEl.style.display = "block";
      nameEl.style.marginBottom = "2px";
      nameEl.textContent = place.place_name;

      const addrEl = document.createElement("span");
      Object.assign(addrEl.style, { color: "#666", fontSize: "12px" });
      addrEl.textContent = place.road_address_name || place.address_name;

      const arrow = document.createElement("div");
      Object.assign(arrow.style, {
        position: "absolute",
        bottom: "-8px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "0",
        height: "0",
        borderLeft: "8px solid transparent",
        borderRight: "8px solid transparent",
        borderTop: "8px solid #fff",
        filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.1))",
      });

      wrapper.append(nameEl, addrEl, arrow);
      overlayContent.appendChild(wrapper);

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

    /* 지하철역 마커 — 파란색 이모지 핀 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subwayMarkers: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subwayOverlays: any[] = [];

    if (subway?.isStationArea) {
      subway.stationsInRadius.forEach((station) => {
        if (!station.latitude || !station.longitude) return;

        const stationPosition = new kakao.maps.LatLng(
          station.latitude,
          station.longitude,
        );

        // 이모지 핀 마커 (CustomOverlay)
        const pinEl = createPinMarker("🚇", "#2563eb", 30);

        // 역 정보 팝업 오버레이
        const overlayContent = document.createElement("div");
        const wrapper = document.createElement("div");
        Object.assign(wrapper.style, {
          padding: "8px 12px",
          fontSize: "13px",
          minWidth: "120px",
          color: "#1e3a8a",
          background: "#eff6ff",
          borderRadius: "8px",
          border: "1px solid #93c5fd",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          transform: "translateY(-100%)",
          marginBottom: "12px",
          position: "relative",
        });
        const nameEl = document.createElement("strong");
        nameEl.style.display = "block";
        nameEl.style.marginBottom = "2px";
        nameEl.textContent = station.name;
        const distEl = document.createElement("span");
        Object.assign(distEl.style, { color: "#3b82f6", fontSize: "12px" });
        distEl.textContent = `도보 ${Math.round(station.distance)}m`;
        const arrow = document.createElement("div");
        Object.assign(arrow.style, {
          position: "absolute",
          bottom: "-8px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "0",
          height: "0",
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: "8px solid #eff6ff",
        });
        wrapper.append(nameEl, distEl, arrow);
        overlayContent.appendChild(wrapper);

        const stationOverlay = new kakao.maps.CustomOverlay({
          content: overlayContent,
          position: stationPosition,
          yAnchor: 1,
          clickable: true,
        });

        const stationMarker = new kakao.maps.CustomOverlay({
          content: pinEl,
          position: stationPosition,
          yAnchor: 1.0,
          clickable: true,
        });
        stationMarker.setMap(map);

        pinEl.addEventListener("click", () => {
          if (activeOverlay) activeOverlay.setMap(null);
          stationOverlay.setMap(map);
          activeOverlay = stationOverlay;
        });

        subwayMarkers.push(stationMarker);
        subwayOverlays.push(stationOverlay);
      });
    }

    /* 버스 정류장 마커 — 주황색 이모지 핀 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const busMarkers: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const busOverlays: any[] = [];

    if (bus?.hasBusStop && bus.stopsInRadius.length > 0) {
      bus.stopsInRadius.forEach((stop) => {
        if (!stop.latitude || !stop.longitude) return;

        const stopPosition = new kakao.maps.LatLng(stop.latitude, stop.longitude);

        const pinEl = createPinMarker("🚌", "#ea580c", 30);

        const overlayContent = document.createElement("div");
        const wrapper = document.createElement("div");
        Object.assign(wrapper.style, {
          padding: "8px 12px",
          fontSize: "13px",
          minWidth: "120px",
          color: "#7c2d12",
          background: "#fff7ed",
          borderRadius: "8px",
          border: "1px solid #fdba74",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          transform: "translateY(-100%)",
          marginBottom: "12px",
          position: "relative",
        });
        const nameEl = document.createElement("strong");
        nameEl.style.display = "block";
        nameEl.style.marginBottom = "2px";
        nameEl.textContent = stop.name;
        const distEl = document.createElement("span");
        Object.assign(distEl.style, { color: "#ea580c", fontSize: "12px" });
        distEl.textContent = `도보 ${Math.round(stop.distance)}m`;
        const arrow = document.createElement("div");
        Object.assign(arrow.style, {
          position: "absolute",
          bottom: "-8px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "0",
          height: "0",
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: "8px solid #fff7ed",
        });
        wrapper.append(nameEl, distEl, arrow);
        overlayContent.appendChild(wrapper);

        const stopOverlay = new kakao.maps.CustomOverlay({
          content: overlayContent,
          position: stopPosition,
          yAnchor: 1,
          clickable: true,
        });

        const stopMarker = new kakao.maps.CustomOverlay({
          content: pinEl,
          position: stopPosition,
          yAnchor: 1.0,
          clickable: true,
        });
        stopMarker.setMap(map);

        pinEl.addEventListener("click", () => {
          if (activeOverlay) activeOverlay.setMap(null);
          stopOverlay.setMap(map);
          activeOverlay = stopOverlay;
        });

        busMarkers.push(stopMarker);
        busOverlays.push(stopOverlay);
      });
    }

    /* 학교 마커 — 초록색 이모지 핀 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schoolMarkers: any[] = [];

    // 학교는 레벨별 반경(초 500m/중 1000m/고 1500m)으로 어댑터에서 이미 필터된 데이터
    if (school && school.schools.length > 0) {
      school.schools.forEach((s) => {
        const schoolPosition = new kakao.maps.LatLng(s.lat, s.lng);

        const pinEl = createPinMarker("🏫", "#16a34a", 30);

        const overlayContent = document.createElement("div");
        const wrapper = document.createElement("div");
        Object.assign(wrapper.style, {
          padding: "8px 12px",
          fontSize: "13px",
          minWidth: "120px",
          color: "#14532d",
          background: "#f0fdf4",
          borderRadius: "8px",
          border: "1px solid #86efac",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          transform: "translateY(-100%)",
          marginBottom: "12px",
          position: "relative",
        });
        const nameEl = document.createElement("strong");
        nameEl.style.display = "block";
        nameEl.style.marginBottom = "2px";
        nameEl.textContent = s.name;
        const distEl = document.createElement("span");
        Object.assign(distEl.style, { color: "#16a34a", fontSize: "12px" });
        distEl.textContent = `${s.level} · 도보 ${s.distanceMeters}m`;
        const arrow = document.createElement("div");
        Object.assign(arrow.style, {
          position: "absolute",
          bottom: "-8px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "0",
          height: "0",
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: "8px solid #f0fdf4",
        });
        wrapper.append(nameEl, distEl, arrow);
        overlayContent.appendChild(wrapper);

        const schoolOverlay = new kakao.maps.CustomOverlay({
          content: overlayContent,
          position: schoolPosition,
          yAnchor: 1,
          clickable: true,
        });

        const schoolMarker = new kakao.maps.CustomOverlay({
          content: pinEl,
          position: schoolPosition,
          yAnchor: 1.0,
          clickable: true,
        });
        schoolMarker.setMap(map);

        pinEl.addEventListener("click", () => {
          if (activeOverlay) activeOverlay.setMap(null);
          schoolOverlay.setMap(map);
          activeOverlay = schoolOverlay;
        });

        schoolMarkers.push(schoolMarker);
      });
    }

    /* 반경 내 여부 확인 헬퍼 */
    const isInRadius = (lat: number, lng: number): boolean => {
      const R = 6_371_000;
      const dLat = ((lat - centerLat) * Math.PI) / 180;
      const dLng = ((lng - centerLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((centerLat * Math.PI) / 180) *
          Math.cos((lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radius;
    };

    /* 대학교 마커 — 인디고색 이모지 핀 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const universityMarkers: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const universityOverlays: any[] = [];

    if (university && university.universities.length > 0) {
      university.universities.forEach((u) => {
        if (!isInRadius(u.latitude, u.longitude)) return;
        const univPosition = new kakao.maps.LatLng(u.latitude, u.longitude);

        const pinEl = createPinMarker("🎓", "#4f46e5", 30);

        const overlayContent = document.createElement("div");
        const wrapper = document.createElement("div");
        Object.assign(wrapper.style, {
          padding: "8px 12px",
          fontSize: "13px",
          minWidth: "120px",
          color: "#1e1b4b",
          background: "#eef2ff",
          borderRadius: "8px",
          border: "1px solid #a5b4fc",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          transform: "translateY(-100%)",
          marginBottom: "12px",
          position: "relative",
        });
        const nameEl = document.createElement("strong");
        nameEl.style.display = "block";
        nameEl.style.marginBottom = "2px";
        nameEl.textContent = u.name;
        const distEl = document.createElement("span");
        Object.assign(distEl.style, { color: "#4f46e5", fontSize: "12px" });
        distEl.textContent = `도보 ${u.distanceMeters}m`;
        const arrow = document.createElement("div");
        Object.assign(arrow.style, {
          position: "absolute",
          bottom: "-8px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "0",
          height: "0",
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: "8px solid #eef2ff",
        });
        wrapper.append(nameEl, distEl, arrow);
        overlayContent.appendChild(wrapper);

        const univOverlay = new kakao.maps.CustomOverlay({
          content: overlayContent,
          position: univPosition,
          yAnchor: 1,
          clickable: true,
        });

        const univMarker = new kakao.maps.CustomOverlay({
          content: pinEl,
          position: univPosition,
          yAnchor: 1.0,
          clickable: true,
        });
        univMarker.setMap(map);

        pinEl.addEventListener("click", () => {
          if (activeOverlay) activeOverlay.setMap(null);
          univOverlay.setMap(map);
          activeOverlay = univOverlay;
        });

        universityMarkers.push(univMarker);
        universityOverlays.push(univOverlay);
      });
    }

    /* 의료시설 마커 — 빨간색 이모지 핀 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const medicalMarkers: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const medicalOverlays: any[] = [];

    if (medical && medical.hospitals.length > 0) {
      medical.hospitals.forEach((h) => {
        if (!isInRadius(h.latitude, h.longitude)) return;
        if (h.category !== "종합병원") return;
        const hospitalPosition = new kakao.maps.LatLng(h.latitude, h.longitude);

        const pinEl = createPinMarker("🏥", "#dc2626", 30);

        const overlayContent = document.createElement("div");
        const wrapper = document.createElement("div");
        Object.assign(wrapper.style, {
          padding: "8px 12px",
          fontSize: "13px",
          minWidth: "120px",
          color: "#7f1d1d",
          background: "#fef2f2",
          borderRadius: "8px",
          border: "1px solid #fca5a5",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          transform: "translateY(-100%)",
          marginBottom: "12px",
          position: "relative",
        });
        const nameEl = document.createElement("strong");
        nameEl.style.display = "block";
        nameEl.style.marginBottom = "2px";
        nameEl.textContent = h.name;
        const distEl = document.createElement("span");
        Object.assign(distEl.style, { color: "#dc2626", fontSize: "12px" });
        distEl.textContent = `${h.category} · 도보 ${h.distanceMeters}m`;
        const arrow = document.createElement("div");
        Object.assign(arrow.style, {
          position: "absolute",
          bottom: "-8px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "0",
          height: "0",
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: "8px solid #fef2f2",
        });
        wrapper.append(nameEl, distEl, arrow);
        overlayContent.appendChild(wrapper);

        const hospitalOverlay = new kakao.maps.CustomOverlay({
          content: overlayContent,
          position: hospitalPosition,
          yAnchor: 1,
          clickable: true,
        });

        const hospitalMarker = new kakao.maps.CustomOverlay({
          content: pinEl,
          position: hospitalPosition,
          yAnchor: 1.0,
          clickable: true,
        });
        hospitalMarker.setMap(map);

        pinEl.addEventListener("click", () => {
          if (activeOverlay) activeOverlay.setMap(null);
          hospitalOverlay.setMap(map);
          activeOverlay = hospitalOverlay;
        });

        medicalMarkers.push(hospitalMarker);
        medicalOverlays.push(hospitalOverlay);
      });
    }

    // cleanup: 마커·오버레이·원 제거 (메모리 누수 방지)
    return () => {
      markers.forEach((m) => m.setMap(null));
      overlays.forEach((o) => o.setMap(null));
      subwayMarkers.forEach((m) => m.setMap(null));
      subwayOverlays.forEach((o) => o.setMap(null));
      busMarkers.forEach((m) => m.setMap(null));
      busOverlays.forEach((o) => o.setMap(null));
      schoolMarkers.forEach((m) => m.setMap(null));
      universityMarkers.forEach((m) => m.setMap(null));
      universityOverlays.forEach((o) => o.setMap(null));
      medicalMarkers.forEach((m) => m.setMap(null));
      medicalOverlays.forEach((o) => o.setMap(null));
      if (activeOverlay) activeOverlay.setMap(null);
      circle.setMap(null);
    };
  }, [isLoaded, centerLat, centerLng, radius, places, fullScreen, subway, bus, school, university, medical]);

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
