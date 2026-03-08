"use client";

import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { KakaoMapProvider } from "@/features/map/components/kakao-map-provider";
import { InstallBanner } from "@/components/pwa/install-banner";
import { UpdatePrompt } from "@/components/pwa/update-prompt";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return (
    <>
      <KakaoMapProvider>{children}</KakaoMapProvider>
      <Toaster />
      <InstallBanner />
      <UpdatePrompt />
    </>
  );
}
