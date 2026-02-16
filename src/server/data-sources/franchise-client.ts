import { z } from "zod";
import { env, hasApiKey } from "@/lib/env";
import type { FranchiseApiResponse } from "./types";

const FRANCHISE_BASE_URL = "https://franchise.ftc.go.kr/api";

const USE_MOCK = process.env.NODE_ENV === "development" && !hasApiKey.franchise;

// ─── Zod 스키마 ───

/** 가맹본부 정보 */
export const franchiseBrandSchema = z.object({
  /** 정보공개서 일련번호 */
  jngIfrmpSn: z.coerce.string(),
  /** 가맹본부명 */
  frcsBizNm: z.string(),
  /** 브랜드명 */
  brdNm: z.string().optional(),
  /** 대표자명 */
  rprsntNm: z.string().optional(),
  /** 업종 */
  induty: z.string().optional(),
  /** 사업자등록번호 */
  bzmnLicenNo: z.string().optional(),
  /** 등록일자 */
  regDt: z.string().optional(),
  /** 주소 */
  addr: z.string().optional(),
  /** 전화번호 */
  telno: z.string().optional(),
});
export type FranchiseBrand = z.infer<typeof franchiseBrandSchema>;

/** 가맹점 현황 정보 */
export const franchiseStoreStatsSchema = z.object({
  /** 정보공개서 일련번호 */
  jngIfrmpSn: z.coerce.string(),
  /** 직영점 수 */
  dirctMngStorCo: z.coerce.number().optional(),
  /** 가맹점 수 */
  frcsStorCo: z.coerce.number().optional(),
  /** 신규 개점 수 */
  newOpenStorCo: z.coerce.number().optional(),
  /** 계약해지 수 */
  ctrtTrmnatCo: z.coerce.number().optional(),
  /** 계약종료 수 */
  ctrtEndCo: z.coerce.number().optional(),
  /** 영업중 가맹점 수 */
  bsnFrcsStorCo: z.coerce.number().optional(),
});
export type FranchiseStoreStats = z.infer<typeof franchiseStoreStatsSchema>;

/** 가맹정보 조회 파라미터 */
export interface FranchiseListParams {
  /** 연도 (예: 2023) */
  yr?: string;
  /** 페이지 번호 (기본: 1) */
  pageNo?: number;
  /** 페이지당 건수 (기본: 10, 최대: 1000) */
  numOfRows?: number;
  /** 브랜드명 검색 */
  brdNm?: string;
  /** 업종 */
  induty?: string;
}

// ─── API 클라이언트 ───

/** 공정위 API 호출 (XML 파싱 포함) */
async function fetchFranchiseApi(
  endpoint: string,
  params: Record<string, string | number | undefined>
): Promise<string> {
  if (USE_MOCK) {
    console.warn("[Franchise] API 키 없음 - 모킹 모드");
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><response><resultCode>00</resultCode><totalCount>0</totalCount></response>";
  }

  const url = new URL(`${FRANCHISE_BASE_URL}/${endpoint}`);
  url.searchParams.set("serviceKey", env.FRANCHISE_OPEN_API_KEY!);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  console.log(`[Franchise] 요청 URL: ${url.toString()}`);

  const res = await fetch(url.toString());
  console.log(`[Franchise] 응답 상태: ${res.status}`);

  if (!res.ok) {
    const errorText = await res.text();
    console.log(`[Franchise] 에러 응답: ${errorText.substring(0, 200)}`);
    throw new Error(`Franchise API 오류: ${res.status}`);
  }

  const text = await res.text();
  console.log(`[Franchise] 응답 길이: ${text.length}자`);
  return text;
}

/** XML에서 값 추출 (간단한 정규식 파서) */
function parseXmlValue(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`));
  return match?.[1]?.trim();
}

/** XML에서 여러 아이템 추출 */
function parseXmlItems(xml: string): string[] {
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  return Array.from(itemMatches, (m) => m[1]);
}

/**
 * 가맹본부 목록 조회
 *
 * @see https://franchise.ftc.go.kr/openApi/guide.do
 */
export async function getFranchiseList(
  params: FranchiseListParams = {}
): Promise<FranchiseApiResponse<FranchiseBrand>> {
  try {
    const xml = await fetchFranchiseApi("search.do", {
      type: "list",
      yr: params.yr ?? new Date().getFullYear().toString(),
      pageNo: params.pageNo ?? 1,
      numOfRows: params.numOfRows ?? 10,
      brdNm: params.brdNm,
      induty: params.induty,
    });

    console.log("[Franchise] XML 응답 (처음 500자):", xml.substring(0, 500));

    const totalCount = Number(parseXmlValue(xml, "totalCount") ?? "0");
    console.log(`[Franchise] totalCount: ${totalCount}`);

    const items = parseXmlItems(xml);
    const data = items.map((item) => ({
      jngIfrmpSn: parseXmlValue(item, "jngIfrmpSn") ?? "",
      frcsBizNm: parseXmlValue(item, "corpNm") ?? "",  // corpNm = 기업명
      brdNm: parseXmlValue(item, "brandNm"),           // brandNm = 브랜드명
      rprsntNm: parseXmlValue(item, "rprsntNm"),
      induty: parseXmlValue(item, "induty"),
      bzmnLicenNo: parseXmlValue(item, "brno"),        // brno = 사업자등록번호
      regDt: parseXmlValue(item, "jngIfrmpRgsno"),     // 등록번호
      addr: parseXmlValue(item, "addr"),
      telno: parseXmlValue(item, "telno"),
    }));

    return {
      resultCode: "00",
      resultMsg: "SUCCESS",
      totalCount,
      data,
    };
  } catch (error) {
    console.error("[Franchise] 목록 조회 실패:", error);
    return {
      resultCode: "ERROR",
      resultMsg: error instanceof Error ? error.message : "Unknown error",
      totalCount: 0,
      data: [],
    };
  }
}

/**
 * 특정 가맹본부 상세 정보 조회
 *
 * @param jngIfrmpSn 정보공개서 일련번호
 */
export async function getFranchiseDetail(
  jngIfrmpSn: string
): Promise<FranchiseBrand | null> {
  try {
    const xml = await fetchFranchiseApi("search.do", {
      type: "title",
      jngIfrmpSn,
    });

    const resultCode = parseXmlValue(xml, "resultCode");
    if (resultCode !== "00") {
      return null;
    }

    const items = parseXmlItems(xml);
    if (items.length === 0) return null;

    const item = items[0];
    return {
      jngIfrmpSn,
      frcsBizNm: parseXmlValue(item, "frcsBizNm") ?? "",
      brdNm: parseXmlValue(item, "brdNm"),
      rprsntNm: parseXmlValue(item, "rprsntNm"),
      induty: parseXmlValue(item, "induty"),
      bzmnLicenNo: parseXmlValue(item, "bzmnLicenNo"),
      regDt: parseXmlValue(item, "regDt"),
      addr: parseXmlValue(item, "addr"),
      telno: parseXmlValue(item, "telno"),
    };
  } catch (error) {
    console.error("[Franchise] 상세 조회 실패:", error);
    return null;
  }
}

/**
 * 업종별 가맹본부 검색
 *
 * @param induty 업종 (예: "한식", "커피전문점", "편의점")
 */
export async function searchFranchiseByIndustry(
  induty: string,
  params: Omit<FranchiseListParams, "induty"> = {}
): Promise<FranchiseApiResponse<FranchiseBrand>> {
  return getFranchiseList({
    ...params,
    induty,
  });
}

/**
 * 브랜드명으로 가맹본부 검색
 *
 * @param brdNm 브랜드명 (예: "스타벅스", "CU", "GS25")
 */
export async function searchFranchiseByBrand(
  brdNm: string,
  params: Omit<FranchiseListParams, "brdNm"> = {}
): Promise<FranchiseApiResponse<FranchiseBrand>> {
  return getFranchiseList({
    ...params,
    brdNm,
  });
}
