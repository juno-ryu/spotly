"use client";

import { useEffect, useRef } from "react";

interface GoogleAdsenseProps {
  /** 광고 슬롯 ID (애드센스 대시보드에서 광고 단위 생성 후 발급) */
  slot: string;
  /** 광고 형식 */
  format?: "auto" | "fluid" | "rectangle" | "horizontal" | "vertical";
  /** 반응형 여부 */
  responsive?: boolean;
  className?: string;
}

/** 구글 애드센스 배너 컴포넌트 */
export function GoogleAdsense({
  slot,
  format = "auto",
  responsive = true,
  className,
}: GoogleAdsenseProps) {
  const isLoaded = useRef(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID) return;
    if (isLoaded.current) return;
    isLoaded.current = true;

    try {
      const adsbygoogle = (window as any).adsbygoogle || [];
      adsbygoogle.push({});
    } catch {
      // 광고 차단기 등으로 실패 시 무시
    }
  }, []);

  if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID) return null;

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}
