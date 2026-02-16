import { fetchNpsData, type NpsMetrics } from "./adapters/data-go-kr/nps-adapter";
import { fetchKakaoPlaces, type KakaoPlacesRaw, type KakaoPlace } from "./adapters/kakao/places-adapter";
import { fetchFranchiseBrands, type FranchiseMetrics } from "./adapters/franchise/franchise-adapter";
import { analyzeCompetition, type CompetitionAnalysis } from "./scoring";

export interface AnalysisResult {
  nps: NpsMetrics | null;
  /** 카카오 Places 원시 데이터 */
  places: KakaoPlacesRaw;
  /** 경쟁 분석 결과 (스코어링) */
  competition: CompetitionAnalysis;
  /** 공정위 프랜차이즈 데이터 (API 키 없거나 실패 시 null) */
  franchise: FranchiseMetrics | null;
  radius: number;
  industryCode: string;
  centerLatitude: number;
  centerLongitude: number;
  dongName?: string;
}

export type { KakaoPlace, KakaoPlacesRaw };

export async function runAnalysis(params: {
  latitude: number;
  longitude: number;
  regionCode: string;
  industryKeywords: string[];
  industryCode: string;
  industryName: string;
  radius: number;
  adminDongCode?: string;
  dongName?: string;
}): Promise<AnalysisResult> {
  // 1단계: 데이터 수집 — franchise + kakao + NPS 병렬 호출
  const [franchiseResult, placesRaw, nps] = await Promise.all([
    fetchFranchiseBrands(params.industryName, params.industryKeywords).catch(
      (err) => {
        console.warn("[Franchise] 조회 실패:", err);
        return null;
      },
    ),
    fetchKakaoPlaces({
      keyword: params.industryName,
      latitude: params.latitude,
      longitude: params.longitude,
      radius: params.radius,
    }),
    fetchNpsData({
      regionCode: params.regionCode,
      keywords: params.industryKeywords,
      industryCode: params.industryCode,
    }).catch((err) => {
      console.warn("[NPS] 조회 실패:", err);
      return null;
    }),
  ]);

  // 2단계: 경쟁 분석 (스코어링) — 원시 데이터 + 프랜차이즈 브랜드 기반
  const competition = analyzeCompetition({
    places: placesRaw.places,
    totalCount: placesRaw.totalCount,
    radius: params.radius,
    industryCode: params.industryCode,
    franchiseBrands: franchiseResult?.brands,
  });

  return {
    nps,
    places: placesRaw,
    competition,
    franchise: franchiseResult
      ? { brands: [...franchiseResult.brands], totalRegistered: franchiseResult.totalRegistered }
      : null,
    radius: params.radius,
    industryCode: params.industryCode,
    centerLatitude: params.latitude,
    centerLongitude: params.longitude,
    dongName: params.dongName,
  };
}
