import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface FakeMapProps {
  /** 반경(m). 시각적 원 크기 결정. */
  radius?: number;
  /** 경쟁업체 dot 표시 여부 */
  showCompetitorDots?: boolean;
  className?: string;
}

/** 경쟁업체 dot 좌표 — 화면 비율(%) 기반 hardcode. SSR hydration 안정. */
const COMPETITOR_DOTS = [
  { top: "22%", left: "18%" },
  { top: "30%", left: "76%" },
  { top: "40%", left: "30%" },
  { top: "55%", left: "82%" },
  { top: "62%", left: "15%" },
  { top: "70%", left: "55%" },
  { top: "78%", left: "28%" },
  { top: "26%", left: "55%" },
  { top: "85%", left: "70%" },
  { top: "15%", left: "40%" },
  { top: "48%", left: "65%" },
  { top: "92%", left: "44%" },
] as const;

/** 반경(m) → 원 직경(%). 300m → 40%, 1km → 65%, 3km → 90% 정도 */
function radiusToCirclePercent(radius: number): number {
  if (radius <= 300) return 38;
  if (radius <= 500) return 48;
  if (radius <= 1000) return 62;
  if (radius <= 2000) return 78;
  return 88;
}

/**
 * Kakao 지도 대신 사용하는 시각 모형.
 * 순수 CSS — 외부 SDK, useEffect, fetch 없음.
 */
export function FakeMap({
  radius = 300,
  showCompetitorDots = true,
  className,
}: FakeMapProps) {
  const circlePercent = radiusToCirclePercent(radius);

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-[#eef2f6]",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.06) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
      aria-hidden
    >
      {/* 도로 모방 — 대각선 + 가로/세로 한 줄씩 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(112deg, transparent 47%, rgba(160,170,200,0.25) 47%, rgba(160,170,200,0.25) 49%, transparent 49%), linear-gradient(15deg, transparent 60%, rgba(160,170,200,0.22) 60%, rgba(160,170,200,0.22) 62%, transparent 62%)",
        }}
      />

      {/* 경쟁업체 dot */}
      {showCompetitorDots &&
        COMPETITOR_DOTS.map((pos) => (
          <span
            key={`${pos.top}-${pos.left}`}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/70 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]"
            style={pos}
          />
        ))}

      {/* 반경 원 */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-violet-500/40 bg-violet-500/10"
        style={{
          width: `${circlePercent}%`,
          aspectRatio: "1 / 1",
        }}
      />

      {/* 중앙 핀 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[calc(50%+10px)]">
        <MapPin
          className="size-9 text-violet-600"
          fill="currentColor"
          strokeWidth={1.5}
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }}
        />
      </div>
    </div>
  );
}
