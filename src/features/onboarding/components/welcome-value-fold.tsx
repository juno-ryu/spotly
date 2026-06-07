import { GRADIENT_TEXT_STYLE as GRADIENT_STYLE } from "@/constants/site";
import type { PreviewData } from "../lib/get-random-preview-report";
import { KakaoShareCards } from "./kakao-share-cards";

/** 공공데이터 소스 — UI 키트 디자인 매칭 (6개) */
const DATA_SOURCES = [
  "Kakao Places",
  "서울 골목상권",
  "KOSIS 인구",
  "지하철·버스",
  "학교·의료",
  "프랜차이즈",
] as const;

interface WelcomeValueFoldProps {
  preview: PreviewData;
  onStart: () => void;
  /** 카카오 공유 카드 푸터 "스팟리" 클릭 — Fold 1 인사 화면으로 복귀 */
  onHome: () => void;
  /** 카드 + 칩 영역 아래에 ScrollHint 렌더 */
  scrollHint: React.ReactNode;
}

/**
 * Fold 2 — 가치 제안 헤드라인 + 실제 리포트 미리보기(카카오 카드) + 데이터 소스 칩.
 *
 * 사이드이펙트 없음 (KakaoShareCards 내부 IntersectionObserver 만 1회 발화).
 */
export function WelcomeValueFold({
  preview,
  onStart,
  onHome,
  scrollHint,
}: WelcomeValueFoldProps) {
  return (
    <section className="relative flex min-h-dvh flex-col justify-between bg-background px-6 py-10 ">
      <div className="pt-4">
        {/* 메인 헤드라인 */}
        <h2 className="text-center text-[28px] font-black leading-[1.2] tracking-[-0.02em] break-keep">
          창업,{" "}
          <span style={GRADIENT_STYLE} className="font-black">
            감으로
          </span>
          <br />
          고르지 마세요.
        </h2>

        {/* 서브카피 */}
        <p className="mt-8 text-center text-[16px] leading-[1.65] text-muted-foreground break-keep">
          주소만 넣으면{" "}
          <b className="font-bold text-foreground">공공데이터 11종</b>으로
          <br />
          입지를{" "}
          <span style={GRADIENT_STYLE} className="font-black">
            100점 만점
          </span>
          으로 채점해드려요
        </p>

        <div className="mt-10">
          <KakaoShareCards
            id={preview.id}
            address={preview.address}
            industryName={preview.industryName}
            totalScore={preview.totalScore}
            grade={preview.grade}
            verdict={preview.verdict}
            ogSquareUrl={preview.ogSquareUrl}
            onStart={onStart}
            onHome={onHome}
          />
        </div>

        {/* 데이터 소스 칩 6개 */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {DATA_SOURCES.map((s) => (
            <span
              key={s}
              className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-[13px] font-semibold text-foreground/70 shadow-sm"
            >
              <span className="mr-1.5 text-[11px] font-black text-emerald-500">
                ✓
              </span>
              {s}
            </span>
          ))}
        </div>
        {scrollHint}
      </div>
    </section>
  );
}
