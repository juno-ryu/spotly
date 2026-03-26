"use client";

import { MessageCircle, Link2, Check } from "lucide-react";
import Script from "next/script";
import { trackEvent, AnalyticsEvent } from "@/lib/analytics";
import { INDUSTRY_CODES } from "@/features/analysis/constants/industry-codes";
import { useKakaoShare } from "@/hooks/use-kakao-share";

interface RelatedIndustry {
  name: string;
  reason: string;
}

interface ReportBottomCTAProps {
  /** 카카오 공유 제목 */
  shareTitle: string;
  /** 카카오 공유 설명 */
  shareText: string;
  /** 리포트 URL (UTM 없는 원본) */
  reportUrl: string;
  /** OG 이미지 URL */
  imageUrl?: string;
  /** 분석 대상 업종명 */
  industryName: string;
  /** AI가 추천한 연관 업종 */
  relatedIndustries?: RelatedIndustry[];
  /** 분석 좌표 (없으면 연관 업종 CTA 숨김) */
  lat?: number | null;
  lng?: number | null;
  /** 분석 주소 */
  address: string;
}

export function ReportBottomCTA({
  shareTitle,
  shareText,
  reportUrl,
  imageUrl,
  industryName,
  relatedIndustries,
  lat,
  lng,
  address,
}: ReportBottomCTAProps) {
  const { copied, appKey, handleKakaoInit, shareToKakao, copyLink, track } =
    useKakaoShare({ title: shareTitle, text: shareText, url: reportUrl, imageUrl, campaign: "bottom_cta" });

  const handleKakaoShare = () => {
    track("kakao_bottom_cta");
    shareToKakao();
  };

  const handleCopyLink = async () => {
    track("clipboard_bottom_cta");
    await copyLink();
  };

  const handleRelatedClick = (industry: RelatedIndustry) => {
    trackEvent(AnalyticsEvent.RELATED_INDUSTRY_CLICK, {
      from_industry: industryName,
      to_industry: industry.name,
    });
  };

  /** 연관 업종 분석 링크 — 좌표+업종코드로 /analyze 직행 */
  const buildRelatedUrl = (name: string) => {
    if (lat == null || lng == null) return "/";
    const industry = INDUSTRY_CODES.find((i) => i.name === name);
    if (!industry) return "/";
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      address,
      code: industry.code,
      keyword: industry.keywords[0],
      radius: "300",
    });
    return `/analyze?${params}`;
  };

  const hasRelated =
    relatedIndustries &&
    relatedIndustries.length > 0 &&
    lat != null &&
    lng != null;

  return (
    <>
      {appKey && (
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          strategy="lazyOnload"
          onLoad={handleKakaoInit}
        />
      )}

      <div className="space-y-4 px-4 pt-6 pb-8">
        {/* ── 공유 CTA ── */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-sm text-foreground/80">
            이 분석이 도움이 됐다면, 주변에도 공유해보세요
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleKakaoShare}
              className="flex items-center gap-1.5 rounded-lg bg-[#FEE500] px-4 py-2 text-sm font-medium text-[#191919] transition-colors hover:bg-[#FDD800]"
            >
              <MessageCircle className="h-4 w-4" fill="currentColor" />
              카톡 공유
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {copied ? "복사됨" : "링크 복사"}
            </button>
          </div>
        </div>

        {/* ── 연관 업종 CTA (좌표 있을 때만) ── */}
        {hasRelated && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-sm text-foreground/80">
              {industryName}에 영향을 끼치는 주변 업종도 분석해보세요
            </p>
            <div className="flex flex-wrap gap-2">
              {relatedIndustries.map((industry) => (
                <a
                  key={industry.name}
                  href={buildRelatedUrl(industry.name)}
                  onClick={() => handleRelatedClick(industry)}
                  className="inline-flex items-center rounded-full border bg-background px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  title={industry.reason}
                >
                  {industry.name} 분석하기
                </a>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              {relatedIndustries.map((i) => i.reason).join(" · ")}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
