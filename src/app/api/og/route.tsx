import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

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

// 로고 대체: 텍스트 기반 아이콘 (satori는 svg/img 불안정)
function LogoIcon() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "120px",
        height: "120px",
        borderRadius: "28px",
        backgroundColor: "#7c3aed",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: "60px",
          fontWeight: 700,
          color: "white",
        }}
      >
        S
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  try {
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
      const shortVerdict = verdict.length > 60 ? verdict.slice(0, 60) + "..." : verdict;

      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              backgroundColor: "#0f172a",
              padding: "60px 80px",
            }}
          >
            <div style={{ display: "flex", marginRight: "60px" }}>
              <LogoIcon />
            </div>

            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", marginBottom: "20px" }}>
                <div
                  style={{
                    display: "flex",
                    padding: "8px 20px",
                    borderRadius: "20px",
                    backgroundColor: colors.bg,
                    color: colors.text,
                    fontSize: "22px",
                    fontWeight: 700,
                  }}
                >
                  {grade}등급 · {label} · {score}점
                </div>
              </div>

              <div style={{ display: "flex", marginBottom: "20px" }}>
                <span style={{ fontSize: "56px", fontWeight: 700, color: "#7c3aed" }}>Spot</span>
                <span style={{ fontSize: "56px", fontWeight: 700, color: "#a78bfa" }}>ly</span>
              </div>

              <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: "white", marginBottom: "16px" }}>
                {address} {industry}
              </div>

              <div style={{ display: "flex", fontSize: "18px", color: "#94a3b8" }}>
                {shortVerdict || "AI 창업 입지 분석 리포트"}
              </div>
            </div>
          </div>
        ),
        { width: 1200, height: 630 },
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
            backgroundColor: "#0f172a",
            padding: "60px 80px",
          }}
        >
          <div style={{ display: "flex", marginRight: "60px" }}>
            <LogoIcon />
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", marginBottom: "16px" }}>
              <span style={{ fontSize: "64px", fontWeight: 700, color: "#7c3aed" }}>Spot</span>
              <span style={{ fontSize: "64px", fontWeight: 700, color: "#a78bfa" }}>ly</span>
            </div>
            <div style={{ display: "flex", fontSize: "32px", fontWeight: 700, color: "white", marginBottom: "12px" }}>
              AI 창업 입지 분석
            </div>
            <div style={{ display: "flex", fontSize: "22px", color: "#94a3b8" }}>
              주소와 업종만 입력하면, 100점 만점 맞춤 리포트 제공
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
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
