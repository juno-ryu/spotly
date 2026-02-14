"use client";

import { memo, useEffect, useRef } from "react";
import { useKakaoMap } from "@/features/map/components/kakao-map-provider";
import type { NearbyBusiness } from "../schema";

interface CompetitorMapProps {
  /** 분석 중심 위도 */
  centerLat: number;
  /** 분석 중심 경도 */
  centerLng: number;
  /** 분석 반경 (미터) */
  radius: number;
  /** 주변 사업장 목록 */
  businesses: NearbyBusiness[];
}

/** 상태별 마커 색상 */
const STATUS_COLOR: Record<string, string> = {
  active: "#3b82f6",    // 파란색
  suspended: "#eab308", // 노란색
  closed: "#6b7280",    // 회색
};

const STATUS_LABEL: Record<string, string> = {
  active: "활성",
  suspended: "휴업",
  closed: "폐업",
};

/** 경쟁업체 지도 시각화 */
export const CompetitorMap = memo(function CompetitorMap({
  centerLat,
  centerLng,
  radius,
  businesses,
}: CompetitorMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const { isLoaded } = useKakaoMap();

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.kakao?.maps) return;

    const kakao = window.kakao;
    const center = new kakao.maps.LatLng(centerLat, centerLng);

    // 지도 생성
    const map = new kakao.maps.Map(mapRef.current, {
      center,
      level: radius <= 500 ? 5 : radius <= 1000 ? 6 : 8,
    });

    // 반경 원 오버레이 (setMap 사용 — Circle 생성자에 map 미지원)
    const circle = new kakao.maps.Circle({
      center,
      radius,
      strokeWeight: 3,
      strokeColor: "#3b82f6",
      strokeOpacity: 0.6,
      strokeStyle: "solid",
      fillColor: "#3b82f6",
      fillOpacity: 0.08,
    });
    circle.setMap(map);

    // 중심 마커 (선택 위치)
    new kakao.maps.Marker({
      position: center,
      map,
      image: new kakao.maps.MarkerImage(
        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
        new kakao.maps.Size(24, 35),
      ),
    });

    // 현재 열린 오버레이 추적 (마커 간 공유)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let activeOverlay: any = null;

    // 경쟁업체 마커 (좌표 없으면 중심점 주변에 분포)
    businesses.forEach((biz, idx) => {
      let lat = biz.latitude;
      let lng = biz.longitude;

      if (!lat || !lng) {
        // 좌표 없는 사업장: 반경 내 랜덤 위치 생성 (시드 기반 일관성)
        const angle = (idx * 137.508) % 360; // 황금각으로 균일 분포
        const dist = (0.3 + (idx * 0.618) % 0.7) * radius; // 반경의 30~100%
        const dLat = (dist * Math.cos(angle * Math.PI / 180)) / 111320;
        const dLng = (dist * Math.sin(angle * Math.PI / 180)) / (111320 * Math.cos(centerLat * Math.PI / 180));
        lat = centerLat + dLat;
        lng = centerLng + dLng;
      }

      const position = new kakao.maps.LatLng(lat, lng);
      const color = STATUS_COLOR[biz.status] ?? "#6b7280";
      const label = STATUS_LABEL[biz.status] ?? biz.status;

      // SVG 마커 (상태별 색상)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="${color}" stroke="white" stroke-width="2"/></svg>`;
      const markerImage = new kakao.maps.MarkerImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        new kakao.maps.Size(20, 20),
        { offset: new kakao.maps.Point(10, 10) },
      );

      const marker = new kakao.maps.Marker({
        position,
        map,
        image: markerImage,
      });

      // 커스텀 오버레이 (인포윈도우 대체 — 스타일 제어 용이)
      const overlayContent = document.createElement("div");
      overlayContent.innerHTML = `
        <div style="
          padding:8px 12px;
          font-size:13px;
          min-width:150px;
          color:#333;
          background:#fff;
          border-radius:8px;
          border:1px solid #ddd;
          box-shadow:0 2px 6px rgba(0,0,0,0.15);
          white-space:nowrap;
          transform:translateY(-100%);
          margin-bottom:12px;
          position:relative;
        ">
          <strong>${biz.name}</strong><br/>
          직원 ${biz.employeeCount}명 · <span style="color:${color}">${label}</span>
          <div style="
            position:absolute;
            bottom:-8px;
            left:50%;
            transform:translateX(-50%);
            width:0;height:0;
            border-left:8px solid transparent;
            border-right:8px solid transparent;
            border-top:8px solid #fff;
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
        // 이전 오버레이 닫기
        if (activeOverlay) {
          activeOverlay.setMap(null);
        }
        overlay.setMap(map);
        activeOverlay = overlay;
      });
    });

    // 지도 클릭 시 오버레이 닫기
    kakao.maps.event.addListener(map, "click", () => {
      if (activeOverlay) {
        activeOverlay.setMap(null);
        activeOverlay = null;
      }
    });

    // 줌 컨트롤
    map.addControl(
      new kakao.maps.ZoomControl(),
      kakao.maps.ControlPosition.RIGHT,
    );
  }, [isLoaded, centerLat, centerLng, radius, businesses]);

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
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
          활성
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-500" />
          휴업
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-gray-500" />
          폐업
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 text-yellow-400">★</span>
          선택 위치
        </span>
      </div>
    </div>
  );
});
