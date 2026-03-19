import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const LOGO_DATA_URL = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBmaWxsPSJub25lIj4KICA8ZGVmcz4KICAgIDxtYXNrIGlkPSJwaW4taG9sZSI+CiAgICAgIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiBmaWxsPSJ3aGl0ZSIvPgogICAgICA8Y2lyY2xlIGN4PSIyNTYiIGN5PSIxODYiIHI9IjUwIiBmaWxsPSJibGFjayIvPgogICAgPC9tYXNrPgogIDwvZGVmcz4KCiAgPCEtLSDsmbjqs70g7JuQIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMjQwIiBzdHJva2U9IiM3YzNhZWQiIHN0cm9rZS13aWR0aD0iMjQiIGZpbGw9IndoaXRlIi8+CgogIDwhLS0g7YOA7JuQIDLqsJwgLS0+CiAgPGVsbGlwc2UgY3g9IjI1NiIgY3k9IjM1MCIgcng9IjcwIiByeT0iNTUiIHN0cm9rZT0iIzdjM2FlZCIgc3Ryb2tlLXdpZHRoPSIxMiIgZmlsbD0ibm9uZSIvPgogIDxlbGxpcHNlIGN4PSIyNTYiIGN5PSIzNTAiIHJ4PSIxMjAiIHJ5PSI5NSIgc3Ryb2tlPSIjN2MzYWVkIiBzdHJva2Utd2lkdGg9IjEyIiBmaWxsPSJub25lIi8+CgogIDwhLS0g7Iut7J6Q7ISgICjsmrDsuKEgKyDtlZjri6jrp4wsIOuBnSDrnbzsmrTrk5wpIC0tPgogIDxsaW5lIHgxPSIyNTYiIHkxPSIzNzgiIHgyPSIyNTYiIHkyPSI0NzMiIHN0cm9rZT0iIzdjM2FlZCIgc3Ryb2tlLXdpZHRoPSIxMCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPGxpbmUgeDE9IjI5MiIgeTE9IjM1MCIgeDI9IjQxMiIgeTI9IjM1MCIgc3Ryb2tlPSIjN2MzYWVkIiBzdHJva2Utd2lkdGg9IjEwIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KCiAgPCEtLSDsnITsuZgg7ZWAICjrgrTrtoAg7JuQIOq1rOupjSkgLS0+CiAgPHBhdGggZD0iTTI1NiA5MCBDMjAwIDkwIDE1NiAxMzQgMTU2IDE5MCBDMTU2IDI2MiAyNTYgMzQ4IDI1NiAzNDggQzI1NiAzNDggMzU2IDI2MiAzNTYgMTkwIEMzNTYgMTM0IDMxMiA5MCAyNTYgOTBaIiBmaWxsPSIjN2MzYWVkIiBtYXNrPSJ1cmwoI3Bpbi1ob2xlKSIvPgo8L3N2Zz4K";

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

// 검증된 단일 템플릿 — 메인/리포트 공용
function buildOgImage(
  elements: { title: string; subtitle: string; badge?: string; badgeColor?: string; showLogo?: boolean },
  fonts: { name: string; data: ArrayBuffer; weight: 700 }[],
) {
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
        {/* 브랜드 로고 */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
          <img src={LOGO_DATA_URL} width={48} height={48} style={{ marginRight: "12px" }} />
          <span style={{ fontSize: "32px", fontWeight: 700, color: "white" }}>스팟리</span>
        </div>

        {/* 뱃지 */}
        {elements.badge ? (
          <div style={{ display: "flex", marginBottom: "24px" }}>
            <div
              style={{
                padding: "8px 24px",
                borderRadius: "20px",
                backgroundColor: elements.badgeColor ?? "#22c55e",
                color: "#0f172a",
                fontSize: "20px",
                fontWeight: 700,
              }}
            >
              {elements.badge}
            </div>
          </div>
        ) : null}

        {/* 제목 */}
        <div style={{ fontSize: "44px", fontWeight: 700, color: "#a78bfa", marginBottom: "16px", textAlign: "center" }}>
          {elements.title}
        </div>

        {/* 부제목 */}
        <div style={{ fontSize: "24px", color: "#94a3b8", textAlign: "center" }}>
          {elements.subtitle}
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}

export async function GET(request: NextRequest) {
  const fontData = await loadFont();
  const fonts = [{ name: "Pretendard" as const, data: fontData, weight: 700 as const }];
  const { searchParams } = request.nextUrl;

  const address = searchParams.get("address");
  const industry = searchParams.get("industry");
  const scoreStr = searchParams.get("score");
  const verdict = searchParams.get("verdict") ?? "";

  if (address && industry && scoreStr) {
    const score = Number(scoreStr);
    const { grade, label, color } = getGradeInfo(score);
    const shortVerdict = verdict.length > 50 ? verdict.slice(0, 50) + "..." : verdict;

    return buildOgImage(
      {
        title: `${address} ${industry}`,
        subtitle: shortVerdict || "AI 창업 입지 분석 리포트",
        badge: `${grade}등급 · ${label} · ${score}점`,
        badgeColor: color,
      },
      fonts,
    );
  }

  return buildOgImage(
    {
      title: "AI 창업 입지 분석",
      subtitle: "주소와 업종만 입력하면, 100점 만점 맞춤 리포트 제공",
    },
    fonts,
  );
}
