import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "스팟리 - AI 창업 입지 분석";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* 로고 영역 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
            }}
          >
            📍
          </div>
          <span
            style={{
              fontSize: "48px",
              fontWeight: 800,
              color: "white",
            }}
          >
            스팟리
          </span>
        </div>

        {/* 제목 */}
        <div
          style={{
            fontSize: "56px",
            fontWeight: 800,
            background: "linear-gradient(90deg, #a78bfa, #818cf8, #7c3aed)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "20px",
          }}
        >
          AI 창업 입지 분석
        </div>

        {/* 설명 */}
        <div
          style={{
            fontSize: "24px",
            color: "#94a3b8",
            textAlign: "center",
            maxWidth: "800px",
            lineHeight: 1.5,
          }}
        >
          주소와 업종만 입력하면, 공공데이터 기반 AI가
        </div>
        <div
          style={{
            fontSize: "24px",
            color: "#94a3b8",
            textAlign: "center",
            maxWidth: "800px",
            lineHeight: 1.5,
          }}
        >
          100점 만점 맞춤 리포트를 제공합니다
        </div>

        {/* 지표 카드 */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "40px",
          }}
        >
          {["경쟁 강도", "유동인구", "교통·접근성", "인프라"].map((label) => (
            <div
              key={label}
              style={{
                padding: "12px 28px",
                borderRadius: "12px",
                border: "1px solid #4c1d95",
                background: "rgba(124, 58, 237, 0.1)",
                color: "#c4b5fd",
                fontSize: "18px",
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
