import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "업종 선택",
  description: "창업 분석을 시작할 업종을 선택하세요. 음식점, 카페, 편의점 등 다양한 소상공인 업종을 지원합니다.",
  robots: { index: false },
};

export default function IndustryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
