"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { WelcomeScreen } from "./welcome-screen";
import { useWizardStore } from "@/features/analysis/stores/wizard-store";

interface WelcomePageClientProps {
  isLoggedIn: boolean;
}

export function WelcomePageClient({ isLoggedIn }: WelcomePageClientProps) {
  const router = useRouter();
  const reset = useWizardStore((s) => s.reset);

  const handleNext = useCallback(() => {
    reset();
    router.push("/industry");
  }, [reset, router]);

  return <WelcomeScreen onNext={handleNext} isLoggedIn={isLoggedIn} />;
}
