"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";
import { signInWithGoogle, signInWithKakao } from "@/features/auth/actions";
import { GoogleIcon } from "@/components/icons/google-icon";
import { KakaoIcon } from "@/components/icons/kakao-icon";
import { GRADIENT_TEXT_STYLE } from "@/constants/site";
import { KakaoAdfit } from "@/components/kakao-adfit";

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
] as const;

const REPORT_INCLUDES = [
  "💰 예상 매출 범위",
  "📊 생존율·폐업률",
  "⚠️ 리스크 경고",
  "🎯 맞춤 창업 전략",
  "📍 입지 대안 제안",
  "👥 타겟 고객 분석",
  "🏥 주변 인프라",
  "🕐 추천 운영시간",
] as const;

interface AuthRequiredModalProps {
  onClose: () => void;
  returnTo: string;
}

/** 비로그인 유저가 AI 리포트 요청 시 — 블러 배경 + 모달 */
export function AuthRequiredModal({ onClose, returnTo }: AuthRequiredModalProps) {
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [testimonialVisible, setTestimonialVisible] = useState(true);

  // 모달 열림 시 뒤쪽 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 딤 배경 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto bg-background rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        <div className="px-5 py-6">
          {/* 닫기 */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>

          {/* 타이틀 */}
          <div className="pt-[10px] pb-4">
            <h1 className="text-[22px] font-black leading-[1.4] break-keep">
              <span style={GRADIENT_TEXT_STYLE}>수천만원 창업 투자,</span>
              <br />
              <span style={GRADIENT_TEXT_STYLE}>무료로 리스크를 줄이세요</span>
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

          {/* AI 리포트 포함 내용 — 칩 태그 */}
          <div className="pb-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2.5">로그인하면 이것도 알 수 있어요</p>
            <div className="flex flex-wrap gap-2">
              {REPORT_INCLUDES.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* 카카오 애드핏 — 비활성화 */}
          {/* {process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT_ID && (
            <div className="pb-4 flex justify-center">
              <KakaoAdfit
                unitId={process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT_ID}
                width={320}
                height={100}
              />
            </div>
          )} */}

          {/* 참고용 고지 */}
          <div className="pb-5">
            <div className="rounded-xl bg-muted/50 dark:bg-muted/30 p-4 text-center">
              <p className="text-[11px] text-muted-foreground break-keep leading-relaxed">
                ⚠️ AI 리포트는 공공·민간 데이터 기반의 <span className="font-semibold text-foreground">참고 자료</span>이며,
                <br />
                최종 창업 결정 전 현장 답사와 전문가 상담을 권장합니다.
              </p>
            </div>
          </div>

          {/* 소셜 로그인 CTA */}
          <div className="space-y-2.5">
            <form action={signInWithKakao}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-5 py-3.5 text-sm font-bold text-[#3C1E1E] shadow-sm hover:bg-[#F5DC00] active:scale-95 transition-all"
              >
                <KakaoIcon />
                카카오로 무료 시작하기
              </button>
            </form>

            <form action={signInWithGoogle}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-white border border-gray-200 px-5 py-3.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
              >
                <GoogleIcon size={20} />
                Google로 무료 시작하기
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
