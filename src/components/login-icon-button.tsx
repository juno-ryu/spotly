"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AuthRequiredModal } from "@/features/auth/components/auth-required-modal";

/** 비로그인 유저 아이콘 버튼 — 클릭 시 로그인 오버레이 */
export function LoginIconButton({ returnTo }: { returnTo?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-background border shadow-sm transition-colors hover:bg-muted"
              aria-label="로그인"
            >
              <User className="h-5 w-5 text-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            우리집 근처 무료로 분석하기
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {/* transform 부모(FloatingActionGroup scale)가 fixed 모달 containing block을 깨뜨리므로 포탈로 탈출 */}
      {open && createPortal(
        <AuthRequiredModal onClose={() => setOpen(false)} returnTo={returnTo ?? pathname} />,
        document.body,
      )}
    </>
  );
}
