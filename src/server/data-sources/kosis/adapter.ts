import { cachedFetch, CACHE_TTL } from "@/server/cache/redis";
import * as kosisClient from "./client";

export interface PopulationMetrics {
  totalPopulation: number;
  isDongLevel: boolean;
}

export async function fetchPopulationData(params: {
  adminDongCode?: string;
  regionCode: string;
}): Promise<PopulationMetrics | null> {
  const cacheKey = `kosis:population:${params.adminDongCode ?? params.regionCode}`;

  const data = await cachedFetch(cacheKey, CACHE_TTL.KOSIS, () =>
    kosisClient.getPopulationByDong(params.adminDongCode, params.regionCode),
  ).catch(() => null);

  if (!data) {
    console.log(`[KOSIS 인구] 데이터 없음: ${params.adminDongCode ?? params.regionCode}`);
    return null;
  }

  // 읍면동 수준 데이터가 아닌 시군구 fallback은 신뢰도 부족으로 거부
  if (!data.isDongLevel) {
    console.warn(`[KOSIS 인구] 읍면동 데이터 없음, 시군구 fallback 거부: ${params.adminDongCode ?? params.regionCode}`);
    return null;
  }

  console.log(
    `[KOSIS 인구] 조회 성공: ${params.adminDongCode ?? params.regionCode} — 인구 ${data.totalPopulation.toLocaleString()}명`,
  );

  return {
    totalPopulation: data.totalPopulation,
    isDongLevel: data.isDongLevel,
  };
}
