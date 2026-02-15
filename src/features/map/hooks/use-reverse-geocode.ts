"use client";

import { useCallback, useRef, useState } from "react";

interface ReverseGeocodeResult {
  /** 표시용 주소 (도로명 우선, 없으면 지번) */
  address: string;
  /** 지번 주소 */
  jibunAddress: string;
  /** 도로명 주소 */
  roadAddress: string | null;
  /** 법정동코드 앞 5자리 (시군구) */
  districtCode: string | null;
  /** 법정동 이름 (예: "중동", "역삼동") */
  dongName: string | null;
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

    // 주소 조회 + 법정동코드 조회 병렬 실행
    let addressDone = false;
    let regionDone = false;
    let partialResult: Partial<ReverseGeocodeResult> = {};

    const tryFinish = () => {
      if (addressDone && regionDone) {
        setResult({
          address: partialResult.address ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          jibunAddress: partialResult.jibunAddress ?? "",
          roadAddress: partialResult.roadAddress ?? null,
          districtCode: partialResult.districtCode ?? null,
          dongName: partialResult.dongName ?? null,
        });
        setIsLoading(false);
      }
    };

    // 1) 주소 조회 (기존)
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
          partialResult.address = roadAddr ?? jibunAddr;
          partialResult.jibunAddress = jibunAddr;
          partialResult.roadAddress = roadAddr;
        }
        addressDone = true;
        tryFinish();
      },
    );

    // 2) 법정동코드 조회 (프리페치용)
    geocoderRef.current.coord2RegionCode(
      lng,
      lat,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (results: any[], status: string) => {
        if (
          status === window.kakao.maps.services.Status.OK &&
          results.length > 0
        ) {
          // 법정동(B) 타입 우선
          const bRegion = results.find(
            (r: { region_type: string }) => r.region_type === "B",
          ) ?? results[0];
          if (bRegion?.code) {
            partialResult.districtCode = bRegion.code.substring(0, 5);
            partialResult.dongName = bRegion.region_3depth_name ?? null;
          }
        }
        regionDone = true;
        tryFinish();
      },
    );
  }, []);

  return { result, isLoading, reverseGeocode };
}
