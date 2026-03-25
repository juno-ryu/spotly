import { z } from "zod";
import { env } from "@/lib/env";

/**
 * 소상공인시장진흥공단 상가(상권)정보 API
 *
 * - 제공처: 소상공인시장진흥공단
 * - data.go.kr ID: 15012005
 * - 엔드포인트: http://apis.data.go.kr/B553077/api/open/sdsc2
 * - 인증: serviceKey (쿼리 파라미터, DATA_GO_KR_API_KEY)
 * - 호출 제한: 30 TPS
 * - 반경 조회: /storeListInRadius (radius, cx, cy)
 * - 페이징: pageNo + numOfRows (최대 1000건/페이지)
 * - 갱신: 분기
 * - 범위: 전국
 */

const SBIZ_API_BASE = "http://apis.data.go.kr/B553077/api/open/sdsc2";

// ─── 응답 스키마 ─────────────────────────────────────

/** 상가업소 단일 항목 */
const sbizStoreSchema = z.object({
  /** 상가업소번호 */
  bizesId: z.string(),
  /** 상호명 */
  bizesNm: z.string(),
  /** 지점명 */
  brchNm: z.string().default(""),
  /** 상권업종대분류코드 */
  indsLclsCd: z.string(),
  /** 상권업종대분류명 */
  indsLclsNm: z.string(),
  /** 상권업종중분류코드 */
  indsMclsCd: z.string(),
  /** 상권업종중분류명 */
  indsMclsNm: z.string(),
  /** 상권업종소분류코드 */
  indsSclsCd: z.string(),
  /** 상권업종소분류명 */
  indsSclsNm: z.string(),
  /** 표준산업분류코드 */
  ksicCd: z.string().optional(),
  /** 표준산업분류명 */
  ksicNm: z.string().optional(),
  /** 도로명주소 */
  rdnmAdr: z.string().default(""),
  /** 지번주소 */
  lnoAdr: z.string().default(""),
  /** 경도 */
  lon: z.coerce.number(),
  /** 위도 */
  lat: z.coerce.number(),
  /** 층정보 */
  flrNo: z.string().default(""),
});

export type SbizStore = z.infer<typeof sbizStoreSchema>;

/** API 응답 래퍼 (소상공인 전용 포맷 — data.go.kr 표준과 다름) */
const sbizResponseSchema = z.object({
  header: z.object({
    resultCode: z.string(),
    resultMsg: z.string(),
    /** 기준년월 (YYYYMM) */
    stdrYm: z.string().optional(),
  }),
  body: z.object({
    items: z.array(sbizStoreSchema).default([]),
    totalCount: z.coerce.number().default(0),
  }).default({ items: [], totalCount: 0 }),
});

// ─── API 호출 ─────────────────────────────────────

/**
 * 반경 내 상가업소 목록 조회 (단일 페이지)
 */
async function fetchPage(params: {
  cx: number;
  cy: number;
  radius: number;
  pageNo: number;
  numOfRows?: number;
  /** 업종대분류코드 (선택) */
  indsLclsCd?: string;
  /** 업종소분류코드 (선택, 대분류보다 우선) */
  indsSclsCd?: string;
}): Promise<{ items: SbizStore[]; totalCount: number }> {
  const key = env.DATA_GO_KR_API_KEY;
  if (!key) throw new Error("[상가정보] DATA_GO_KR_API_KEY 미설정");

  const { cx, cy, radius, pageNo, numOfRows = 1000, indsLclsCd, indsSclsCd } = params;
  const searchParams = new URLSearchParams({
    serviceKey: key,
    cx: String(cx),
    cy: String(cy),
    radius: String(radius),
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    type: "json",
  });
  // 소분류가 있으면 소분류 우선, 없으면 대분류 fallback
  if (indsSclsCd) searchParams.set("indsSclsCd", indsSclsCd);
  else if (indsLclsCd) searchParams.set("indsLclsCd", indsLclsCd);

  const url = `${SBIZ_API_BASE}/storeListInRadius?${searchParams.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("[상가정보] 10초 타임아웃 초과");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`[상가정보] HTTP ${res.status}`);

  const raw = await res.json();
  const parsed = sbizResponseSchema.parse(raw);

  if (parsed.header.resultCode === "03") {
    // NODATA_ERROR — 해당 조건에 데이터 없음
    return { items: [], totalCount: 0 };
  }

  if (parsed.header.resultCode !== "00") {
    throw new Error(`[상가정보] ${parsed.header.resultCode}: ${parsed.header.resultMsg}`);
  }

  return { items: parsed.body.items, totalCount: parsed.body.totalCount };
}

/**
 * 반경 내 상가업소 전체 조회 (자동 페이징)
 *
 * totalCount가 1000건 초과 시 병렬 페이지 호출.
 * 30 TPS 제한 대응: 최대 5페이지 병렬 (실질적으로 5000건까지 커버).
 */
export async function searchStoresInRadius(params: {
  /** 경도 */
  longitude: number;
  /** 위도 */
  latitude: number;
  /** 반경 (m) */
  radius: number;
  /** 업종대분류코드 (선택) */
  indsLclsCd?: string;
  /** 업종소분류코드 (선택, 대분류보다 우선) */
  indsSclsCd?: string;
}): Promise<{ stores: SbizStore[]; totalCount: number; stdrYm?: string }> {
  const { longitude, latitude, radius, indsLclsCd, indsSclsCd } = params;

  console.log(
    `[상가정보] 반경 조회 시작: (${latitude}, ${longitude}) 반경 ${radius}m${indsLclsCd ? ` 업종=${indsLclsCd}` : ""}`,
  );

  const first = await fetchPage({
    cx: longitude,
    cy: latitude,
    radius,
    pageNo: 1,
    indsLclsCd,
    indsSclsCd,
  });

  if (first.totalCount <= 1000) {
    console.log(`[상가정보] 조회 완료: ${first.items.length}건 / 전체 ${first.totalCount}건`);
    return { stores: first.items, totalCount: first.totalCount };
  }

  // 1000건 초과 — 추가 페이지 병렬 호출 (최대 5페이지 = 5000건)
  const pageCount = Math.min(Math.ceil(first.totalCount / 1000), 5);
  console.log(
    `[상가정보] 전체 ${first.totalCount.toLocaleString()}건 → ${pageCount}페이지 병렬 호출`,
  );

  const promises = Array.from({ length: pageCount - 1 }, (_, i) =>
    fetchPage({
      cx: longitude,
      cy: latitude,
      radius,
      pageNo: i + 2,
      indsLclsCd,
      indsSclsCd,
    })
      .then((r) => r.items)
      .catch((err) => {
        console.warn(`[상가정보] 페이지 ${i + 2} 실패:`, err instanceof Error ? err.message : String(err));
        return [] as SbizStore[];
      }),
  );

  const rest = await Promise.all(promises);
  const allStores = [first.items, ...rest].flat();

  console.log(`[상가정보] 조회 완료: ${allStores.length}건 / 전체 ${first.totalCount}건`);
  return { stores: allStores, totalCount: first.totalCount };
}
