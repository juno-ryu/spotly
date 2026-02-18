import * as golmokClient from "./client";
import type { GolmokAggregated } from "./client";

/** 상권 활력도 비즈니스 타입 — 서울 전용 */
export interface CommercialVitalityData {
  /** 분기 추정매출 (원) */
  estimatedQuarterlySales: number;
  /** 분기 매출 건수 */
  salesCount: number;
  /** 평일 매출 비율 (0~1) */
  weekdayRatio: number;
  /** 피크 시간대 (예: "17~21시") */
  peakTimeSlot: string;
  /** 피크 요일 */
  peakDay: string;
  /** 총 점포수 */
  storeCount: number;
  /** 개업률(%) — 절대 건수 기반 */
  openRate: number;
  /** 폐업률(%) — 절대 건수 기반 */
  closeRate: number;
  /** 프랜차이즈 점포수 */
  franchiseCount: number;
  /** 상권변화지표 코드 (HH/HL/LH/LL) */
  changeIndex: string | null;
  /** 상권변화지표명 (예: "다이나믹", "상권확장") */
  changeIndexName: string | null;
  /** 주 소비 연령대 */
  mainAgeGroup: string;
  /** 주 소비 성별 */
  mainGender: string;
  /** 유동인구 */
  floatingPopulation?: {
    totalFloating: number;
    maleRatio: number;
    peakTimeSlot: string;
    peakDay: string;
    mainAgeGroup: string;
  };
  /** 상주인구 */
  residentPopulation?: {
    totalResident: number;
    totalHouseholds: number;
  };
}

function toVitalityData(raw: GolmokAggregated): CommercialVitalityData {
  return {
    estimatedQuarterlySales: raw.estimatedQuarterlySales,
    salesCount: raw.salesCount,
    weekdayRatio: raw.weekdayRatio,
    peakTimeSlot: raw.peakTimeSlot,
    peakDay: raw.peakDay,
    storeCount: raw.storeCount,
    openRate: raw.openRate,
    closeRate: raw.closeRate,
    franchiseCount: raw.franchiseCount,
    changeIndex: raw.changeIndex ?? null,
    changeIndexName: raw.changeIndexName ?? null,
    mainAgeGroup: raw.mainAgeGroup,
    mainGender: raw.mainGender,
    floatingPopulation: raw.floatingPopulation,
    residentPopulation: raw.residentPopulation,
  };
}

/**
 * 서울 골목상권 데이터를 수집하여 활력도 지표로 변환.
 *
 * 호출 흐름:
 * 1. TbgisTrdarRelm (캐시 30일) → 좌표+반경 or 행정동코드 → 상권코드 매핑
 * 2. VwsmTrdarStorQq  → 상권코드별 URL 필터 (상권 수 × 1회)
 * 3. VwsmTrdarIxQq   (캐시 30일) → 상권코드 필터
 * 4. VwsmTrdarSelngQq (캐시 7일, 전체) → 상권코드+업종 필터
 *
 * 반경 기반 필터링으로 불필요한 상권 제외 → API 호출 최소화
 */
export async function fetchCommercialVitality(params: {
  industryKeyword: string;
  adminDongCode?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  quarter?: string;
}): Promise<CommercialVitalityData | null> {
  // 1단계: 반경 기반 우선, fallback으로 행정동코드 기반
  let areas: Awaited<ReturnType<typeof golmokClient.getTrdarsByLocation>>;

  if (params.latitude && params.longitude && params.radius) {
    areas = await golmokClient
      .getTrdarsByLocation({
        latitude: params.latitude,
        longitude: params.longitude,
        radius: params.radius,
      })
      .catch((err) => {
        console.warn("[서울 골목상권] 반경 기반 상권영역 조회 실패:", err);
        return [];
      });
  } else if (params.adminDongCode) {
    const seoulDongCode =
      params.adminDongCode.length === 10
        ? params.adminDongCode.substring(0, 8)
        : params.adminDongCode;
    areas = await golmokClient
      .getTrdarsByDongCode(seoulDongCode)
      .catch((err) => {
        console.warn("[서울 골목상권] 행정동 기반 상권영역 조회 실패:", err);
        return [];
      });
  } else {
    console.log("[서울 골목상권] 좌표/행정동코드 모두 미제공 → 스킵");
    return null;
  }

  if (areas.length === 0) {
    console.log("[서울 골목상권] 조건에 해당하는 상권 없음");
    return null;
  }

  const trdarCodes = areas.map((a) => a.trdarCd);
  console.log(
    `[서울 골목상권] 상권 ${areas.length}개: ${areas.map((a) => `${a.trdarNm}(${a.trdarCd})`).join(", ")}`,
  );

  // 2단계: 5개 API 병렬 호출
  const [stores, changeIndexes, sales, floatingPop, residentPop] =
    await Promise.all([
      golmokClient
        .getStoreStatus({
          quarter: params.quarter,
          industryKeyword: params.industryKeyword,
          trdarCodes,
        })
        .catch((err) => {
          console.warn("[서울 골목상권] 점포 조회 실패:", err);
          return [] as Awaited<ReturnType<typeof golmokClient.getStoreStatus>>;
        }),
      golmokClient
        .getChangeIndex({
          quarter: params.quarter,
          trdarCodes,
        })
        .catch((err) => {
          console.warn("[서울 골목상권] 변화지표 조회 실패:", err);
          return [] as Awaited<ReturnType<typeof golmokClient.getChangeIndex>>;
        }),
      golmokClient
        .getEstimatedSales({
          quarter: params.quarter,
          industryKeyword: params.industryKeyword,
          trdarCodes,
        })
        .catch((err) => {
          console.warn("[서울 골목상권] 매출 조회 실패:", err);
          return [] as Awaited<ReturnType<typeof golmokClient.getEstimatedSales>>;
        }),
      golmokClient
        .getFloatingPopulation({
          quarter: params.quarter,
          trdarCodes,
        })
        .catch((err) => {
          console.warn("[서울 골목상권] 유동인구 조회 실패:", err);
          return [] as Awaited<ReturnType<typeof golmokClient.getFloatingPopulation>>;
        }),
      golmokClient
        .getResidentPopulation({
          quarter: params.quarter,
          trdarCodes,
        })
        .catch((err) => {
          console.warn("[서울 골목상권] 상주인구 조회 실패:", err);
          return [] as Awaited<ReturnType<typeof golmokClient.getResidentPopulation>>;
        }),
    ]);

  console.log(
    `[서울 골목상권] 수집 완료: 매출 ${sales.length}건, 점포 ${stores.length}건, 변화지표 ${changeIndexes.length}건, 유동인구 ${floatingPop.length}건, 상주인구 ${residentPop.length}건`,
  );

  const aggregated = golmokClient.aggregateGolmokData(
    sales,
    stores,
    changeIndexes,
    floatingPop,
    residentPop,
  );

  if (!aggregated) {
    console.log(`[서울 골목상권] 집계 실패 (매출 0건): ${params.industryKeyword}`);
    return null;
  }

  console.log(
    `[서울 골목상권] 결과: ${params.industryKeyword} — 매출 ${Math.round(aggregated.estimatedQuarterlySales / 10000).toLocaleString()}만원, 점포 ${aggregated.storeCount}개, 개업률 ${aggregated.openRate}%/폐업률 ${aggregated.closeRate}%`,
  );

  return toVitalityData(aggregated);
}
