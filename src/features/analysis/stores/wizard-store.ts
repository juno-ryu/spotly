import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface SelectedLocation {
  latitude: number;
  longitude: number;
  address: string;
  name?: string;
}

export interface SelectedIndustry {
  code: string;
  name: string;
  emoji: string;
}

/** 온보딩에서 선택한 지역 (좌표 + 줌 레벨) */
export interface SelectedRegion {
  name: string;
  latitude: number;
  longitude: number;
  zoom: number;
}

interface WizardState {
  selectedLocation: SelectedLocation | null;
  selectedIndustry: SelectedIndustry | null;
  selectedRegion: SelectedRegion | null;
  setSelectedLocation: (location: SelectedLocation) => void;
  setSelectedIndustry: (industry: SelectedIndustry) => void;
  setSelectedRegion: (region: SelectedRegion) => void;
  reset: () => void;
}

const initialState = {
  selectedLocation: null,
  selectedIndustry: null,
  selectedRegion: null,
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...initialState,
      setSelectedLocation: (location) => set({ selectedLocation: location }),
      setSelectedIndustry: (industry) => set({ selectedIndustry: industry }),
      setSelectedRegion: (region) => set({ selectedRegion: region }),
      reset: () => set(initialState),
    }),
    {
      name: "wizard-data",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// 개발 환경에서 디버깅용 store 노출
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as never as Record<string, unknown>).__WIZARD_STORE__ = useWizardStore;
}
