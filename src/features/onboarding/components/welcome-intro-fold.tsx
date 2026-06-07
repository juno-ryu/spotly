"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GRADIENT_TEXT_STYLE as GRADIENT_STYLE } from "@/constants/site";
import { useTypingAnimation } from "../hooks/use-typing-animation";

const STEP1_TEXT = "창업 준비중이세요?";
const STEP2_TEXT = "같이 한번 알아볼까요? 😊";
const TYPING_SPEED = 33;
const PHASE_PAUSE = 500;

interface WelcomeIntroFoldProps {
  onStart: () => void;
}

/**
 * Fold 1 — 인사 타이핑 시퀀스 + Pill CTA + 하단 chevron.
 *
 * 타이핑 단계: step1 → pause(500ms) → step2 → done → CTA fade-in → 2.5s 후 bounce.
 */
export function WelcomeIntroFold({ onStart }: WelcomeIntroFoldProps) {
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

  return (
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

      {/* Pill — fade-in 후 bounce */}
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
          onClick={onStart}
          className={`rounded-full h-auto py-3 px-8 text-base font-semibold active:scale-95 transition-transform flex flex-col gap-0.5 leading-tight ${
            showBounce ? "animate-bounce-gentle" : ""
          }`}
        >
          <span>
            네, 알아보고 있어요 <span aria-hidden>👋</span>
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            즉시 분석 시작
          </span>
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
  );
}

/** 이모지는 원본 색상, 텍스트에만 그라데이션 — 줄바꿈은 \n 으로 받음 */
function renderGradientText(text: string) {
  return text.split("\n").map((line, lineIdx) => (
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
}
