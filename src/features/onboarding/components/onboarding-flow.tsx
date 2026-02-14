"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { WelcomeScreen } from "./welcome-screen";
import { IndustrySelector } from "./industry-selector";
import { RegionSelector } from "./region-selector";
import type { OnboardingIndustry } from "../constants/industries";
import type { OnboardingRegion } from "../constants/regions";

type SubStep = "welcome" | "industry" | "region";

interface OnboardingFlowProps {
  onComplete: (industry: OnboardingIndustry, region: OnboardingRegion) => void;
}

/** Step 1~3 온보딩 퍼널 컨테이너 */
export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [subStep, setSubStep] = useState<SubStep>("welcome");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedIndustry, setSelectedIndustry] =
    useState<OnboardingIndustry | null>(null);

  /** Step 전환 (300ms CSS 트랜지션) */
  const transitionTo = useCallback(
    (next: SubStep, callback?: () => void) => {
      setIsTransitioning(true);
      setTimeout(() => {
        if (callback) callback();
        setSubStep(next);
        setIsTransitioning(false);
      }, 300);
    },
    [],
  );

  // Step 1 → Step 2
  const handleWelcomeNext = useCallback(() => {
    transitionTo("industry");
  }, [transitionTo]);

  // Step 2 → Step 3
  const handleIndustryNext = useCallback(
    (industry: OnboardingIndustry) => {
      setSelectedIndustry(industry);
      transitionTo("region");
    },
    [transitionTo],
  );

  // Step 3 → 완료
  const handleRegionNext = useCallback(
    (region: OnboardingRegion) => {
      if (!selectedIndustry) return;
      onComplete(selectedIndustry, region);
    },
    [selectedIndustry, onComplete],
  );

  // Step 2 → Step 1
  const handleIndustryBack = useCallback(() => {
    transitionTo("welcome");
  }, [transitionTo]);

  // Step 3 → Step 2
  const handleRegionBack = useCallback(() => {
    transitionTo("industry");
  }, [transitionTo]);

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={cn(
          "transition-all duration-300 ease-out",
          isTransitioning
            ? "opacity-0 -translate-y-4"
            : "opacity-100 translate-y-0",
        )}
      >
        {subStep === "welcome" && (
          <WelcomeScreen onNext={handleWelcomeNext} />
        )}
        {subStep === "industry" && (
          <IndustrySelector
            onNext={handleIndustryNext}
            onBack={handleIndustryBack}
          />
        )}
        {subStep === "region" && selectedIndustry && (
          <RegionSelector
            selectedIndustry={selectedIndustry}
            onNext={handleRegionNext}
            onBack={handleRegionBack}
          />
        )}
      </div>

      {/* 스크린리더 Step 전환 알림 */}
      <div aria-live="assertive" className="sr-only">
        {subStep === "industry" && "업종을 선택해주세요"}
        {subStep === "region" && "지역을 선택해주세요"}
      </div>
    </div>
  );
}
