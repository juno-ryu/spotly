import { create } from "zustand";

/** 분석 위자드 단계 */
export const WizardStep = {
  /** 대화형 온보딩 */
  ONBOARDING: "ONBOARDING",
  /** 전체화면 지도 + 위치 검색 */
  MAP_SEARCH: "MAP_SEARCH",
  /** 위치 확정 + 업종 선택 */
  LOCATION_INDUSTRY: "LOCATION_INDUSTRY",
  /** 반경 설정 */
  RADIUS_SETTING: "RADIUS_SETTING",
  /** AI 분석 진행 중 */
  ANALYZING: "ANALYZING",
  /** 분석 결과 요약 */
  RESULT_SUMMARY: "RESULT_SUMMARY",
  /** AI 리포트 */
  REPORT: "REPORT",
} as const;
export type WizardStep = (typeof WizardStep)[keyof typeof WizardStep];

export interface SelectedLocation {
  latitude: number;
  longitude: number;
  address: string;
  name?: string;
}

export interface SelectedIndustry {
  code: string;
  name: string;
}

/** 온보딩에서 선택한 지역 (좌표 + 줌 레벨) */
export interface SelectedRegion {
  name: string;
  latitude: number;
  longitude: number;
  zoom: number;
}

interface WizardState {
  step: WizardStep;
  selectedLocation: SelectedLocation | null;
  selectedIndustry: SelectedIndustry | null;
  selectedRegion: SelectedRegion | null;
  setStep: (step: WizardStep) => void;
  setSelectedLocation: (location: SelectedLocation) => void;
  setSelectedIndustry: (industry: SelectedIndustry) => void;
  setSelectedRegion: (region: SelectedRegion) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>((set) => ({
  step: WizardStep.ONBOARDING,
  selectedLocation: null,
  selectedIndustry: null,
  selectedRegion: null,
  setStep: (step) => set({ step }),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  setSelectedIndustry: (industry) => set({ selectedIndustry: industry }),
  setSelectedRegion: (region) => set({ selectedRegion: region }),
  reset: () =>
    set({
      step: WizardStep.ONBOARDING,
      selectedLocation: null,
      selectedIndustry: null,
      selectedRegion: null,
    }),
}));

// 개발 환경에서 디버깅용 store 노출
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as never as Record<string, unknown>).__WIZARD_STORE__ = useWizardStore;
}
