"use client";

import { MessageSquareText } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * 리포트 페이지 어디서든 후기 섹션으로 부드럽게 점프하는 floating 아이콘 버튼.
 * FloatingActionGroup 의 children 으로 사용한다.
 */
export function ReviewJumpButton() {
  const handleClick = () => {
    const target = document.getElementById("review-section");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            aria-label="후기 보러가기"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            <MessageSquareText className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          다른 사장님들의 후기 보러가기
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
