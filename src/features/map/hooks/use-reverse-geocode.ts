"use client";

import { useCallback, useRef, useState } from "react";

interface ReverseGeocodeResult {
  /** 표시용 주소 (도로명 우선, 없으면 지번) */
  address: string;
  /** 지번 주소 */
  jibunAddress: string;
  /** 도로명 주소 */
  roadAddress: string | null;
}

/** 카카오 Geocoder를 이용한 좌표 → 주소 역지오코딩 훅 */
export function useReverseGeocode() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geocoderRef = useRef<any>(null);
  const [result, setResult] = useState<ReverseGeocodeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!window.kakao?.maps?.services) return;

    if (!geocoderRef.current) {
      geocoderRef.current = new window.kakao.maps.services.Geocoder();
    }

    setIsLoading(true);

    geocoderRef.current.coord2Address(
      lng,
      lat,
      (results: KakaoGeocoderResult[], status: string) => {
        if (
          status === window.kakao.maps.services.Status.OK &&
          results.length > 0
        ) {
          const first = results[0];
          const roadAddr = first.road_address?.address_name ?? null;
          const jibunAddr = first.address.address_name;

          setResult({
            address: roadAddr ?? jibunAddr,
            jibunAddress: jibunAddr,
            roadAddress: roadAddr,
          });
        } else {
          setResult({
            address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            jibunAddress: "",
            roadAddress: null,
          });
        }
        setIsLoading(false);
      },
    );
  }, []);

  return { result, isLoading, reverseGeocode };
}
