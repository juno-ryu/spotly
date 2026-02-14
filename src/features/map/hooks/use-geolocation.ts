"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface GeoPosition {
  latitude: number;
  longitude: number;
}

/** 서울 시청 기본 좌표 (GPS 실패 시 폴백) */
const DEFAULT_POSITION: GeoPosition = {
  latitude: 37.5665,
  longitude: 126.978,
};

/** 브라우저 Geolocation API 래퍼 — 기본 좌표로 즉시 렌더, GPS 수신 시 갱신 */
export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition>(DEFAULT_POSITION);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requested = useRef(false);

  const requestPosition = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("GPS를 사용할 수 없는 환경입니다");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setError(null);
        setLoading(false);
      },
      () => {
        setError("위치 권한이 필요합니다");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    requestPosition();
  }, [requestPosition]);

  return { position, error, loading, requestPosition };
}
