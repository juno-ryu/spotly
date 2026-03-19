import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const LOGO_URL = "https://spotly-beta.vercel.app/icons/icon-192.png";

async function loadFont() {
  const res = await fetch(
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff/Pretendard-Bold.woff",
  );
  return res.arrayBuffer();
}

function getGradeInfo(score: number) {
  if (score >= 75) return { grade: "A", label: "우수", color: "#22c55e" };
  if (score >= 60) return { grade: "B", label: "양호", color: "#3b82f6" };
  if (score >= 40) return { grade: "C", label: "보통", color: "#eab308" };
  if (score >= 20) return { grade: "D", label: "미흡", color: "#f97316" };
  return { grade: "F", label: "위험", color: "#ef4444" };
}

export async function GET(request: NextRequest) {
  const fontData = await loadFont();
  const fonts = [{ name: "Pretendard" as const, data: fontData, weight: 700 as const }];
  const { searchParams } = request.nextUrl;

  const address = searchParams.get("address");
  const industry = searchParams.get("industry");
  const scoreStr = searchParams.get("score");
  const verdict = searchParams.get("verdict") ?? "";

  // 리포트 OG — Step 1: 로고 img만 추가
  if (address && industry && scoreStr) {
    const score = Number(scoreStr);
    const { grade, label, color } = getGradeInfo(score);
    const shortVerdict = verdict.length > 50 ? verdict.slice(0, 50) + "..." : verdict;

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0f172a",
            fontFamily: "Pretendard",
          }}
        >
          {/* 브랜드 — img 로고 */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
            <img src={LOGO_URL} width={36} height={36} style={{ borderRadius: "18px", marginRight: "10px" }} />
            <span style={{ fontSize: "24px", fontWeight: 700, color: "white" }}>스팟리</span>
          </div>

          {/* 등급 뱃지 */}
          <div style={{ display: "flex", marginBottom: "24px" }}>
            <div
              style={{
                padding: "8px 24px",
                borderRadius: "20px",
                backgroundColor: color,
                color: "#0f172a",
                fontSize: "20px",
                fontWeight: 700,
              }}
            >
              {grade}등급 · {label} · {score}점
            </div>
          </div>

          {/* 제목 */}
          <div style={{ fontSize: "44px", fontWeight: 700, color: "#a78bfa", marginBottom: "16px", textAlign: "center" }}>
            {address} {industry}
          </div>

          {/* 부제 */}
          <div style={{ fontSize: "24px", color: "#94a3b8", textAlign: "center" }}>
            {shortVerdict || "AI 창업 입지 분석 리포트"}
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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f172a",
          fontFamily: "Pretendard",
        }}
      >
        <img src={LOGO_URL} width={80} height={80} style={{ borderRadius: "40px", marginBottom: "24px" }} />
        <span style={{ fontSize: "48px", fontWeight: 700, color: "white", marginBottom: "16px" }}>스팟리</span>
        <div style={{ fontSize: "52px", fontWeight: 700, color: "#a78bfa", marginBottom: "20px" }}>
          AI 창업 입지 분석
        </div>
        <div style={{ fontSize: "24px", color: "#94a3b8" }}>
          주소와 업종만 입력하면, 100점 만점 맞춤 리포트 제공
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}
