"use client";

import { usePathname } from "next/navigation";
import { UserMenu } from "@/features/auth/components/user-menu";
import { HomeButton } from "./home-button";

interface LayoutButtonsProps {
  isLoggedIn: boolean;
  email: string;
  avatarUrl?: string;
  name?: string;
}

export function LayoutButtons({ isLoggedIn, email, avatarUrl, name }: LayoutButtonsProps) {
  const pathname = usePathname();
  const isReportPage = pathname.startsWith("/report/");

  return (
    <>
      {/* 프로필 — 로그인 시 항상 표시 */}
      {isLoggedIn && (
        <div className="fixed top-4 right-4 z-50">
          <UserMenu email={email} avatarUrl={avatarUrl} name={name} />
        </div>
      )}

      {/* 홈 버튼 — 리포트 페이지에서만 */}
      {isReportPage && (
        <HomeButton isLoggedIn={isLoggedIn} />
      )}
    </>
  );
}
