import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// SVG 로고를 빌드타임 인라인 (런타임 fetch 없음)
const LOGO_SVG_BASE64 = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBmaWxsPSJub25lIj4KICA8ZGVmcz4KICAgIDxtYXNrIGlkPSJwaW4taG9sZSI+CiAgICAgIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiBmaWxsPSJ3aGl0ZSIvPgogICAgICA8Y2lyY2xlIGN4PSIyNTYiIGN5PSIxODYiIHI9IjUwIiBmaWxsPSJibGFjayIvPgogICAgPC9tYXNrPgogIDwvZGVmcz4KCiAgPCEtLSDsmbjqs70g7JuQIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMjQwIiBzdHJva2U9IiM3YzNhZWQiIHN0cm9rZS13aWR0aD0iMjQiIGZpbGw9IndoaXRlIi8+CgogIDwhLS0g7YOA7JuQIDLqsJwgLS0+CiAgPGVsbGlwc2UgY3g9IjI1NiIgY3k9IjM1MCIgcng9IjcwIiByeT0iNTUiIHN0cm9rZT0iIzdjM2FlZCIgc3Ryb2tlLXdpZHRoPSIxMiIgZmlsbD0ibm9uZSIvPgogIDxlbGxpcHNlIGN4PSIyNTYiIGN5PSIzNTAiIHJ4PSIxMjAiIHJ5PSI5NSIgc3Ryb2tlPSIjN2MzYWVkIiBzdHJva2Utd2lkdGg9IjEyIiBmaWxsPSJub25lIi8+CgogIDwhLS0g7Iut7J6Q7ISgICjsmrDsuKEgKyDtlZjri6jrp4wsIOuBnSDrnbzsmrTrk5wpIC0tPgogIDxsaW5lIHgxPSIyNTYiIHkxPSIzNzgiIHgyPSIyNTYiIHkyPSI0NzMiIHN0cm9rZT0iIzdjM2FlZCIgc3Ryb2tlLXdpZHRoPSIxMCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPGxpbmUgeDE9IjI5MiIgeTE9IjM1MCIgeDI9IjQxMiIgeTI9IjM1MCIgc3Ryb2tlPSIjN2MzYWVkIiBzdHJva2Utd2lkdGg9IjEwIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KCiAgPCEtLSDsnITsuZgg7ZWAICjrgrTrtoAg7JuQIOq1rOupjSkgLS0+CiAgPHBhdGggZD0iTTI1NiA5MCBDMjAwIDkwIDE1NiAxMzQgMTU2IDE5MCBDMTU2IDI2MiAyNTYgMzQ4IDI1NiAzNDggQzI1NiAzNDggMzU2IDI2MiAzNTYgMTkwIEMzNTYgMTM0IDMxMiA5MCAyNTYgOTBaIiBmaWxsPSIjN2MzYWVkIiBtYXNrPSJ1cmwoI3Bpbi1ob2xlKSIvPgo8L3N2Zz4K";
const LOGO_DATA_URL = `data:image/svg+xml;base64,${LOGO_SVG_BASE64}`;

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

  // 리포트 OG
  if (address && industry && scoreStr) {
    const score = Number(scoreStr);
    const { grade, label, color } = getGradeInfo(score);
    const shortVerdict = verdict.length > 50 ? verdict.slice(0, 50) + "..." : verdict;
    const pct = Math.round((score / 100) * 360);

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
          {/* 브랜드 */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
            <img src={LOGO_DATA_URL} width={32} height={32} style={{ marginRight: "10px" }} />
            <span style={{ fontSize: "22px", fontWeight: 700, color: "white" }}>스팟리</span>
          </div>

          {/* 점수 프로그레스 원 */}
          <div
            style={{
              width: "140px",
              height: "140px",
              borderRadius: "70px",
              backgroundImage: `conic-gradient(${color} ${pct}deg, #1e293b ${pct}deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: "110px",
                height: "110px",
                borderRadius: "55px",
                backgroundColor: "#0f172a",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "40px", fontWeight: 700, color }}>{grade}</span>
              <span style={{ fontSize: "14px", color: "#94a3b8" }}>{score}/100</span>
            </div>
          </div>

          {/* 등급 뱃지 */}
          <div style={{ display: "flex", marginBottom: "20px" }}>
            <div
              style={{
                padding: "6px 20px",
                borderRadius: "16px",
                backgroundColor: color,
                color: "#0f172a",
                fontSize: "16px",
                fontWeight: 700,
              }}
            >
              {grade}등급 · {label}
            </div>
          </div>

          {/* 업종 + 주소 */}
          <div style={{ fontSize: "18px", color: "#a78bfa", marginBottom: "8px", fontWeight: 700 }}>
            {industry}
          </div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "white", textAlign: "center", marginBottom: "12px" }}>
            {address}
          </div>

          {/* verdict */}
          <div style={{ fontSize: "16px", color: "#94a3b8", textAlign: "center" }}>
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
        <img src={LOGO_DATA_URL} width={80} height={80} style={{ marginBottom: "24px" }} />
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
