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
import { trackEvent, AnalyticsEvent, appendUtm } from "@/lib/analytics";

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
    const kakaoUrl = appendUtm(url, { medium: "kakao" });
    const homeUrl = url.split("/report/")[0];
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description: text,
        imageUrl: imageUrl ?? `${homeUrl}/icons/spotly-logo3.png`,
        link: { mobileWebUrl: kakaoUrl, webUrl: kakaoUrl },
      },
      buttons: [
        { title: "리포트 보기", link: { mobileWebUrl: kakaoUrl, webUrl: kakaoUrl } },
        { title: "나도 분석하기", link: { mobileWebUrl: homeUrl, webUrl: homeUrl } },
      ],
    });
  };

  const copyLink = async () => {
    const clipboardUrl = appendUtm(url, { medium: "clipboard" });
    try {
      await navigator.clipboard.writeText(clipboardUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = clipboardUrl;
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
        const nativeUrl = appendUtm(url, { medium: "native_share" });
        await navigator.share({ title, text, url: nativeUrl });
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
