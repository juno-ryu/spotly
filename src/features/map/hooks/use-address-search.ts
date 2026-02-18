"use client";

import { useEffect, useState } from "react";
import { useKakaoMap } from "../components/kakao-map-provider";

export interface SearchResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
}

/** 디바운스된 값 반환 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** 카카오 Maps SDK Places 키워드 검색 (클라이언트 측, IP 제한 없음) */
function searchPlaces(keyword: string): Promise<SearchResult[]> {
  return new Promise((resolve) => {
    if (!window.kakao?.maps?.services) {
      resolve([]);
      return;
    }

    const places = new window.kakao.maps.services.Places();
    places.keywordSearch(
      keyword,
      (results, status) => {
        if (status === window.kakao.maps.services.Status.OK) {
          resolve(
            results.map((r) => ({
              name: r.place_name,
              address: r.road_address_name || r.address_name,
              latitude: parseFloat(r.y),
              longitude: parseFloat(r.x),
              category: r.category_name,
            })),
          );
        } else {
          resolve([]);
        }
      },
      { size: 10 },
    );
  });
}

/** 주소/키워드 검색 (200ms 디바운싱, 카카오 클라이언트 SDK 사용) */
export function useAddressSearch(keyword: string) {
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 200);
  const { isLoaded } = useKakaoMap();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!debouncedKeyword || !isLoaded) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    searchPlaces(debouncedKeyword).then((res) => {
      if (cancelled) return;
      setResults(res);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedKeyword, isLoaded]);

  return { data: { results }, isLoading };
}
