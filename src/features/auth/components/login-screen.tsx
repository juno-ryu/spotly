"use client";

import { signInWithGoogle, signInWithKakao } from "../actions";
import { GoogleIcon } from "@/components/icons/google-icon";
import { KakaoIcon } from "@/components/icons/kakao-icon";

/** 로그인 전용 화면 — 웰컴 플로우 중간에 표시 */
export function LoginScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 gap-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">시작하기</h2>
        <p className="text-sm text-muted-foreground">
          로그인하고 분석 내역을 저장하세요
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        {/* Google 로그인 */}
        <form action={signInWithGoogle} className="w-full">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white border border-gray-200 px-5 py-3.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            <GoogleIcon size={20} />
            Google로 시작하기
          </button>
        </form>

        {/* 카카오 로그인 */}
        <form action={signInWithKakao} className="w-full">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#FEE500] px-5 py-3.5 text-sm font-semibold text-[#3C1E1E] shadow-sm hover:bg-[#F5DC00] active:scale-95 transition-all"
          >
            <KakaoIcon />
            카카오로 시작하기
          </button>
        </form>
      </div>
    </div>
  );
}
