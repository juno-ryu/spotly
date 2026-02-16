export const SITE_CONFIG = {
  name: "창업 분석기",
  description: "소상공인 창업 입지 분석 서비스",
  url: "http://localhost:3000",
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
