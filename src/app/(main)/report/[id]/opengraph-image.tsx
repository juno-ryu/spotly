import { ImageResponse } from "next/og";
import { prisma } from "@/server/db/prisma";

export const runtime = "nodejs";
export const alt = "스팟리 창업 분석 리포트";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 점수별 색상
function getScoreColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

// 점수별 등급
function getGrade(score: number) {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

export default async function ReportOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await prisma.analysisReport.findUnique({
    where: { id },
    select: { address: true, industryName: true, totalScore: true },
  });

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
            background: "#0f172a",
            color: "white",
            fontSize: "36px",
          }}
        >
          리포트를 찾을 수 없습니다
        </div>
      ),
      { ...size },
    );
  }

  const scoreColor = getScoreColor(report.totalScore);
  const grade = getGrade(report.totalScore);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          fontFamily: "sans-serif",
          padding: "60px",
        }}
      >
        {/* 상단: 로고 + 브랜드 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            📍
          </div>
          <span style={{ fontSize: "24px", color: "#a78bfa", fontWeight: 700 }}>
            스팟리
          </span>
          <span style={{ fontSize: "18px", color: "#64748b", marginLeft: "8px" }}>
            AI 창업 입지 분석
          </span>
        </div>

        {/* 중앙: 주소 + 업종 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              color: "#94a3b8",
              marginBottom: "12px",
              fontWeight: 600,
            }}
          >
            📌 {report.industryName}
          </div>
          <div
            style={{
              fontSize: "40px",
              fontWeight: 800,
              color: "white",
              lineHeight: 1.3,
              marginBottom: "36px",
            }}
          >
            {report.address}
          </div>

          {/* 점수 */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
            <span style={{ fontSize: "18px", color: "#94a3b8" }}>종합 점수</span>
            <span
              style={{
                fontSize: "72px",
                fontWeight: 900,
                color: scoreColor,
                lineHeight: 1,
              }}
            >
              {report.totalScore}
            </span>
            <span style={{ fontSize: "28px", color: "#64748b" }}>/ 100</span>
            <div
              style={{
                marginLeft: "16px",
                padding: "8px 20px",
                borderRadius: "8px",
                background: scoreColor,
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
    { ...size },
  );
}
