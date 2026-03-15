/** 분석 반경 옵션 (미터) */
export const RadiusOption = {
  /** 200m (골목상권, 도보 2~3분) */
  NEAR: 200,
  /** 300m (근린상권, 도보 4~5분) */
  MEDIUM: 300,
  /** 500m (도보 6~7분) */
  FAR: 500,
} as const;
export type RadiusOption = (typeof RadiusOption)[keyof typeof RadiusOption];

/** 반경 옵션 목록 (UI 렌더링용) */
export const RADIUS_OPTIONS = [
  { value: RadiusOption.NEAR, label: "200m", description: "밀착 분석" },
  { value: RadiusOption.MEDIUM, label: "300m", description: "균형 분석" },
  { value: RadiusOption.FAR, label: "500m", description: "광역 분석" },
] as const;
