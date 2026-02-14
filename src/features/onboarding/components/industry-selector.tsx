"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapticLight } from "../lib/haptic";
import { useTypingAnimation } from "../hooks/use-typing-animation";
import { useRecentSearches } from "../hooks/use-recent-searches";
import {
  ONBOARDING_INDUSTRIES,
  type OnboardingIndustry,
} from "../constants/industries";
import {
  INDUSTRY_CODES,
  type IndustryCode,
} from "@/features/analysis/constants/industry-codes";

const HEADER_TEXT = "어떤 창업을 생각하고 계신가요?";
const TYPING_SPEED = 33;

interface IndustrySelectorProps {
  onNext: (industry: OnboardingIndustry) => void;
  onBack: () => void;
}

/** Step 2: 업종 선택 — 검색 + 핫한 창업 아이템 추천 */
export function IndustrySelector({ onNext, onBack }: IndustrySelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showContent, setShowContent] = useState(false);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { items: recentIndustries, add: addRecentIndustry } =
    useRecentSearches<OnboardingIndustry>("recent-industries");

  const { displayText: headerText, isDone: headerDone } = useTypingAnimation(
    HEADER_TEXT,
    TYPING_SPEED,
    true,
  );

  // 타이핑 완료 후 컨텐츠 표시
  useEffect(() => {
    if (headerDone) {
      const timer = setTimeout(() => setShowContent(true), 200);
      return () => clearTimeout(timer);
    }
  }, [headerDone]);

  // 핫 아이템 선택 → 0.35초 후 자동 전환
  const handleItemSelect = useCallback(
    (industry: OnboardingIndustry) => {
      hapticLight();
      setSelected(industry.name);
      addRecentIndustry(industry);

      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
      autoAdvanceTimer.current = setTimeout(() => onNext(industry), 350);
    },
    [onNext, addRecentIndustry],
  );

  // 검색 결과에서 선택
  const handleSearchSelect = useCallback(
    (code: IndustryCode) => {
      hapticLight();

      const found = ONBOARDING_INDUSTRIES.find(
        (i) => i.ksicCode === code.code,
      );
      if (found) {
        setSelected(found.name);
        addRecentIndustry(found);
        setTimeout(() => onNext(found), 350);
        return;
      }

      const custom: OnboardingIndustry = {
        emoji: "🏪",
        name: code.name,
        keyword: code.name,
        ksicCode: code.code,
        seoulCode: "",
      };
      setSelected(code.name);
      addRecentIndustry(custom);
      setTimeout(() => onNext(custom), 350);
    },
    [onNext, addRecentIndustry],
  );

  const searchResults =
    searchQuery.length > 0
      ? INDUSTRY_CODES.filter(
          (c) =>
            c.name.includes(searchQuery) ||
            c.keywords.some((k) => k.includes(searchQuery)),
        ).slice(0, 8)
      : [];

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  // ─── 검색 모드 ───
  if (searchOpen) {
    return (
      <div className="flex min-h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-2 px-3 pt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="업종 검색..."
              autoFocus
              className="h-10 w-full rounded-lg border bg-muted/50 pl-10 pr-10 text-sm outline-none focus:border-[var(--onboarding-chip-border-selected)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-1">
          {searchResults.map((code) => (
            <button
              key={code.code}
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
                "hover:bg-accent active:bg-accent",
                selected === code.name &&
                  "bg-[var(--onboarding-chip-selected)]",
              )}
              onClick={() => handleSearchSelect(code)}
            >
              <span className="text-sm font-medium">{code.name}</span>
              <span className="text-xs text-muted-foreground">
                {code.category}
              </span>
            </button>
          ))}
          {searchQuery && searchResults.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              검색 결과가 없습니다
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── 메인 화면 ───
  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* 대화 텍스트 — 타이핑 애니메이션 */}
      <div className="pt-16 pb-6">
        <h2 className="text-xl font-bold text-left leading-snug">
          {headerText}
          {!headerDone && (
            <span className="animate-blink-cursor font-normal text-pink-400">
              _
            </span>
          )}
        </h2>
      </div>

      {/* 검색 + 핫 아이템 — 타이핑 완료 후 표시 */}
      {showContent && (
        <div className="flex flex-col gap-4">
          {/* 검색 입력 (탭 시 검색 모드 진입) */}
          <div
            className="animate-in fade-in"
            style={{ animationDuration: "200ms", animationFillMode: "both" }}
          >
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              <Search className="h-4 w-4" />
              업종 검색...
            </button>
          </div>

          {/* 최근 검색 */}
          {recentIndustries.length > 0 && (
            <div
              className="animate-in fade-in"
              style={{
                animationDuration: "200ms",
                animationDelay: "70ms",
                animationFillMode: "both",
              }}
            >
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                🕐 최근 검색
              </h3>
              <div className="flex flex-wrap gap-2">
                {recentIndustries.map((industry) => (
                  <button
                    key={industry.name}
                    type="button"
                    onClick={() => handleItemSelect(industry)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                      "hover:bg-accent active:scale-95 active:bg-accent",
                      selected === industry.name
                        ? "border-2 border-[var(--onboarding-chip-border-selected)] bg-[var(--onboarding-chip-selected)]"
                        : "bg-background",
                    )}
                  >
                    {industry.emoji} {industry.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 핫한 창업 아이템 추천 */}
          <div
            className="animate-in fade-in"
            style={{
              animationDuration: "200ms",
              animationDelay: recentIndustries.length > 0 ? "130ms" : "70ms",
              animationFillMode: "both",
            }}
          >
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              🔥 핫한 창업 아이템
            </h3>
            <div className="flex flex-wrap gap-2">
              {ONBOARDING_INDUSTRIES.map((industry, i) => (
                <button
                  key={industry.name}
                  type="button"
                  onClick={() => handleItemSelect(industry)}
                  className={cn(
                    "animate-in fade-in rounded-full border px-4 py-2 text-sm font-medium transition-all",
                    "hover:bg-accent active:scale-95 active:bg-accent",
                    selected === industry.name
                      ? "border-2 border-[var(--onboarding-chip-border-selected)] bg-[var(--onboarding-chip-selected)]"
                      : "bg-background",
                  )}
                  style={{
                    animationDuration: "150ms",
                    animationDelay: `${130 + i * 27}ms`,
                    animationFillMode: "both",
                  }}
                >
                  {industry.emoji} {industry.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 뒤로 버튼 */}
      <div className="mt-auto pb-8 pt-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          뒤로
        </Button>
      </div>

      {/* 스크린리더 알림 */}
      <div aria-live="polite" className="sr-only">
        {selected && `${selected} 선택됨`}
      </div>
    </div>
  );
}
