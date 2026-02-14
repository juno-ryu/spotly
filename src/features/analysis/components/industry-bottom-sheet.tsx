"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X, MapPin, ChevronLeft } from "lucide-react";
import { INDUSTRY_CODES, type IndustryCode } from "../constants/industry-codes";
import { fuzzyMatch } from "@/lib/korean-search";

type SheetState = "collapsed" | "expanded";

/** 바텀시트 축소 높이 (px) */
const COLLAPSED_HEIGHT = 160;
/** 바텀시트 확장 비율 (뷰포트 대비) */
const EXPANDED_RATIO = 0.65;
/** 스와이프 전환 임계값 (px) */
const SWIPE_THRESHOLD = 60;
/** 디바운스 딜레이 (ms) */
const DEBOUNCE_MS = 200;

/** localStorage 키 — 최근 선택 업종 */
const RECENT_INDUSTRIES_KEY = "startup-analyzer-recent-industries";

interface RecentIndustry {
  code: string;
  name: string;
}

function getRecentIndustries(): RecentIndustry[] {
  try {
    const raw = localStorage.getItem(RECENT_INDUSTRIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentIndustry(item: RecentIndustry) {
  const list = getRecentIndustries().filter((i) => i.code !== item.code);
  list.unshift(item);
  localStorage.setItem(RECENT_INDUSTRIES_KEY, JSON.stringify(list.slice(0, 5)));
}

interface IndustryBottomSheetProps {
  /** 현재 선택된 주소 */
  address: string;
  /** 주소 탭 → Step 3 복귀 */
  onLocationChange: () => void;
  /** 업종 선택 완료 */
  onIndustrySelect: (industry: { code: string; name: string }) => void;
}

/** Step 4: 업종 검색 바텀시트 (PRD Step 4) */
export function IndustryBottomSheet({
  address,
  onLocationChange,
  onIndustrySelect,
}: IndustryBottomSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>("collapsed");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentIndustries, setRecentIndustries] = useState<RecentIndustry[]>([]);
  const [dragOffset, setDragOffset] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef(0);
  const isDraggingRef = useRef(false);

  // 최근 선택 로드
  useEffect(() => {
    setRecentIndustries(getRecentIndustries());
  }, []);

  // 디바운스 검색
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 퍼지 매칭 검색 결과
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return INDUSTRY_CODES.filter(
      (ic) =>
        fuzzyMatch(debouncedQuery, ic.name) ||
        ic.keywords.some((kw) => fuzzyMatch(debouncedQuery, kw)) ||
        ic.code.toLowerCase().includes(debouncedQuery.toLowerCase()),
    ).slice(0, 15);
  }, [debouncedQuery]);

  const expandedHeight =
    typeof window !== "undefined" ? window.innerHeight * EXPANDED_RATIO : 500;

  const isDragging = isDraggingRef.current && dragOffset !== 0;
  const baseHeight =
    sheetState === "collapsed" ? COLLAPSED_HEIGHT : expandedHeight;
  const currentHeight = Math.max(
    COLLAPSED_HEIGHT,
    Math.min(expandedHeight, baseHeight + dragOffset),
  );

  // 업종 선택 핸들러
  const handleSelect = useCallback(
    (item: IndustryCode | RecentIndustry) => {
      // 햅틱 피드백
      try { navigator?.vibrate?.(10); } catch { /* 무시 */ }

      saveRecentIndustry({ code: item.code, name: item.name });
      setRecentIndustries(getRecentIndustries());
      setSearchQuery("");
      setSheetState("collapsed");
      onIndustrySelect({ code: item.code, name: item.name });
    },
    [onIndustrySelect],
  );

  // 드래그 핸들 터치 이벤트
  const handleDragStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  }, []);

  const handleDragMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = touchStartY.current - e.touches[0].clientY;
      if (sheetState === "collapsed") {
        setDragOffset(Math.max(0, deltaY));
      } else {
        setDragOffset(Math.min(0, deltaY));
      }
    },
    [sheetState],
  );

  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (sheetState === "collapsed" && dragOffset > SWIPE_THRESHOLD) {
      setSheetState("expanded");
    } else if (sheetState === "expanded" && dragOffset < -SWIPE_THRESHOLD) {
      setSheetState("collapsed");
      setSearchQuery("");
    }
    setDragOffset(0);
  }, [sheetState, dragOffset]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t"
      style={{
        height: currentHeight,
        transition: isDragging ? "none" : "height 0.3s ease-out",
      }}
    >
      {/* 드래그 핸들 */}
      <div
        className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onClick={() =>
          setSheetState((s) => (s === "collapsed" ? "expanded" : "collapsed"))
        }
      >
        <div className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
      </div>

      {/* 주소 표시 — 탭하면 Step 3으로 복귀 */}
      <button
        type="button"
        className="flex items-center gap-2 px-4 pb-3 w-full text-left"
        onClick={onLocationChange}
      >
        <MapPin className="h-4 w-4 shrink-0 text-violet-500" />
        <span className="text-base font-semibold text-foreground truncate">
          {address}
        </span>
        <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground ml-auto rotate-180" />
      </button>

      {sheetState === "collapsed" && dragOffset === 0 ? (
        /* 축소 상태: 업종 검색 힌트 */
        <button
          type="button"
          className="w-full px-4 text-left"
          onClick={() => setSheetState("expanded")}
        >
          <p className="text-base text-muted-foreground">
            🔍 업종을 검색해주세요
          </p>
          <p className="mt-1 text-sm text-muted-foreground/60">
            예: 치킨, 카페, 미용실
          </p>
        </button>
      ) : (
        /* 확장 상태: 검색 + 결과 */
        <div
          className="flex flex-col gap-3 overflow-y-auto px-4 pb-8"
          style={{ height: currentHeight - 96 }}
        >
          {/* 검색 입력 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="업종명, 키워드, 초성 검색 (예: ㅊㅋ)"
              className="h-11 w-full rounded-lg border bg-background pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
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

          {/* 검색 결과 */}
          {debouncedQuery.length > 0 && (
            <div className="space-y-0.5">
              {searchResults.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  검색 결과가 없습니다
                </p>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-3 h-[52px] text-left hover:bg-accent transition-colors"
                    onClick={() => handleSelect(item)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {item.name}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {item.category}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground/50 ml-2">
                      {item.code}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* 검색어 없을 때: 최근 선택 + 인기 업종 */}
          {debouncedQuery.length === 0 && (
            <>
              {/* 최근 선택 */}
              {recentIndustries.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    최근 선택
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {recentIndustries.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleSelect(item)}
                        className="rounded-full border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent"
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 인기 업종 */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  🔥 인기 업종
                </h3>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRY_CODES.filter((_, i) => i < 12).map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="rounded-full border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
