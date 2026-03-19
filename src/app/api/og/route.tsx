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

function buildOgImage(
  elements: { title: string; subtitle: string; badge?: string; badgeColor?: string },
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
        {/* 브랜드 */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "24px",
              backgroundColor: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              color: "white",
              fontWeight: 700,
              marginRight: "12px",
            }}
          >
            S
          </div>
          <span style={{ fontSize: "32px", fontWeight: 700, color: "white" }}>스팟리</span>
        </div>

        {/* 뱃지 (있으면) */}
        {elements.badge ? (
          <div
            style={{
              display: "flex",
              marginBottom: "24px",
            }}
          >
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

  // 리포트 OG
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

  // 메인 OG
  return buildOgImage(
    {
      title: "AI 창업 입지 분석",
      subtitle: "주소와 업종만 입력하면, 100점 만점 맞춤 리포트 제공",
    },
    fonts,
  );
}
