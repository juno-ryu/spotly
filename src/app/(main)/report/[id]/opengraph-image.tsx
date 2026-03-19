import { ImageResponse } from "next/og";
import { prisma } from "@/server/db/prisma";

export const alt = "스팟리 창업 분석 리포트";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function getScoreColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

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
          backgroundColor: "#0f172a",
          padding: "60px",
        }}
      >
        {/* 상단: 브랜드 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "48px",
          }}
        >
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

        {/* 중앙: 업종 + 주소 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: "22px",
              color: "#a78bfa",
              marginBottom: "16px",
              fontWeight: 600,
            }}
          >
            {report.industryName}
          </div>
          <div
            style={{
              fontSize: "40px",
              fontWeight: 800,
              color: "white",
              lineHeight: 1.3,
              marginBottom: "40px",
            }}
          >
            {report.address}
          </div>

          {/* 점수 */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: "18px", color: "#94a3b8", marginRight: "16px" }}>
              종합 점수
            </span>
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
            <span style={{ fontSize: "28px", color: "#64748b", marginLeft: "4px" }}>
              / 100
            </span>
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
    { ...size },
  );
}
