import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function loadFont() {
  const res = await fetch(
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff/Pretendard-Bold.woff",
  );
  return res.arrayBuffer();
}

function buildImage(
  title: string,
  subtitle: string,
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

        <div style={{ fontSize: "44px", fontWeight: 700, color: "#a78bfa", marginBottom: "20px", textAlign: "center" }}>
          {title}
        </div>

        <div style={{ fontSize: "24px", color: "#94a3b8", textAlign: "center" }}>
          {subtitle}
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}

export async function GET(request: NextRequest) {
  try {
    const fontData = await loadFont();
    const fonts = [{ name: "Pretendard" as const, data: fontData, weight: 700 as const }];
    const { searchParams } = request.nextUrl;

    const address = searchParams.get("address");
    const industry = searchParams.get("industry");
    const score = searchParams.get("score");

    if (address && industry && score) {
      return buildImage(
        `${address} ${industry}`,
        `종합 점수 ${score}점 · AI 창업 입지 분석`,
        fonts,
      );
    }

    return buildImage(
      "AI 창업 입지 분석",
      "주소와 업종만 입력하면, 100점 만점 맞춤 리포트 제공",
      fonts,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`OG error: ${msg}`, { status: 500 });
  }
}
