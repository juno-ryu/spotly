import { z } from "zod";

const REAL_ESTATE_BASE_URL =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev";

const USE_MOCK =
  process.env.NODE_ENV === "development" && !process.env.DATA_GO_KR_API_KEY;

// ─── Zod 스키마 ───

/** 아파트 거래 내역 */
export const apartmentTradeSchema = z.object({
  /** 거래금액 (만원) */
  dealAmount: z.coerce.number(),
  /** 건축년도 */
  buildYear: z.coerce.number().optional(),
  /** 거래년도 */
  dealYear: z.coerce.number(),
  /** 거래월 */
  dealMonth: z.coerce.number(),
  /** 거래일 */
  dealDay: z.coerce.number().optional(),
  /** 아파트명 */
  aptNm: z.string().optional(),
  /** 전용면적 (m²) */
  excluUseAr: z.coerce.number().optional(),
  /** 층 */
  floor: z.coerce.number().optional(),
  /** 법정동 */
  umdNm: z.string().optional(),
});
export type ApartmentTrade = z.infer<typeof apartmentTradeSchema>;

// ─── XML 파서 (이 API는 JSON 미지원) ───

/** XML에서 <item>...</item> 블록 추출 후 각 필드를 객체로 변환 */
function parseXmlItems(xml: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const content = itemMatch[1];
    const obj: Record<string, string> = {};
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRegex.exec(content)) !== null) {
      obj[fieldMatch[1]] = fieldMatch[2].trim();
    }
    items.push(obj);
  }
  return items;
}

/** XML 아이템을 ApartmentTrade에 맞게 변환 */
function xmlItemToTrade(item: Record<string, string>) {
  return {
    dealAmount: parseInt((item.dealAmount ?? "0").replace(/,/g, ""), 10),
    buildYear: item.buildYear ? Number(item.buildYear) : undefined,
    dealYear: Number(item.dealYear),
    dealMonth: Number(item.dealMonth),
    dealDay: item.dealDay ? Number(item.dealDay) : undefined,
    aptNm: item.aptNm || undefined,
    excluUseAr: item.excluUseAr ? Number(item.excluUseAr) : undefined,
    floor: item.floor ? Number(item.floor) : undefined,
    umdNm: item.umdNm || undefined,
  };
}

// ─── API 함수 ───

/** 아파트 실거래가 조회 */
export async function getApartmentTransactions(
  lawdCd: string,
  dealYmd: string,
): Promise<ApartmentTrade[]> {
  if (USE_MOCK) {
    const mock = await import("./mock/real-estate.json");
    return z.array(apartmentTradeSchema).parse(mock.default.items);
  }

  const apiKey = process.env.DATA_GO_KR_API_KEY!;
  const url = `${REAL_ESTATE_BASE_URL}/getRTMSDataSvcAptTradeDev?serviceKey=${apiKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&pageNo=1&numOfRows=1000`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`부동산 API 오류: ${res.status}`);

  const xml = await res.text();

  // 에러 응답 체크
  const resultCode = xml.match(/<resultCode>(\d+)<\/resultCode>/)?.[1];
  if (resultCode && resultCode !== "000" && resultCode !== "00") {
    const resultMsg = xml.match(/<resultMsg>(.*?)<\/resultMsg>/)?.[1] ?? "";
    throw new Error(`부동산 API 에러: [${resultCode}] ${resultMsg}`);
  }

  const rawItems = parseXmlItems(xml);
  const trades = rawItems.map(xmlItemToTrade);

  return z.array(apartmentTradeSchema).parse(trades);
}

/** 평균 거래가 계산 (만원) */
export function calculateAveragePrice(trades: ApartmentTrade[]): number {
  if (trades.length === 0) return 0;
  const total = trades.reduce((sum, t) => sum + t.dealAmount, 0);
  return Math.round(total / trades.length);
}
