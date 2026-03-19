import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
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
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "32px",
            }}
          >
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
                fontWeight: 800,
                marginRight: "16px",
              }}
            >
              S
            </div>
            <span style={{ fontSize: "48px", fontWeight: 800, color: "white" }}>
              스팟리
            </span>
          </div>

          <div style={{ fontSize: "52px", fontWeight: 800, color: "#a78bfa", marginBottom: "20px" }}>
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
                  fontWeight: 600,
                  marginRight: "16px",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  // id 있으면 리포트 OG 이미지
  let report: { address: string; industryName: string; totalScore: number } | null = null;
  try {
    report = await prisma.analysisReport.findUnique({
      where: { id },
      select: { address: true, industryName: true, totalScore: true },
    });
  } catch {
    // DB 연결 실패 시 폴백
  }

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
          }}
        >
          스팟리 - AI 창업 입지 분석
        </div>
      ),
      { width: 1200, height: 630 },
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
          backgroundColor: "#0f172a",
          padding: "60px",
        }}
      >
        {/* 브랜드 */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "48px" }}>
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

        {/* 업종 + 주소 */}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          <div style={{ fontSize: "22px", color: "#a78bfa", marginBottom: "16px", fontWeight: 600 }}>
            {report.industryName}
          </div>
          <div style={{ fontSize: "40px", fontWeight: 800, color: "white", marginBottom: "40px" }}>
            {report.address}
          </div>

          {/* 점수 */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: "18px", color: "#94a3b8", marginRight: "16px" }}>종합 점수</span>
            <span style={{ fontSize: "72px", fontWeight: 900, color: scoreColor }}>{score}</span>
            <span style={{ fontSize: "28px", color: "#64748b", marginLeft: "4px" }}>/ 100</span>
            <div
              style={{
                marginLeft: "24px",
                padding: "8px 20px",
                borderRadius: "8px",
                backgroundColor: scoreColor,
                color: "#0f172a",
                fontSize: "28px",
                fontWeight: 800,
              }}
            >
              {grade}등급
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
