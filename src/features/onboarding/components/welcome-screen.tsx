"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hapticLight } from "../lib/haptic";
import { useTypingAnimation } from "../hooks/use-typing-animation";
import { GRADIENT_TEXT_STYLE as GRADIENT_STYLE } from "@/constants/site";
import { KakaoShareCards } from "./kakao-share-cards";
import { IndustrySelector } from "./industry-selector";
import { RegionSelector } from "./region-selector";
import { ReportViewer } from "@/features/report/components/report-viewer";
import { AnalysisResult } from "@/features/analysis/components/analysis-result";
import { GeneratingProgress } from "@/features/analysis/components/purchase-overlay";
import { MapRadiusStep } from "@/features/map/components/map-radius-step";
import { PhoneFrame } from "./phone-frame";
import type { AnalysisData } from "@/features/analysis/actions";
import type { PreviewData } from "@/features/onboarding/lib/get-random-preview-report";
import type { OnboardingIndustry } from "../constants/industries";

const NOOP = () => {};

/** phone fold 사이 chevron — section 사이 spacer 안에 둠. 클릭 시 다음 section 으로 스크롤 */
function ScrollHint() {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const wrapper = e.currentTarget.parentElement;
    // 1순위: wrapper 의 nextSibling (section 사이 spacer 모드)
    let next = wrapper?.nextElementSibling as HTMLElement | null;
    // 2순위: 가장 가까운 section 의 nextSibling (section 안 모드)
    if (!next) {
      const section = wrapper?.closest("section");
      next = section?.nextElementSibling as HTMLElement | null;
    }
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

/** preview 데이터의 업종명 → OnboardingIndustry 형태로 변환 (RegionSelector 헤드라인용) */
function previewToIndustry(industryName: string): OnboardingIndustry {
  return {
    emoji: "☕",
    name: industryName,
    keyword: industryName,
    ksicCode: "",
    seoulCode: "",
  };
}

/** preview + aiReportJson 의 raw 정보로 AnalysisData 형 채움. 없는 raw 는 적당한 mock. */
function buildMockAnalysisData(preview: PreviewData): AnalysisData {
  const ai = preview.aiReportJson;
  const competitionScore = preview.scoreDetail?.competition ?? {
    score: preview.totalScore,
    grade: preview.grade,
    gradeLabel: preview.verdict,
  };
  const direct = ai?.competitorCount?.direct ?? 29;
  const indirect = ai?.competitorCount?.indirect ?? 7;
  const franchise = ai?.competitorCount?.franchise ?? 0;
  const total = direct + indirect + franchise;
  const franchiseRatio = total > 0 ? franchise / total : 0;
  const lat = preview.lat ?? 37.5665;
  const lng = preview.lng ?? 126.978;
  return {
    address: preview.address,
    industryName: preview.industryName,
    industryKeyword: preview.industryName,
    radius: 300,
    totalScore: preview.totalScore,
    scoreDetail: preview.scoreDetail ?? { competition: competitionScore },
    isSeoul: true,
    centerLatitude: lat,
    centerLongitude: lng,
    competition: {
      totalCount: total || 36,
      fetchedCount: total || 36,
      densityPerMeter: 99,
      densityBaseline: 150,
      directCompetitorCount: direct,
      indirectCompetitorCount: indirect,
      directCompetitorRatio: total > 0 ? direct / total : 0.8,
      estimatedDirectCount: direct,
      estimatedIndirectCount: indirect,
      franchiseCount: franchise,
      franchiseRatio,
      estimatedFranchiseCount: franchise,
      franchiseBrandNames: franchise > 0 ? ["스타벅스", "이디야", "할리스"] : [],
      competitionScore,
    },
    // VitalityAnalysis 의 raw (details.floatingPopulation 등) 는 깊어서 미복원 — null
    vitality: null,
    populationAnalysis: preview.scoreDetail?.population
      ? {
          populationScore: preview.scoreDetail.population.score,
          score: preview.scoreDetail.population,
          details: { totalPopulation: 21619, isDongLevel: true },
        }
      : null,
    places: {
      totalCount: total || 36,
      fetchedCount: total || 36,
      places: [],
    },
    subway: {
      isStationArea: true,
      nearestStation: { name: "중곡역", distance: 94, latitude: lat, longitude: lng },
      stationsInRadius: [
        { name: "중곡역", distance: 94, latitude: lat, longitude: lng },
      ],
    },
    bus: {
      hasBusStop: true,
      nearestStop: {
        nodeId: "BUS_MOCK_001",
        name: "성북구청.성북경찰서",
        latitude: lat,
        longitude: lng,
        distanceMeters: 100,
        routes: ["110", "143", "1014", "1166", "147", "148", "162", "171", "172", "272", "1218"],
        routeIds: Array.from({ length: 11 }, (_, i) => `R${i}`),
        routeCount: 11,
      },
      stopCount: 17,
      stopsInRadius: [
        { name: "성북구청.성북경찰서", distance: 100, latitude: lat, longitude: lng },
      ],
      totalRouteCount: 11,
    },
    school: {
      elementaryCount: 0,
      middleCount: 0,
      highCount: 1,
      totalCount: 1,
      schools: [
        {
          name: "성북고등학교",
          level: "고등학교",
          distanceMeters: 260,
          address: preview.address,
          lat,
          lng,
        },
      ],
    },
    university: {
      count: 1,
      universities: [
        {
          name: "성신여자대학교",
          distanceMeters: 543,
          address: preview.address,
          lat,
          lng,
        },
      ],
    },
    medical: {
      generalHospitalCount: 2,
      hospitals: [
        {
          name: "성북병원",
          distanceMeters: 320,
          address: preview.address,
          lat,
          lng,
        },
      ],
    },
  } as unknown as AnalysisData;
}

const STEP1_TEXT = "창업 준비중이세요?";
const STEP2_TEXT = "같이 한번 알아볼까요? 😊";

const TYPING_SPEED = 33;
const PHASE_PAUSE = 500;

/** 공공데이터 소스 — UI 키트 디자인 매칭 (6개) */
const DATA_SOURCES = [
  "Kakao Places",
  "서울 골목상권",
  "KOSIS 인구",
  "지하철·버스",
  "학교·의료",
  "프랜차이즈",
] as const;

interface WelcomeScreenProps {
  onNext: () => void;
  preview: PreviewData | null;
  reviewSection: React.ReactNode;
}

/** 웰컴 화면 — Fold 1(인사·CTA) + Fold 2(실제 리포트 미리보기) 2단 스냅 스크롤 */
export function WelcomeScreen({ onNext, preview, reviewSection }: WelcomeScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"step1" | "pause" | "step2" | "done">(
    "step1",
  );
  const [showCTA, setShowCTA] = useState(false);
  const [showBounce, setShowBounce] = useState(false);

  const { displayText: text1, isDone: text1Done } = useTypingAnimation(
    STEP1_TEXT,
    TYPING_SPEED,
    true,
  );

  const { displayText: text2, isDone: text2Done } = useTypingAnimation(
    STEP2_TEXT,
    TYPING_SPEED,
    phase === "step2" || phase === "done",
  );

  useEffect(() => {
    if (text1Done && phase === "step1") setPhase("pause");
  }, [text1Done, phase]);

  useEffect(() => {
    if (phase !== "pause") return;
    const timer = setTimeout(() => setPhase("step2"), PHASE_PAUSE);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (text2Done && phase === "step2") setPhase("done");
  }, [text2Done, phase]);

  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => setShowCTA(true), 250);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!showCTA) return;
    const timer = setTimeout(() => setShowBounce(true), 2500);
    return () => clearTimeout(timer);
  }, [showCTA]);

  const handleStart = useCallback(() => {
    hapticLight();
    onNext();
  }, [onNext]);

  /** Fold 1 (인사 화면) 으로 복귀 — 홈/스팟리 푸터 클릭용 */
  const scrollToTop = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    hapticLight();
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /** 이모지는 원본 색상, 텍스트에만 그라데이션 */
  const renderGradientText = (text: string) =>
    text.split("\n").map((line, lineIdx) => (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {line.split(/(\p{Extended_Pictographic})/u).map((seg, i) =>
          /\p{Extended_Pictographic}/u.test(seg) ? (
            <span key={i}>{seg}</span>
          ) : seg ? (
            <span key={i} style={GRADIENT_STYLE}>
              {seg}
            </span>
          ) : null,
        )}
      </span>
    ));

  return (
    <div
      ref={scrollRef}
      className="absolute inset-0 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* ─── Fold 1: 인사말 + pill + 작은 카피 ─── */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-6 ">
        {/* 글로우 배경 */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-120px] h-[360px] w-[460px] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(124,58,237,0.20), rgba(99,102,241,0.08) 45%, transparent 70%)",
          }}
        />

        <div className="relative z-10 space-y-5 text-center">
          <Image
            src="/icons/icon-192.png"
            alt="스팟리 로고"
            width={80}
            height={80}
            className="mx-auto rounded-2xl"
            priority
          />

          {text1 && (
            <h1 className="text-[28px] sm:text-[34px] font-black leading-[1.4] break-keep">
              {renderGradientText(text1)}
              {!text1Done && (
                <span className="animate-blink-cursor font-normal text-pink-400">
                  _
                </span>
              )}
            </h1>
          )}

          {(phase === "step2" || phase === "done") && (
            <p className="text-xl sm:text-2xl font-extrabold leading-[1.5] break-keep">
              {renderGradientText(text2)}
              {!text2Done && (
                <span className="animate-blink-cursor text-cyan-400">_</span>
              )}
            </p>
          )}
        </div>

        {/* Pill — 그대로 유지. 클릭 시 아래 미리보기로 스크롤 */}
        <div
          className="relative z-10 mt-12 flex flex-col items-center gap-3"
          style={{
            opacity: showCTA ? 1 : 0,
            transform: showCTA ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
            pointerEvents: showCTA ? "auto" : "none",
          }}
        >
          <Button
            variant="secondary"
            onClick={handleStart}
            className={`rounded-full h-auto py-3 px-8 text-base font-semibold active:scale-95 transition-transform flex flex-col gap-0.5 leading-tight ${
              showBounce ? "animate-bounce-gentle" : ""
            }`}
          >
            <span>네, 알아보고 있어요 <span aria-hidden>👋</span></span>
            <span className="text-[11px] font-medium text-muted-foreground">즉시 분석 시작</span>
          </Button>
        </div>

        {/* 하단 chevron — Fold 2 로 스크롤 */}
        <button
          type="button"
          onClick={(e) => {
            const section = e.currentTarget.closest("section");
            const next = section?.nextElementSibling as HTMLElement | null;
            next?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          aria-label="아래로 스크롤"
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 p-2"
          style={{
            opacity: showCTA ? 1 : 0,
            pointerEvents: showCTA ? "auto" : "none",
            transition: "opacity 0.4s ease",
          }}
        >
          <ChevronsDown
            className="size-6 text-violet-600 animate-bounce-gentle"
            strokeWidth={2.5}
          />
        </button>
      </section>

      {/* ─── Fold 2: 가치 제안 + 실제 리포트 미리보기 + CTA ─── */}
      <section className="relative flex min-h-dvh flex-col justify-between bg-background px-6 py-10 ">
        <div className="pt-4">
          {/* 메인 헤드라인 */}
          <h2 className="text-center text-[28px] font-black leading-[1.2] tracking-[-0.02em] break-keep">
            창업, <span style={GRADIENT_STYLE} className="font-black">감으로</span>
            <br />
            고르지 마세요.
          </h2>

          {/* 서브카피 */}
          <p className="mt-8 text-center text-[16px] leading-[1.65] text-muted-foreground break-keep">
            주소만 넣으면{" "}
            <b className="font-bold text-foreground">공공데이터 11종</b>으로
            <br />
            입지를{" "}
            <span style={GRADIENT_STYLE} className="font-black">
              100점 만점
            </span>
            으로 채점해드려요
          </p>

          {preview && (
            <div className="mt-10">
              <KakaoShareCards {...preview} onStart={handleStart} onHome={scrollToTop} />
            </div>
          )}

          {/* 데이터 소스 칩 6개 */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {DATA_SOURCES.map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-[13px] font-semibold text-foreground/70 shadow-sm"
              >
                <span className="mr-1.5 text-[11px] font-black text-emerald-500">
                  ✓
                </span>
                {s}
              </span>
            ))}
          </div>
          <ScrollHint />
        </div>

      </section>

      {/* ─── Fold 3: 업종 선택 미리보기 (iPhone view-only) ─── */}
      {preview && (
        <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
          <PhoneFrame>
            <IndustrySelector
              onNext={NOOP}
              mode="view"
              initialSelectedName={preview.industryName}
            />
          </PhoneFrame>
          <ScrollHint />
        </section>
      )}

      {/* ─── Fold 4: 지역 선택 미리보기 (iPhone view-only) ─── */}
      {preview && (
        <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
          <PhoneFrame>
            <RegionSelector
              selectedIndustry={previewToIndustry(preview.industryName)}
              onNext={NOOP}
              mode="view"
            />
          </PhoneFrame>
          <ScrollHint />
        </section>
      )}

      {/* ─── Fold 5: 위치/반경 선택 (지도) 미리보기 ─── */}
      {preview && (
        <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
          <PhoneFrame>
            <MapRadiusStep
              mode="view"
              viewAddress={preview.address}
              viewLat={preview.lat ?? undefined}
              viewLng={preview.lng ?? undefined}
              viewIndustryName={preview.industryName}
            />
          </PhoneFrame>
          <ScrollHint />
        </section>
      )}

      {/* ─── Fold 6: 분석 결과 (지도 + bottom sheet) 미리보기 ─── */}
      {preview && (
        <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
          <PhoneFrame>
            <AnalysisResult
              data={buildMockAnalysisData(preview)}
              isAuthenticated={false}
              mode="view"
            />
          </PhoneFrame>
          <ScrollHint />
        </section>
      )}

      {/* ─── Fold 7: AI 리포트 생성 대기 (iPhone view-only) ─── */}
      {preview && (
        <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
          <PhoneFrame>
            <GeneratingProgress mode="view" />
          </PhoneFrame>
          <ScrollHint />
        </section>
      )}

      {/* ─── Fold 8: AI 리포트 미리보기 (iPhone view-only) ─── */}
      {preview?.aiReportJson && (
        <section className="flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center bg-white px-4">
          <PhoneFrame>
            {/* report/[id]/page.tsx 의 기존 헤더 마크업 그대로 */}
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
              {/* report/[id]/page.tsx 와 동일한 하단 후기 섹션 */}
              <div className="pointer-events-none select-none" aria-hidden>
                {reviewSection}
              </div>
            </div>
          </PhoneFrame>
        </section>
      )}
    </div>
  );
}
