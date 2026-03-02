import { fetchKakaoPlaces, type KakaoPlacesRaw, type KakaoPlace } from "@/server/data-sources/kakao/adapter";
import { fetchCommercialVitality } from "@/server/data-sources/seoul-golmok/adapter";
import { fetchPopulationData, type PopulationMetrics } from "@/server/data-sources/kosis/adapter";
import { fetchSubwayAnalysis, type SubwayAnalysis } from "@/server/data-sources/subway/adapter";
import { fetchBusAnalysis, type BusAnalysis } from "@/server/data-sources/bus/adapter";
import { analyzeCompetition, type CompetitionAnalysis, analyzePopulation, type PopulationAnalysis } from "./scoring";
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
  /** KOSIS 인구 데이터 (전국, 없으면 null) */
  population: PopulationMetrics | null;
  /** KOSIS 인구 분석 결과 (전국, 없으면 null) */
  populationAnalysis: PopulationAnalysis | null;
  /** 지하철 역세권 분석 (전국, 없으면 null) */
  subway: SubwayAnalysis | null;
  /** 버스 접근성 분석 (전국, 없으면 null) */
  bus: BusAnalysis | null;
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

  // 데이터 수집 — 카카오 Places + 서울 골목상권(서울만) + KOSIS 인구(전국) + 지하철(전국) + 버스(전국)
  const [placesRaw, vitalityData, populationData, subwayData, busData] = await Promise.all([
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
    // KOSIS 인구 조회는 서울/비서울 구분 없이 전국 실행
    fetchPopulationData({
      adminDongCode: params.adminDongCode,
      regionCode: params.regionCode,
    }).catch((err) => {
      console.warn("[오케스트레이터] KOSIS 인구 조회 실패:", err);
      return null;
    }),
    // 지하철 역세권 분석 (전국 — 수도권 지하철 커버)
    fetchSubwayAnalysis({
      latitude: params.latitude,
      longitude: params.longitude,
    }).catch((err) => {
      console.warn("[오케스트레이터] 지하철 역세권 분석 실패:", err);
      return null;
    }),
    // 버스 접근성 분석 (전국)
    fetchBusAnalysis({
      latitude: params.latitude,
      longitude: params.longitude,
    }).catch((err) => {
      console.warn("[오케스트레이터] 버스 접근성 분석 실패:", err);
      return null;
    }),
  ]);

  // 경쟁 분석 (하드코딩 프랜차이즈 목록 기반, 외부 API 호출 없음)
  const competition = analyzeCompetition({
    places: placesRaw.places,
    totalCount: placesRaw.totalCount,
    radius: params.radius,
    industryCode: params.industryCode,
  });

  // 상권 활력도 분석 (서울 골목상권 데이터 있을 때만 산출, subway는 보강 역할)
  // 비서울 지역에서 subway만으로 vitality를 생성하지 않음:
  // vitality는 매출/점포/상권변화 기반 지표이며, subway 단독으로는 의미 부족.
  // subway 데이터는 별도 인사이트(역세권 아코디언)로 제공.
  const vitality = vitalityData
    ? analyzeVitality(vitalityData, subwayData)
    : null;

  // 인구 분석 (전국)
  const populationAnalysis = populationData ? analyzePopulation(populationData) : null;

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
    population: populationData,
    populationAnalysis,
    subway: subwayData,
    bus: busData,
  };
}
