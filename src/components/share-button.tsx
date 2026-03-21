"use client";

import { useEffect, useState } from "react";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";
import Script from "next/script";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trackEvent, AnalyticsEvent } from "@/lib/analytics";

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
}

export function ShareButton({ title, text, url, imageUrl }: ShareButtonProps) {
  const [kakaoReady, setKakaoReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clicked, setClicked] = useState(false);
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

  useEffect(() => {
    if (window.Kakao?.isInitialized?.()) {
      setKakaoReady(true);
    }
  }, []);

  const handleKakaoInit = () => {
    if (!appKey || !window.Kakao) return;
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(appKey);
    }
    setKakaoReady(true);
  };

  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);

  const shareToKakao = () => {
    if (!kakaoReady || !window.Kakao?.Share) return;
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description: text,
        imageUrl: imageUrl ?? `${url.split("/report/")[0]}/icons/spotly-logo3.png`,
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [
        { title: "리포트 보기", link: { mobileWebUrl: url, webUrl: url } },
        { title: "나도 분석하기", link: { mobileWebUrl: url.split("/report/")[0], webUrl: url.split("/report/")[0] } },
      ],
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    toast.success("링크가 복사되었어요", { icon: "✅" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    // 클릭 시 툴팁 영구 닫기
    setClicked(true);

    // GA4 공유 이벤트 추적
    trackEvent(AnalyticsEvent.REPORT_SHARE, {
      method: isMobile ? (kakaoReady ? "kakao" : "native_share") : "clipboard",
      content_type: "report",
      item_id: url.split("/report/")[1]?.split("?")[0],
    });

    // 모바일: 카카오톡 우선
    if (isMobile && kakaoReady) {
      shareToKakao();
      return;
    }

    // 모바일 폴백: 네이티브 공유시트
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        return;
      }
    }

    // PC: 클립보드 복사
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
        <Tooltip defaultOpen open={clicked ? false : undefined}>
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
