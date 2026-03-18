"use client";

import { useEffect, useRef } from "react";

interface KakaoAdfitProps {
  unitId: string;
  width: number;
  height: number;
}

/**
 * 카카오 애드핏 배너 컴포넌트
 * SDK 스크립트를 동적으로 로드하고 ins 태그를 렌더링한다.
 */
export function KakaoAdfit({ unitId, width, height }: KakaoAdfitProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // SDK 스크립트 중복 삽입 방지
    const scriptSrc = "//t1.daumcdn.net/kas/static/ba.min.js";
    if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
      const script = document.createElement("script");
      script.src = scriptSrc;
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div ref={containerRef} className="flex justify-center">
      <ins
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit={unitId}
        data-ad-width={String(width)}
        data-ad-height={String(height)}
      />
    </div>
  );
}
