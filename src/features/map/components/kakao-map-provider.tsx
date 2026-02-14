"use client";

import Script from "next/script";
import { createContext, useContext, useState, type ReactNode } from "react";

interface KakaoMapContextValue {
  isLoaded: boolean;
}

const KakaoMapContext = createContext<KakaoMapContextValue>({
  isLoaded: false,
});

export function useKakaoMap() {
  return useContext(KakaoMapContext);
}

/** Kakao Maps JS SDK 로드 + 초기화 Provider */
export function KakaoMapProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

  if (!appKey) {
    return <>{children}</>;
  }

  return (
    <KakaoMapContext.Provider value={{ isLoaded }}>
      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=services&autoload=false`}
        strategy="afterInteractive"
        onLoad={() => {
          if (window.kakao?.maps) {
            window.kakao.maps.load(() => {
              setIsLoaded(true);
            });
          }
        }}
      />
      {children}
    </KakaoMapContext.Provider>
  );
}
