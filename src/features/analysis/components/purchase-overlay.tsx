"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";
import { KakaoAdfit } from "@/components/kakao-adfit";
import { GRADIENT_TEXT_STYLE } from "@/constants/site";

const TESTIMONIALS = [
  {
    text: "보증금 3천만원 날릴 뻔했어요. 리포트 보고 위치 바꿨습니다",
    author: "성북구 카페 예비창업자",
    seed: "startup42",
    bg: "b6e3f4",
  },
  {
    text: "경쟁업체 분석이 너무 정확해요. 컨설팅 50만원 낭비할 뻔했어요",
    author: "마포구 음식점 준비생",
    seed: "chef88",
    bg: "ffd5dc",
  },
  {
    text: "주변 상권이 포화인 걸 미리 알고 동네 바꿨어요. 진짜 살았다",
    author: "서초구 치킨집 예비창업자",
    seed: "chicken77",
    bg: "d1f4d1",
  },
  {
    text: "이 가격에 이런 분석이라니 말이 안 돼요. 강추합니다",
    author: "송파구 미용실 창업자",
    seed: "beauty99",
    bg: "c0aede",
  },
] as const;

const COMPARISON_ITEMS = [
  { label: "경쟁업체 수", free: true },
  { label: "경쟁강도 등급", free: true },
  { label: "예상 매출 범위", free: false },
  { label: "생존율 분석", free: false },
  { label: "리스크 경고", free: false },
  { label: "맞춤형 창업 전략", free: false },
  { label: "입지 대안 제안", free: false },
] as const;

const GENERATION_STEPS = [
  "국민연금공단(NPS) 사업체 데이터 분석",
  "서울시(골목상권) 매출·유동인구 분석",
  "통계청(KOSIS) 전국 배후인구 데이터 분석",
  "국토교통부(TAGO) 전국 버스·지하철 교통 분석",
  "Kakao Places(카카오) 인접 매장 분석",
  "교육부·카카오 학교·대학·의료 인프라 분석",
  "데이터 취합 및 AI 리포트 작성중입니다.",
];

const GEN_STEP_INTERVAL = 2500;

export function GeneratingProgress() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeIndex >= GENERATION_STEPS.length) return;
    const timer = setTimeout(() => {
      setActiveIndex((prev) => prev + 1);
    }, GEN_STEP_INTERVAL);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  // 리포트 생성 중 모든 네비게이션 차단
  useEffect(() => {
    // 브라우저 새로고침/탭 닫기 차단
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    // 브라우저 뒤로가기/앞으로가기 차단
    // 더미 히스토리 엔트리를 push하고 popstate에서 다시 push해서 이탈 방지
    history.pushState(null, "", location.href);
    const onPopState = () => {
      history.pushState(null, "", location.href);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // 마지막 단계(AI 리포트 작성)에서는 프로그레스 고정
  const lastIdx = GENERATION_STEPS.length - 1;
  const progress = Math.min(95, Math.round((Math.min(activeIndex, lastIdx) / lastIdx) * 95));
  const currentLabel = activeIndex < GENERATION_STEPS.length
    ? `${GENERATION_STEPS[activeIndex]} 중...`
    : "거의 완료되었어요...";

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6">
      <div className="w-[320px] space-y-6">
        <div className="text-center space-y-2">
          <p className="text-lg font-bold">AI 전문가가 분석 중이에요</p>
          <p className="text-sm text-muted-foreground">
            수집된 데이터를 기반으로 맞춤 리포트를 작성하고 있어요
          </p>
        </div>

        {/* 프로그레스 바 */}
        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{currentLabel}</p>
            <p className="text-xs font-medium text-violet-500">{progress}%</p>
          </div>
        </div>

        {/* 전체 단계 목록 — 완료 시 체크+텍스트, 진행 중 로더+스켈레톤, 대기 중 스켈레톤 */}
        <div className="space-y-2.5">
          {GENERATION_STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2.5 text-sm">
              <span className="w-4 h-4 flex items-center justify-center shrink-0">
                {i === GENERATION_STEPS.length - 1 && activeIndex >= GENERATION_STEPS.length - 1 ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                ) : i < activeIndex ? (
                  <span className="text-emerald-500 text-xs">✓</span>
                ) : i === activeIndex ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
                )}
              </span>
              {i < activeIndex || (i === GENERATION_STEPS.length - 1 && activeIndex >= GENERATION_STEPS.length - 1) ? (
                <span className="text-foreground">{label}</span>
              ) : (
                <span
                  className="h-3 rounded bg-muted-foreground/10 animate-pulse"
                  style={{ width: `${60 + (i % 3) * 20}%` }}
                />
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

interface PurchaseOverlayProps {
  isGenerating: boolean;
  onGenerate: () => void;
  onClose: () => void;
}

export function PurchaseOverlay({ isGenerating, onGenerate, onClose }: PurchaseOverlayProps) {
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [testimonialVisible, setTestimonialVisible] = useState(true);

  useEffect(() => {
    if (isGenerating) return;
    const id = setInterval(() => {
      setTestimonialVisible(false);
      setTimeout(() => {
        setTestimonialIdx((i) => (i + 1) % TESTIMONIALS.length);
        setTestimonialVisible(true);
      }, 250);
    }, 3500);
    return () => clearInterval(id);
  }, [isGenerating]);

  // AI 생성 중 프로그레스 화면
  if (isGenerating) {
    return <GeneratingProgress />;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
      <div className="max-w-lg mx-auto px-5 py-6">
        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 상단 타이틀 */}
        <div className="pt-6 pb-5 text-center">
          <h1 className="text-[22px] font-black leading-[1.4] break-keep">
            <span style={GRADIENT_TEXT_STYLE}>AI 리포트로</span>
            <br />
            <span style={GRADIENT_TEXT_STYLE}>정확한 창업 결정을 내리세요</span>
          </h1>
        </div>

        {/* 소셜 프루프 — 순환 후기 */}
        <div className="pb-4">
          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            <div
              className="flex items-start gap-3 transition-opacity duration-250"
              style={{ opacity: testimonialVisible ? 1 : 0 }}
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage
                  src={`https://api.dicebear.com/9.x/notionists/svg?seed=${TESTIMONIALS[testimonialIdx].seed}&backgroundColor=${TESTIMONIALS[testimonialIdx].bg}`}
                  alt="리뷰어 아바타"
                />
                <AvatarFallback className="text-xs">
                  {TESTIMONIALS[testimonialIdx].author.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-[13px] text-foreground break-keep leading-5">
                  &ldquo;{TESTIMONIALS[testimonialIdx].text}&rdquo;
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  — {TESTIMONIALS[testimonialIdx].author}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-1">
                {TESTIMONIALS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1 rounded-full transition-all duration-300",
                      i === testimonialIdx
                        ? "w-4 bg-violet-500"
                        : "w-1 bg-muted-foreground/30",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">1,247건</span>
                <span className="text-[11px] text-amber-500">⭐ 4.7</span>
              </div>
            </div>
          </div>
        </div>

        {/* 비교 테이블 — 무료 vs AI 리포트 */}
        <div className="pb-4">
          <div className="rounded-xl overflow-hidden border border-border">
            <div className="grid grid-cols-2 text-sm font-semibold">
              <div className="px-4 py-2.5 bg-muted/50 text-muted-foreground">무료</div>
              <div className="px-4 py-2.5 bg-violet-600 text-white">AI 리포트</div>
            </div>
            {COMPARISON_ITEMS.map((item, idx) => (
              <div
                key={item.label}
                className={cn(
                  "grid grid-cols-2 text-sm border-t border-border",
                  idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                )}
              >
                <div className={cn("px-4 py-2.5", !item.free && "text-muted-foreground/40")}>
                  {item.free ? "✅" : "🔒"} {item.label}
                </div>
                <div className="px-4 py-2.5 bg-violet-50/50 dark:bg-violet-950/20">
                  ✅ {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 카카오 애드핏 */}
        {process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT_ID && (
          <div className="pb-4 flex justify-center">
            <KakaoAdfit
              unitId={process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT_ID}
              width={320}
              height={100}
            />
          </div>
        )}

        {/* 가격 앵커링 */}
        <div className="pb-6">
          <div className="rounded-xl bg-muted/50 dark:bg-muted/30 p-4 text-center">
            <p className="text-[11px] text-muted-foreground break-keep">
              다른 곳에서 상권 분석 해보기 전에
            </p>
            <p className="text-[12px] text-muted-foreground mt-1">
              민간 상권 컨설팅 비용 평균 <span className="font-bold text-foreground">35만원</span>
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={onGenerate}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm active:scale-95 transition-transform"
          >
            AI 리포트 무료로 받기
          </button>
          <p className="text-center text-xs text-muted-foreground">
            현재 무료 체험 기간 · 결제 없이 이용 가능
          </p>
        </div>
      </div>
    </div>
  );
}
