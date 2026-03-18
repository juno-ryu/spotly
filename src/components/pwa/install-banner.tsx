"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// iOS Safari 감지 (iPhone, iPad, iPod — standalone 모드 제외)
function isIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !isStandalone;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 7;

// 모듈 레벨 플래그 — SPA 라우트 이동 시에도 유지 (리로드 전까지 초기화 안 됨)
let dismissedInSession = false;

function isDismissed() {
  if (dismissedInSession) return true;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    if (dayjs().valueOf() < Number(raw)) {
      dismissedInSession = true;
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

function setDismissed() {
  dismissedInSession = true;
  try {
    localStorage.setItem(DISMISS_KEY, String(dayjs().add(DISMISS_DAYS, "day").valueOf()));
  } catch {}
}

// 이미 PWA로 설치돼서 실행 중인지 확인
function isInStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

type BannerType = "android" | "ios" | null;

export function InstallBanner() {
  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // useEffect는 클라이언트에서만 실행되므로 document 접근 안전
    // SSR 상태를 useState 초기값으로 쓰면 서버(dismissed=true)와 클라이언트 hydration 불일치 발생
    if (isInStandaloneMode() || isDismissed()) return;

    if (isIosSafari()) {
      setBannerType("ios");
      return;
    }

    // Android/Chrome: beforeinstallprompt 이벤트 대기
    const handler = (e: Event) => {
      e.preventDefault();
      setAndroidPrompt(e as BeforeInstallPromptEvent);
      setBannerType("android");
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setBannerType(null));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleDismiss = () => {
    setDismissed();
    setBannerType(null);
  };

  const handleAndroidInstall = async () => {
    if (!androidPrompt) return;
    await androidPrompt.prompt();
    const { outcome } = await androidPrompt.userChoice;
    if (outcome === "accepted") setBannerType(null);
  };

  if (!bannerType || dismissedInSession || isDismissed()) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border bg-background p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <Image
          src="/icons/icon-192.png"
          alt="창업 분석기"
          width={40}
          height={40}
          className="h-10 w-10 flex-shrink-0 rounded-lg"
        />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold">홈 화면에 추가하세요</p>
          <p className="text-xs text-muted-foreground">
            {bannerType === "ios"
              ? "하단 공유 버튼 → '홈 화면에 추가' 를 탭하세요"
              : "빠른 실행과 오프라인 열람이 가능합니다"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={handleDismiss}
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={handleDismiss}>
          나중에
        </Button>
        {bannerType === "ios" ? (
          // iOS는 프로그래밍적 설치 불가 → 안내만 제공
          <Button size="sm" className="flex-1 pointer-events-none opacity-80">
            <Share className="mr-1.5 h-3.5 w-3.5" />
            공유 → 홈 추가
          </Button>
        ) : (
          <Button size="sm" className="flex-1" onClick={handleAndroidInstall}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            설치하기
          </Button>
        )}
      </div>
    </div>
  );
}
