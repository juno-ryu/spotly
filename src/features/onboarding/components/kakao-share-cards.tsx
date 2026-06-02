"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface KakaoShareCardsProps {
  id: string;
  address: string;
  industryName: string;
  totalScore: number;
  grade: string;
  verdict: string;
  ogSquareUrl: string;
  /** "나도 분석하기" 클릭 — pill 과 동일한 다음 스텝으로 */
  onStart: () => void;
  /** "스팟리" 푸터 클릭 — Fold 1 상단으로 복귀 */
  onHome: () => void;
}

/** 카카오톡 공유 카드 (피드) — view-only. 스크롤 진입 시 한 번 페이드인 */
export function KakaoShareCards(props: KakaoShareCardsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="mx-auto w-full max-w-[280px]">
      <FadeIn visible={visible} delay={0}>
        <FeedCard {...props} />
      </FadeIn>
    </div>
  );
}

/** 스크롤 진입 시 한 번만 페이드인 — wrapper */
function FadeIn({
  visible,
  delay,
  children,
}: {
  visible: boolean;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "transition-opacity duration-700 ease-out",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** 카카오톡 채팅창 피드 카드 — square OG + 제목 + 설명 + 버튼 2개 + 스팟리 푸터 */
function FeedCard({
  id,
  address,
  industryName,
  totalScore,
  grade,
  verdict,
  ogSquareUrl,
  onStart,
  onHome,
}: KakaoShareCardsProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md">
      {/* 정사각형 OG */}
      <Image
        src={ogSquareUrl}
        width={600}
        height={720}
        alt="카카오톡 공유 카드"
        className="block h-auto w-full"
        unoptimized
      />

      {/* 본문 */}
      <div className="space-y-3 bg-white px-4 pt-4 pb-3">
        <h3 className="text-[15px] font-medium leading-[1.45] text-zinc-900 break-keep">
          {address} {industryName} {grade}등급 ({totalScore}점)
        </h3>
        <p className="text-[14px] leading-[1.5] text-zinc-500 break-keep">
          AI 판정: {verdict}. 같이 창업 전에 확인해봐!
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            href={`/report/${id}`}
            className="flex h-12 items-center justify-center rounded-md border border-zinc-200 bg-white text-[14px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            리포트 보기
          </Link>
          <button
            type="button"
            onClick={onStart}
            className="flex h-12 items-center justify-center rounded-md border border-zinc-200 bg-white text-[14px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            나도 분석하기
          </button>
        </div>
      </div>

      {/* 푸터 — 스팟리 → 홈 (Fold 1 으로 스크롤) */}
      <button
        type="button"
        onClick={onHome}
        className="flex w-full items-center gap-2 border-t border-zinc-100 px-4 py-3 transition-colors hover:bg-zinc-50"
      >
        <Image
          src="/icons/icon-192.png"
          width={20}
          height={20}
          alt=""
          className="rounded"
        />
        <span className="flex-1 text-left text-[13px] text-zinc-700">스팟리</span>
        <ChevronRight className="size-4 text-zinc-400" />
      </button>
    </div>
  );
}

