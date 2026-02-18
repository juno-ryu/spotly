"use client";

import { Toaster } from "@/components/ui/sonner";
import { KakaoMapProvider } from "@/features/map/components/kakao-map-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <KakaoMapProvider>{children}</KakaoMapProvider>
      <Toaster />
    </>
  );
}
