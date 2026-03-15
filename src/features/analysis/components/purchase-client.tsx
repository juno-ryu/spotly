"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BackButton } from "@/components/back-button";
import { GRADIENT_TEXT_STYLE } from "@/constants/site";


// analysis-result.tsx에서 이동
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

/** totalScore → 등급 문자 + 라벨 + 색상 (GradeBadge 미구현 시 임시 사용) */
function getGrade(score: number): {
  grade: string;
  label: string;
  className: string;
} {
  if (score >= 80)
    return { grade: "A", label: "우수한 입지", className: "bg-emerald-500 text-white" };
  if (score >= 65)
    return { grade: "B", label: "양호한 입지", className: "bg-violet-500 text-white" };
  if (score >= 50)
    return { grade: "C", label: "보통 수준", className: "bg-amber-500 text-white" };
  if (score >= 35)
    return { grade: "D", label: "주의 필요", className: "bg-orange-500 text-white" };
  return { grade: "F", label: "신중한 검토 필요", className: "bg-red-500 text-white" };
}

interface PurchaseClientProps {
  analysis: {
    id: string;
    address: string;
    industryName: string;
    totalScore: number;
  };
}

export function PurchaseClient({ analysis }: PurchaseClientProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [testimonialVisible, setTestimonialVisible] = useState(true);

  // 3.5초마다 후기 순환
  useEffect(() => {
    const id = setInterval(() => {
      setTestimonialVisible(false);
      setTimeout(() => {
        setTestimonialIdx((i) => (i + 1) % TESTIMONIALS.length);
        setTestimonialVisible(true);
      }, 250);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  function handleGenerate() {
    setIsGenerating(true);
    router.push(`/report/${analysis.id}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-5 py-6">
        <BackButton />

        {/* ── 상단 타이틀 ── */}
        <div className="pt-6 pb-5 text-center">
          <h1 className="text-[22px] font-black leading-[1.4] break-keep">
            <span style={GRADIENT_TEXT_STYLE}>AI 리포트로</span>
            <br />
            <span style={GRADIENT_TEXT_STYLE}>정확한 창업 결정을 내리세요</span>
          </h1>
        </div>

        {/* ── 소셜 프루프 — 순환 후기 ── */}
        <div className="pb-4">
          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            {/* 후기 (페이드 전환) */}
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
            {/* 인디케이터 + 통계 */}
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

        {/* ── 비교 테이블 — 무료 vs AI 리포트 ── */}
        <div className="pb-4">
          <div className="rounded-xl overflow-hidden border border-border">
            {/* 헤더 */}
            <div className="grid grid-cols-2 text-sm font-semibold">
              <div className="px-4 py-2.5 bg-muted/50 text-muted-foreground">
                무료
              </div>
              <div className="px-4 py-2.5 bg-violet-600 text-white">
                AI 리포트
              </div>
            </div>
            {/* 행 */}
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

        {/* ── 가격 앵커링 ── */}
        <div className="pb-6">
          <div className="rounded-xl bg-muted/50 dark:bg-muted/30 p-4 space-y-1 text-center">
            <p className="text-[12px] text-muted-foreground">
              상권 컨설팅{" "}
              <span className="line-through">50만원</span>
              {" → "}
              <span className="line-through text-muted-foreground">₩3,900</span>
              {" "}
              <span className="font-bold text-foreground">얼리버드 ₩1,900</span>
            </p>
            <p className="text-[11px] text-muted-foreground break-keep">
              ☕ 아메리카노 한 잔 가격으로 수천만원 투자 리스크를 줄이세요
            </p>
          </div>
        </div>

        {/* ── 하단 CTA ── */}
        <div className="space-y-2">
          
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold text-sm active:scale-95 transition-transform"
          >
            {isGenerating ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                리포트 생성 중...
              </>
            ) : (
              <>
                <span className="line-through text-violet-300 text-xs">₩3,900</span>
                {" "}지금 바로 받기 · ₩1,900
              </>
            )}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            지금은 무료 체험 기간입니다 · 결제 없이 이용 가능
          </p>
        </div>
      </div>
    </div>
  );
}