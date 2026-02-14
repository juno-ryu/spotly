"use client";

interface CenterPinProps {
  /** 지도 드래그 중 여부 (핀 애니메이션) */
  isMoving: boolean;
}

/** 화면 중앙 고정 핀 (배달의민족/카카오택시 스타일) */
export function CenterPin({ isMoving }: CenterPinProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
      <div
        className="relative transition-transform duration-200 ease-out"
        style={{ transform: isMoving ? "translateY(-12px)" : "translateY(0)" }}
      >
        {/* 핀 SVG */}
        <svg
          width="36"
          height="48"
          viewBox="0 0 36 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg"
          style={{ transform: "translateY(-24px)" }}
        >
          <path
            d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z"
            fill="#7c3aed"
          />
          <circle cx="18" cy="18" r="8" fill="white" />
        </svg>

        {/* 그림자 타원 */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black/20 transition-all duration-200 ease-out"
          style={{
            width: isMoving ? 8 : 12,
            height: isMoving ? 3 : 4,
            bottom: isMoving ? -4 : 0,
            opacity: isMoving ? 0.3 : 0.5,
          }}
        />
      </div>
    </div>
  );
}
