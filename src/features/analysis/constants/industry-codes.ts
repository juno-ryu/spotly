/** 업종 코드 인터페이스 (PRD Step 4) */
export interface IndustryCode {
  code: string;
  name: string;
  category: string;
  keywords: string[];
}

/** 업종 코드 전체 목록 — KSIC 기반 */
export const INDUSTRY_CODES: IndustryCode[] = [
  // ─── 음식점 ───
  { code: "I56111", name: "한식음식점", category: "음식", keywords: ["한식", "밥", "찌개", "백반", "국밥", "비빔밥"] },
  { code: "I56112", name: "중식음식점", category: "음식", keywords: ["중식", "짜장", "짬뽕", "중국", "탕수육"] },
  { code: "I56113", name: "일식음식점", category: "음식", keywords: ["일식", "초밥", "스시", "라멘", "돈카츠", "일본"] },
  { code: "I56114", name: "서양식음식점", category: "음식", keywords: ["양식", "파스타", "스테이크", "레스토랑"] },
  { code: "I56192", name: "치킨전문점", category: "음식", keywords: ["치킨", "닭", "프라이드", "양념", "후라이드"] },
  { code: "I56193", name: "피자전문점", category: "음식", keywords: ["피자", "도우"] },
  { code: "I56194", name: "분식전문점", category: "음식", keywords: ["분식", "떡볶이", "김밥", "순대", "라볶이"] },
  { code: "I56195", name: "햄버거전문점", category: "음식", keywords: ["햄버거", "버거", "패스트푸드"] },
  { code: "I56196", name: "감자탕전문점", category: "음식", keywords: ["감자탕", "뼈해장국", "해장"] },
  { code: "I56199", name: "기타음식점", category: "음식", keywords: ["음식점", "식당", "맛집"] },

  // ─── 카페/음료 ───
  { code: "I56191", name: "커피전문점", category: "카페", keywords: ["커피", "카페", "아메리카노", "라떼", "에스프레소"] },
  { code: "I56220", name: "주스/음료전문점", category: "카페", keywords: ["주스", "음료", "스무디", "과일"] },
  { code: "I56291", name: "제과점", category: "카페", keywords: ["빵", "베이커리", "제과", "케이크", "디저트"] },
  { code: "I56292", name: "아이스크림전문점", category: "카페", keywords: ["아이스크림", "젤라또", "빙수"] },
  { code: "I56293", name: "차전문점", category: "카페", keywords: ["차", "티", "녹차", "홍차", "허브티"] },

  // ─── 주점 ───
  { code: "I56211", name: "일반유흥주점", category: "주점", keywords: ["술집", "호프", "주점", "맥주"] },
  { code: "I56219", name: "기타주점", category: "주점", keywords: ["바", "와인바", "칵테일", "포차", "이자카야"] },

  // ─── 소매/편의점 ───
  { code: "G47112", name: "편의점", category: "소매", keywords: ["편의점", "마트", "GS", "CU", "세븐"] },
  { code: "G47111", name: "슈퍼마켓", category: "소매", keywords: ["슈퍼", "마트", "식료품"] },
  { code: "G47211", name: "의류판매점", category: "소매", keywords: ["옷", "의류", "패션", "브랜드"] },
  { code: "G47411", name: "컴퓨터/전자기기", category: "소매", keywords: ["컴퓨터", "전자", "핸드폰", "휴대폰", "스마트폰"] },
  { code: "G47911", name: "반려동물용품", category: "소매", keywords: ["반려동물", "펫", "강아지", "고양이", "펫샵"] },
  { code: "G47810", name: "꽃집", category: "소매", keywords: ["꽃", "플라워", "화훼", "꽃집", "플로리스트"] },
  { code: "G47721", name: "화장품판매점", category: "소매", keywords: ["화장품", "뷰티", "코스메틱", "스킨케어"] },

  // ─── 미용/서비스 ───
  { code: "S96112", name: "미용실", category: "서비스", keywords: ["미용", "헤어", "뷰티", "미장원", "헤어샵"] },
  { code: "S96113", name: "네일숍", category: "서비스", keywords: ["네일", "네일아트", "매니큐어"] },
  { code: "S96114", name: "피부관리실", category: "서비스", keywords: ["피부", "피부관리", "에스테틱", "스킨케어"] },
  { code: "S96121", name: "세탁소", category: "서비스", keywords: ["세탁", "드라이클리닝", "빨래"] },
  { code: "S96911", name: "반려동물미용", category: "서비스", keywords: ["애견미용", "펫미용", "반려동물"] },

  // ─── 의료/건강 ───
  { code: "Q86211", name: "일반의원", category: "의료", keywords: ["병원", "의원", "내과", "클리닉"] },
  { code: "Q86212", name: "치과의원", category: "의료", keywords: ["치과", "임플란트", "치아"] },
  { code: "Q86230", name: "한의원", category: "의료", keywords: ["한의원", "한방", "한의사", "침"] },
  { code: "Q86241", name: "약국", category: "의료", keywords: ["약국", "약", "조제", "의약품"] },
  { code: "R93191", name: "헬스클럽", category: "건강", keywords: ["헬스", "피트니스", "운동", "짐", "PT"] },
  { code: "R93192", name: "요가/필라테스", category: "건강", keywords: ["요가", "필라테스", "스트레칭"] },

  // ─── 교육 ───
  { code: "P85501", name: "학원", category: "교육", keywords: ["학원", "입시", "교육", "과외", "보습"] },
  { code: "P85502", name: "어학원", category: "교육", keywords: ["어학", "영어", "일본어", "중국어", "외국어"] },
  { code: "P85503", name: "예체능학원", category: "교육", keywords: ["예체능", "미술", "음악", "피아노", "태권도"] },
  { code: "P85509", name: "코딩/IT교육", category: "교육", keywords: ["코딩", "IT", "프로그래밍", "컴퓨터학원"] },

  // ─── 부동산/사무 ───
  { code: "L68112", name: "부동산중개", category: "부동산", keywords: ["부동산", "공인중개사", "임대", "매매"] },
  { code: "N75110", name: "인력파견", category: "사무", keywords: ["인력", "파견", "용역", "아르바이트"] },

  // ─── 자동차 ───
  { code: "G45211", name: "자동차부품", category: "자동차", keywords: ["자동차", "부품", "카센터"] },
  { code: "S95211", name: "자동차수리", category: "자동차", keywords: ["자동차수리", "정비", "카센터", "오토바이"] },
  { code: "I56130", name: "세차장", category: "자동차", keywords: ["세차", "자동세차"] },

  // ─── 숙박 ───
  { code: "I55101", name: "호텔", category: "숙박", keywords: ["호텔", "숙박", "리조트"] },
  { code: "I55109", name: "모텔/게스트하우스", category: "숙박", keywords: ["모텔", "게스트하우스", "민박", "숙소"] },

  // ─── 기타 ───
  { code: "R91291", name: "노래방", category: "오락", keywords: ["노래방", "코인노래방", "노래연습장"] },
  { code: "R91241", name: "당구장", category: "오락", keywords: ["당구", "포켓볼", "당구장"] },
  { code: "R91111", name: "PC방", category: "오락", keywords: ["PC방", "피시방", "게임", "인터넷카페"] },
  { code: "N76390", name: "스튜디오", category: "기타", keywords: ["스튜디오", "사진", "촬영", "포토"] },
  { code: "S95120", name: "핸드폰수리", category: "기타", keywords: ["핸드폰수리", "스마트폰수리", "폰수리"] },
] as const;

/** 카테고리 목록 (필터용) */
export const INDUSTRY_CATEGORIES = [
  "음식", "카페", "주점", "소매", "서비스", "의료", "건강", "교육", "부동산", "자동차", "숙박", "오락", "기타",
] as const;
