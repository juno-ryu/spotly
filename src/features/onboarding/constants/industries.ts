/** 온보딩 업종 칩 */
export interface OnboardingIndustry {
  emoji: string;
  name: string;
  /** Kakao Places 검색 키워드 */
  keyword: string;
  /** KSIC 코드 (NPS 매핑용) */
  ksicCode: string;
  /** 서울 골목상권 코드 */
  seoulCode: string;
}

/** 온보딩 Step 2 업종 칩 목록 (9개) */
export const ONBOARDING_INDUSTRIES: OnboardingIndustry[] = [
  { emoji: "☕", name: "카페", keyword: "카페", ksicCode: "I56191", seoulCode: "CS100010" },
  { emoji: "🍗", name: "치킨", keyword: "치킨", ksicCode: "I56192", seoulCode: "CS100006" },
  { emoji: "🍜", name: "한식", keyword: "한식", ksicCode: "I56111", seoulCode: "CS100001" },
  { emoji: "🥘", name: "중식", keyword: "중식", ksicCode: "I56112", seoulCode: "CS100002" },
  { emoji: "💇", name: "미용실", keyword: "미용실", ksicCode: "S96112", seoulCode: "CS300009" },
  { emoji: "🍕", name: "양식", keyword: "양식", ksicCode: "I56114", seoulCode: "CS100005" },
  { emoji: "🏪", name: "편의점", keyword: "편의점", ksicCode: "G47112", seoulCode: "CS200013" },
  { emoji: "🍰", name: "베이커리", keyword: "베이커리", ksicCode: "I56291", seoulCode: "CS100009" },
  { emoji: "🥤", name: "음료", keyword: "음료", ksicCode: "I56220", seoulCode: "CS100011" },
] as const;
