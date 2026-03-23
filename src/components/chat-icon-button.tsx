"use client";

import { MessageCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const OPEN_CHAT_URL = "https://open.kakao.com/o/pWKM4Mmi";

/** 카카오 오픈채팅 문의 버튼 — 우상단 플로팅 */
export function ChatIconButton() {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={OPEN_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-background border shadow-sm transition-colors hover:bg-muted"
            aria-label="서비스 문의"
          >
            <MessageCircle className="h-5 w-5 text-foreground" />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left">
          서비스 문의
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
