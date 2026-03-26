"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { trackEvent, AnalyticsEvent, appendUtm } from "@/lib/analytics";
import { SITE_CONFIG } from "@/constants/site";
import type { UtmMedium } from "@/lib/analytics";

interface UseKakaoShareOptions {
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
  /** UTM campaign 파라미터 (기본: "report_share") */
  campaign?: string;
}

export function useKakaoShare({ title, text, url, imageUrl, campaign }: UseKakaoShareOptions) {
  const [kakaoReady, setKakaoReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

  useEffect(() => {
    if (window.Kakao?.isInitialized?.()) {
      setKakaoReady(true);
    }
  }, []);

  const handleKakaoInit = useCallback(() => {
    if (!appKey || !window.Kakao) return;
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(appKey);
    }
    setKakaoReady(true);
  }, [appKey]);

  const reportId = (() => {
    try {
      return new URL(url).pathname.split("/report/")[1];
    } catch {
      return undefined;
    }
  })();

  const shareToKakao = useCallback((medium: UtmMedium = "kakao") => {
    if (!kakaoReady || !window.Kakao?.Share) return;
    const kakaoUrl = appendUtm(url, { medium, ...(campaign && { campaign }) });
    const homeUrl = SITE_CONFIG.url;

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
  }, [kakaoReady, url, title, text, imageUrl, campaign]);

  const copyLink = useCallback(async (medium: UtmMedium = "clipboard") => {
    const clipboardUrl = appendUtm(url, { medium, ...(campaign && { campaign }) });
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
  }, [url, campaign]);

  const track = useCallback((method: string) => {
    trackEvent(AnalyticsEvent.REPORT_SHARE, {
      method,
      content_type: "report",
      item_id: reportId,
    });
  }, [reportId]);

  return {
    kakaoReady,
    copied,
    appKey,
    handleKakaoInit,
    shareToKakao,
    copyLink,
    track,
  };
}
