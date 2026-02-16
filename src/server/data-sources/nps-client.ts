import { z } from "zod";
import type { DataGoKrResponse } from "./types";

const NPS_BASE_URL =
  "https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2";

const USE_MOCK =
  process.env.NODE_ENV === "development" && !process.env.DATA_GO_KR_API_KEY;

// data.go.kr은 User-Agent 없으면 502 반환
const FETCH_HEADERS = { "User-Agent": "Mozilla/5.0" } as const;

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 250;
const MAX_DELAY_MS = 1500;

/** 지수 백오프 + 지터: 재시도 간격 최적화 */
function getBackoffDelay(attempt: number): number {
  const exponential = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, MAX_DELAY_MS);
  return Math.round(capped * (0.5 + Math.random() * 0.5));
}

/** data.go.kr 간헐적 502 대응 — 지수 백오프 재시도 */
async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS });
      if (res.ok) return res;

      // 502/503은 data.go.kr 일시적 오류 → 재시도
      if ((res.status === 502 || res.status === 503) && attempt < MAX_RETRIES) {
        const delay = getBackoffDelay(attempt);
        console.warn(`[NPS] ${res.status} 오류 (${attempt}/${MAX_RETRIES}), ${delay}ms 후 재시도`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw new Error(`NPS API 오류: ${res.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        const delay = getBackoffDelay(attempt);
        console.warn(`[NPS] 요청 실패 (${attempt}/${MAX_RETRIES}), ${delay}ms 후 재시도`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError ?? new Error("NPS API 호출 실패");
}

// ─── Zod 스키마 ───

/** 사업장 기본 정보 (검색 결과) */
export const npsBusinessSchema = z.object({
  seq: z.coerce.string(),
  wkplNm: z.string(),                          // 사업장명
  bzowrRgstNo: z.string().optional(),           // 사업자등록번호 (마스킹됨)
  wkplRoadNmDtlAddr: z.string().optional(),     // 도로명 주소
  ldongAddrMgplDgCd: z.string().optional(),     // 시도 코드 (2자리)
  ldongAddrMgplSgguCd: z.string().optional(),   // 시군구 코드 (3자리)
  ldongAddrMgplSgguEmdCd: z.string().optional(),// 읍면동 코드
  wkplJnngStcd: z.string().optional(),          // 가입상태 (1=가입, 2=탈퇴)
  wkplStylDvcd: z.string().optional(),          // 사업장형태 (1=법인, 2=개인)
  dataCrtYm: z.string().optional(),             // 데이터 생성 년월
});
export type NpsBusiness = z.infer<typeof npsBusinessSchema>;

/** 사업장 상세 정보 */
export const npsDetailSchema = z.object({
  seq: z.coerce.string(),
  wkplNm: z.string(),
  bzowrRgstNo: z.string().optional(),
  jnngpCnt: z.coerce.number().optional(),       // 가입자 수 (직원 수)
  crrmmNtcAmt: z.coerce.number().optional(),    // 당월 고지금액
  wkplRoadNmDtlAddr: z.string().optional(),
  vldtVlKrnNm: z.string().optional(),           // 업종명
  wkplIntpCd: z.string().optional(),            // 업종코드
  adptDt: z.string().optional(),                // 적용일 (가입일)
  scsnDt: z.string().optional(),                // 탈퇴일
  wkplJnngStcd: z.string().optional(),          // 가입상태
  ldongAddrMgplDgCd: z.string().optional(),
  ldongAddrMgplSgguCd: z.string().optional(),
  ldongAddrMgplSgguEmdCd: z.string().optional(),
  wkplStylDvcd: z.string().optional(),
});
export type NpsDetail = z.infer<typeof npsDetailSchema>;

/** 월별 가입자 변동 현황 */
export const npsTrendItemSchema = z.object({
  nwAcqzrCnt: z.coerce.number(),   // 신규 가입자 수
  lssJnngpCnt: z.coerce.number(),  // 퇴사자 수
});
export type NpsTrendItem = z.infer<typeof npsTrendItemSchema>;

// ─── API 함수 ───

/**
 * 사업장 검색
 * @param regionCode 5자리 시군구코드 (앞2=시도, 뒤3=시군구)
 */
export async function searchBusinesses(params: {
  regionCode: string;
  keyword?: string;
  page?: number;
  size?: number;
}): Promise<{ items: NpsBusiness[]; totalCount: number }> {
  if (USE_MOCK) {
    const mock = await import("./mock/nps-search.json");
    const items = z.array(npsBusinessSchema).parse(mock.default.items);
    return { items, totalCount: items.length };
  }

  // 5자리 시군구코드를 시도(2) + 시군구(3)로 분리
  const sidoCode = params.regionCode.substring(0, 2);
  const sgguCode = params.regionCode.substring(2, 5);

  const url = new URL(`${NPS_BASE_URL}/getBassInfoSearchV2`);
  url.searchParams.set("serviceKey", process.env.DATA_GO_KR_API_KEY!);
  url.searchParams.set("ldongAddrMgplDgCd", sidoCode);
  url.searchParams.set("ldongAddrMgplSgguCd", sgguCode);
  if (params.keyword) {
    url.searchParams.set("wkplNm", params.keyword);
  }
  url.searchParams.set("pageNo", String(params.page ?? 1));
  url.searchParams.set("numOfRows", String(params.size ?? 100));
  url.searchParams.set("dataType", "json");

  console.log(`[API 요청] NPS 사업장 검색 — 시도:${sidoCode} 시군구:${sgguCode} 키워드:"${params.keyword ?? "전체"}"`);
  const res = await fetchWithRetry(url.toString());
  const data: DataGoKrResponse<NpsBusiness> = await res.json();
  const rawItems = data.response.body.items?.item ?? [];
  // 단건 응답 시 배열이 아닌 객체로 올 수 있음
  const itemArray = Array.isArray(rawItems) ? rawItems : [rawItems];
  const items = z.array(npsBusinessSchema).parse(itemArray);
  console.log(`[API 응답] NPS 사업장 검색 — ${items.length}건 (전체 ${data.response.body.totalCount}건)`);
  return { items, totalCount: data.response.body.totalCount };
}

/** 사업장 상세 조회 */
export async function getBusinessDetail(seq: string): Promise<NpsDetail | null> {
  if (USE_MOCK) {
    const mock = await import("./mock/nps-detail.json");
    return npsDetailSchema.parse(mock.default);
  }

  const url = new URL(`${NPS_BASE_URL}/getDetailInfoSearchV2`);
  url.searchParams.set("serviceKey", process.env.DATA_GO_KR_API_KEY!);
  url.searchParams.set("seq", seq);
  url.searchParams.set("dataType", "json");

  console.log(`[API 요청] NPS 사업장 상세 — seq:${seq}`);
  const res = await fetchWithRetry(url.toString());
  const data: DataGoKrResponse<NpsDetail> = await res.json();
  const rawItems = data.response.body.items?.item ?? [];
  const itemArray = Array.isArray(rawItems) ? rawItems : [rawItems];
  if (itemArray.length === 0) return null;

  const detail = npsDetailSchema.parse(itemArray[0]);
  console.log(`[API 응답] NPS 사업장 상세 — ${detail.wkplNm} (직원 ${detail.jnngpCnt ?? 0}명)`);
  return detail;
}

/** 월별 가입자 변동 추이 조회 */
export async function getMonthlyTrend(
  seq: string,
  months: number = 12,
): Promise<NpsTrendItem[]> {
  if (USE_MOCK) {
    const mock = await import("./mock/nps-trend.json");
    return z.array(npsTrendItemSchema).parse(mock.default.items);
  }

  const now = new Date();
  const endYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - months);
  const stYm = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, "0")}`;

  const url = new URL(`${NPS_BASE_URL}/getPdAcctoSttusInfoSearchV2`);
  url.searchParams.set("serviceKey", process.env.DATA_GO_KR_API_KEY!);
  url.searchParams.set("seq", seq);
  url.searchParams.set("stYm", stYm);
  url.searchParams.set("endYm", endYm);
  url.searchParams.set("dataType", "json");

  console.log(`[API 요청] NPS 월별 추이 — seq:${seq} (${stYm}~${endYm})`);
  const res = await fetchWithRetry(url.toString());
  const data: DataGoKrResponse<NpsTrendItem> = await res.json();
  const rawItems = data.response.body.items?.item ?? [];
  const itemArray = Array.isArray(rawItems) ? rawItems : [rawItems];
  const items = z.array(npsTrendItemSchema).parse(itemArray);
  console.log(`[API 응답] NPS 월별 추이 — ${items.length}개월 데이터`);
  return items;
}
