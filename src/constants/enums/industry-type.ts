/** 인기 업종 (UI 상단 퀵 선택용) */
export const POPULAR_INDUSTRIES = [
  { code: "I56192", name: "치킨전문점", keywords: ["치킨", "닭", "프라이드"] },
  { code: "I56111", name: "한식음식점", keywords: ["한식", "밥", "찌개"] },
  { code: "I56112", name: "중식음식점", keywords: ["중식", "짜장", "중국"] },
  { code: "I56191", name: "커피전문점", keywords: ["커피", "카페", "음료"] },
  { code: "I56194", name: "분식전문점", keywords: ["분식", "떡볶이", "김밥"] },
  { code: "I56193", name: "피자전문점", keywords: ["피자", "파스타"] },
  { code: "I56219", name: "기타주점", keywords: ["술집", "호프", "바"] },
  { code: "G47112", name: "편의점", keywords: ["편의점", "마트"] },
  { code: "S96112", name: "미용실", keywords: ["미용", "헤어", "뷰티"] },
  { code: "G47911", name: "반려동물용품", keywords: ["반려동물", "펫"] },
] as const;

export type IndustryInfo = {
  code: string;
  name: string;
  keywords: string[];
};
