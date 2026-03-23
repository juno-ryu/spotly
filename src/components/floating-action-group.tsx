"use client";

import { type ReactNode } from "react";

import { useScrolling } from "@/hooks/use-scrolling";

interface FloatingActionGroupProps {
  children: ReactNode;
  className?: string;
}

// 스크롤 중 → 숨김, 멈추면 펼침
export function FloatingActionGroup({ children, className = "" }: FloatingActionGroupProps) {
  const isScrolling = useScrolling(1000);

  return (
    <div
      className={`flex flex-col items-center gap-2 transition-all duration-300 ${
        isScrolling
          ? "pointer-events-none scale-90 opacity-0"
          : "scale-100 opacity-100"
      } ${className}`}
    >
      {children}
    </div>
  );
}
