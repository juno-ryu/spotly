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

  // 짧은 브랜드명(3자 이하)은 정확 매칭으로 오탐 방지
  // 예: "CU", "BBQ", "굽네" 등이 무관한 매장명에 포함되는 것을 방지
  if (b.length <= 3) {
    return a === b;
  }

  // 4자 이상 브랜드명은 매장명에 포함되면 매칭
  return a.includes(b);
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
    // 0% → 25점, 20% → 100점 (선형)
    return Math.round(25 + (franchiseRatio / FRANCHISE_OPTIMAL_MIN) * 75);
  }
  // 40% → 100점, 80%+ → 0점 (선형)
  const excess = (franchiseRatio - FRANCHISE_OPTIMAL_MAX) / (0.8 - FRANCHISE_OPTIMAL_MAX);
  return Math.round(Math.max(0, 100 * (1 - excess)));
}

/** 가중치: 밀집도 75%, 프랜차이즈 U커브 25% */
const FRANCHISE_WEIGHT = 0.25;
const DENSITY_WEIGHT = 0.75;

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
  /** 업종 카테고리 — 비프랜차이즈 업종은 U커브 적용 제외 */
  industryCategory?: string,
): CompetitionScore {
  // V-02: 경쟁 0개 → 중립 50점 (블루오션도 위험도 아닌 불확실 상태)
  if (densityPerMeter === 0) {
    const { grade, gradeLabel } = scoreToGrade(50);
    return { score: 50, grade, gradeLabel };
  }

  // 시그모이드 커브: ratio=1일 때 50점, ratio=2일 때 ~88점, ratio=0.5일 때 ~12점
  // ratio = densityPerMeter / densityBaseline (클수록 경쟁 적음 = 유리)
  const ratio = densityPerMeter / densityBaseline;
  const densityScore = Math.round(100 / (1 + Math.exp(-4 * (ratio - 1))));

  // 비프랜차이즈 업종: 프랜차이즈 U커브 대신 50점(중립) 고정 (박사님 승인 2026-03-15)
  // - 의료/부동산: 기존 (M-10)
  // - 교육/서비스/건강/오락: 신규 추가 — 프랜차이즈 구조가 일반 소매업과 달라 U커브 왜곡 발생
  const NON_FRANCHISE_CATEGORIES = new Set([
    "의료", "부동산", "교육", "서비스", "건강", "오락",
  ]);
  const isNonFranchiseIndustry = industryCategory
    ? NON_FRANCHISE_CATEGORIES.has(industryCategory)
    : false;
  const franchiseScore = isNonFranchiseIndustry
    ? 50
    : calculateFranchiseUCurve(franchiseRatio);

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

  // 경쟁 강도 점수 (밀집도 75% + 프랜차이즈 U커브 25%)
  // 의료/부동산 업종은 프랜차이즈 U커브 대신 50점 중립값 적용 (M-10)
  let competitionScore = calculateCompetitionScore(densityPerMeter, densityBaseline, franchiseRatio, industry?.category);

  // V-03: 소수 표본 보정 — totalCount < 5이면 50점(중립)으로 수렴
  // totalCount=1 → score×0.2 + 50×0.8, totalCount=4 → score×0.8 + 50×0.2
  if (totalCount > 0 && totalCount < 5) {
    const confidence = totalCount / 5;
    const adjustedScore = Math.round(
      competitionScore.score * confidence + 50 * (1 - confidence)
    );
    const { grade, gradeLabel } = scoreToGrade(adjustedScore);
    competitionScore = { score: adjustedScore, grade, gradeLabel };
  }

  // V-09: 프랜차이즈 0% 차별화 — 충분한 표본에서 프랜차이즈 없음 = 독립 상권
  // totalCount >= 10이고 franchiseRatio=0이면 독립 상권으로 판단 → 45점
  if (totalCount >= 10 && franchiseRatio === 0) {
    const ratio = densityPerMeter / densityBaseline;
    const densityScore = Math.round(100 / (1 + Math.exp(-4 * (ratio - 1))));
    const adjustedScore = Math.round(densityScore * 0.75 + 45 * 0.25);
    const { grade, gradeLabel } = scoreToGrade(adjustedScore);
    competitionScore = { score: adjustedScore, grade, gradeLabel };
  }

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
