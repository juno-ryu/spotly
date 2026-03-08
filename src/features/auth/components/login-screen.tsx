"use client";

import { signInWithGoogle } from "../actions";

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
            <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17Z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07Z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3Z"/>
            </svg>
            Google로 시작하기
          </button>
        </form>

        {/* 카카오 (미연결) */}
        <button
          disabled
          className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#FEE500] px-5 py-3.5 text-sm font-semibold text-[#3C1E1E] opacity-40 cursor-not-allowed"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="#3C1E1E">
            <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.636 1.584 4.953 4 6.32V21l3.5-2.5c.82.13 1.668.2 2.5.2 5.523 0 10-3.477 10-7.5S17.523 3 12 3z"/>
          </svg>
          카카오로 시작하기
          <span className="text-xs opacity-60">(준비중)</span>
        </button>
      </div>
    </div>
  );
}
