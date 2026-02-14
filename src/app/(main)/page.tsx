"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { WelcomeScreen } from "@/features/onboarding/components/welcome-screen";
import { useWizardStore } from "@/features/analysis/stores/wizard-store";

/** Step 1: 환영 화면 */
export default function HomePage() {
  const router = useRouter();
  const reset = useWizardStore((s) => s.reset);

  const handleNext = useCallback(() => {
    reset();
    router.push("/industry");
  }, [reset, router]);

  return <WelcomeScreen onNext={handleNext} />;
}
