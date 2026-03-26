"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import Script from "next/script";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { appendUtm } from "@/lib/analytics";
import { useKakaoShare } from "@/hooks/use-kakao-share";

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
}

export function ShareButton({ title, text, url, imageUrl }: ShareButtonProps) {
  const [clicked, setClicked] = useState(false);
  const { kakaoReady, copied, appKey, handleKakaoInit, shareToKakao, copyLink, track } =
    useKakaoShare({ title, text, url, imageUrl });

  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);

  const handleShare = async () => {
    setClicked(true);
    track(isMobile ? (kakaoReady ? "kakao" : "native_share") : "clipboard");

    if (isMobile && kakaoReady) {
      shareToKakao();
      return;
    }

    if (isMobile && navigator.share) {
      try {
        const nativeUrl = appendUtm(url, { medium: "native_share" });
        await navigator.share({ title, text, url: nativeUrl });
        return;
      } catch {
        return;
      }
    }

    await copyLink();
  };

  return (
    <>
      {appKey && (
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          strategy="lazyOnload"
          onLoad={handleKakaoInit}
        />
      )}
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleShare}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-background border shadow-sm transition-colors hover:bg-muted"
              aria-label="공유하기"
            >
              {copied
                ? <Check className="h-5 w-5 text-emerald-500" />
                : <Share2 className="h-5 w-5 text-foreground" />
              }
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            공유하기
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}
