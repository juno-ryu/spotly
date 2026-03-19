import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Noto Sans KR Black(900) — 한글+영문 굵은 폰트
const FONT_URL =
  "https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@latest/Subset/SpoqaHanSansNeo/SpoqaHanSansNeo-Bold.woff";

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(FONT_URL);
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

// 실제 프로젝트 상수와 동일한 등급 색상
const GRADE_COLORS: Record<string, { text: string; bg: string }> = {
  A: { text: "#16a34a", bg: "#dcfce7" },
  B: { text: "#2563eb", bg: "#dbeafe" },
  C: { text: "#ca8a04", bg: "#fef9c3" },
  D: { text: "#ea580c", bg: "#ffedd5" },
  F: { text: "#dc2626", bg: "#fee2e2" },
};

function getGradeInfo(score: number) {
  if (score >= 75) return { grade: "A", label: "우수" };
  if (score >= 60) return { grade: "B", label: "양호" };
  if (score >= 40) return { grade: "C", label: "보통" };
  if (score >= 20) return { grade: "D", label: "미흡" };
  return { grade: "F", label: "위험" };
}

// spotly-logo2.svg 기반 (clipPath 제외 — satori 미지원)
function LogoIcon({ size = 120 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size}>
      <rect width="512" height="512" rx="80" fill="#7c3aed" />
      <ellipse cx="256" cy="421" rx="42" ry="8" fill="black" opacity={0.3} />
      <path
        d="M256 100 C188 100 134 154 134 222 C134 310 256 420 256 420 C256 420 378 310 378 222 C378 154 324 100 256 100Z"
        fill="white"
      />
      <circle cx="256" cy="218" r="52" fill="#7c3aed" />
    </svg>
  );
}

export async function GET(request: NextRequest) {
  try {
    const fontData = await loadFont();
    const fonts = fontData
      ? [{ name: "SpoqaHanSans", data: fontData, weight: 900 as const }]
      : [];
    const fontFamily = fontData ? "SpoqaHanSans" : "sans-serif";

    const { searchParams } = request.nextUrl;
    const address = searchParams.get("address");
    const industry = searchParams.get("industry");
    const scoreStr = searchParams.get("score");
    const verdict = searchParams.get("verdict") ?? "";

    // 리포트 OG
    if (address && industry && scoreStr) {
      const score = Number(scoreStr);
      const { grade, label } = getGradeInfo(score);
      const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.C;
      const shortVerdict = verdict.length > 80 ? verdict.slice(0, 80) + "..." : verdict;

      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0f172a",
              fontFamily,
              padding: "0 60px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                flex: 1,
              }}
            >
            <div style={{ display: "flex", marginRight: "50px" }}>
              <LogoIcon size={280} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", marginBottom: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    padding: "12px 28px",
                    borderRadius: "24px",
                    backgroundColor: colors.bg,
                    color: colors.text,
                    fontSize: "30px",
                    fontWeight: 900,
                  }}
                >
                  {grade}등급 · {label} · {score}점
                </div>
              </div>

              <div style={{ display: "flex", marginBottom: "24px" }}>
                <span style={{ fontSize: "72px", fontWeight: 900, color: "#7c3aed" }}>Spot</span>
                <span style={{ fontSize: "72px", fontWeight: 900, color: "#a78bfa" }}>ly</span>
              </div>

              <div style={{ display: "flex", fontSize: "36px", fontWeight: 900, color: "white", marginBottom: "16px" }}>
                {address} {industry}
              </div>

              <div style={{ display: "flex", fontSize: "24px", fontWeight: 900, color: "#94a3b8" }}>
                {shortVerdict || "AI 창업 입지 분석 리포트"}
              </div>
            </div>
            </div>
          </div>
        ),
        { width: 1200, height: 630, fonts },
      );
    }

    // 메인 OG
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0f172a",
            padding: "0 60px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              flex: 1,
            }}
          >
          <div style={{ display: "flex", marginRight: "60px" }}>
            <LogoIcon size={320} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", marginBottom: "24px" }}>
              <span style={{ fontSize: "96px", fontWeight: 900, color: "#7c3aed" }}>Spot</span>
              <span style={{ fontSize: "96px", fontWeight: 900, color: "#a78bfa" }}>ly</span>
            </div>
            <div style={{ display: "flex", fontSize: "44px", fontWeight: 900, color: "white", marginBottom: "16px" }}>
              AI 창업 입지 분석
            </div>
            <div style={{ display: "flex", fontSize: "28px", fontWeight: 900, color: "#94a3b8" }}>
              주소와 업종만 입력하면, 100점 만점 맞춤 리포트 제공
            </div>
          </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630, fonts },
    );
  } catch (e) {
    console.error("[OG] 이미지 생성 실패:", e);
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0f172a",
          }}
        >
          <span style={{ fontSize: "64px", fontWeight: 700, color: "#7c3aed" }}>Spotly</span>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }
}
