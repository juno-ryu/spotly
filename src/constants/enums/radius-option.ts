/** 분석 반경 옵션 (미터) */
export const RadiusOption = {
  /** 500m (도보 5분) */
  NEAR: 500,
  /** 1km (도보 15분) */
  MEDIUM: 1000,
  /** 3km (대중교통/차량) */
  FAR: 3000,
} as const;
export type RadiusOption = (typeof RadiusOption)[keyof typeof RadiusOption];

/** 반경 옵션 목록 (UI 렌더링용) */
export const RADIUS_OPTIONS = [
  { value: RadiusOption.NEAR, label: "500m", description: "도보 5분" },
  { value: RadiusOption.MEDIUM, label: "1km", description: "도보 15분" },
  { value: RadiusOption.FAR, label: "3km", description: "대중교통/차량" },
] as const;
