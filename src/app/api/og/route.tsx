import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

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
  try {
    const fontData = await loadFont();
    const fonts = [{ name: "Pretendard", data: fontData, weight: 700 as const }];
    const { searchParams } = request.nextUrl;

    const address = searchParams.get("address");
    const industry = searchParams.get("industry");
    const scoreStr = searchParams.get("score");
    const verdict = searchParams.get("verdict") ?? "";

    // 리포트 OG
    if (address && industry && scoreStr) {
      const score = Number(scoreStr);
      const { grade, label, color } = getGradeInfo(score);
      const shortVerdict = verdict.length > 60 ? verdict.slice(0, 60) + "..." : verdict;

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
              padding: "60px",
            }}
          >
            {/* 브랜드 */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "16px",
                  backgroundColor: "#7c3aed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "16px",
                  fontWeight: 700,
                  marginRight: "10px",
                }}
              >
                S
              </div>
              <span style={{ fontSize: "18px", color: "#a78bfa", fontWeight: 700 }}>스팟리</span>
              <span style={{ fontSize: "16px", color: "#64748b", marginLeft: "8px" }}>AI 창업 입지 분석</span>
            </div>

            {/* 점수 원 + 등급 */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "60px",
                  border: `6px solid ${color}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "24px",
                }}
              >
                <span style={{ fontSize: "40px", fontWeight: 700, color }}>{grade}</span>
                <span style={{ fontSize: "14px", color: "#94a3b8" }}>{score}/100</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    padding: "6px 16px",
                    borderRadius: "16px",
                    backgroundColor: color,
                    color: "#0f172a",
                    fontSize: "16px",
                    fontWeight: 700,
                    marginBottom: "8px",
                  }}
                >
                  {grade}등급 · {label}
                </div>
                <span style={{ fontSize: "14px", color: "#94a3b8" }}>
                  {shortVerdict || "AI 창업 입지 분석 리포트"}
                </span>
              </div>
            </div>

            {/* 업종 */}
            <div style={{ fontSize: "20px", color: "#a78bfa", marginBottom: "12px", fontWeight: 700 }}>
              {industry}
            </div>

            {/* 주소 */}
            <div style={{ fontSize: "36px", fontWeight: 700, color: "white", textAlign: "center" }}>
              {address}
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
          <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "36px",
                backgroundColor: "#7c3aed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "36px",
                color: "white",
                fontWeight: 700,
                marginRight: "16px",
              }}
            >
              S
            </div>
            <span style={{ fontSize: "48px", fontWeight: 700, color: "white" }}>스팟리</span>
          </div>

          <div style={{ fontSize: "52px", fontWeight: 700, color: "#a78bfa", marginBottom: "20px" }}>
            AI 창업 입지 분석
          </div>

          <div style={{ fontSize: "24px", color: "#94a3b8" }}>
            주소와 업종만 입력하면, 100점 만점 맞춤 리포트 제공
          </div>

          <div style={{ display: "flex", marginTop: "40px" }}>
            {["경쟁 강도", "유동인구", "교통·접근성", "인프라"].map((l) => (
              <div
                key={l}
                style={{
                  padding: "12px 28px",
                  borderRadius: "12px",
                  border: "1px solid #4c1d95",
                  color: "#c4b5fd",
                  fontSize: "18px",
                  fontWeight: 700,
                  marginRight: "16px",
                }}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      ),
      { width: 1200, height: 630, fonts },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`OG error: ${msg}`, { status: 500 });
  }
}
