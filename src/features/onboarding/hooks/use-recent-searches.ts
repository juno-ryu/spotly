"use client";

import { useCallback, useEffect, useState } from "react";

const MAX_ITEMS = 3;

/**
 * localStorage 기반 최근 검색 훅
 * @param storageKey localStorage 키
 * @param dedupeKey 중복 제거 기준 필드 (기본: "name")
 */
export function useRecentSearches<T extends { name: string }>(
  storageKey: string,
  dedupeKey: keyof T = "name" as keyof T,
) {
  const [items, setItems] = useState<T[]>([]);

  // 마운트 시 localStorage에서 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setItems(JSON.parse(stored));
    } catch {
      /* SSR 또는 파싱 실패 무시 */
    }
  }, [storageKey]);

  // 항목 추가 (최신순, 중복 제거, 최대 3개)
  const add = useCallback(
    (item: T) => {
      setItems((prev) => {
        const filtered = prev.filter((i) => i[dedupeKey] !== item[dedupeKey]);
        const updated = [item, ...filtered].slice(0, MAX_ITEMS);
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          /* 용량 초과 무시 */
        }
        return updated;
      });
    },
    [storageKey, dedupeKey],
  );

  return { items, add } as const;
}
