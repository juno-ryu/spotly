import { z } from "zod";
import { hasApiKey, env } from "@/lib/env";

const SEOUL_API_BASE = "http://openapi.seoul.go.kr:8088";

const USE_MOCK = !hasApiKey.seoul;

// ─── Zod 스키마 ───

/** 추정매출 (VwsmTrdarSelngQq, OA-15572) */
export const golmokSalesSchema = z.object({
  STDR_YYQU_CD: z.string(),
  TRDAR_CD: z.string(),
  TRDAR_CD_NM: z.string(),
  SVC_INDUTY_CD: z.string(),
  SVC_INDUTY_CD_NM: z.string(),
  /** 당월(분기) 매출 금액 */
  THSMON_SELNG_AMT: z.coerce.number(),
  /** 당월(분기) 매출 건수 */
  THSMON_SELNG_CO: z.coerce.number(),
  /** 주중 매출 */
  MDWK_SELNG_AMT: z.coerce.number(),
  MDWK_SELNG_CO: z.coerce.number(),
  /** 주말 매출 */
  WKEND_SELNG_AMT: z.coerce.number(),
  WKEND_SELNG_CO: z.coerce.number(),
  /** 요일별 매출 */
  MON_SELNG_AMT: z.coerce.number(),
  TUES_SELNG_AMT: z.coerce.number(),
  WED_SELNG_AMT: z.coerce.number(),
  THUR_SELNG_AMT: z.coerce.number(),
  FRI_SELNG_AMT: z.coerce.number(),
  SAT_SELNG_AMT: z.coerce.number(),
  SUN_SELNG_AMT: z.coerce.number(),
  /** 시간대별 매출 */
  TMZON_00_06_SELNG_AMT: z.coerce.number(),
  TMZON_06_11_SELNG_AMT: z.coerce.number(),
  TMZON_11_14_SELNG_AMT: z.coerce.number(),
  TMZON_14_17_SELNG_AMT: z.coerce.number(),
  TMZON_17_21_SELNG_AMT: z.coerce.number(),
  TMZON_21_24_SELNG_AMT: z.coerce.number(),
  /** 성별 매출 */
  ML_SELNG_AMT: z.coerce.number(),
  ML_SELNG_CO: z.coerce.number(),
  FML_SELNG_AMT: z.coerce.number(),
  FML_SELNG_CO: z.coerce.number(),
  /** 연령대별 매출 */
  AGRDE_10_SELNG_AMT: z.coerce.number(),
  AGRDE_20_SELNG_AMT: z.coerce.number(),
  AGRDE_30_SELNG_AMT: z.coerce.number(),
  AGRDE_40_SELNG_AMT: z.coerce.number(),
  AGRDE_50_SELNG_AMT: z.coerce.number(),
  AGRDE_60_ABOVE_SELNG_AMT: z.coerce.number(),
  AGRDE_10_SELNG_CO: z.coerce.number(),
  AGRDE_20_SELNG_CO: z.coerce.number(),
  AGRDE_30_SELNG_CO: z.coerce.number(),
  AGRDE_40_SELNG_CO: z.coerce.number(),
  AGRDE_50_SELNG_CO: z.coerce.number(),
  AGRDE_60_ABOVE_SELNG_CO: z.coerce.number(),
});
export type GolmokSales = z.infer<typeof golmokSalesSchema>;

/** 점포 (VwsmTrdarStorQq, OA-15577) */
export const golmokStoreSchema = z.object({
  STDR_YYQU_CD: z.string(),
  TRDAR_CD: z.string(),
  TRDAR_CD_NM: z.string(),
  SVC_INDUTY_CD: z.string(),
  SVC_INDUTY_CD_NM: z.string(),
  /** 점포수 */
  STOR_CO: z.coerce.number(),
  /** 유사업종 점포수 */
  SIMILR_INDUTY_STOR_CO: z.coerce.number(),
  /** 개업률(%) */
  OPBIZ_RT: z.coerce.number(),
  /** 개업 건수 */
  OPBIZ_STOR_CO: z.coerce.number(),
  /** 폐업률(%) */
  CLSBIZ_RT: z.coerce.number(),
  /** 폐업 건수 */
  CLSBIZ_STOR_CO: z.coerce.number(),
  /** 프랜차이즈 점포수 */
  FRC_STOR_CO: z.coerce.number(),
});
export type GolmokStore = z.infer<typeof golmokStoreSchema>;

/**
 * 상권변화지표 (VwsmTrdarIxQq, OA-15576)
 *
 * 등급 해석:
 * - LL: 생존·폐업 모두 낮음 (신규/재생 상권)
 * - LH: 생존 낮음·폐업 높음 (상권확장, 신규 업체에 유리)
 * - HL: 생존 높음·폐업 낮음 (기존 업체 강함, 진입장벽 높음)
 * - HH: 생존·폐업 모두 높음 (안정적이나 경쟁 치열)
 */
export const golmokChangeIndexSchema = z.object({
  STDR_YYQU_CD: z.string(),
  TRDAR_CD: z.string(),
  TRDAR_CD_NM: z.string(),
  /** 상권변화지표 등급 (HH/HL/LH/LL) */
  TRDAR_CHNGE_IX: z.string(),
  /** 상권변화지표 명칭 */
  TRDAR_CHNGE_IX_NM: z.string(),
  /** 생존 사업체 평균 영업기간(월) */
  OPR_SALE_MT_AVRG: z.coerce.number(),
  /** 폐업 사업체 평균 영업기간(월) */
  CLS_SALE_MT_AVRG: z.coerce.number(),
});
export type GolmokChangeIndex = z.infer<typeof golmokChangeIndexSchema>;

// ─── 서울시 Open API 응답 ───

/** 정상 응답: { "서비스명": { list_total_count, RESULT, row } } */
interface SeoulApiSuccessBody<T> {
  list_total_count: number;
  RESULT: { CODE: string; MESSAGE: string };
  row: T[];
}

/** 에러 응답: { "RESULT": { CODE, MESSAGE } } (최상위) */
interface SeoulApiErrorBody {
  RESULT: { CODE: string; MESSAGE: string };
}

/** 최근 분기 코드 반환 (데이터 반영 지연 감안: 현재 기준 2분기 전) */
function getRecentQuarterCode(): string {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setMonth(targetDate.getMonth() - 6);

  const year = targetDate.getFullYear();
  const quarter = Math.ceil((targetDate.getMonth() + 1) / 3);
  return `${year}${quarter}`;
}

/** 서울시 Open API 호출 공통 함수 */
async function fetchSeoulApi<T>(
  serviceName: string,
  start: number,
  end: number,
  quarterCode?: string,
): Promise<T[]> {
  const key = env.SEOUL_OPEN_API_KEY!;
  const qc = quarterCode ?? getRecentQuarterCode();
  const url = `${SEOUL_API_BASE}/${key}/json/${serviceName}/${start}/${end}/${qc}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`서울시 API 오류 (${serviceName}): ${res.status}`);

  const text = await res.text();

  // XML 에러 응답 처리 (인증키 오류 등에서 XML 반환)
  if (text.startsWith("<")) {
    const codeMatch = text.match(/<CODE>([^<]+)<\/CODE>/);
    const msgMatch = text.match(/<MESSAGE><!\[CDATA\[([^\]]+)\]\]><\/MESSAGE>/);
    const code = codeMatch?.[1] ?? "UNKNOWN";
    if (code === "INFO-200") return [];
    throw new Error(`서울시 API 오류 (${code}): ${msgMatch?.[1] ?? "XML 에러 응답"}`);
  }

  const data = JSON.parse(text);

  // 정상 응답: { "서비스명": { ... } }
  const serviceData = data[serviceName] as SeoulApiSuccessBody<T> | undefined;

  if (!serviceData) {
    // 에러 응답: { "RESULT": { CODE, MESSAGE } } (최상위)
    const errorBody = data as SeoulApiErrorBody;
    if (errorBody.RESULT?.CODE === "INFO-200") return []; // 데이터 없음
    throw new Error(
      `서울시 API 오류: ${errorBody.RESULT?.MESSAGE ?? "알 수 없는 응답"}`,
    );
  }

  if (serviceData.RESULT.CODE !== "INFO-000") {
    if (serviceData.RESULT.CODE === "INFO-200") return [];
    throw new Error(`서울시 API 오류: ${serviceData.RESULT.MESSAGE}`);
  }

  return serviceData.row;
}

// ─── 업종 키워드 매칭 ───

/** 우리 업종명 → 서울시 업종명 키워드 매칭 */
function matchesIndustry(
  seoulIndustryName: string,
  industryKeyword: string,
): boolean {
  const normalizedSeoul = seoulIndustryName.toLowerCase();
  const normalizedKeyword = industryKeyword.toLowerCase();

  // 직접 포함
  if (normalizedSeoul.includes(normalizedKeyword)) return true;
  if (normalizedKeyword.includes(normalizedSeoul)) return true;

  // 키워드별 동의어 매핑
  const KEYWORD_MAP: Record<string, string[]> = {
    "치킨": ["치킨", "닭"],
    "커피": ["커피", "음료", "카페"],
    "피자": ["피자"],
    "한식": ["한식", "백반", "국밥"],
    "분식": ["분식", "떡볶이"],
    "미용": ["미용", "헤어"],
    "편의점": ["편의점"],
  };

  for (const [key, synonyms] of Object.entries(KEYWORD_MAP)) {
    if (normalizedKeyword.includes(key)) {
      return synonyms.some((s) => normalizedSeoul.includes(s));
    }
  }

  return false;
}

// ─── API 함수 ───

/** 추정매출 조회 (업종명 키워드로 필터링) */
export async function getEstimatedSales(params: {
  quarter?: string;
  industryKeyword: string;
}): Promise<GolmokSales[]> {
  if (USE_MOCK) {
    const mock = await import("./mock/seoul-golmok-sales.json");
    const rows = z.array(golmokSalesSchema).parse(mock.default.row);
    return rows.filter((r) =>
      matchesIndustry(r.SVC_INDUTY_CD_NM, params.industryKeyword),
    );
  }

  const raw = await fetchSeoulApi<GolmokSales>(
    "VwsmTrdarSelngQq",
    1,
    1000,
    params.quarter,
  );
  const parsed = z.array(golmokSalesSchema).parse(raw);
  return parsed.filter((r) =>
    matchesIndustry(r.SVC_INDUTY_CD_NM, params.industryKeyword),
  );
}

/** 점포(개폐업) 조회 */
export async function getStoreStatus(params: {
  quarter?: string;
  industryKeyword: string;
}): Promise<GolmokStore[]> {
  if (USE_MOCK) {
    const mock = await import("./mock/seoul-golmok-store.json");
    const rows = z.array(golmokStoreSchema).parse(mock.default.row);
    return rows.filter((r) =>
      matchesIndustry(r.SVC_INDUTY_CD_NM, params.industryKeyword),
    );
  }

  const raw = await fetchSeoulApi<GolmokStore>(
    "VwsmTrdarStorQq",
    1,
    1000,
    params.quarter,
  );
  const parsed = z.array(golmokStoreSchema).parse(raw);
  return parsed.filter((r) =>
    matchesIndustry(r.SVC_INDUTY_CD_NM, params.industryKeyword),
  );
}

/** 상권변화지표 조회 */
export async function getChangeIndex(params: {
  quarter?: string;
}): Promise<GolmokChangeIndex[]> {
  if (USE_MOCK) {
    const mock = await import("./mock/seoul-golmok-change-index.json");
    return z.array(golmokChangeIndexSchema).parse(mock.default.row);
  }

  const raw = await fetchSeoulApi<GolmokChangeIndex>(
    "VwsmTrdarIxQq",
    1,
    1000,
    params.quarter,
  );
  return z.array(golmokChangeIndexSchema).parse(raw);
}

// ─── 데이터 집계 헬퍼 ───

/** 요일별 매출에서 피크 요일 반환 */
function findPeakDay(sales: GolmokSales): string {
  const days = [
    { name: "월요일", amount: sales.MON_SELNG_AMT },
    { name: "화요일", amount: sales.TUES_SELNG_AMT },
    { name: "수요일", amount: sales.WED_SELNG_AMT },
    { name: "목요일", amount: sales.THUR_SELNG_AMT },
    { name: "금요일", amount: sales.FRI_SELNG_AMT },
    { name: "토요일", amount: sales.SAT_SELNG_AMT },
    { name: "일요일", amount: sales.SUN_SELNG_AMT },
  ];
  return days.reduce((max, d) => (d.amount > max.amount ? d : max), days[0]).name;
}

/** 시간대별 매출에서 피크 시간대 반환 */
function findPeakTimeSlot(sales: GolmokSales): string {
  const slots = [
    { name: "00~06시", amount: sales.TMZON_00_06_SELNG_AMT },
    { name: "06~11시", amount: sales.TMZON_06_11_SELNG_AMT },
    { name: "11~14시", amount: sales.TMZON_11_14_SELNG_AMT },
    { name: "14~17시", amount: sales.TMZON_14_17_SELNG_AMT },
    { name: "17~21시", amount: sales.TMZON_17_21_SELNG_AMT },
    { name: "21~24시", amount: sales.TMZON_21_24_SELNG_AMT },
  ];
  return slots.reduce((max, s) => (s.amount > max.amount ? s : max), slots[0]).name;
}

/** 연령대별 매출에서 주 소비 연령대 반환 */
function findMainAgeGroup(sales: GolmokSales): string {
  const groups = [
    { name: "10대", amount: sales.AGRDE_10_SELNG_AMT },
    { name: "20대", amount: sales.AGRDE_20_SELNG_AMT },
    { name: "30대", amount: sales.AGRDE_30_SELNG_AMT },
    { name: "40대", amount: sales.AGRDE_40_SELNG_AMT },
    { name: "50대", amount: sales.AGRDE_50_SELNG_AMT },
    { name: "60대 이상", amount: sales.AGRDE_60_ABOVE_SELNG_AMT },
  ];
  return groups.reduce((max, g) => (g.amount > max.amount ? g : max), groups[0]).name;
}

/** 성별 매출에서 주 소비 성별 반환 */
function findMainGender(sales: GolmokSales): string {
  return sales.ML_SELNG_AMT > sales.FML_SELNG_AMT ? "남성" : "여성";
}

/** 골목상권 데이터 집계 결과 */
export interface GolmokAggregated {
  /** 분기 추정매출 (원) */
  estimatedQuarterlySales: number;
  /** 분기 건수 */
  salesCount: number;
  /** 평일/주말 매출 비율 (평일 매출 / 총 매출) */
  weekdayRatio: number;
  /** 피크 시간대 */
  peakTimeSlot: string;
  /** 피크 요일 */
  peakDay: string;
  /** 점포수 */
  storeCount: number;
  /** 유사업종 점포수 */
  similarStoreCount: number;
  /** 개업률(%) */
  openRate: number;
  /** 폐업률(%) */
  closeRate: number;
  /** 프랜차이즈 점포수 */
  franchiseCount: number;
  /** 상권변화지표 (HH/HL/LH/LL) */
  changeIndex?: string;
  /** 상권변화지표명 */
  changeIndexName?: string;
  /** 운영 사업체 평균 영업기간(월) */
  avgOperatingMonths?: number;
  /** 주 소비 연령대 */
  mainAgeGroup: string;
  /** 주 소비 성별 */
  mainGender: string;
}

/** 3개 API 응답을 단일 집계 객체로 변환 */
export function aggregateGolmokData(
  sales: GolmokSales[],
  stores: GolmokStore[],
  changeIndexes: GolmokChangeIndex[],
): GolmokAggregated | null {
  if (sales.length === 0) return null;

  // 매출 합산 (여러 상권 데이터 집계)
  const totalSales = sales.reduce((sum, s) => sum + s.THSMON_SELNG_AMT, 0);
  const totalCount = sales.reduce((sum, s) => sum + s.THSMON_SELNG_CO, 0);
  const totalMdwk = sales.reduce((sum, s) => sum + s.MDWK_SELNG_AMT, 0);

  // 대표 매출 데이터 (가장 매출이 높은 상권)
  const representativeSales = sales.reduce(
    (max, s) => (s.THSMON_SELNG_AMT > max.THSMON_SELNG_AMT ? s : max),
    sales[0],
  );

  // 점포 합산
  const totalStores = stores.reduce((sum, s) => sum + s.STOR_CO, 0);
  const totalSimilar = stores.reduce((sum, s) => sum + s.SIMILR_INDUTY_STOR_CO, 0);
  const totalFranchise = stores.reduce((sum, s) => sum + s.FRC_STOR_CO, 0);

  // 개폐업률 가중 평균
  const avgOpenRate =
    stores.length > 0
      ? stores.reduce((sum, s) => sum + s.OPBIZ_RT, 0) / stores.length
      : 0;
  const avgCloseRate =
    stores.length > 0
      ? stores.reduce((sum, s) => sum + s.CLSBIZ_RT, 0) / stores.length
      : 0;

  // 상권변화지표 (가장 빈번한 지표)
  const indexCounts = changeIndexes.reduce(
    (acc, ci) => {
      acc[ci.TRDAR_CHNGE_IX] = (acc[ci.TRDAR_CHNGE_IX] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const dominantIndex = Object.entries(indexCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const dominantChangeIndex = changeIndexes.find(
    (ci) => ci.TRDAR_CHNGE_IX === dominantIndex?.[0],
  );

  // 평균 영업기간
  const avgOperatingMonths =
    changeIndexes.length > 0
      ? changeIndexes.reduce((sum, ci) => sum + ci.OPR_SALE_MT_AVRG, 0) /
        changeIndexes.length
      : undefined;

  return {
    estimatedQuarterlySales: totalSales,
    salesCount: totalCount,
    weekdayRatio: totalSales > 0 ? totalMdwk / totalSales : 0.5,
    peakTimeSlot: findPeakTimeSlot(representativeSales),
    peakDay: findPeakDay(representativeSales),
    storeCount: totalStores,
    similarStoreCount: totalSimilar,
    openRate: Math.round(avgOpenRate * 10) / 10,
    closeRate: Math.round(avgCloseRate * 10) / 10,
    franchiseCount: totalFranchise,
    changeIndex: dominantChangeIndex?.TRDAR_CHNGE_IX,
    changeIndexName: dominantChangeIndex?.TRDAR_CHNGE_IX_NM,
    avgOperatingMonths:
      avgOperatingMonths != null
        ? Math.round(avgOperatingMonths * 10) / 10
        : undefined,
    mainAgeGroup: findMainAgeGroup(representativeSales),
    mainGender: findMainGender(representativeSales),
  };
}
