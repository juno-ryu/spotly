"use client";

import { useCallback, useRef } from "react";
import { ChevronsDown } from "lucide-react";
import { GRADIENT_TEXT_STYLE as GRADIENT_STYLE } from "@/constants/site";
import { hapticLight } from "../lib/haptic";
import { ReportViewer } from "@/features/report/components/report-viewer";
import { PhoneFrame } from "./phone-frame";
import { WelcomeIntroFold } from "./welcome-intro-fold";
import { WelcomeValueFold } from "./welcome-value-fold";
import { LazyFold } from "./previews/lazy-fold";
import { IndustryPreview } from "./previews/industry-preview";
import { RegionPreview } from "./previews/region-preview";
import { MapPreview } from "./previews/map-preview";
import { ResultPreview } from "./previews/result-preview";
import { GeneratingPreview } from "./previews/generating-preview";
import type { PreviewData } from "@/features/onboarding/lib/get-random-preview-report";

interface WelcomeScreenProps {
  onNext: () => void;
  preview: PreviewData | null;
  reviewSection: React.ReactNode;
}

/**
 * 웰컴 화면 — 인사(Fold 1) + 가치 제안(Fold 2) + view-only 미리보기(Fold 3~8).
 *
 * Fold 3~8 은 LazyFold 로 viewport 240px 전에만 마운트하여 첫 페인트 비용 절감.
 */
export function WelcomeScreen({
  onNext,
  preview,
  reviewSection,
}: WelcomeScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleStart = useCallback(() => {
    hapticLight();
    onNext();
  }, [onNext]);

  /** Fold 1 (인사 화면) 으로 복귀 — 카카오 공유 카드 푸터 클릭용 */
  const scrollToTop = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    hapticLight();
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div
      ref={scrollRef}
      className="absolute inset-0 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <WelcomeIntroFold onStart={handleStart} />

      {preview && (
        <WelcomeValueFold
          preview={preview}
          onStart={handleStart}
          onHome={scrollToTop}
          scrollHint={<ScrollHint />}
        />
      )}

      {/* ─── Fold 3: 업종 선택 미리보기 ─── */}
      {preview && (
        <LazyFold>
          <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
            <PhoneFrame>
              <IndustryPreview selectedIndustryName={preview.industryName} />
            </PhoneFrame>
            <ScrollHint />
          </section>
        </LazyFold>
      )}

      {/* ─── Fold 4: 지역 선택 미리보기 ─── */}
      {preview && (
        <LazyFold>
          <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
            <PhoneFrame>
              <RegionPreview industryName={preview.industryName} />
            </PhoneFrame>
            <ScrollHint />
          </section>
        </LazyFold>
      )}

      {/* ─── Fold 5: 위치/반경 선택 미리보기 ─── */}
      {preview && (
        <LazyFold>
          <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
            <PhoneFrame>
              <MapPreview
                address={preview.address}
                industryName={preview.industryName}
              />
            </PhoneFrame>
            <ScrollHint />
          </section>
        </LazyFold>
      )}

      {/* ─── Fold 6: 분석 결과 미리보기 ─── */}
      {preview && (
        <LazyFold>
          <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
            <PhoneFrame>
              <ResultPreview preview={preview} />
            </PhoneFrame>
            <ScrollHint />
          </section>
        </LazyFold>
      )}

      {/* ─── Fold 7: AI 리포트 생성 대기 미리보기 ─── */}
      {preview && (
        <LazyFold>
          <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
            <PhoneFrame>
              <GeneratingPreview />
            </PhoneFrame>
            <ScrollHint />
          </section>
        </LazyFold>
      )}

      {/* ─── Fold 8: AI 리포트 미리보기 ─── */}
      {preview?.aiReportJson && (
        <LazyFold>
          <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
            <PhoneFrame>
              <div className="py-4">
                <div className="pl-6">
                  <h1 className="text-2xl font-bold" style={GRADIENT_STYLE}>
                    {preview.address}
                  </h1>
                  <p className="text-muted-foreground">
                    {preview.industryName} · AI 리포트
                  </p>
                </div>
                <ReportViewer
                  report={preview.aiReportJson}
                  totalScore={preview.totalScore}
                  scoreGrade={preview.grade}
                  scoreDetail={preview.scoreDetail ?? undefined}
                  lat={preview.lat}
                  lng={preview.lng}
                  address={preview.address}
                  industryName={preview.industryName}
                  mode="view"
                />
                <div className="pointer-events-none select-none" aria-hidden>
                  {reviewSection}
                </div>
              </div>
            </PhoneFrame>
          </section>
        </LazyFold>
      )}
    </div>
  );
}

/**
 * phone fold 사이 chevron — 클릭 시 다음 fold 로 스크롤.
 *
 * LazyFold 가 section 을 한 단계 wrapping 하므로 단순 `closest("section").nextElementSibling`
 * 로는 다음 fold 를 못 찾는 경우가 있다. 따라서 부모를 타고 올라가면서
 * `nextElementSibling` 이 있는 첫 ancestor 를 찾는다.
 */
function ScrollHint() {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    let cursor: HTMLElement | null = e.currentTarget;
    while (cursor && !cursor.nextElementSibling) {
      cursor = cursor.parentElement;
    }
    const next = cursor?.nextElementSibling as HTMLElement | null;
    next?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="flex justify-center bg-white py-10">
      <button
        type="button"
        onClick={handleClick}
        className="p-2"
        aria-label="다음으로 스크롤"
      >
        <ChevronsDown
          className="size-7 text-violet-600 animate-bounce-gentle"
          strokeWidth={2.5}
        />
      </button>
    </div>
  );
}
