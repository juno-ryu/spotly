"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { hapticLight } from "../lib/haptic";
import { useTypingAnimation } from "../hooks/use-typing-animation";
import Image from "next/image";
import { GRADIENT_TEXT_STYLE as GRADIENT_STYLE } from "@/constants/site";

const STEP1_TEXT = "창업 준비중이세요?";
const STEP2_TEXT = "같이 한번 알아볼까요? 😊";

const TYPING_SPEED = 33;
const PHASE_PAUSE = 500;

interface WelcomeScreenProps {
  onNext: () => void;
}

/** Step 1: 환영 인사 — 타이핑 애니메이션 + CTA */
export function WelcomeScreen({ onNext }: WelcomeScreenProps) {
  const [phase, setPhase] = useState<"step1" | "pause" | "step2" | "done">(
    "step1",
  );
  const [showCTA, setShowCTA] = useState(false);
  const [showBounce, setShowBounce] = useState(false);
  const touchStartY = useRef(0);

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

  // step1 타이핑 완료 → pause
  useEffect(() => {
    if (text1Done && phase === "step1") {
      setPhase("pause");
    }
  }, [text1Done, phase]);

  // pause → step2
  useEffect(() => {
    if (phase !== "pause") return;
    const timer = setTimeout(() => setPhase("step2"), PHASE_PAUSE);
    return () => clearTimeout(timer);
  }, [phase]);

  // step2 타이핑 완료 → done
  useEffect(() => {
    if (text2Done && phase === "step2") {
      setPhase("done");
    }
  }, [text2Done, phase]);

  // done → CTA 표시
  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => setShowCTA(true), 250);
    return () => clearTimeout(timer);
  }, [phase]);

  // CTA 표시 후 4초 뒤 bounce 힌트
  useEffect(() => {
    if (!showCTA) return;
    const timer = setTimeout(() => setShowBounce(true), 2500);
    return () => clearTimeout(timer);
  }, [showCTA]);

  const handleCTATap = useCallback(() => {
    hapticLight();
    onNext();
  }, [onNext]);

  // 스와이프 업 폴백
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaY = touchStartY.current - e.changedTouches[0].clientY;
      if (deltaY > 80) {
        hapticLight();
        onNext();
      }
    },
    [onNext],
  );

  /** 이모지는 원본 색상, 텍스트에만 그라데이션 적용 */
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
      className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="text-center space-y-5">
        {/* 로고 */}
        <Image
          src="/icons/icon-192.png"
          alt="스팟리 로고"
          width={80}
          height={80}
          className="mx-auto rounded-2xl"
          priority
        />

        {/* Step 1 텍스트: 그라데이션 + 타이핑 */}
        {text1 && (
          <h1 className="text-[28px] sm:text-[34px] font-black leading-[1.4]">
            {renderGradientText(text1)}
            {!text1Done && (
              <span className="animate-blink-cursor font-normal text-pink-400">
                _
              </span>
            )}
          </h1>
        )}

        {/* Step 2 텍스트: 그라데이션 + 타이핑 */}
        {(phase === "step2" || phase === "done") && (
          <p className="text-xl sm:text-2xl font-extrabold leading-[1.5]">
            {renderGradientText(text2)}
            {!text2Done && (
              <span className="animate-blink-cursor text-cyan-400">_</span>
            )}
          </p>
        )}
      </div>

      {/* CTA 버튼: 타이핑 완료 후 페이드인 */}
      <div
        className="mt-12"
        style={{
          opacity: showCTA ? 1 : 0,
          transform: showCTA ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
          pointerEvents: showCTA ? "auto" : "none",
        }}
      >
        <Button
          variant="secondary"
          onClick={handleCTATap}
          className={`rounded-full h-13 px-8 text-base font-semibold active:scale-95 transition-transform ${
            showBounce ? "animate-bounce-gentle" : ""
          }`}
        >
          네, 알아보고 있어요 <span aria-hidden>👋</span>
        </Button>
      </div>
    </div>
  );
}
