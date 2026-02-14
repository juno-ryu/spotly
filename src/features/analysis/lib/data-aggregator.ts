import { cachedFetch, CACHE_TTL } from "@/server/cache/redis";
import * as npsClient from "@/server/data-sources/nps-client";
import * as realEstateClient from "@/server/data-sources/real-estate-client";
import * as kosisClient from "@/server/data-sources/kosis-client";
import * as golmokClient from "@/server/data-sources/seoul-golmok-client";
import type { GolmokAggregated } from "@/server/data-sources/seoul-golmok-client";

/** 병합된 분석 데이터 */
export interface AggregatedData {
  /** 주변 사업장 (상태 포함) */
  businesses: AggregatedBusiness[];
  /** 아파트 거래 건수 */
  transactionCount: number;
  /** 평균 아파트 거래가 (만원) */
  avgApartmentPrice: number;
  /** 분석 반경 (m) */
  radius: number;
  /** 업종 코드 */
  industryCode: string;
  /** 분석 중심 위도 */
  centerLatitude: number;
  /** 분석 중심 경도 */
  centerLongitude: number;
  /** 인구 데이터 (KOSIS 통계청) */
  population?: {
    totalPopulation: number;
    households: number;
  };
  /** 서울시 골목상권 데이터 (서울 한정, 선택) */
  golmok?: GolmokAggregated;
}

export interface AggregatedBusiness {
  name: string;
  address: string;
  employeeCount: number;
  status: "active" | "suspended" | "closed";
  monthlyTrend: number[];
  businessNumber?: string;
  seq: string;
  /** 국민연금 가입일 (YYYYMMDD, 사업장 개업 시기 추정) */
  adptDt?: string;
}

/** fulfilled 결과만 추출 */
function extractFulfilled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

/** 부동산 실거래 데이터 기준 년월 (YYYYMM, 2~3개월 전) */
function getRecentDealYearMonth(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 3); // 실거래 데이터는 2~3개월 지연
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** NPS 가입상태 코드 → 상태 */
function toNpsStatus(stcd: string | undefined): "active" | "suspended" | "closed" {
  return stcd === "1" ? "active" : "closed";
}

/** 데이터 수집 + 병합 */
export async function aggregateAnalysisData(params: {
  latitude: number;
  longitude: number;
  regionCode: string;
  industryKeyword: string;
  industryCode: string;
  radius: number;
}): Promise<AggregatedData> {
  // 서울 여부 판별 (regionCode가 '11'로 시작하면 서울)
  const isSeoul = params.regionCode.startsWith("11");

  // 1단계: NPS 검색 + 부동산 + KOSIS + 골목상권(서울만) 병렬 호출
  const basePromises = [
    cachedFetch(
      `nps:search:${params.regionCode}:${params.industryKeyword}`,
      CACHE_TTL.NPS,
      () =>
        npsClient.searchBusinesses({
          regionCode: params.regionCode,
          keyword: params.industryKeyword,
        }),
    ),
    cachedFetch(
      `realestate:${params.regionCode}:${getRecentDealYearMonth()}`,
      CACHE_TTL.REAL_ESTATE,
      () =>
        realEstateClient.getApartmentTransactions(
          params.regionCode,
          getRecentDealYearMonth(),
        ),
    ),
    cachedFetch(
      `kosis:pop:${params.regionCode}`,
      CACHE_TTL.KOSIS,
      () => kosisClient.getPopulationByDistrict(params.regionCode),
    ),
  ] as const;

  // 서울 골목상권 3개 API (서울 지역만 호출)
  const golmokPromises = isSeoul
    ? ([
        cachedFetch(
          `golmok:sales:${params.industryKeyword}`,
          CACHE_TTL.SEOUL,
          () => golmokClient.getEstimatedSales({ industryKeyword: params.industryKeyword }),
        ),
        cachedFetch(
          `golmok:store:${params.industryKeyword}`,
          CACHE_TTL.SEOUL,
          () => golmokClient.getStoreStatus({ industryKeyword: params.industryKeyword }),
        ),
        cachedFetch(
          `golmok:change`,
          CACHE_TTL.SEOUL,
          () => golmokClient.getChangeIndex({}),
        ),
      ] as const)
    : null;

  const [baseResults, golmokResults] = await Promise.all([
    Promise.allSettled(basePromises),
    golmokPromises ? Promise.allSettled(golmokPromises) : Promise.resolve(null),
  ]);

  const [npsResult, realEstateResult, kosisResult] = baseResults;

  // 실패 시 원인 로깅
  if (npsResult.status === "rejected") console.error("[NPS 실패]", npsResult.reason);
  if (realEstateResult.status === "rejected") console.error("[부동산 실패]", realEstateResult.reason);
  if (kosisResult.status === "rejected") console.error("[KOSIS 실패]", kosisResult.reason);

  const npsData = extractFulfilled(npsResult);
  const realEstateData = extractFulfilled(realEstateResult);
  const kosisData = extractFulfilled(kosisResult);

  // 골목상권 데이터 집계 (서울 한정)
  let golmokData: GolmokAggregated | undefined;
  if (golmokResults) {
    const [salesResult, storeResult, changeResult] = golmokResults;
    if (salesResult.status === "rejected") console.error("[골목상권-매출 실패]", salesResult.reason);
    if (storeResult.status === "rejected") console.error("[골목상권-점포 실패]", storeResult.reason);
    if (changeResult.status === "rejected") console.error("[골목상권-변화지표 실패]", changeResult.reason);

    const sales = extractFulfilled(salesResult) ?? [];
    const stores = extractFulfilled(storeResult) ?? [];
    const changes = extractFulfilled(changeResult) ?? [];

    golmokData = golmokClient.aggregateGolmokData(sales, stores, changes) ?? undefined;
  }

  const rawBusinesses = npsData?.items ?? [];

  // 2단계: 상위 20개 사업장 상세 + 추이 동시 병렬 조회
  const top20 = rawBusinesses.slice(0, 20);
  const [detailResults, trendResults] = await Promise.all([
    Promise.allSettled(
      top20.map((b) =>
        cachedFetch(`nps:detail:${b.seq}`, CACHE_TTL.NPS, () =>
          npsClient.getBusinessDetail(b.seq),
        ),
      ),
    ),
    Promise.allSettled(
      top20.map((b) =>
        cachedFetch(`nps:trend:${b.seq}`, CACHE_TTL.NPS, () =>
          npsClient.getMonthlyTrend(b.seq, 12),
        ),
      ),
    ),
  ]);

  // 상세정보에서 직원수 + 가입일 추출
  const details = detailResults.map((r) => {
    if (r.status === "fulfilled" && r.value) {
      return {
        employeeCount: r.value.jnngpCnt ?? 0,
        adptDt: r.value.adptDt,
      };
    }
    return { employeeCount: 0, adptDt: undefined };
  });

  // 추이에서 순변동(신규-퇴사) 추출
  const monthlyTrends: number[][] = trendResults.map((r, i) => {
    const currentCount = details[i]?.employeeCount ?? 0;
    if (r.status === "fulfilled" && r.value.length > 0) {
      const trend = r.value[0];
      const netChange = trend.nwAcqzrCnt - trend.lssJnngpCnt;
      return [Math.max(0, currentCount - netChange), currentCount];
    }
    return currentCount > 0 ? [currentCount] : [];
  });

  // 4단계: 사업장 데이터 병합
  const businesses: AggregatedBusiness[] = rawBusinesses.map((b, i) => {
    const status = toNpsStatus(b.wkplJnngStcd);

    return {
      name: b.wkplNm,
      address: b.wkplRoadNmDtlAddr ?? "",
      employeeCount: i < 20 ? (details[i]?.employeeCount ?? 0) : 0,
      status,
      monthlyTrend: i < 20 ? (monthlyTrends[i] ?? []) : [],
      businessNumber: b.bzowrRgstNo,
      seq: b.seq,
      adptDt: i < 20 ? details[i]?.adptDt : undefined,
    };
  });

  // 부동산 통계
  const trades = realEstateData ?? [];
  const avgApartmentPrice = realEstateClient.calculateAveragePrice(trades);

  return {
    businesses,
    transactionCount: trades.length,
    avgApartmentPrice,
    radius: params.radius,
    industryCode: params.industryCode,
    centerLatitude: params.latitude,
    centerLongitude: params.longitude,
    population: kosisData ?? undefined,
    golmok: golmokData,
  };
}
