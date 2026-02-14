import { z } from "zod";

const KOSIS_BASE_URL =
  "https://kosis.kr/openapi/Param/statisticsParameterData.do";

const USE_MOCK =
  process.env.NODE_ENV === "development" && !process.env.KOSIS_API_KEY;

// ─── Zod 스키마 ───

/** KOSIS API 응답 아이템 */
const kosisItemSchema = z.object({
  /** 항목 ID */
  ITM_ID: z.string(),
  /** 항목명 */
  ITM_NM: z.string(),
  /** 데이터 값 (문자열) */
  DT: z.string(),
  /** 분류코드 (시군구코드) */
  C1: z.string(),
  /** 분류명 */
  C1_NM: z.string(),
  /** 통계표 ID */
  TBL_ID: z.string(),
});
type KosisItem = z.infer<typeof kosisItemSchema>;

/** 인구 데이터 */
export interface PopulationData {
  /** 총 인구수 */
  totalPopulation: number;
  /** 세대수 */
  households: number;
}

// ─── 내부 유틸 ───

/** KOSIS 응답에서 숫자 값 추출 (쉼표 제거) */
function parseKosisNumber(value: string): number {
  const cleaned = value.replace(/,/g, "").replace(/-/g, "0").trim();
  return Number(cleaned) || 0;
}

/** KOSIS API 공통 호출 */
async function kosisRequest(params: {
  tblId: string;
  objL1: string;
  itmId: string;
  prdSe: string;
  startPrdDe: string;
  endPrdDe: string;
}): Promise<KosisItem[]> {
  const apiKey = process.env.KOSIS_API_KEY!;

  // NOTE: URL.searchParams는 base64 키의 '='를 '%3D'로 인코딩하여 KOSIS가 거부함.
  // 쿼리스트링을 직접 조합하여 '='가 그대로 전달되도록 처리.
  const qs = [
    `method=getList`,
    `apiKey=${apiKey}`,
    `format=json`,
    `jsonVD=Y`,
    `orgId=101`,
    `tblId=${params.tblId}`,
    `objL1=${params.objL1}`,
    `itmId=${params.itmId}`,
    `prdSe=${params.prdSe}`,
    `startPrdDe=${params.startPrdDe}`,
    `endPrdDe=${params.endPrdDe}`,
  ].join("&");

  const res = await fetch(`${KOSIS_BASE_URL}?${qs}`);
  if (!res.ok) throw new Error(`KOSIS API 오류: ${res.status}`);

  const data: unknown = await res.json();

  // KOSIS는 에러 시 { err: "...", errMsg: "..." } 형태 반환
  if (data && typeof data === "object" && "err" in data) {
    const errData = data as { err: string; errMsg: string };
    throw new Error(`KOSIS API 에러: [${errData.err}] ${errData.errMsg}`);
  }

  return z.array(kosisItemSchema).parse(data);
}

// ─── API 함수 ───

/**
 * 시군구별 인구·세대수 조회
 * - DT_1B040A3: 행정구역(시군구)별 성별 인구수 → T20(총인구)
 * - DT_1B040B3: 행정구역(시군구)별 주민등록세대수 → T1(세대수)
 * @param districtCode 5자리 시군구코드 (예: "11680")
 */
export async function getPopulationByDistrict(
  districtCode: string,
): Promise<PopulationData> {
  if (USE_MOCK) {
    const mock = await import("./mock/kosis-population.json");
    const items = z.array(kosisItemSchema).parse(mock.default);
    return itemsToPopulationData(items);
  }

  const lastYear = String(new Date().getFullYear() - 1);

  // 인구수 + 세대수 병렬 조회 (서로 다른 테이블)
  const [populationItems, householdItems] = await Promise.all([
    kosisRequest({
      tblId: "DT_1B040A3",
      objL1: districtCode,
      itmId: "T20",
      prdSe: "Y",
      startPrdDe: lastYear,
      endPrdDe: lastYear,
    }),
    kosisRequest({
      tblId: "DT_1B040B3",
      objL1: districtCode,
      itmId: "T1",
      prdSe: "Y",
      startPrdDe: lastYear,
      endPrdDe: lastYear,
    }),
  ]);

  const totalPopulation =
    populationItems.length > 0
      ? parseKosisNumber(populationItems[0].DT)
      : 0;

  const households =
    householdItems.length > 0
      ? parseKosisNumber(householdItems[0].DT)
      : 0;

  return { totalPopulation, households };
}

/** mock 데이터 → PopulationData 변환 */
function itemsToPopulationData(items: KosisItem[]): PopulationData {
  let totalPopulation = 0;
  let households = 0;

  for (const item of items) {
    if (item.ITM_ID === "T20" && item.TBL_ID === "DT_1B040A3") {
      totalPopulation = parseKosisNumber(item.DT);
    }
    if (item.ITM_ID === "T1" && item.TBL_ID === "DT_1B040B3") {
      households = parseKosisNumber(item.DT);
    }
  }

  return { totalPopulation, households };
}
