"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** 공용 뒤로가기 버튼 — 좌상단 고정 오버레이 */
export function BackButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={cn(
        "fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md",
        className,
      )}
      aria-label="뒤로가기"
    >
      <ArrowLeft className="h-5 w-5 text-gray-700" />
    </button>
  );
}
