"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWizardStore } from "../stores/wizard-store";

type GuardField = "selectedIndustry" | "selectedRegion" | "selectedLocation";

/** 필수 필드 미충족 시 리다이렉트할 경로 */
const REDIRECT_MAP: Record<GuardField, string> = {
  selectedIndustry: "/industry",
  selectedRegion: "/region",
  selectedLocation: "/map",
};

/**
 * 위자드 페이지 가드 — persist hydration 완료 후 필수 필드 검사
 * 필수 필드가 없으면 해당 스텝 페이지로 리다이렉트
 */
export function useWizardGuard(requiredFields: GuardField[]) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // zustand persist hydration 완료 대기
    const unsub = useWizardStore.persist.onFinishHydration(() => {
      const state = useWizardStore.getState();

      for (const field of requiredFields) {
        if (!state[field]) {
          router.replace(REDIRECT_MAP[field]);
          return;
        }
      }

      setIsReady(true);
    });

    // 이미 hydration이 완료된 경우
    if (useWizardStore.persist.hasHydrated()) {
      const state = useWizardStore.getState();

      for (const field of requiredFields) {
        if (!state[field]) {
          router.replace(REDIRECT_MAP[field]);
          return;
        }
      }

      setIsReady(true);
    }

    return unsub;
  }, [requiredFields, router]);

  return { isReady };
}
