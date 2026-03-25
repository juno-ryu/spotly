import { z } from "zod";

const KOSIS_BASE_URL =
  "https://kosis.kr/openapi/Param/statisticsParameterData.do";



// ─── Zod 스키마 ───

/** KOSIS API 응답 아이템 (필요한 필드만 추출, 나머지는 strip) */
const kosisItemSchema = z.object({
  /** 항목 ID */
  ITM_ID: z.string(),
  /** 항목명 */
  ITM_NM: z.string(),
  /** 데이터 값 (문자열) */
  DT: z.string(),
  /** 분류코드 (시군구/읍면동 코드) */
  C1: z.string(),
  /** 분류명 */
  C1_NM: z.string(),
  /** 통계표 ID */
  TBL_ID: z.string(),
}).strip();
type KosisItem = z.infer<typeof kosisItemSchema>;

/** 인구 데이터 */
export interface PopulationData {
  /** 총 인구수 */
  totalPopulation: number;
  /** 동 단위 데이터 여부 (false면 시군구 단위 fallback) */
  isDongLevel?: boolean;
}

// ─── 내부 유틸 ───

/** KOSIS 응답에서 숫자 값 추출 (쉼표 제거) */
function parseKosisNumber(value: string): number | null {
  const trimmed = value.trim();
  // KOSIS에서 `-`는 "해당 데이터 없음"을 의미 — 0과 구분 필요
  if (trimmed === "-" || trimmed === "") return null;
  const cleaned = trimmed.replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

/** KOSIS API 공통 호출 */
async function kosisRequest(params: {
  tblId: string;
  objL1: string;
  objL2?: string;
  itmId: string;
  prdSe: string;
  startPrdDe: string;
  endPrdDe: string;
}): Promise<KosisItem[]> {
  const apiKey = process.env.KOSIS_API_KEY;
  if (!apiKey) {
    throw new Error("KOSIS_API_KEY 환경변수가 설정되지 않았습니다");
  }

  // NOTE: URL.searchParams는 base64 키의 '='를 '%3D'로 인코딩하여 KOSIS가 거부함.
  // 쿼리스트링을 직접 조합하여 '='가 그대로 전달되도록 처리.
  const parts = [
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
  ];
  if (params.objL2 !== undefined) {
    parts.push(`objL2=${params.objL2}`);
  }
  const qs = parts.join("&");

  // ECONNRESET, ETIMEDOUT, AbortError 등 일시적 네트워크 오류 여부 판단
  const isRetryable = (err: unknown): boolean => {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    // KOSIS API 에러(err 필드 응답)는 재시도 불필요 — 데이터 부재이므로
    if (msg.startsWith("kosis api 에러")) return false;
    return (
      err.name === "AbortError" ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("network") ||
      msg.includes("fetch failed")
    );
  };

  const MAX_ATTEMPTS = 3; // 최초 1회 + 재시도 2회
  const RETRY_DELAY_MS = 500;


  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 10초 타임아웃 (fallback 포함 최대 4회 직렬 호출 대비)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`${KOSIS_BASE_URL}?${qs}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`KOSIS API 오류: ${res.status}`);

      const data: unknown = await res.json();

      // KOSIS는 에러 시 { err: "...", errMsg: "..." } 형태 반환 — 재시도 없이 throw
      if (data && typeof data === "object" && "err" in data) {
        const errData = data as { err: string; errMsg: string };
        throw new Error(`KOSIS API 에러: [${errData.err}] ${errData.errMsg}`);
      }

      const items = z.array(kosisItemSchema).parse(data);
      return items;
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === MAX_ATTEMPTS) throw err;
      console.warn(`[API 재시도] KOSIS — ${attempt}/${MAX_ATTEMPTS - 1}회 (${(err as Error).message})`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 루프 종료 후 도달하지 않지만 타입 만족을 위해
  throw lastError;
}

// ─── API 함수 ───

/**
 * 시군구별 인구수 조회
 * - DT_1B04005N: 행정구역(읍면동)별/5세별 주민등록인구 → T2(총인구수)
 * @param districtCode 5자리 시군구코드 (예: "11680")
 */
export async function getPopulationByDistrict(
  districtCode: string,
): Promise<PopulationData> {
  const lastYear = String(new Date().getFullYear() - 1);

  // 인구수만 조회 (세대수는 읍면동/시군구 해상도 불일치로 제거)
  const populationItems = await kosisRequest({
    tblId: "DT_1B04005N",
    objL1: districtCode,
    objL2: "0",
    itmId: "T2",
    prdSe: "Y",
    startPrdDe: lastYear,
    endPrdDe: lastYear,
  });

  const totalPopulation =
    populationItems.length > 0
      ? (parseKosisNumber(populationItems[0].DT) ?? 0)
      : 0;

  return { totalPopulation };
}

/**
 * 읍면동별 인구 조회 (동 단위, 시군구 fallback)
 * - DT_1B04005N: 행정구역(읍면동)별/5세별 주민등록인구(2011년~)
 *   → itmId=T2(총인구수), objL2=0(전체 연령=계)
 * @param adminDongCode 행정동코드 10자리 (예: "2635053000")
 * @param districtCode 5자리 시군구코드 (fallback용)
 */
export async function getPopulationByDong(
  adminDongCode: string | undefined,
  districtCode: string,
): Promise<PopulationData> {
  // 행정동코드가 없으면 바로 시군구 fallback
  if (!adminDongCode) {
    const result = await getPopulationByDistrict(districtCode);
    return { ...result, isDongLevel: false };
  }

  try {
    const lastYear = String(new Date().getFullYear() - 1);

    // 읍면동 인구수만 조회 (세대수는 해상도 불일치로 제거)
    const populationItems = await kosisRequest({
      tblId: "DT_1B04005N",
      objL1: adminDongCode,
      objL2: "0",
      itmId: "T2",
      prdSe: "Y",
      startPrdDe: lastYear,
      endPrdDe: lastYear,
    });

    const totalPopulation =
      populationItems.length > 0
        ? (parseKosisNumber(populationItems[0].DT) ?? 0)
        : 0;

    // 동 단위 데이터가 있으면 사용
    if (totalPopulation > 0) {
      return { totalPopulation, isDongLevel: true };
    }

    // 데이터 없으면 시군구 fallback
    const fallback = await getPopulationByDistrict(districtCode);
    return { ...fallback, isDongLevel: false };
  } catch (error) {
    // 읍면동 테이블 조회 실패 → 시군구 fallback
    console.warn(`[KOSIS] 읍면동 조회 실패 → 시군구(${districtCode}) fallback:`, error);
    const fallback = await getPopulationByDistrict(districtCode);
    return { ...fallback, isDongLevel: false };
  }
}

