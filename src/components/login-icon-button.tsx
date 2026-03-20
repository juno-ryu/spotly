"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { AuthRequiredModal } from "@/features/auth/components/auth-required-modal";

/** 비로그인 유저 아이콘 버튼 — 클릭 시 로그인 오버레이 */
export function LoginIconButton({ returnTo }: { returnTo?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-background border shadow-sm transition-colors hover:bg-muted"
        aria-label="로그인"
      >
        <User className="h-5 w-5 text-foreground" />
      </button>
      {open && <AuthRequiredModal onClose={() => setOpen(false)} returnTo={returnTo ?? pathname} />}
    </>
  );
}
