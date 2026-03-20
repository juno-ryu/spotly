import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@latest/Subset/SpoqaHanSansNeo/SpoqaHanSansNeo-Bold.woff";

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(FONT_URL);
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

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

// 로고 아이콘 (spotly-logo3 기반)
function LogoIcon({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size}>
      <rect width="512" height="512" fill="#7c3aed" rx="80" />
      <ellipse cx="256" cy="421" rx="42" ry="8" fill="black" opacity={0.3} />
      <path
        d="M256 100 C188 100 134 154 134 222 C134 310 256 420 256 420 C256 420 378 310 378 222 C378 154 324 100 256 100Z"
        fill="white"
      />
      <circle cx="256" cy="218" r="52" fill="#7c3aed" />
    </svg>
  );
}

// 원형 점수 게이지
function ScoreGauge({ score, grade, color, size = 120 }: { score: number; grade: string; color: string; size?: number }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;

  return (
    <div style={{ display: "flex", position: "relative", width: `${size}px`, height: `${size}px`, alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {/* 배경 원 */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
        {/* 진행 원 */}
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${offset}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute" }}>
        <span style={{ fontSize: `${size * 0.28}px`, fontWeight: 900, color }}>{grade}</span>
        <span style={{ fontSize: `${size * 0.15}px`, fontWeight: 900, color: "#94a3b8" }}>{score}/100</span>
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  try {
    const fontData = await loadFont();
    const fonts = fontData
      ? [{ name: "SpoqaHanSans", data: fontData, weight: 900 as const }]
      : [];
    const fontFamily = fontData ? "SpoqaHanSans" : "sans-serif";

    const { searchParams } = request.nextUrl;
    const address = searchParams.get("address");
    const industry = searchParams.get("industry");
    const scoreStr = searchParams.get("score");
    const verdict = searchParams.get("verdict") ?? "";
    const competitors = searchParams.get("competitors");
    const franchise = searchParams.get("franchise");
    const revenue = searchParams.get("revenue");
    const closeRate = searchParams.get("closeRate");
    const risk = searchParams.get("risk");
    const scope = searchParams.get("scope");
    const summary = searchParams.get("summary");
    const isSquare = searchParams.get("square") === "1";

    // 리포트 OG
    if (address && industry && scoreStr) {
      const score = Number(scoreStr);
      const { grade, label } = getGradeInfo(score);
      const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.C;

      // 주소 축약 — "서울특별시 성동구 아차산로 100" → "성동구 아차산로 100"
      const shortAddress = address
        .replace(/^서울특별시\s*/, "")
        .replace(/^부산광역시\s*/, "")
        .replace(/^대구광역시\s*/, "")
        .replace(/^인천광역시\s*/, "")
        .replace(/^광주광역시\s*/, "")
        .replace(/^대전광역시\s*/, "")
        .replace(/^울산광역시\s*/, "")
        .replace(/^세종특별자치시\s*/, "")
        .replace(/^경기도\s*/, "")
        .replace(/^강원특별자치도\s*/, "")
        .replace(/^충청북도\s*/, "")
        .replace(/^충청남도\s*/, "")
        .replace(/^전라북도\s*/, "")
        .replace(/^전라남도\s*/, "")
        .replace(/^경상북도\s*/, "")
        .replace(/^경상남도\s*/, "")
        .replace(/^제주특별자치도\s*/, "");

      // 하단 정보 라인 조합
      const infoItems: string[] = [];
      if (competitors) infoItems.push(`경쟁 ${competitors}개`);
      if (franchise) infoItems.push(`프랜차이즈 ${franchise}개`);
      if (revenue) infoItems.push(`월매출 ${revenue}만원`);
      if (closeRate) infoItems.push(`폐업률 ${closeRate}%`);
      const infoLine = infoItems.join("  ·  ");

      // 1:1 정사각형 (카카오톡 공유용)
      if (isSquare) {
        return new ImageResponse(
          (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#0f172a",
                fontFamily,
                gap: "20px",
                padding: "40px",
              }}
            >
              {/* 상단: 주소 + 업종 */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                <div style={{ display: "flex", fontSize: "36px", fontWeight: 900, color: "white" }}>
                  {shortAddress}
                </div>
                <div style={{ display: "flex", fontSize: "24px", fontWeight: 900, color: "#a78bfa" }}>
                  {industry} · AI 리포트
                </div>
              </div>

              {/* 하단: 게이지 + 종합평가 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <ScoreGauge score={score} grade={grade} color={colors.text} size={200} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "22px", fontWeight: 900, color: "#94a3b8" }}>종합평가</span>
                    <div
                      style={{
                        display: "flex",
                        padding: "4px 12px",
                        borderRadius: "8px",
                        backgroundColor: colors.bg,
                        color: colors.text,
                        fontSize: "20px",
                        fontWeight: 900,
                      }}
                    >
                      {grade}등급
                    </div>
                    {verdict && (
                      <div
                        style={{
                          display: "flex",
                          padding: "4px 12px",
                          borderRadius: "8px",
                          backgroundColor: "#1e293b",
                          color: "#cbd5e1",
                          fontSize: "20px",
                          fontWeight: 900,
                        }}
                      >
                        {verdict}
                      </div>
                    )}
                  </div>
                  {scope && (
                    <div style={{ display: "flex", fontSize: "22px", textAlign: 'center', fontWeight: 900, color: "#e2e8f0", lineHeight: 1.5 }}>
                      {scope}
                    </div>
                  )}
                  <div style={{ display: "flex", fontSize: "18px", textAlign: 'center', fontWeight: 900, color: "#94a3b8", lineHeight: 1.4 }}>
                    {summary || `${shortAddress} ${industry} 창업 입지 분석 리포트`}
                  </div>
                </div>
              </div>
            </div>
          ),
          { width: 600, height: 600, fonts },
        );
      }

      // 기본 직사각형 OG (1200x630) — 종합평가 UI 그대로
      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#0f172a",
              fontFamily,
              padding: "50px 60px",
            }}
          >
            {/* 상단: 주소 + 업종 */}
            <div style={{ display: "flex", flexDirection: "column", }}>
              <div style={{ display: "flex", fontSize: "50px", fontWeight: 900, color: "white" }}>
                {shortAddress}
              </div>
              <div style={{ display: "flex", fontSize: "38px", fontWeight: 900, color: "#a78bfa" }}>
                {industry} · AI 리포트
              </div>
            </div>

            {/* 하단: 게이지 + 종합평가 */}
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              {/* 좌: 원형 게이지 */}
              <div style={{ display: "flex", marginRight: "50px" }}>
                <ScoreGauge score={score} grade={grade} color={colors.text} size={300} />
              </div>

              {/* 우: 종합평가 */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "20px" }}>
                {/* 종합평가 + 등급 배지 + 판정 */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <span style={{ fontSize: "32px", fontWeight: 900, color: "#94a3b8" }}>종합평가</span>
                  <div
                    style={{
                      display: "flex",
                      padding: "6px 18px",
                      borderRadius: "12px",
                      backgroundColor: colors.bg,
                      color: colors.text,
                      fontSize: "28px",
                      fontWeight: 900,
                    }}
                  >
                    {grade}등급
                  </div>
                  {verdict && (
                    <div
                      style={{
                        display: "flex",
                        padding: "6px 18px",
                        borderRadius: "12px",
                        backgroundColor: "#1e293b",
                        color: "#cbd5e1",
                        fontSize: "28px",
                        fontWeight: 900,
                      }}
                    >
                      {verdict}
                    </div>
                  )}
                </div>

                {/* scope — 분석 범위 (굵은 흰색) */}
                {scope && (
                  <div style={{ display: "flex", fontSize: "32px", fontWeight: 900, color: "#e2e8f0", lineHeight: 1.6 }}>
                    {scope}
                  </div>
                )}
                {/* summary — 핵심 판단 (회색) */}
                <div style={{ display: "flex", fontSize: "26px", fontWeight: 900, color: "#94a3b8", lineHeight: 1.5 }}>
                  {summary || `${shortAddress} ${industry} 창업 입지 분석 리포트`}
                </div>
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
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0f172a",
            fontFamily,
            gap: "24px",
          }}
        >
          <LogoIcon size={120} />
          <div style={{ display: "flex", gap: "4px" }}>
            <span style={{ fontSize: "72px", fontWeight: 900, color: "#7c3aed" }}>스팟리</span>
          </div>
          <div style={{ display: "flex", fontSize: "36px", fontWeight: 900, color: "white" }}>
            AI 창업 입지 분석
          </div>
          <div style={{ display: "flex", fontSize: "24px", fontWeight: 900, color: "#94a3b8" }}>
            주소와 업종만 입력하면, 100점 만점 맞춤 리포트
          </div>
        </div>
      ),
      { width: 1200, height: 630, fonts },
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
          <span style={{ fontSize: "64px", fontWeight: 700, color: "#7c3aed" }}>스팟리</span>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }
}
