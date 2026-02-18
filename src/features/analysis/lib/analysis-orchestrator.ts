import { fetchKakaoPlaces, type KakaoPlacesRaw, type KakaoPlace } from "@/server/data-sources/kakao/adapter";
import { fetchCommercialVitality } from "@/server/data-sources/seoul-golmok/adapter";
import { analyzeCompetition, type CompetitionAnalysis } from "./scoring";
import { analyzeVitality, type VitalityAnalysis } from "./scoring/vitality";

export interface AnalysisResult {
  /** 카카오 Places 원시 데이터 */
  places: KakaoPlacesRaw;
  /** 경쟁 분석 결과 (스코어링) */
  competition: CompetitionAnalysis;
  /** 상권 활력도 분석 결과 (서울 전용, 비서울은 null) */
  vitality: VitalityAnalysis | null;
  radius: number;
  industryCode: string;
  centerLatitude: number;
  centerLongitude: number;
  dongName?: string;
  /** 서울 지역 여부 */
  isSeoul: boolean;
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
  const isSeoul = params.regionCode.startsWith("11");

  // 데이터 수집 — 카카오 Places + 서울 골목상권(서울만)
  const [placesRaw, vitalityData] = await Promise.all([
    fetchKakaoPlaces({
      keyword: params.industryName,
      latitude: params.latitude,
      longitude: params.longitude,
      radius: params.radius,
    }),
    isSeoul
      ? fetchCommercialVitality({
          industryKeyword: params.industryName,
          adminDongCode: params.adminDongCode,
          latitude: params.latitude,
          longitude: params.longitude,
          radius: params.radius,
        }).catch((err) => {
          console.warn("[오케스트레이터] 서울 골목상권 조회 실패:", err);
          return null;
        })
      : Promise.resolve(null),
  ]);

  // 경쟁 분석 (하드코딩 프랜차이즈 목록 기반, 외부 API 호출 없음)
  const competition = analyzeCompetition({
    places: placesRaw.places,
    totalCount: placesRaw.totalCount,
    radius: params.radius,
    industryCode: params.industryCode,
  });

  // 상권 활력도 분석 (서울 전용)
  const vitality = vitalityData ? analyzeVitality(vitalityData) : null;

  return {
    places: placesRaw,
    competition,
    vitality,
    radius: params.radius,
    industryCode: params.industryCode,
    centerLatitude: params.latitude,
    centerLongitude: params.longitude,
    dongName: params.dongName,
    isSeoul,
  };
}
