import { env, hasApiKey } from "@/lib/env";

/**
 * 공정거래위원회 가맹정보 브랜드 목록 API (data.go.kr)
 *
 * @see https://www.data.go.kr/data/15125467/openapi.do
 * 엔드포인트: apis.data.go.kr/1130000/FftcBrandRlsInfo2_Service/getBrandinfo
 * 인증: DATA_GO_KR_API_KEY (공공데이터포털 통합키)
 */

const BASE_URL =
  "https://apis.data.go.kr/1130000/FftcBrandRlsInfo2_Service/getBrandinfo";

/** 브랜드 정보 (API 응답 item) */
export interface FranchiseBrandItem {
  /** 브랜드명 */
  brandNm: string;
  /** 업종 대분류명 */
  indutyLclasNm?: string;
  /** 업종 중분류명 */
  indutyMlsfcNm?: string;
  /** 주요상품명 */
  majrGdsNm?: string;
  /** 가맹본부명 (법인명) */
  frcsBizNm?: string;
  /** 가맹사업 개시일자 */
  jngBizStrtDate?: string;
  /** 사업자등록번호 */
  brno?: string;
  /** 법인등록번호 */
  crno?: string;
}

/** API 응답 구조 */
interface BrandApiResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: { item: FranchiseBrandItem[] } | "";
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

/**
 * 공정위 등록 프랜차이즈 브랜드 전체 목록 조회.
 * JSON 응답, 페이지네이션 지원.
 */
export async function fetchAllFranchiseBrands(params: {
  /** 기준년도 (기본: 현재년도-1, 없으면 -2 fallback) */
  year?: number;
  /** 페이지당 건수 (기본: 5000) */
  numOfRows?: number;
}): Promise<{ brands: FranchiseBrandItem[]; totalCount: number }> {
  if (!hasApiKey.dataGoKr) {
    console.log("[Franchise] DATA_GO_KR_API_KEY 없음");
    return { brands: [], totalCount: 0 };
  }

  const currentYear = new Date().getFullYear();
  const primaryYear = params.year ?? currentYear - 1;
  const numOfRows = params.numOfRows ?? 5000;

  // yr-1 시도
  const result = await fetchBrandPage(primaryYear, 1, numOfRows);
  if (result.totalCount > 0) return result;

  // yr-2 fallback
  const fallbackYear = primaryYear - 1;
  console.log(
    `[Franchise] ${primaryYear}년 데이터 없음 → ${fallbackYear}년 fallback`,
  );
  return fetchBrandPage(fallbackYear, 1, numOfRows);
}

/** 단일 페이지 조회 */
async function fetchBrandPage(
  year: number,
  pageNo: number,
  numOfRows: number,
): Promise<{ brands: FranchiseBrandItem[]; totalCount: number }> {
  const url = new URL(BASE_URL);
  url.searchParams.set("serviceKey", env.DATA_GO_KR_API_KEY!);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(numOfRows));
  url.searchParams.set("resultType", "json");
  url.searchParams.set("jngBizCrtraYr", String(year));

  console.log(`[Franchise] data.go.kr 요청: yr=${year}, page=${pageNo}, rows=${numOfRows}`);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Franchise] API 오류 ${res.status}: ${text.substring(0, 200)}`);
    throw new Error(`Franchise API ${res.status}`);
  }

  const json = (await res.json()) as BrandApiResponse;
  const { header, body } = json.response;

  if (header.resultCode !== "00") {
    console.error(`[Franchise] 응답 에러: ${header.resultCode} — ${header.resultMsg}`);
    return { brands: [], totalCount: 0 };
  }

  const items = body.items === "" ? [] : body.items.item;
  console.log(`[Franchise] ${year}년 조회: ${body.totalCount}건 (이번 페이지 ${items.length}건)`);

  return { brands: items, totalCount: body.totalCount };
}
