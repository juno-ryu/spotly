/** 기본 지도 줌 레벨 (카카오맵 level — 숫자가 작을수록 확대) */
export const DEFAULT_MAP_ZOOM = 3;

/** 온보딩 지역 선택 결과 */
export interface OnboardingRegion {
  emoji: string;
  name: string;
  latitude: number;
  longitude: number;
  zoom: number;
}

/** 핫한 창업지역 추천 (추후 데이터 기반으로 교체 예정) */
export const HOT_STARTUP_AREAS: OnboardingRegion[] = [
  { emoji: "🏙️", name: "성수동", latitude: 37.5445, longitude: 127.0561, zoom: DEFAULT_MAP_ZOOM },
  { emoji: "🎨", name: "망원동", latitude: 37.5563, longitude: 126.9100, zoom: DEFAULT_MAP_ZOOM },
  { emoji: "🎸", name: "연남동", latitude: 37.5660, longitude: 126.9227, zoom: DEFAULT_MAP_ZOOM },
  { emoji: "🎵", name: "홍대", latitude: 37.5563, longitude: 126.9237, zoom: DEFAULT_MAP_ZOOM },
  { emoji: "🌍", name: "이태원", latitude: 37.5345, longitude: 126.9940, zoom: DEFAULT_MAP_ZOOM },
  { emoji: "✨", name: "압구정", latitude: 37.5278, longitude: 127.0289, zoom: DEFAULT_MAP_ZOOM },
  { emoji: "🎡", name: "잠실", latitude: 37.5133, longitude: 127.1001, zoom: DEFAULT_MAP_ZOOM },
  { emoji: "🌊", name: "해운대", latitude: 35.1631, longitude: 129.1637, zoom: DEFAULT_MAP_ZOOM },
  { emoji: "🏛️", name: "을지로", latitude: 37.5660, longitude: 126.9910, zoom: DEFAULT_MAP_ZOOM },
] as const;
