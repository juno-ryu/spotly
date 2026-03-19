import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function loadFont() {
  const res = await fetch(
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff/Pretendard-Bold.woff",
  );
  return res.arrayBuffer();
}

// Prisma 대신 내부 페이지를 fetch해서 메타데이터 파싱
async function getReportData(id: string, origin: string) {
  try {
    const res = await fetch(`${origin}/report/${id}`, {
      headers: { Accept: "text/html" },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch?.[1]?.replace(" | 스팟리", "") ?? "";

    // 주소 + 업종 파싱: "부산광역시... 치킨전문점 창업 분석"
    const parts = title.split(" ");
    const idx = parts.findIndex((p) => p === "창업");
    if (idx < 1) return null;

    const industryName = parts[idx - 1];
    const address = parts.slice(0, idx - 1).join(" ");

    // 점수 파싱: "종합 점수 60점"
    const scoreMatch = html.match(/종합 점수 (\d+)점/);
    const totalScore = scoreMatch ? Number(scoreMatch[1]) : 0;

    return { address, industryName, totalScore };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const fontData = await loadFont();
  const fonts = [{ name: "Pretendard", data: fontData, weight: 700 as const }];
  const { searchParams, origin } = request.nextUrl;
  const id = searchParams.get("id");

  // id 없으면 메인 OG 이미지
  if (!id) {
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
            <span style={{ fontSize: "48px", fontWeight: 700, color: "white" }}>
              스팟리
            </span>
          </div>

          <div style={{ fontSize: "52px", fontWeight: 700, color: "#a78bfa", marginBottom: "20px" }}>
            AI 창업 입지 분석
          </div>

          <div style={{ fontSize: "24px", color: "#94a3b8" }}>
            주소와 업종만 입력하면, 100점 만점 맞춤 리포트 제공
          </div>

          <div style={{ display: "flex", marginTop: "40px" }}>
            {["경쟁 강도", "유동인구", "교통·접근성", "인프라"].map((label) => (
              <div
                key={label}
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
                {label}
              </div>
            ))}
          </div>
        </div>
      ),
      { width: 1200, height: 630, fonts },
    );
  }

  // 리포트 데이터 가져오기
  const report = await getReportData(id, origin);

  if (!report) {
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
            color: "white",
            fontSize: "36px",
            fontFamily: "Pretendard",
          }}
        >
          스팟리 - AI 창업 입지 분석
        </div>
      ),
      { width: 1200, height: 630, fonts },
    );
  }

  const score = report.totalScore;
  const scoreColor = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";
  const grade = score >= 90 ? "S" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F";

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
        <div style={{ display: "flex", alignItems: "center", marginBottom: "40px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "20px",
              backgroundColor: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "20px",
              fontWeight: 700,
              marginRight: "12px",
            }}
          >
            S
          </div>
          <span style={{ fontSize: "24px", color: "#a78bfa", fontWeight: 700 }}>
            스팟리
          </span>
          <span style={{ fontSize: "18px", color: "#64748b", marginLeft: "12px" }}>
            AI 창업 입지 분석
          </span>
        </div>

        {/* 업종 */}
        <div style={{ fontSize: "22px", color: "#a78bfa", marginBottom: "16px", fontWeight: 700 }}>
          {report.industryName}
        </div>

        {/* 주소 */}
        <div style={{ fontSize: "36px", fontWeight: 700, color: "white", marginBottom: "40px", textAlign: "center" }}>
          {report.address}
        </div>

        {/* 점수 */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: "18px", color: "#94a3b8", marginRight: "16px" }}>종합 점수</span>
          <span style={{ fontSize: "72px", fontWeight: 700, color: scoreColor }}>{score}</span>
          <span style={{ fontSize: "28px", color: "#64748b", marginLeft: "4px" }}>/ 100</span>
          <div
            style={{
              marginLeft: "24px",
              padding: "8px 20px",
              borderRadius: "8px",
              backgroundColor: scoreColor,
              color: "#0f172a",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            {grade}등급
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}
