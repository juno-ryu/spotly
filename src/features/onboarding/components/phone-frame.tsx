/**
 * iPhone 외형 프레임 — 메인 인트로의 view-only 미리보기 컨테이너.
 *
 * 내부 children 의 `position: fixed` 도 부모의 transform 컨테이너에
 * 의해 phone 안에 가둬짐.
 */

interface PhoneFrameProps {
  children: React.ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div
      className="relative mx-auto"
      style={{
        width: "100%",
        maxWidth: 390,
        aspectRatio: "390 / 844",
        background: "#000",
        borderRadius: 52,
        padding: 11,
        boxShadow:
          "0 30px 70px -20px rgba(40,20,80,0.35), 0 0 0 1px rgba(0,0,0,0.05)",
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden bg-white"
        style={{ borderRadius: 42, transform: "translate(0,0)" }}
      >
        {/* notch */}
        <div
          className="absolute z-50"
          style={{
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 34,
            background: "#000",
            borderBottomLeftRadius: 18,
            borderBottomRightRadius: 18,
          }}
        />
        {/* 스크롤 가능 영역 — 얇은 overlay-style 스크롤바 (macOS 풍) */}
        <div
          className="h-full w-full overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.2)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/20 [&::-webkit-scrollbar-thumb:hover]:bg-black/35"
          style={{ paddingTop: 12 }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
