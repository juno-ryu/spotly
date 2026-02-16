import * as kosisClient from "@/server/data-sources/kosis-client";

export interface PopulationMetrics {
  totalPopulation: number;
  households: number;
  isDongLevel: boolean;
}

export async function fetchPopulationData(params: {
  adminDongCode?: string;
  regionCode: string;
}): Promise<PopulationMetrics | null> {
  const data = await kosisClient
    .getPopulationByDong(params.adminDongCode, params.regionCode)
    .catch(() => null);

  if (!data) {
    console.log(`[KOSIS 인구] 데이터 없음: ${params.adminDongCode ?? params.regionCode}`);
    return null;
  }

  console.log(
    `[KOSIS 인구] 조회 성공: ${params.adminDongCode ?? params.regionCode} — 인구 ${data.totalPopulation.toLocaleString()}명, ${data.households.toLocaleString()}세대`,
  );

  return {
    totalPopulation: data.totalPopulation,
    households: data.households,
    isDongLevel: data.isDongLevel ?? false,
  };
}
