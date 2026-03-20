"use client";

import { useEffect } from "react";
import { Home } from "lucide-react";
import Link from "next/link";

/** 홈 버튼 + 뒤로가기 차단 — 리포트 페이지용 */
export function HomeButton() {
  // 브라우저 뒤로가기 차단
  useEffect(() => {
    history.pushState(null, "", location.href);
    const onPopState = () => {
      history.pushState(null, "", location.href);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <Link
      href="/"
      className="flex h-10 w-10 items-center justify-center rounded-full bg-background border shadow-sm transition-colors hover:bg-muted"
      aria-label="홈으로"
    >
      <Home className="h-5 w-5 text-foreground" />
    </Link>
  );
}
