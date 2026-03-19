import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// spotly-logo2.svg base64 인라인
const LOGO_DATA_URL = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj4KICA8ZGVmcz4KICAgIDxjbGlwUGF0aCBpZD0icGluLWNsaXAiPgogICAgICA8cGF0aCBkPSJNMjU2IDEwMCBDMTg4IDEwMCAxMzQgMTU0IDEzNCAyMjIgQzEzNCAzMTAgMjU2IDQyMCAyNTYgNDIwIEMyNTYgNDIwIDM3OCAzMTAgMzc4IDIyMiBDMzc4IDE1NCAzMjQgMTAwIDI1NiAxMDBaIi8+CiAgICA8L2NsaXBQYXRoPgogIDwvZGVmcz4KCiAgPCEtLSDrsJTsnbTsmKzroJsg67Cw6rK9IC0tPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iODAiIGZpbGw9IiM3YzNhZWQiLz4KCiAgPCEtLSDqt7jrprzsnpAgKO2VgCDslYTrnpgsIO2VgOuztOuLpCDrqLzsoIAg6re466Ck7JW8IOuSpOyXkCDquZTrprwpIC0tPgogIDxlbGxpcHNlIGN4PSIyNTYiIGN5PSI0MjEiIHJ4PSI0MiIgcnk9IjgiIGZpbGw9ImJsYWNrIiBvcGFjaXR5PSIwLjMiLz4KCiAgPCEtLSDtnbDsg4kg7ZWAIC0tPgogIDxwYXRoIGQ9Ik0yNTYgMTAwIEMxODggMTAwIDEzNCAxNTQgMTM0IDIyMiBDMTM0IDMxMCAyNTYgNDIwIDI1NiA0MjAgQzI1NiA0MjAgMzc4IDMxMCAzNzggMjIyIEMzNzggMTU0IDMyNCAxMDAgMjU2IDEwMFoiIGZpbGw9IndoaXRlIi8+CgogIDwhLS0g7Jew7ZWcIOuwlOydtOyYrOugmyDrjIDqsIHshKAgLS0+CiAgPHBvbHlnb24gcG9pbnRzPSIzNzgsNDIwIDEzNCw0MjAgMzc4LDEwMCIgZmlsbD0iI2RkZDZmZSIgY2xpcC1wYXRoPSJ1cmwoI3Bpbi1jbGlwKSIvPgoKICA8IS0tIO2VgCDrgrTrtoAg6rWs66mNIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxOCIgcj0iNTIiIGZpbGw9IiM3YzNhZWQiLz4KPC9zdmc+Cg==";

async function loadFont() {
  const res = await fetch(
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff/Pretendard-Bold.woff",
  );
  return res.arrayBuffer();
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

export async function GET(request: NextRequest) {
  const fontData = await loadFont();
  const fonts = [{ name: "Pretendard" as const, data: fontData, weight: 700 as const }];
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
            fontFamily: "Pretendard",
            padding: "60px 80px",
          }}
        >
          {/* 좌측: 로고 크게 */}
          <div style={{ display: "flex", width: "240px", marginRight: "60px" }}>
            <img src={LOGO_DATA_URL} width={200} height={200} />
          </div>

          {/* 우측: 컨텐츠 좌정렬 */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* 1행: 등급 라벨 */}
            <div style={{ display: "flex", marginBottom: "20px" }}>
              <div
                style={{
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

            {/* 2행: Spotly 브랜드 */}
            <div style={{ display: "flex", marginBottom: "20px" }}>
              <span style={{ fontSize: "56px", fontWeight: 700, color: "#7c3aed" }}>Spot</span>
              <span style={{ fontSize: "56px", fontWeight: 700, color: "#a78bfa" }}>ly</span>
            </div>

            {/* 3행: 주소 */}
            <div style={{ fontSize: "28px", fontWeight: 700, color: "white", marginBottom: "16px" }}>
              {address} {industry}
            </div>

            {/* 4행: 한줄평 */}
            <div style={{ fontSize: "18px", color: "#94a3b8" }}>
              {shortVerdict || "AI 창업 입지 분석 리포트"}
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
          backgroundColor: "#0f172a",
          fontFamily: "Pretendard",
          padding: "60px 80px",
        }}
      >
        <div style={{ display: "flex", width: "280px", marginRight: "60px" }}>
          <img src={LOGO_DATA_URL} width={240} height={240} />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", marginBottom: "16px" }}>
            <span style={{ fontSize: "64px", fontWeight: 700, color: "#7c3aed" }}>Spot</span>
            <span style={{ fontSize: "64px", fontWeight: 700, color: "#a78bfa" }}>ly</span>
          </div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "white", marginBottom: "12px" }}>
            AI 창업 입지 분석
          </div>
          <div style={{ fontSize: "22px", color: "#94a3b8" }}>
            주소와 업종만 입력하면, 100점 만점 맞춤 리포트 제공
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}
