"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function UpdatePrompt() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          // 새 SW가 installed 상태 + 기존 SW 활성화 중일 때만 알림
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            toast("새 버전이 있습니다", {
              description: "업데이트하면 최신 기능을 이용할 수 있습니다.",
              action: {
                label: "업데이트",
                onClick: () => {
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                  window.location.reload();
                },
              },
              duration: Infinity,
            });
          }
        });
      });
    });
  }, []);

  // 렌더링 없음 — 부작용만 처리
  return null;
}
