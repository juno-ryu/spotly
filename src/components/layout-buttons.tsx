"use client";

import { UserMenu } from "@/features/auth/components/user-menu";

interface LayoutButtonsProps {
  isLoggedIn: boolean;
  email: string;
  avatarUrl?: string;
  name?: string;
}

export function LayoutButtons({ isLoggedIn, email, avatarUrl, name }: LayoutButtonsProps) {
  return (
    <>
      {isLoggedIn && (
        <div className="fixed top-4 right-4 z-50">
          <UserMenu email={email} avatarUrl={avatarUrl} name={name} />
        </div>
      )}
    </>
  );
}
