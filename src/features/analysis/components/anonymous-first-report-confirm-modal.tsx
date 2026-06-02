"use client";

import { useEffect } from "react";
import { GRADIENT_TEXT_STYLE } from "@/constants/site";

interface AnonymousFirstReportConfirmModalProps {
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 비로그인 사용자가 AI 리포트 버튼을 처음 누를 때 보여주는 확인 모달.
 * "1회 무료" 사실을 명확히 알리고, 사용자가 능동적으로 확정해야 LLM 호출 진행.
 */
export function AnonymousFirstReportConfirmModal({
  onConfirm,
  onClose,
}: AnonymousFirstReportConfirmModalProps) {
  // 모달 열려있는 동안 뒤쪽 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 딤 배경 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative w-[calc(100%-2rem)] max-w-md bg-background rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 p-6">
        <div className="text-center space-y-2 pt-2 pb-5">
          <div className="text-3xl mb-2">🎉</div>
          <h2 className="text-[20px] font-black break-keep leading-snug">
            <span style={GRADIENT_TEXT_STYLE}>첫 AI 리포트, 무료로 받아보세요</span>
          </h2>
          <p className="text-sm text-muted-foreground break-keep mt-2 leading-relaxed">
            지금 바로 AI 전문가가 입력하신 입지를 분석해드려요
          </p>
        </div>

        <div className="rounded-xl bg-muted/40 dark:bg-muted/20 p-3 mb-5">
          <p className="text-[12px] text-muted-foreground text-center break-keep leading-relaxed">
            💡 다음 분석부터는 로그인하면 이력이 자동 저장돼요
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-1.5 h-12 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 active:scale-95 transition-all"
          >
            지금 분석 받기
            <span className="text-base leading-none">→</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl text-muted-foreground text-sm hover:bg-muted/50 active:scale-95 transition-all"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
