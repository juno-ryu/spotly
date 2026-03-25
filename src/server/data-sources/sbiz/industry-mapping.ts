/**
 * 스팟리 업종 코드(KSIC) → 소상공인 상가정보 소분류 코드 매핑
 *
 * 스팟리는 KSIC(표준산업분류) 코드를 사용하고,
 * 상가정보 API는 자체 소분류 코드(`indsSclsCd`)를 사용한다.
 *
 * 매핑 원칙:
 * - 1:1 매핑이 가능한 경우 소분류 코드 사용
 * - 1:N 매핑 (하나의 스팟리 업종이 여러 상가정보 소분류에 걸침) → 배열
 * - 매핑 불가 시 대분류(`indsLclsCd`) fallback 사용
 *
 * 검증: 강남역 반경 2km 데이터에서 실측 확인 (2026-03-25)
 */

interface SbizMapping {
  /** 상가정보 소분류 코드 배열 */
  sbizCodes: string[];
  /** 매핑 불가 시 대분류 코드 fallback */
  sbizLclsCd?: string;
}

/**
 * 스팟리 industryCode(KSIC) → 상가정보 소분류 코드 매핑
 *
 * 매핑이 없는 업종은 키워드 기반 전체 조회 후 앱 필터링으로 처리.
 */
export const KSIC_TO_SBIZ: Record<string, SbizMapping> = {
  // ─── 음식점 ───
  "I56111": { sbizCodes: ["I20101", "I20102", "I20103", "I20104", "I20106"] }, // 한식 → 백반/한정식, 국/탕, 족발, 전, 냉면
  "I56112": { sbizCodes: ["I20201", "I20202"] },                               // 중식 → 중국집, 마라탕/훠궈
  "I56113": { sbizCodes: ["I20301", "I20302", "I20303"] },                     // 일식 → 회/초밥, 카레/돈가스, 면
  "I56114": { sbizCodes: ["I20401", "I20402", "I20499"] },                     // 서양식 → 경양식, 파스타/스테이크, 기타
  "I56192": { sbizCodes: ["I21006"] },                                         // 치킨
  "I56193": { sbizCodes: ["I21003"] },                                         // 피자
  "I56194": { sbizCodes: ["I21007"] },                                         // 분식 → 김밥/만두/분식
  "I56195": { sbizCodes: ["I21004"] },                                         // 햄버거
  "I56196": { sbizCodes: ["I20102"] },                                         // 감자탕 → 국/탕 (근사 매핑)
  "I56199": { sbizCodes: ["I21099"], sbizLclsCd: "I2" },                       // 기타음식점

  // ─── 카페/음료 ───
  "I56191": { sbizCodes: ["I21201"] },                                         // 커피전문점 → 카페
  "I56220": { sbizCodes: ["I21201"] },                                         // 주스/음료 → 카페 (동일 코드)
  "I56291": { sbizCodes: ["I21001"] },                                         // 제과점 → 빵/도넛
  "I56292": { sbizCodes: ["I21008"] },                                         // 아이스크림
  "I56293": { sbizCodes: ["I21201"] },                                         // 차전문점 → 카페 (동일 코드)

  // ─── 주점 ───
  "I56211": { sbizCodes: ["I21101"] },                                         // 일반유흥주점
  "I56219": { sbizCodes: ["I21104", "I21103"] },                               // 기타주점 → 요리주점, 생맥주

  // ─── 소매 ───
  "G47112": { sbizCodes: ["G20405"] },                                         // 편의점
  "G47111": { sbizCodes: ["G20404"] },                                         // 슈퍼마켓
  "G47211": { sbizCodes: ["G20901", "G20902", "G20905"] },                     // 의류 → 남성/여성/기타
  "G47411": { sbizCodes: ["G20801", "G20802"] },                               // 컴퓨터/전자 → 컴퓨터, 핸드폰
  "G47911": { sbizCodes: [], sbizLclsCd: "G2" },                               // 반려동물용품 (직접 매핑 없음)
  "G47810": { sbizCodes: ["G21901"] },                                         // 꽃집
  "G47721": { sbizCodes: ["G21503"] },                                         // 화장품

  // ─── 미용/서비스 ───
  "S96112": { sbizCodes: ["S20701"] },                                         // 미용실
  "S96113": { sbizCodes: ["S20703"] },                                         // 네일숍
  "S96114": { sbizCodes: ["S20702"] },                                         // 피부관리실
  "S96121": { sbizCodes: ["S20801", "S20901"] },                               // 세탁소
  "S96911": { sbizCodes: [], sbizLclsCd: "S2" },                               // 반려동물미용 (직접 매핑 없음)

  // ─── 의료 ───
  "Q86211": { sbizCodes: ["Q10201", "Q10202", "Q10203", "Q10204", "Q10205", "Q10206"] }, // 일반의원 (내과~이비인후과)
  "Q86212": { sbizCodes: ["Q10210"] },                                         // 치과의원
  "Q86230": { sbizCodes: ["Q10211"] },                                         // 한의원
  "Q86241": { sbizCodes: ["G21501"] },                                         // 약국

  // ─── 건강 ───
  "R93191": { sbizCodes: ["R10307"] },                                         // 헬스클럽 → 헬스장
  "R93192": { sbizCodes: ["P10603"] },                                         // 요가/필라테스 → 요가학원

  // ─── 교육 ───
  "P85501": { sbizCodes: ["P10501"] },                                         // 학원 → 입시/교과학원
  "P85502": { sbizCodes: ["P10615"] },                                         // 어학원 → 외국어학원
  "P85503": { sbizCodes: ["P10613"] },                                         // 예체능 → 기타 예술/스포츠
  "P85509": { sbizCodes: ["P10627"] },                                         // 코딩/IT → 컴퓨터학원

  // ─── 부동산 ───
  "L68112": { sbizCodes: ["L10203"] },                                         // 부동산중개

  // ─── 자동차 ───
  "G45211": { sbizCodes: [], sbizLclsCd: "G4" },                               // 자동차부품
  "S95211": { sbizCodes: ["S20301"] },                                         // 자동차수리 → 정비소
  "I56130": { sbizCodes: ["S20302"] },                                         // 세차장

  // ─── 숙박 ───
  "I55101": { sbizCodes: ["I10101"] },                                         // 호텔
  "I55109": { sbizCodes: ["I10102", "I10103"] },                               // 모텔/게스트하우스

  // ─── 오락 ───
  "R91291": { sbizCodes: ["R10407"] },                                         // 노래방
  "R91241": { sbizCodes: ["R10310"] },                                         // 당구장
  "R91111": { sbizCodes: ["R10405"] },                                         // PC방 → 기타오락장

  // ─── 기타 ───
  "N76390": { sbizCodes: ["M11301"] },                                         // 스튜디오 → 사진촬영업
  "S95120": { sbizCodes: [], sbizLclsCd: "S2" },                               // 핸드폰수리
  "N75110": { sbizCodes: ["N10401", "N10402"] },                               // 인력파견
};

/**
 * 스팟리 industryCode에 대응하는 상가정보 필터 조건 반환
 *
 * @returns sbizCodes가 있으면 소분류 필터, 없으면 대분류 fallback, 둘 다 없으면 null
 */
export function getSbizFilter(industryCode: string): {
  type: "sclsCd" | "lclsCd";
  codes: string[];
} | null {
  const mapping = KSIC_TO_SBIZ[industryCode];
  if (!mapping) return null;

  if (mapping.sbizCodes.length > 0) {
    return { type: "sclsCd", codes: mapping.sbizCodes };
  }
  if (mapping.sbizLclsCd) {
    return { type: "lclsCd", codes: [mapping.sbizLclsCd] };
  }
  return null;
}
