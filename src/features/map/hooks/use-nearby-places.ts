"use client";

import { useEffect, useRef, useState } from "react";
import { useKakaoMap } from "../components/kakao-map-provider";

interface UseNearbyPlacesParams {
  keyword: string;
  lat: number;
  lng: number;
  /** 검색 반경 (미터) */
  radius: number;
}

interface UseNearbyPlacesResult {
  places: KakaoPlaceResult[];
  isLoading: boolean;
}

/** Kakao Places keywordSearch로 좌표 + 반경 기반 주변 업종 검색 (전체 페이지 수집) */
export function useNearbyPlaces({
  keyword,
  lat,
  lng,
  radius,
}: UseNearbyPlacesParams): UseNearbyPlacesResult {
  const { isLoaded } = useKakaoMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placesRef = useRef<any>(null);
  const [places, setPlaces] = useState<KakaoPlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Places 인스턴스 생성
  useEffect(() => {
    if (!isLoaded || !window.kakao?.maps?.services) return;
    if (!placesRef.current) {
      placesRef.current = new window.kakao.maps.services.Places();
    }
  }, [isLoaded]);

  // keyword / lat / lng / radius 변경 시 디바운스 검색 + 전체 페이지 수집
  useEffect(() => {
    if (!placesRef.current || !keyword) {
      setPlaces([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(() => {
      const ps = placesRef.current;
      const accumulated: KakaoPlaceResult[] = [];

      const callback = (
        result: KakaoPlaceResult[],
        status: string,
        pagination: KakaoPlacesPagination,
      ) => {
        if (cancelled) return;

        if (status === window.kakao.maps.services.Status.OK) {
          accumulated.push(...result);
          setPlaces([...accumulated]);

          // 다음 페이지가 있으면 계속 요청 (최대 45페이지 = 675개)
          if (pagination.hasNextPage) {
            pagination.nextPage();
            return;
          }
        }

        setIsLoading(false);
      };

      ps.keywordSearch(keyword, callback, {
        x: String(lng),
        y: String(lat),
        radius: Math.min(radius, 20000),
        size: 15,
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsLoading(false);
    };
  }, [keyword, lat, lng, radius]);

  return { places, isLoading };
}
