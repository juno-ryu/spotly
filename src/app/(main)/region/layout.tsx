import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "지역 선택",
  description: "분석할 창업 예정 지역을 선택하세요. 서울, 경기 등 주요 지역의 상권 데이터를 분석해드립니다.",
  robots: { index: false },
};

export default function RegionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
