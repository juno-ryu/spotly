"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
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

const HEADER_TEXT = "어떤 창업 생각 중이세요?";
const TYPING_SPEED = 33;
import { GRADIENT_TEXT_STYLE as GRADIENT_STYLE } from "@/constants/site";

interface IndustrySelectorProps {
  onNext: (industry: OnboardingIndustry) => void;
}

/** Step 2: 업종 선택 — 검색 + 핫한 창업 아이템 추천 */
export function IndustrySelector({ onNext }: IndustrySelectorProps) {
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
    (code: IndustryCode, selectedKeyword?: string) => {
      hapticLight();

      // 매칭된 정확한 키워드 사용 (사용자 타이핑 "이자카" → 매칭 키워드 "이자카야")
      const keyword = selectedKeyword || code.keywords[0] || code.name;

      const found = ONBOARDING_INDUSTRIES.find((i) => i.ksicCode === code.code);
      if (found) {
        const withKeyword = { ...found, keyword };
        setSelected(found.name);
        addRecentIndustry(withKeyword);
        setTimeout(() => onNext(withKeyword), 350);
        return;
      }

      const custom: OnboardingIndustry = {
        emoji: code.emoji || "🏪",
        name: code.name,
        keyword,
        ksicCode: code.code,
        seoulCode: "",
      };
      setSelected(code.name);
      addRecentIndustry(custom);
      setTimeout(() => onNext(custom), 350);
    },
    [onNext, addRecentIndustry],
  );

  const searchResults = (() => {
    if (searchQuery.length === 0) return [];
    // 직접 매칭 (name 또는 keywords에 검색어 포함)
    const direct = INDUSTRY_CODES.filter(
      (c) =>
        c.name.includes(searchQuery) ||
        c.keywords.some((k) => k.includes(searchQuery)),
    );
    // 같은 category에 속하는 다른 업종도 추가 (검색 편의)
    const matchedCategories = new Set(direct.map((c) => c.category));
    const sameCategory = INDUSTRY_CODES.filter(
      (c) => matchedCategories.has(c.category) && !direct.includes(c),
    );
    return [...direct, ...sameCategory].slice(0, 12);
  })();

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  // 카테고리별 그룹핑 (Command용)
  const groupedCodes = INDUSTRY_CODES.reduce<Record<string, IndustryCode[]>>(
    (acc, code) => {
      (acc[code.category] ??= []).push(code);
      return acc;
    },
    {},
  );

  // ─── 검색 모드 (shadcn Command) ───
  if (searchOpen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* 뒤로가기 — BackButton과 동일한 위치/크기 (검색 닫기용) */}
        <button
          type="button"
          onClick={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }}
          className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>

        <Command className="flex-1" shouldFilter={false}>
          <div className="shrink-0 px-16 pt-6 pb-2">
            <CommandInput
              placeholder="업종, 키워드로 검색..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              autoFocus
            />
          </div>
          <CommandList className="max-h-none flex-1 overflow-y-auto">
            <CommandEmpty>검색 결과가 없습니다</CommandEmpty>
            {recentIndustries.length > 0 && searchQuery.length === 0 && (
              <>
                <CommandGroup heading="최근 검색">
                  {recentIndustries.map((industry) => (
                    <CommandItem
                      key={industry.name}
                      value={industry.keyword}
                      onSelect={() => handleItemSelect(industry)}
                    >
                      <span>{industry.emoji}</span>
                      <span>{industry.keyword || industry.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            {(() => {
              type FlatItem = { keyword: string; code: IndustryCode };
              const allItems: FlatItem[] = INDUSTRY_CODES.flatMap((code) =>
                code.keywords.map((kw) => ({ keyword: kw, code })),
              );

              const filtered =
                searchQuery.length > 0
                  ? (() => {
                      const matched = allItems.filter(
                        (item) =>
                          item.keyword.includes(searchQuery) ||
                          item.code.name.includes(searchQuery),
                      );
                      const matchedCategories = new Set(
                        matched.map((i) => i.code.category),
                      );
                      const rest = allItems.filter(
                        (item) =>
                          matchedCategories.has(item.code.category) &&
                          !matched.includes(item),
                      );
                      return [...matched, ...rest];
                    })()
                  : allItems;

              const grouped: Record<string, FlatItem[]> = {};
              for (const item of filtered) {
                (grouped[item.code.category] ??= []).push(item);
              }

              const entries = Object.entries(grouped);
              return entries.map(([category, items], i) => (
                <React.Fragment key={category}>
                  {i > 0 && <CommandSeparator />}
                  <CommandGroup heading={`${items[0].code.emoji} ${category}`}>
                    {items.map((item) => (
                    <CommandItem
                      key={`${item.code.code}-${item.keyword}`}
                      value={`${item.keyword} ${item.code.category}`}
                      onSelect={() => {
                        setSearchQuery(item.keyword);
                        handleSearchSelect(item.code, item.keyword);
                      }}
                    >
                      <span>{item.keyword}</span>
                      <CommandShortcut>{item.code.name}</CommandShortcut>
                    </CommandItem>
                    ))}
                  </CommandGroup>
                </React.Fragment>
              ));
            })()}
          </CommandList>
        </Command>
      </div>
    );
  }

  // ─── 메인 화면 ───
  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* 대화 텍스트 — 타이핑 애니메이션 */}
      <div className="pt-16 pb-6">
        <h2 className="text-xl font-bold text-left leading-snug">
          {headerText.split("창업").map((part, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>
                {part}
                <span style={GRADIENT_STYLE}>창업</span>
              </span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
          {!headerDone && (
            <span className="animate-blink-cursor font-normal text-violet-400">
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

          {/* 핫한 창업 아이템 추천 */}
          <div
            className="animate-in fade-in"
            style={{
              animationDuration: "200ms",
              animationDelay: "70ms",
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

      {/* 스크린리더 알림 */}
      <div aria-live="polite" className="sr-only">
        {selected && `${selected} 선택됨`}
      </div>
    </div>
  );
}
