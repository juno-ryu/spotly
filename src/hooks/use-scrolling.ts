"use client";

import { useEffect, useState } from "react";

/**
 * 스크롤 중인지 감지하는 훅
 * 스크롤 멈추면 delay(ms) 후 false 반환
 */
export function useScrolling(delay = 150) {
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const onScroll = () => {
      setIsScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setIsScrolling(false), delay);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [delay]);

  return isScrolling;
}
