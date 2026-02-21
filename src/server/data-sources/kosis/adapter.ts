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

  console.log(
    `[KOSIS 인구] 조회 성공: ${params.adminDongCode ?? params.regionCode} — 인구 ${data.totalPopulation.toLocaleString()}명`,
  );

  return {
    totalPopulation: data.totalPopulation,
    isDongLevel: data.isDongLevel ?? false,
  };
}
