"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface LazyFoldProps {
  children: ReactNode;
  /** viewport 진입 전 미리 마운트할 거리(px). default 240 */
  rootMargin?: string;
  /** 마운트 전 placeholder 높이 (PhoneFrame 비율 유지용). default phone fold 높이 추정값 */
  minHeightClass?: string;
}

/**
 * 메인 인트로 전용 lazy mount 래퍼.
 *
 * - IntersectionObserver 로 viewport 200~240px 전에 마운트 신호.
 * - 한 번 마운트되면 unmount 하지 않음 (다시 스크롤 올라가도 유지).
 * - 마운트 전: 동일한 min-height 유지해 스크롤 점프 방지.
 *
 * 효과: Fold 3~8 의 무거운 컴포넌트(지도/차트)가 첫 페인트에 마운트되지 않음.
 */
export function LazyFold({
  children,
  rootMargin = "240px",
  minHeightClass = "min-h-[calc(100dvh-200px)]",
}: LazyFoldProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, rootMargin]);

  return (
    <div ref={ref} className={minHeightClass}>
      {mounted ? children : null}
    </div>
  );
}
