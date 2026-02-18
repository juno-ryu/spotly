import * as realEstateClient from "./client";

export interface ApartmentTradeMetrics {
  transactionCount: number;
  avgPrice: number;
  trades: { price: number; area: number; floor: number; dealDate: string }[];
}

export async function fetchApartmentData(params: {
  regionCode: string;
  dealYm: string;
}): Promise<ApartmentTradeMetrics> {
  const data = await realEstateClient
    .getApartmentTransactions(params.regionCode, params.dealYm)
    .catch(() => null);

  const trades = data ?? [];
  const avgPrice = realEstateClient.calculateAveragePrice(trades);

  if (trades.length > 0) {
    console.log(
      `[아파트 실거래] 조회 성공: ${params.regionCode} ${params.dealYm} — ${trades.length}건, 평균 ${Math.round(avgPrice).toLocaleString()}만원`,
    );
  } else {
    console.log(`[아파트 실거래] 데이터 없음: ${params.regionCode} ${params.dealYm}`);
  }

  return {
    transactionCount: trades.length,
    avgPrice,
    trades: trades.map((t) => ({
      price: t.dealAmount,
      area: t.excluUseAr ?? 0,
      floor: t.floor ?? 0,
      dealDate: `${t.dealYear}${String(t.dealMonth).padStart(2, "0")}${String(t.dealDay ?? 1).padStart(2, "0")}`,
    })),
  };
}
