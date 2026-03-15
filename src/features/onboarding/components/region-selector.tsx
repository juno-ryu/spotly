"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { toast } from "sonner";
import { hapticLight } from "../lib/haptic";
import { useTypingAnimation } from "../hooks/use-typing-animation";
import { useRecentSearches } from "../hooks/use-recent-searches";
import {
  useAddressSearch,
  type SearchResult,
} from "@/features/map/hooks/use-address-search";
import type { OnboardingIndustry } from "../constants/industries";
import {
  HOT_STARTUP_AREAS,
  type OnboardingRegion,
} from "../constants/regions";
import { GRADIENT_TEXT_STYLE as GRADIENT_STYLE } from "@/constants/site";
import { Search } from "lucide-react";

const TYPING_SPEED = 33;
const DEFAULT_MAP_ZOOM = 4;

interface RegionSelectorProps {
  selectedIndustry: OnboardingIndustry;
  onNext: (region: OnboardingRegion) => void;
}

export function RegionSelector({
  selectedIndustry,
  onNext,
}: RegionSelectorProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showContent, setShowContent] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
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

  // 카카오 주소 검색
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

  // 핫 지역 / 최근 검색 선택
  const handleAreaSelect = useCallback(
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

  // ─── 검색 모드 (Command) ───
  if (searchOpen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* 뒤로가기 — BackButton과 동일 위치/크기 */}
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
              placeholder="주소, 건물명, 역 이름 검색..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              autoFocus
            />
          </div>
          <CommandList className="max-h-none flex-1 overflow-y-auto">
            {/* 최근 검색 — 검색어 비어있을 때 */}
            {recentRegions.length > 0 && searchQuery.length === 0 && (
              <>
                <CommandGroup heading="최근 검색">
                  {recentRegions.map((region) => (
                    <CommandItem
                      key={region.name}
                      value={region.name}
                      onSelect={() => handleAreaSelect(region)}
                    >
                      <MapPin className="h-4 w-4" />
                      <span>{region.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* 검색 결과 */}
            {searchQuery.length > 0 && (
              <>
                {isSearching && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    검색 중...
                  </div>
                )}
                {searchData?.results && searchData.results.length > 0 && (
                  <CommandGroup heading="검색 결과">
                    {searchData.results.map((result) => (
                      <CommandItem
                        key={`${result.latitude}-${result.longitude}`}
                        value={`${result.name} ${result.address}`}
                        onSelect={() => handleSearchSelect(result)}
                      >
                        <MapPin className="h-4 w-4" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{result.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{result.address}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {!isSearching && searchData?.results?.length === 0 && (
                  <CommandEmpty>검색 결과가 없습니다</CommandEmpty>
                )}
              </>
            )}

          </CommandList>
        </Command>
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
            {selectedIndustry.keyword || selectedIndustry.name}
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

          {/* 현재 위치 버튼 */}
          <div
            className="animate-in fade-in"
            style={{
              animationDuration: "200ms",
              animationDelay: "70ms",
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
              animationDelay: "130ms",
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
                  onClick={() => handleAreaSelect(area)}
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
