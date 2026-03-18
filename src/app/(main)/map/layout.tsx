import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "위치 설정",
  description: "지도에서 창업 예정 위치와 분석 반경을 설정하세요.",
  robots: { index: false },
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
