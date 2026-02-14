"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, MapPin, Flame, ChevronLeft, Loader2 } from "lucide-react";
import { useAddressSearch, type SearchResult } from "../hooks/use-address-search";
import { POPULAR_AREAS } from "../constants/popular-areas";

type SheetState = "collapsed" | "expanded" | "fullscreen";

/** 바텀시트 축소 높이 (px) — 주소 표시 + 확인 버튼 포함 */
const COLLAPSED_HEIGHT = 140;
/** 바텀시트 확장 비율 (뷰포트 대비) */
const EXPANDED_RATIO = 0.65;
/** 스와이프 전환 임계값 (px) */
const SWIPE_THRESHOLD = 60;

interface LocationBottomSheetProps {
  /** 검색 결과 선택 시 지도 이동 콜백 (Step 전환 없이 지도만 이동) */
  onMoveToLocation: (location: {
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  }) => void;
  /** "여기서 분석하기" 확인 버튼 콜백 */
  onConfirm: () => void;
  /** 현재 센터 핀 위치의 주소 */
  centerAddress: string | null;
  /** 역지오코딩 로딩 중 */
  isGeocoding: boolean;
}

/** localStorage 키 */
const RECENT_SEARCHES_KEY = "startup-analyzer-recent-searches";

interface RecentSearch {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

function getRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(item: RecentSearch) {
  const searches = getRecentSearches().filter(
    (s) => s.address !== item.address,
  );
  searches.unshift(item);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(searches.slice(0, 5)),
  );
}

function removeRecentSearch(address: string) {
  const searches = getRecentSearches().filter((s) => s.address !== address);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
}

/** 위치 검색 바텀시트 (센터 핀 패턴) */
export function LocationBottomSheet({
  onMoveToLocation,
  onConfirm,
  centerAddress,
  isGeocoding,
}: LocationBottomSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>("collapsed");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [dragOffset, setDragOffset] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef(0);
  const isDraggingRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const { data: searchData, isLoading: isSearching } =
    useAddressSearch(searchQuery);

  // 최근 검색 로드
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const expandedHeight =
    typeof window !== "undefined" ? window.innerHeight * EXPANDED_RATIO : 500;

  const isDragging = isDraggingRef.current && dragOffset !== 0;

  const isFullscreen = sheetState === "fullscreen";

  const baseHeight =
    sheetState === "collapsed" ? COLLAPSED_HEIGHT : expandedHeight;
  const currentHeight = isFullscreen
    ? typeof window !== "undefined" ? window.innerHeight : 800
    : Math.max(COLLAPSED_HEIGHT, Math.min(expandedHeight, baseHeight + dragOffset));

  // 인풋 포커스 → 전체화면 전환
  const handleInputFocus = useCallback(() => {
    setSheetState("fullscreen");
  }, []);

  // 전체화면 검색 닫기
  const handleSearchClose = useCallback(() => {
    inputRef.current?.blur();
    setSearchQuery("");
    setSheetState("collapsed");
  }, []);

  // 검색 결과 선택 → 지도 이동만 (Step 전환 안 함)
  const handleMoveToLocation = useCallback(
    (item: {
      name: string;
      address: string;
      latitude: number;
      longitude: number;
    }) => {
      inputRef.current?.blur();
      saveRecentSearch(item);
      setRecentSearches(getRecentSearches());
      setSearchQuery("");
      setSheetState("collapsed");
      onMoveToLocation(item);
    },
    [onMoveToLocation],
  );

  // 최근 검색 삭제
  const handleRemoveRecent = useCallback(
    (address: string, e: React.MouseEvent) => {
      e.stopPropagation();
      removeRecentSearch(address);
      setRecentSearches(getRecentSearches());
    },
    [],
  );

  // 인기 지역 선택 → 지도 이동만
  const handlePopularSelect = useCallback(
    (area: (typeof POPULAR_AREAS)[number]) => {
      handleMoveToLocation({
        name: area.name,
        address: area.name,
        latitude: area.latitude,
        longitude: area.longitude,
      });
    },
    [handleMoveToLocation],
  );

  // 드래그 핸들 터치 이벤트
  const handleDragStart = useCallback(
    (e: React.TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    },
    [],
  );

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

  // ─── 전체화면 검색 모드 ───
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* 상단 검색바 */}
        <div className="flex items-center gap-2 px-3 pt-[env(safe-area-inset-top)] border-b">
          <button
            type="button"
            onClick={handleSearchClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="relative flex-1 my-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="주소, 건물명, 역 이름 검색"
              autoFocus
              className="h-10 w-full rounded-lg border bg-muted/50 pl-10 pr-10 text-sm outline-none focus:border-violet-500"
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

        {/* 검색 결과 / 인기 지역 */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {/* 검색 결과 */}
          {searchQuery.length > 0 && (
            <div className="space-y-1 pt-2">
              {isSearching && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  검색 중...
                </p>
              )}
              {searchData?.results?.map((result: SearchResult) => (
                <button
                  key={`${result.latitude}-${result.longitude}`}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg p-3 text-left hover:bg-accent active:bg-accent transition-colors"
                  onClick={() => handleMoveToLocation(result)}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {result.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {result.address}
                    </p>
                  </div>
                </button>
              ))}
              {searchData?.results?.length === 0 && !isSearching && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  검색 결과가 없습니다
                </p>
              )}
            </div>
          )}

          {/* 검색어 없을 때 */}
          {searchQuery.length === 0 && (
            <div className="space-y-6 pt-4">
              {/* 최근 검색 */}
              {recentSearches.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    최근 검색
                  </h3>
                  <div className="space-y-1">
                    {recentSearches.map((item) => (
                      <div
                        key={item.address}
                        className="flex h-12 items-center justify-between rounded-lg px-3 hover:bg-accent transition-colors"
                      >
                        <button
                          type="button"
                          className="flex-1 text-left"
                          onClick={() => handleMoveToLocation(item)}
                        >
                          <span className="text-sm">{item.name}</span>
                          {item.name !== item.address && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {item.address}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveRecent(item.address, e)}
                          className="p-1 text-muted-foreground/50 hover:text-muted-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 인기 창업 지역 */}
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  <Flame className="mr-1 inline-block h-4 w-4" />
                  인기 창업 지역
                </h3>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_AREAS.map((area) => (
                    <button
                      key={area.name}
                      type="button"
                      onClick={() => handlePopularSelect(area)}
                      className="rounded-full border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent active:bg-accent"
                    >
                      {area.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 바텀시트 모드 (축소/확장) ───
  return (
    <div
      ref={sheetRef}
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

      {sheetState === "collapsed" && dragOffset === 0 ? (
        /* 축소 상태: 현재 주소 + 확인 버튼 */
        <div className="px-4 space-y-3">
          {/* 현재 주소 표시 */}
          <button
            type="button"
            className="w-full text-left"
            onClick={() => setSheetState("expanded")}
          >
            <div className="flex items-center gap-2">
              {isGeocoding ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" />
              ) : (
                <MapPin className="h-4 w-4 shrink-0 text-violet-500" />
              )}
              <p className="truncate text-sm font-medium">
                {isGeocoding
                  ? "주소를 찾는 중..."
                  : centerAddress ?? "지도를 움직여 위치를 선택하세요"}
              </p>
            </div>
            <p className="mt-0.5 ml-6 text-xs text-muted-foreground">
              탭하여 검색
            </p>
          </button>

          {/* 여기서 분석하기 버튼 */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={!centerAddress || isGeocoding}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            여기서 분석하기
          </button>
        </div>
      ) : (
        /* 확장 상태 */
        <div
          className="flex flex-col gap-4 overflow-y-auto px-4 pb-8"
          style={{ height: currentHeight - 48 }}
        >
          {/* 검색 입력 — 포커스 시 전체화면으로 전환 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              readOnly
              onFocus={handleInputFocus}
              placeholder="주소, 건물명, 역 이름 검색"
              className="h-11 w-full rounded-lg border bg-background pl-10 pr-10 text-sm outline-none"
            />
          </div>

          {/* 인기 창업 지역 */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              <Flame className="mr-1 inline-block h-4 w-4" />
              인기 창업 지역
            </h3>
            <div className="flex flex-wrap gap-2">
              {POPULAR_AREAS.map((area) => (
                <button
                  key={area.name}
                  type="button"
                  onClick={() => handlePopularSelect(area)}
                  className="rounded-full border bg-background px-4 py-2 text-sm transition-colors hover:bg-accent"
                >
                  {area.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
