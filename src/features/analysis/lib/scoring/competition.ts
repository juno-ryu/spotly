import type { KakaoPlace } from "@/server/data-sources/kakao/adapter";
import { INDUSTRY_CODES } from "../../constants/industry-codes";
import { scoreToGrade, type CompetitionScore, type CompetitionAnalysis } from "./types";

/** densityBaseline 미등록 업종용 기본값 (미터) */
const DEFAULT_DENSITY_BASELINE = 250;

/**
 * 주요 프랜차이즈 브랜드 목록 (업종별, ~150개)
 *
 * 카카오 Places 상호명과 fuzzyMatch하여 프랜차이즈 여부를 판별한다.
 * 연 1~2회 수동 업데이트. 공정위 API 대비 즉시 응답 + 캐시 불필요.
 */
const FRANCHISE_BRANDS = [
  // ─── 치킨 ───
  "BBQ", "BHC", "교촌", "굽네", "네네", "페리카나", "처갓집",
  "호치킨", "맥시칸", "또래오래", "지코바", "노랑통닭", "치킨마루",
  "맛닭꼬", "바른치킨", "60계치킨", "푸라닭", "자담치킨", "깐부치킨",
  "멕시카나", "오븐마루", "불닭발", "당근치킨",

  // ─── 버거/패스트푸드/샌드위치 ───
  "맘스터치", "KFC", "맥도날드", "버거킹", "롯데리아", "파파이스",
  "쉐이크쉑", "노브랜드버거", "이삭토스트", "서브웨이",
  "맘스피자", "프랭크버거",

  // ─── 피자 ───
  "도미노", "피자헛", "피자스쿨", "미스터피자", "파파존스",
  "피자알볼로", "7번가피자", "오구피자", "반올림피자",

  // ─── 커피 ───
  "스타벅스", "이디야", "투썸플레이스", "투썸", "메가커피", "메가MGC",
  "컴포즈커피", "컴포즈", "빽다방", "할리스", "탐앤탐스", "커피빈",
  "폴바셋", "엔제리너스", "더벤티", "매머드커피", "매머드",
  "감성커피", "커피에반하다", "커피명가", "달콤커피",
  "드롭탑", "카페베네", "더카페",

  // ─── 음료/디저트/빙수 ───
  "공차", "쥬씨", "팔공티", "설빙", "디저트39",
  "배스킨라빈스", "배라", "나뚜루", "하겐다즈",

  // ─── 베이커리/제과 ───
  "파리바게뜨", "뚜레쥬르", "크리스피크림", "던킨",
  "삼송빵집", "성심당", "브레댄코",

  // ─── 한식/백반/국밥 ───
  "한솥", "본도시락", "새마을식당", "백종원", "더본",
  "명륜진사갈비", "역전우동", "홍콩반점", "본죽", "본죽&비빔밥",
  "놀부", "원할머니보쌈", "한신포차", "미소야",

  // ─── 분식 ───
  "신전떡볶이", "죠스떡볶이", "엽기떡볶이", "응급실떡볶이",
  "걸작떡볶이", "두끼", "국대떡볶이",
  "김밥천국", "바르다김선생", "김가네",

  // ─── 중식/일식/양식 ───
  "교동짬뽕", "짬뽕지존", "홍콩반점", "미정국수",
  "스시로", "쿠우쿠우", "하남돼지집",
  "빕스", "애슐리", "아웃백", "TGI", "매드포갈릭",

  // ─── 주점/포차 ───
  "이차돌", "역전할머니맥주", "생활맥주", "용용선생",
  "깍뚜기", "조선맥주", "새마을횟집",

  // ─── 편의점 ───
  "GS25", "CU", "세븐일레븐", "이마트24", "미니스톱",

  // ─── 마트/슈퍼 ───
  "이마트", "홈플러스", "롯데마트", "GS더프레시", "노브랜드",

  // ─── 미용/뷰티 ───
  "이가자헤어", "준오헤어", "박승철헤어", "리안헤어",
  "아이디헤어", "블루클럽", "이철헤어",
  "올리브영", "이니스프리", "아리따움", "미샤",

  // ─── 세탁 ───
  "크린토피아", "월드크리닝", "세탁특공대",

  // ─── 헬스/필라테스 ───
  "에니타임피트니스", "스포애니", "커브스", "짐박스",

  // ─── 반려동물 ───
  "아이펫", "펫모아", "동물병원24시",

  // ─── 교육/학원 ───
  "대교", "눈높이", "웅진", "재능교육", "빨간펜",
  "정상어학원", "YBM", "파고다", "해커스",
  "킹콩영어", "청담어학원", "이투스",

  // ─── 부동산 ───
  "ERA", "센추리21",

  // ─── 기타 서비스 ───
  "알파문구", "인생네컷", "하루필름", "포토이즘",
  "코인워시", "워시엔조이",
] as const;

/**
 * 공백 제거 + 소문자 비교로 프랜차이즈 매칭.
 * 한쪽이 다른 쪽을 포함하면 매칭 성공.
 */
function fuzzyMatchBrand(placeName: string, brandName: string): boolean {
  const a = placeName.toLowerCase().replace(/\s+/g, "");
  const b = brandName.toLowerCase().replace(/\s+/g, "");
  return a.includes(b) || b.includes(a);
}

/**
 * 프랜차이즈 U자형 점수 (0~100)
 *
 * 개인 창업자 관점에서 프랜차이즈 비율의 의미:
 * - 20~40%: 최적 (상권 검증됨 + 개인 매장 공존 가능) → 100점
 * - 0%: 상권 매력도 낮음 → 40점
 * - 80%+: 개인 매장 생존 어려움 → 0점
 */
const FRANCHISE_OPTIMAL_MIN = 0.2;
const FRANCHISE_OPTIMAL_MAX = 0.4;

function calculateFranchiseUCurve(franchiseRatio: number): number {
  if (franchiseRatio >= FRANCHISE_OPTIMAL_MIN && franchiseRatio <= FRANCHISE_OPTIMAL_MAX) {
    return 100;
  }
  if (franchiseRatio < FRANCHISE_OPTIMAL_MIN) {
    // 0% → 40점, 20% → 100점 (선형)
    return Math.round(40 + (franchiseRatio / FRANCHISE_OPTIMAL_MIN) * 60);
  }
  // 40% → 100점, 80%+ → 0점 (선형)
  const excess = (franchiseRatio - FRANCHISE_OPTIMAL_MAX) / (0.8 - FRANCHISE_OPTIMAL_MAX);
  return Math.round(Math.max(0, 100 * (1 - excess)));
}

/** 프랜차이즈 보정 가중치 (경쟁 점수 내 10%) */
const FRANCHISE_WEIGHT = 0.10;
const DENSITY_WEIGHT = 1 - FRANCHISE_WEIGHT; // 0.90

/**
 * 경쟁 강도 점수 계산 (0~100, 높을수록 경쟁 약함 = 유리)
 *
 * 복합 지표: 밀집도(75%) + 프랜차이즈 U커브(25%)
 * - 밀집도: 업종별 densityBaseline 대비 실제 밀집도
 * - 프랜차이즈: 비율 20~40% 최적, U자형 커브
 */
function calculateCompetitionScore(
  densityPerMeter: number,
  densityBaseline: number,
  franchiseRatio: number,
): CompetitionScore {
  // 비선형 커브(^2.0): 기준 이하(과밀) 구간에서 감점 강화
  const ratio = densityPerMeter <= 0 ? 0 : densityPerMeter / densityBaseline;
  const densityScore = Math.min(100, Math.pow(ratio, 2) * 100);

  const franchiseScore = calculateFranchiseUCurve(franchiseRatio);

  const score = Math.round(
    densityScore * DENSITY_WEIGHT + franchiseScore * FRANCHISE_WEIGHT,
  );

  const { grade, gradeLabel } = scoreToGrade(score);
  return { score, grade, gradeLabel };
}

/**
 * 카카오 Places 원시 데이터로부터 경쟁 분석을 수행한다.
 *
 * - 밀집도 계산 (업종별 densityBaseline 기반)
 * - 직접/간접 경쟁자 분류
 * - 프랜차이즈 감지 + U자형 점수 반영 (경쟁 점수의 15%)
 */
export function analyzeCompetition(params: {
  places: KakaoPlace[];
  totalCount: number;
  radius: number;
  industryCode: string;
  /** 공정위 API에서 가져온 프랜차이즈 브랜드 Set (없으면 하드코딩 fallback) */
  franchiseBrands?: Set<string>;
}): CompetitionAnalysis {
  const { places, totalCount, radius, industryCode, franchiseBrands } = params;

  // 업종 정보 조회
  const industry = INDUSTRY_CODES.find((i) => i.code === industryCode);
  const densityBaseline = industry?.densityBaseline ?? DEFAULT_DENSITY_BASELINE;

  // 밀집도 계산: √(π × 반경² / totalCount)
  const area = Math.PI * radius * radius;
  const densityPerMeter = totalCount > 0
    ? Math.round(Math.sqrt(area / totalCount))
    : 0;

  // 직접/간접 경쟁 분류
  const categoryKeywords = industry ? industry.keywords : [];
  const directCompetitors = places.filter((p) =>
    categoryKeywords.some((kw) => p.category.includes(kw)),
  );
  const directCompetitorCount = directCompetitors.length;
  const indirectCompetitorCount = places.length - directCompetitorCount;
  const directCompetitorRatio = places.length > 0
    ? directCompetitorCount / places.length
    : 0;

  // 프랜차이즈 감지 (팩트 데이터)
  const useExternalBrands = franchiseBrands && franchiseBrands.size > 0;
  const detectedBrandNames = new Set<string>();

  const franchises = places.filter((p) => {
    if (useExternalBrands) {
      for (const brand of franchiseBrands) {
        if (fuzzyMatchBrand(p.name, brand) || fuzzyMatchBrand(p.category, brand)) {
          detectedBrandNames.add(brand);
          return true;
        }
      }
      return false;
    }
    return FRANCHISE_BRANDS.some((brand) => {
      const matched = p.category.includes(brand) || p.name.includes(brand);
      if (matched) detectedBrandNames.add(brand);
      return matched;
    });
  });

  const franchiseCount = franchises.length;
  const franchiseRatio = places.length > 0
    ? franchiseCount / places.length
    : 0;

  // 경쟁 강도 점수 (밀집도 90% + 프랜차이즈 U커브 10%, 비선형 ^2.0)
  const competitionScore = calculateCompetitionScore(densityPerMeter, densityBaseline, franchiseRatio);

  return {
    densityPerMeter,
    densityBaseline,
    directCompetitorCount,
    indirectCompetitorCount,
    directCompetitorRatio,
    franchiseCount,
    franchiseRatio,
    franchiseBrandNames: [...detectedBrandNames],
    competitionScore,
  };
}
