export const SITE_CONFIG = {
  name: "Spotly - AI 상권 분석",
  description: "AI가 공공데이터를 분석해서 창업 입지를 검증해드려요. 경쟁 강도, 매출, 유동인구, 교통, 인프라를 종합 분석한 맞춤 리포트.",
  url: "https://spotly-beta.vercel.app",
} as const;

/** 하이라이트 텍스트 그라데이션 (violet-600 → indigo-500) */
export const GRADIENT_TEXT_STYLE = {
  background: "linear-gradient(to right, #7c3aed, #6366f1)",
  backgroundSize: "200% auto",
  animation: "gradient-shift 4s ease infinite",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
} as const;
