"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { hapticLight } from "../lib/haptic";
import { useTypingAnimation } from "../hooks/use-typing-animation";
import { useRecentSearches } from "../hooks/use-recent-searches";
import {
  useAddressSearch,
  type SearchResult,
} from "@/features/map/hooks/use-address-search";
import {
  DEFAULT_MAP_ZOOM,
  HOT_STARTUP_AREAS,
  type OnboardingRegion,
} from "../constants/regions";
import type { OnboardingIndustry } from "../constants/industries";

const TYPING_SPEED = 33;
import { GRADIENT_TEXT_STYLE as GRADIENT_STYLE } from "@/constants/site";

interface RegionSelectorProps {
  selectedIndustry: OnboardingIndustry;
  onNext: (region: OnboardingRegion) => void;
}

/** Step 3: 지역 선택 — 검색 + 핫 창업지역 추천 */
export function RegionSelector({
  selectedIndustry,
  onNext,
}: RegionSelectorProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showContent, setShowContent] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { items: recentRegions, add: addRecentRegion } =
    useRecentSearches<OnboardingRegion>("recent-regions");

  const headerText = `창업,\n어디에서 시작할까요?`;

  const { displayText, isDone: headerDone } = useTypingAnimation(
    headerText,
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

  // 검색 결과
  const { data: searchData, isLoading: isSearching } =
    useAddressSearch(searchQuery);

  // 검색 결과 선택
  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      hapticLight();
      const region: OnboardingRegion = {
        emoji: "📍",
        name: result.name,
        latitude: result.latitude,
        longitude: result.longitude,
        zoom: DEFAULT_MAP_ZOOM,
        districtCode: "",
      };
      addRecentRegion(region);
      onNext(region);
    },
    [onNext, addRecentRegion],
  );

  // 핫 지역 선택
  const handleHotAreaSelect = useCallback(
    (area: OnboardingRegion) => {
      hapticLight();
      addRecentRegion(area);
      onNext(area);
    },
    [onNext, addRecentRegion],
  );

  // 현재 위치로 시작
  const handleCurrentLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("GPS를 사용할 수 없는 환경입니다");
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        hapticLight();
        const customRegion: OnboardingRegion = {
          emoji: "📍",
          name: "현재 위치",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          zoom: DEFAULT_MAP_ZOOM,
          districtCode: "",
        };
        addRecentRegion(customRegion);
        onNext(customRegion);
      },
      () => {
        setGeoLoading(false);
        toast.error("위치 권한이 필요합니다");
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 },
    );
  }, [onNext, addRecentRegion]);

  /** 이모지 제외, 텍스트만 렌더 */
  const renderText = (text: string) =>
    text.split("\n").map((line, lineIdx) => (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {line}
      </span>
    ));

  // ─── 검색 모드 ───
  if (searchOpen) {
    return (
      <div className="flex min-h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* 검색 헤더 */}
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
              placeholder="주소, 건물명, 역 이름 검색"
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

        {/* 검색 결과 */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-1">
          {isSearching && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              검색 중...
            </p>
          )}
          {searchData?.results?.map((result) => (
            <button
              key={`${result.latitude}-${result.longitude}`}
              type="button"
              className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent active:bg-accent"
              onClick={() => handleSearchSelect(result)}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{result.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {result.address}
                </p>
              </div>
            </button>
          ))}
          {searchQuery && searchData?.results?.length === 0 && !isSearching && (
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
      {/* 대화 텍스트 — 타이핑 애니메이션 + 업종명 그라데이션 */}
      <div className="pt-16 pb-6">
        <h2 className="text-xl font-bold text-left leading-snug">
          <span>{selectedIndustry.emoji}</span>{" "}
          <span style={GRADIENT_STYLE} className="font-black">
            {selectedIndustry.name}
          </span>{" "}
          {displayText && renderText(displayText)}
          {!headerDone && (
            <span className="animate-blink-cursor font-normal text-violet-400">
              _
            </span>
          )}
        </h2>
      </div>

      {/* 검색 + 현위치 + 핫 지역 — 타이핑 완료 후 표시 */}
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
              주소, 건물명, 역 이름 검색...
            </button>
          </div>

          {/* 최근 검색 */}
          {recentRegions.length > 0 && (
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
                {recentRegions.map((region) => (
                  <button
                    key={region.name}
                    type="button"
                    onClick={() => handleHotAreaSelect(region)}
                    className="rounded-full border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent active:scale-95 active:bg-accent"
                  >
                    {region.emoji} {region.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 현재 위치 버튼 */}
          <div
            className="animate-in fade-in"
            style={{
              animationDuration: "200ms",
              animationDelay: recentRegions.length > 0 ? "130ms" : "70ms",
              animationFillMode: "both",
            }}
          >
            <Button
              variant="secondary"
              onClick={handleCurrentLocation}
              disabled={geoLoading}
              className="w-full rounded-full h-13 text-base font-semibold active:scale-95 transition-transform"
            >
              {geoLoading ? "위치 확인 중..." : "📍 현재 위치로 시작"}
            </Button>
          </div>

          {/* 핫한 창업지역 추천 */}
          <div
            className="animate-in fade-in"
            style={{
              animationDuration: "200ms",
              animationDelay: recentRegions.length > 0 ? "200ms" : "130ms",
              animationFillMode: "both",
            }}
          >
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              🔥 지금 핫한 창업지역
            </h3>
            <div className="flex flex-wrap gap-2">
              {HOT_STARTUP_AREAS.map((area, i) => (
                <button
                  key={area.name}
                  type="button"
                  onClick={() => handleHotAreaSelect(area)}
                  className="animate-in fade-in rounded-full border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent active:scale-95 active:bg-accent"
                  style={{
                    animationDuration: "150ms",
                    animationDelay: `${200 + i * 27}ms`,
                    animationFillMode: "both",
                  }}
                >
                  {area.emoji} {area.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
