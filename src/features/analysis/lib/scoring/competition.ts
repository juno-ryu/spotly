import type { KakaoPlace } from "../adapters/kakao/places-adapter";
import { INDUSTRY_CODES } from "../../constants/industry-codes";
import type { CompetitionScore, CompetitionAnalysis } from "./types";

/** densityBaseline 미등록 업종용 기본값 (미터) */
const DEFAULT_DENSITY_BASELINE = 250;

/** 프랜차이즈 브랜드 목록 (공정위 API 미사용 시 fallback) */
const FRANCHISE_BRANDS_FALLBACK = [
  "BBQ", "BHC", "교촌", "굽네", "네네", "페리카나", "처갓집",
  "호치킨", "맥시칸", "또래오래", "지코바", "노랑통닭", "명가통닭",
  "맘스터치", "KFC", "파파이스", "피자스쿨", "도미노", "피자헛",
  "스타벅스", "이디야", "투썸", "메가커피", "컴포즈", "빽다방",
  "GS25", "CU", "세븐일레븐", "이마트24",
  "치킨마루", "맛닭꼬", "하이덴",
];

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

  let grade: string;
  let gradeLabel: string;
  if (score >= 80) { grade = "A"; gradeLabel = "경쟁 매우 낮음"; }
  else if (score >= 60) { grade = "B"; gradeLabel = "경쟁 낮음"; }
  else if (score >= 40) { grade = "C"; gradeLabel = "경쟁 보통"; }
  else if (score >= 20) { grade = "D"; gradeLabel = "경쟁 높음"; }
  else { grade = "F"; gradeLabel = "경쟁 매우 높음"; }

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
    return FRANCHISE_BRANDS_FALLBACK.some((brand) => {
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
