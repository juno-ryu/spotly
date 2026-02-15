import { redirect } from "next/navigation";
import * as npsClient from "@/server/data-sources/nps-client";
import * as realEstateClient from "@/server/data-sources/real-estate-client";
import * as kosisClient from "@/server/data-sources/kosis-client";
import { getRecentDealYearMonth } from "@/features/analysis/lib/data-aggregator";
import { RadiusSettingStep } from "@/features/map/components/radius-setting-step";

/** Step 5: 반경 설정 + 경쟁업체 (서버 컴포넌트) */
export default async function RadiusPage({
  searchParams,
}: {
  searchParams: Promise<{
    districtCode?: string;
    dongName?: string;
    industryCode?: string;
    industryName?: string;
    lat?: string;
    lng?: string;
    address?: string;
    zoom?: string;
  }>;
}) {
  const params = await searchParams;

  // 필수 파라미터 검증 — 없으면 홈으로 리다이렉트
  if (!params.districtCode || !params.industryCode || !params.lat || !params.lng) {
    redirect("/");
  }

  const districtCode = params.districtCode;
  const industryName = params.industryName ?? "";
  const dongName = params.dongName || null;
  const dealYearMonth = getRecentDealYearMonth();

  const displayAddress = params.address ?? `${params.lat}, ${params.lng}`;
  console.log(`\n[/radius] ──── 서버 데이터 fetch 시작 ────`);
  console.log(`[/radius] 📍 ${displayAddress} (법정동코드: ${districtCode}, 동: ${dongName ?? "없음"})`);
  console.log(`[/radius] 🏷️ 업종: ${industryName} (코드: ${params.industryCode})`);

  // ── Wave 1: 기본 데이터 (3개 병렬) ──
  const [npsResult, realEstateResult, kosisResult] = await Promise.allSettled([
    npsClient.searchBusinesses({
      regionCode: districtCode,
      keyword: industryName,
    }),
    realEstateClient.getApartmentTransactions(districtCode, dealYearMonth),
    kosisClient.getPopulationByDistrict(districtCode),
  ]);

  console.log(`[/radius] NPS: ${npsResult.status === "fulfilled" ? `✅ "${industryName}" 관련 사업장 ${npsResult.value.totalCount}건 (${districtCode})` : `❌ ${npsResult.reason}`}`);
  console.log(`[/radius] 부동산: ${realEstateResult.status === "fulfilled" ? `✅ ${districtCode} ${dealYearMonth} 아파트 실거래 ${realEstateResult.value.length}건` : `❌ ${realEstateResult.reason}`}`);
  console.log(`[/radius] KOSIS: ${kosisResult.status === "fulfilled" ? `✅ ${districtCode} 인구 ${kosisResult.value.totalPopulation.toLocaleString()}명` : `❌ ${kosisResult.reason}`}`);

  // NPS 기본 집계
  const npsItems = npsResult.status === "fulfilled" ? npsResult.value.items : [];
  const npsTotalCount = npsResult.status === "fulfilled" ? npsResult.value.totalCount : 0;
  const activeItems = npsItems.filter((b) => b.wkplJnngStcd === "1");
  const npsActiveCount = activeItems.length;

  // ── Wave 2: NPS 상세(직원수) + 월별 추이(고용 변동) ──
  const targetItems = activeItems.slice(0, 5);
  let avgEmployeeCount = 0;
  let employeeGrowthRate: number | null = null;

  if (targetItems.length > 0) {
    const [detailResults, trendResults] = await Promise.all([
      Promise.allSettled(
        targetItems.map((b) => npsClient.getBusinessDetail(b.seq)),
      ),
      Promise.allSettled(
        targetItems.slice(0, 3).map((b) => npsClient.getMonthlyTrend(b.seq, 6)),
      ),
    ]);

    // 평균 직원수
    const details = detailResults
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof npsClient.getBusinessDetail>>> =>
        r.status === "fulfilled" && r.value != null,
      )
      .map((r) => r.value!);

    const totalEmployees = details.reduce((sum, d) => sum + (d.jnngpCnt ?? 0), 0);
    avgEmployeeCount = details.length > 0 ? Math.round(totalEmployees / details.length) : 0;

    // 고용 변동 추이 (최근 6개월)
    let totalNewHires = 0;
    let totalDepartures = 0;
    for (const result of trendResults) {
      if (result.status === "fulfilled") {
        for (const item of result.value) {
          totalNewHires += item.nwAcqzrCnt;
          totalDepartures += item.lssJnngpCnt;
        }
      }
    }

    if (totalNewHires > 0 || totalDepartures > 0) {
      const netChange = totalNewHires - totalDepartures;
      const estimatedPrevious = totalEmployees - netChange;
      employeeGrowthRate = estimatedPrevious > 0
        ? Math.round((netChange / estimatedPrevious) * 100)
        : netChange > 0 ? 100 : 0;
    }

    console.log(`[/radius] 📊 NPS 상세: 평균 직원수 ${avgEmployeeCount}명 (${details.length}개 사업장)`);
    console.log(`[/radius] 📊 고용 변동: 신규 ${totalNewHires}명 / 퇴사 ${totalDepartures}명 → ${employeeGrowthRate != null ? `${employeeGrowthRate > 0 ? "+" : ""}${employeeGrowthRate}%` : "데이터 없음"}`);
  }

  // 아파트 거래: 동 단위 필터링
  const allTrades = realEstateResult.status === "fulfilled" ? realEstateResult.value : [];
  const dongTrades = dongName
    ? allTrades.filter((t) => t.umdNm === dongName)
    : allTrades;

  console.log(`[/radius] 🏠 아파트 거래: ${dongName ?? districtCode} ${dongTrades.length}건 / ${districtCode} 전체 ${allTrades.length}건`);

  // 서버 데이터 정리 → props
  const serverData = {
    npsTotalCount,
    npsActiveCount,
    avgEmployeeCount,
    employeeGrowthRate,
    transactionCount: dongTrades.length,
    avgAptPrice: realEstateClient.calculateAveragePrice(dongTrades),
    districtTransactionCount: allTrades.length,
    population: kosisResult.status === "fulfilled" ? kosisResult.value : null,
    dongName,
  };

  return (
    <RadiusSettingStep
      centerLat={Number(params.lat)}
      centerLng={Number(params.lng)}
      address={params.address ?? `${params.lat}, ${params.lng}`}
      industryCode={params.industryCode}
      industryName={industryName}
      districtCode={districtCode}
      zoom={params.zoom ? Number(params.zoom) : undefined}
      serverData={serverData}
    />
  );
}
