import { z } from "zod";
import { hasApiKey, env } from "@/lib/env";
import { cachedFetch, redis } from "@/server/cache/redis";

const SEOUL_API_BASE = "http://openapi.seoul.go.kr:8088";
const USE_MOCK = !hasApiKey.seoul;

/** 캐시 TTL (초) */
const TTL = {
  /** 상권영역·변화지표: 분기 데이터이므로 30일 */
  QUARTER: 60 * 60 * 24 * 30,
  /** 매출: 분기 데이터지만 좀 더 자주 갱신 (7일) */
  SALES: 60 * 60 * 24 * 7,
} as const;

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
 * LL: 다이나믹 — 활발한 신진대사, 성장세
 * LH: 상권확장 — 확장 중
 * HL: 상권축소 — 축소세
 * HH: 정체 — 정체
 */
export const golmokChangeIndexSchema = z.object({
  STDR_YYQU_CD: z.string(),
  TRDAR_CD: z.string(),
  TRDAR_CD_NM: z.string(),
  TRDAR_CHNGE_IX: z.string(),
  TRDAR_CHNGE_IX_NM: z.string(),
  OPR_SALE_MT_AVRG: z.coerce.number(),
  CLS_SALE_MT_AVRG: z.coerce.number(),
});

/** 유동인구 (VwsmTrdarFlpopQq) — 상권 단위, ~1,648건/분기 */
export const golmokFloatingPopSchema = z.object({
  STDR_YYQU_CD: z.string(),
  TRDAR_CD: z.string(),
  TRDAR_CD_NM: z.string(),
  /** 총 유동인구 */
  TOT_FLPOP_CO: z.coerce.number(),
  /** 남성 유동인구 */
  ML_FLPOP_CO: z.coerce.number(),
  /** 여성 유동인구 */
  FML_FLPOP_CO: z.coerce.number(),
  /** 연령대별 유동인구 */
  AGRDE_10_FLPOP_CO: z.coerce.number(),
  AGRDE_20_FLPOP_CO: z.coerce.number(),
  AGRDE_30_FLPOP_CO: z.coerce.number(),
  AGRDE_40_FLPOP_CO: z.coerce.number(),
  AGRDE_50_FLPOP_CO: z.coerce.number(),
  AGRDE_60_ABOVE_FLPOP_CO: z.coerce.number(),
  /** 시간대별 유동인구 */
  TMZON_00_06_FLPOP_CO: z.coerce.number(),
  TMZON_06_11_FLPOP_CO: z.coerce.number(),
  TMZON_11_14_FLPOP_CO: z.coerce.number(),
  TMZON_14_17_FLPOP_CO: z.coerce.number(),
  TMZON_17_21_FLPOP_CO: z.coerce.number(),
  TMZON_21_24_FLPOP_CO: z.coerce.number(),
  /** 요일별 유동인구 */
  MON_FLPOP_CO: z.coerce.number(),
  TUES_FLPOP_CO: z.coerce.number(),
  WED_FLPOP_CO: z.coerce.number(),
  THUR_FLPOP_CO: z.coerce.number(),
  FRI_FLPOP_CO: z.coerce.number(),
  SAT_FLPOP_CO: z.coerce.number(),
  SUN_FLPOP_CO: z.coerce.number(),
});
export type GolmokFloatingPop = z.infer<typeof golmokFloatingPopSchema>;

/** 상주인구 (VwsmTrdarRepopQq) — 상권 단위, ~1,648건/분기 */
export const golmokResidentPopSchema = z.object({
  STDR_YYQU_CD: z.string(),
  TRDAR_CD: z.string(),
  TRDAR_CD_NM: z.string(),
  /** 총 상주인구 */
  TOT_REPOP_CO: z.coerce.number(),
  /** 남성 상주인구 */
  ML_REPOP_CO: z.coerce.number(),
  /** 여성 상주인구 */
  FML_REPOP_CO: z.coerce.number(),
  /** 연령대별 상주인구 */
  AGRDE_10_REPOP_CO: z.coerce.number(),
  AGRDE_20_REPOP_CO: z.coerce.number(),
  AGRDE_30_REPOP_CO: z.coerce.number(),
  AGRDE_40_REPOP_CO: z.coerce.number(),
  AGRDE_50_REPOP_CO: z.coerce.number(),
  AGRDE_60_ABOVE_REPOP_CO: z.coerce.number(),
  /** 총 세대수 */
  TOT_HSHLD_CO: z.coerce.number(),
});
export type GolmokResidentPop = z.infer<typeof golmokResidentPopSchema>;

export type GolmokChangeIndex = z.infer<typeof golmokChangeIndexSchema>;

// ─── 공통 타입 ───

interface SeoulApiSuccessBody<T> {
  list_total_count: number;
  RESULT: { CODE: string; MESSAGE: string };
  row: T[];
}

interface SeoulApiErrorBody {
  RESULT: { CODE: string; MESSAGE: string };
}

export interface TrdarArea {
  trdarCd: string;
  trdarNm: string;
  adminDongCode: string;
  adminDongName: string;
  signguCode: string;
  signguName: string;
}

// ─── 유틸 ───

/** 최근 분기 코드 (데이터 반영 지연 감안: 6개월 전) */
function getRecentQuarterCode(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return `${d.getFullYear()}${Math.ceil((d.getMonth() + 1) / 3)}`;
}

// ─── 저수준 API 호출 ───

/**
 * 서울시 Open API 단일 페이지 호출.
 * URL: /{KEY}/json/{서비스명}/{시작}/{끝}/{조건1}/{조건2}/...
 */
async function fetchPage<T>(
  serviceName: string,
  start: number,
  end: number,
  conditions: string[] = [],
): Promise<{ rows: T[]; totalCount: number }> {
  const key = env.SEOUL_OPEN_API_KEY!;
  const condPath = conditions.length > 0 ? `/${conditions.join("/")}` : "";
  const url = `${SEOUL_API_BASE}/${key}/json/${serviceName}/${start}/${end}${condPath}`;

  const label = `${serviceName}/${start}~${end}${condPath}`;
  console.log(`[서울 API 호출] ${label}`);
  const t0 = Date.now();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`[서울 API] ${label}: HTTP ${res.status}`);

  const text = await res.text();

  // XML 에러 응답 (인증키 오류 등)
  if (text.startsWith("<")) {
    const code = text.match(/<CODE>([^<]+)<\/CODE>/)?.[1] ?? "UNKNOWN";
    if (code === "INFO-200") return { rows: [], totalCount: 0 };
    const msg = text.match(/<MESSAGE><!\[CDATA\[([^\]]+)\]\]><\/MESSAGE>/)?.[1] ?? "XML 에러";
    throw new Error(`[서울 API] ${label}: ${code} ${msg}`);
  }

  const data = JSON.parse(text);
  const svc = data[serviceName] as SeoulApiSuccessBody<T> | undefined;

  if (!svc) {
    const err = data as SeoulApiErrorBody;
    if (err.RESULT?.CODE === "INFO-200") return { rows: [], totalCount: 0 };
    throw new Error(`[서울 API] ${label}: ${err.RESULT?.MESSAGE ?? "알 수 없는 응답"}`);
  }

  if (svc.RESULT.CODE !== "INFO-000") {
    if (svc.RESULT.CODE === "INFO-200") return { rows: [], totalCount: 0 };
    throw new Error(`[서울 API] ${label}: ${svc.RESULT.MESSAGE}`);
  }

  console.log(`[서울 API 응답] ${label} → ${svc.row.length}건 / 전체 ${svc.list_total_count}건 (${Date.now() - t0}ms)`);
  return { rows: svc.row, totalCount: svc.list_total_count };
}

/**
 * 1000건 제한 우회: 전체 페이지 병렬 호출.
 * 소량 데이터(상권영역 1,650건, 변화지표 1,650건)에만 사용.
 * 대량 데이터(매출 21K, 점포 76K)는 캐시와 함께 사용.
 */
async function fetchAllPages<T>(
  serviceName: string,
  conditions: string[] = [],
): Promise<T[]> {
  const first = await fetchPage<T>(serviceName, 1, 1000, conditions);
  if (first.totalCount <= 1000) return first.rows;

  const pageCount = Math.ceil(first.totalCount / 1000);
  console.log(`[서울 API 페이지네이션] ${serviceName} 총 ${first.totalCount.toLocaleString()}건 → ${pageCount}페이지 병렬호출`);

  const promises = Array.from({ length: pageCount - 1 }, (_, i) => {
    const s = (i + 1) * 1000 + 1;
    const e = Math.min((i + 2) * 1000, first.totalCount);
    return fetchPage<T>(serviceName, s, e, conditions)
      .then((r) => r.rows)
      .catch(() => [] as T[]);
  });

  const rest = await Promise.all(promises);
  const all = [first.rows, ...rest].flat();
  console.log(`[서울 API 페이지네이션] ${serviceName} 완료: ${all.length.toLocaleString()}건`);
  return all;
}

// ─── 업종 키워드 매칭 ───

const KEYWORD_MAP: Record<string, string[]> = {
  // 음식
  "치킨": ["치킨", "닭"],
  "커피": ["커피", "음료", "카페"],
  "카페": ["커피", "음료", "카페", "제과"],
  "피자": ["피자"],
  "한식": ["한식", "백반", "국밥"],
  "중식": ["중식"],
  "일식": ["일식", "초밥"],
  "양식": ["양식"],
  "분식": ["분식", "떡볶이"],
  "빵": ["제과", "베이커리"],
  "베이커리": ["제과", "베이커리"],
  "술": ["호프", "주점"],
  "맥주": ["호프", "주점"],
  "고기": ["육류"],
  "삼겹살": ["한식", "육류"],
  "패스트푸드": ["패스트푸드"],
  "햄버거": ["패스트푸드"],
  "편의점": ["편의점"],
  "반찬": ["반찬"],
  "과일": ["청과"],
  // 뷰티
  "미용": ["미용", "헤어"],
  "헤어": ["미용", "헤어"],
  "네일": ["네일"],
  "피부": ["피부관리"],
  "화장품": ["화장품"],
  // 운동
  "헬스": ["스포츠", "운동"],
  "피트니스": ["스포츠", "운동"],
  "gym": ["스포츠", "운동"],
  "필라테스": ["스포츠 강습", "운동"],
  "요가": ["스포츠 강습", "운동"],
  "골프": ["골프"],
  "당구": ["당구"],
  "스포츠": ["스포츠", "운동"],
  // 교육
  "학원": ["학원", "교습"],
  "영어": ["외국어학원"],
  "수학": ["일반교습학원"],
  // 생활서비스
  "세탁": ["세탁"],
  "인테리어": ["인테리어"],
  "철물": ["철물"],
  "가구": ["가구"],
  "안경": ["안경"],
  "병원": ["의원"],
  "약국": ["의약"],
  "치과": ["치과"],
  "한의원": ["한의원"],
  // 유통
  "옷": ["의류"],
  "의류": ["의류"],
  "신발": ["신발"],
  "가방": ["가방"],
  "핸드폰": ["핸드폰"],
  "컴퓨터": ["컴퓨터"],
  "노래방": ["노래방"],
  "pc방": ["pc방"],
  "슈퍼": ["슈퍼마켓"],
  "마트": ["슈퍼마켓"],
  "자동차": ["자동차"],
  "세차": ["자동차미용"],
  "꽃": ["화초"],
  "반려동물": ["애완동물"],
  "펫": ["애완동물"],
};

function matchesIndustry(seoulName: string, keyword: string): boolean {
  const s = seoulName.toLowerCase();
  const k = keyword.toLowerCase();

  if (s.includes(k) || k.includes(s)) return true;

  for (const [key, synonyms] of Object.entries(KEYWORD_MAP)) {
    if (k.includes(key)) {
      return synonyms.some((syn) => s.includes(syn));
    }
  }
  return false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  좌표 변환 (WGS84 → EPSG:5181 서울시 TM)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * WGS84(위경도) → EPSG:5181(서울시 TM) 근사 변환.
 * 서울 지역 한정 오차 약 ±50m — 반경 300m+ 필터링에 충분.
 */
function wgs84ToTM(lat: number, lon: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  return {
    x: 200000 + (lon - 127.0) * Math.cos(latRad) * 111319.5,
    y: 500000 + (lat - 38.0) * 110574.0,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  공개 API 함수
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 상권영역 원본 Row (좌표 포함) */
type TrdarRawRow = {
  TRDAR_CD: string;
  TRDAR_CD_NM: string;
  ADSTRD_CD: string;
  ADSTRD_CD_NM: string;
  SIGNGU_CD: string;
  SIGNGU_CD_NM: string;
  XCNTS_VALUE: string;
  YDNTS_VALUE: string;
};

/** 캐시된 상권영역 전체 목록 조회 */
async function getAllTrdarAreas(): Promise<TrdarRawRow[]> {
  return cachedFetch(
    "seoul:TbgisTrdarRelm:all",
    TTL.QUARTER,
    () => fetchAllPages<TrdarRawRow>("TbgisTrdarRelm"),
  );
}

function rawToTrdarArea(r: TrdarRawRow): TrdarArea {
  return {
    trdarCd: r.TRDAR_CD,
    trdarNm: r.TRDAR_CD_NM,
    adminDongCode: r.ADSTRD_CD,
    adminDongName: r.ADSTRD_CD_NM,
    signguCode: r.SIGNGU_CD,
    signguName: r.SIGNGU_CD_NM,
  };
}

/**
 * 좌표 + 반경으로 근처 상권만 필터링.
 * TbgisTrdarRelm의 XCNTS/YDNTS(TM 좌표, 미터)와 유클리드 거리 비교.
 * API 호출: 최초 2회, 이후 0회 (30일 캐시)
 */
export async function getTrdarsByLocation(params: {
  latitude: number;
  longitude: number;
  radius: number;
}): Promise<TrdarArea[]> {
  if (USE_MOCK) return [];

  const allAreas = await getAllTrdarAreas();
  const center = wgs84ToTM(params.latitude, params.longitude);

  const matched = allAreas
    .filter((r) => {
      const dx = Number(r.XCNTS_VALUE) - center.x;
      const dy = Number(r.YDNTS_VALUE) - center.y;
      return Math.sqrt(dx * dx + dy * dy) <= params.radius;
    })
    .map(rawToTrdarArea);

  console.log(
    `[서울 상권영역] 전체 ${allAreas.length}건 중 반경 ${params.radius}m 내 → ${matched.length}건 (${matched.map((a) => a.trdarNm).join(", ")})`,
  );
  return matched;
}

/**
 * 행정동코드 → 상권코드 목록 조회 (fallback).
 * API 호출: 최초 2회, 이후 0회 (30일 캐시)
 */
export async function getTrdarsByDongCode(
  adminDongCode: string,
): Promise<TrdarArea[]> {
  if (USE_MOCK) return [];

  const allAreas = await getAllTrdarAreas();

  const matched = allAreas
    .filter((r) => r.ADSTRD_CD === adminDongCode)
    .map(rawToTrdarArea);

  console.log(
    `[서울 상권영역] 전체 ${allAreas.length}건 중 동코드 ${adminDongCode} → ${matched.length}건 (${matched.map((a) => a.trdarNm).join(", ")})`,
  );
  return matched;
}

/**
 * 점포 현황 조회.
 * VwsmTrdarStorQq는 URL 필터 지원: /분기/상권코드 → 상권별 ~20건만 반환.
 * API 호출: 상권 수만큼 (보통 3~5회)
 */
export async function getStoreStatus(params: {
  quarter?: string;
  industryKeyword: string;
  trdarCodes: string[];
}): Promise<GolmokStore[]> {
  if (USE_MOCK) {
    const mock = await import("../mock/seoul-golmok-store.json");
    return z.array(golmokStoreSchema)
      .parse(mock.default.row)
      .filter((r) => matchesIndustry(r.SVC_INDUTY_CD_NM, params.industryKeyword));
  }

  const qc = params.quarter ?? getRecentQuarterCode();

  // 상권코드별 캐시 조회
  const perTrdarResults = await Promise.all(
    params.trdarCodes.map(async (cd) => {
      try {
        if (redis) {
          const cached = await redis.get<GolmokStore[]>(
            `seoul:store:${qc}:${cd}`,
          );
          if (cached) return { cd, data: cached, hit: true };
        }
      } catch { /* Redis 실패 → 캐시 미스 취급 */ }
      return { cd, data: null as GolmokStore[] | null, hit: false };
    }),
  );

  const hits = perTrdarResults.filter((r) => r.hit);
  const misses = perTrdarResults.filter((r) => !r.hit);

  // 캐시 미스된 상권만 API 호출
  if (misses.length > 0) {
    const fetchResults = await Promise.all(
      misses.map((m) =>
        fetchPage<GolmokStore>("VwsmTrdarStorQq", 1, 1000, [qc, m.cd])
          .then((r) => {
            const parsed = z.array(golmokStoreSchema).parse(r.rows);
            // 상권별 캐싱 (fire-and-forget)
            if (redis) {
              redis.set(`seoul:store:${qc}:${m.cd}`, parsed, { ex: TTL.QUARTER })
                .catch(() => {});
            }
            return { cd: m.cd, data: parsed };
          })
          .catch((err) => {
            console.warn(`[서울 점포] 상권 ${m.cd} 조회 실패:`, err);
            return { cd: m.cd, data: [] as GolmokStore[] };
          }),
      ),
    );
    // misses에 fetch 결과 반영
    for (const fr of fetchResults) {
      const idx = perTrdarResults.findIndex((r) => r.cd === fr.cd);
      if (idx >= 0) perTrdarResults[idx] = { ...fr, hit: false };
    }
  }

  const all = perTrdarResults.flatMap((r) => r.data ?? []);
  const filtered = all.filter((r) =>
    matchesIndustry(r.SVC_INDUTY_CD_NM, params.industryKeyword),
  );

  console.log(
    `[서울 점포] ${params.trdarCodes.length}개 상권 (캐시 ${hits.length}/API ${misses.length}) → 전체 ${all.length}건 → 업종필터 → ${filtered.length}건`,
  );
  return filtered;
}

/**
 * 상권변화지표 조회.
 * VwsmTrdarIxQq 전체(1,650건)를 캐시 후 상권코드로 필터.
 * API 호출: 최초 2회, 이후 0회 (30일 캐시)
 */
export async function getChangeIndex(params: {
  quarter?: string;
  trdarCodes?: string[];
}): Promise<GolmokChangeIndex[]> {
  if (USE_MOCK) {
    const mock = await import("../mock/seoul-golmok-change-index.json");
    return z.array(golmokChangeIndexSchema).parse(mock.default.row);
  }

  const qc = params.quarter ?? getRecentQuarterCode();

  const all = await cachedFetch(
    `seoul:VwsmTrdarIxQq:${qc}`,
    TTL.QUARTER,
    () => fetchAllPages<GolmokChangeIndex>("VwsmTrdarIxQq", [qc])
      .then((rows) => z.array(golmokChangeIndexSchema).parse(rows)),
  );

  if (!params.trdarCodes) return all;

  const filtered = all.filter((r) => params.trdarCodes!.includes(r.TRDAR_CD));
  console.log(
    `[서울 변화지표] 캐시 ${all.length}건 중 상권필터 → ${filtered.length}건`,
  );
  return filtered;
}

/**
 * 유동인구 조회 (VwsmTrdarFlpopQq).
 * 상권 단위, ~1,648건/분기 — 전체 캐시 후 상권코드 필터.
 */
export async function getFloatingPopulation(params: {
  quarter?: string;
  trdarCodes: string[];
}): Promise<GolmokFloatingPop[]> {
  if (USE_MOCK) return [];

  const qc = params.quarter ?? getRecentQuarterCode();

  // 유동인구는 ~1,650건으로 소량 → 단일 키 캐싱 가능
  const all = await cachedFetch(
    `seoul:VwsmTrdarFlpopQq:${qc}`,
    TTL.QUARTER,
    () => fetchAllPages<GolmokFloatingPop>("VwsmTrdarFlpopQq", [qc])
      .then((rows) => z.array(golmokFloatingPopSchema).parse(rows)),
  );

  const filtered = all.filter((r) => params.trdarCodes.includes(r.TRDAR_CD));
  console.log(
    `[서울 유동인구] 전체 ${all.length}건 중 상권필터 → ${filtered.length}건`,
  );
  return filtered;
}

/**
 * 상주인구 조회 (VwsmTrdarRepopQq).
 * 상권 단위, ~1,648건/분기 — 전체 캐시 후 상권코드 필터.
 */
export async function getResidentPopulation(params: {
  quarter?: string;
  trdarCodes: string[];
}): Promise<GolmokResidentPop[]> {
  if (USE_MOCK) return [];

  const qc = params.quarter ?? getRecentQuarterCode();

  // 상주인구 39K건 → 단일 키 캐싱 불가 (Upstash 1MB 제한)
  // 매출과 동일한 상권코드별 분할 캐싱 패턴 적용

  // 1단계: 요청된 상권코드별 캐시 조회
  const perTrdarResults = await Promise.all(
    params.trdarCodes.map(async (cd) => {
      try {
        if (redis) {
          const cached = await redis.get<GolmokResidentPop[]>(
            `seoul:repop:${qc}:${cd}`,
          );
          if (cached) return { cd, data: cached, hit: true };
        }
      } catch { /* Redis 실패 → 캐시 미스 취급 */ }
      return { cd, data: null as GolmokResidentPop[] | null, hit: false };
    }),
  );

  const hitCount = perTrdarResults.filter((r) => r.hit).length;

  // 2단계: 모든 상권 캐시 히트 → API 호출 없이 반환
  if (hitCount === params.trdarCodes.length) {
    const all = perTrdarResults.flatMap((r) => r.data!);
    console.log(
      `[서울 상주인구] 캐시 히트 ${hitCount}/${params.trdarCodes.length}개 상권 → ${all.length}건 (API 0회)`,
    );
    return all;
  }

  // 3단계: 캐시 미스 → 전체 fetch
  console.log(
    `[서울 상주인구] 캐시 히트 ${hitCount}/${params.trdarCodes.length}개 → 전체 fetch 시작`,
  );

  const allRows = await fetchAllPages<GolmokResidentPop>(
    "VwsmTrdarRepopQq",
    [qc],
  ).then((rows) => z.array(golmokResidentPopSchema).parse(rows));

  // 4단계: 전체 상권코드 분할 캐싱 (fire-and-forget)
  // 데이터 없는 상권도 빈 배열로 캐싱 (미스 → 전체 재호출 방지)
  if (redis) {
    const dataByTrdar = new Map<string, GolmokResidentPop[]>();
    for (const row of allRows) {
      const arr = dataByTrdar.get(row.TRDAR_CD) ?? [];
      arr.push(row);
      dataByTrdar.set(row.TRDAR_CD, arr);
    }
    for (const cd of params.trdarCodes) {
      if (!dataByTrdar.has(cd)) dataByTrdar.set(cd, []);
    }
    console.log(
      `[서울 상주인구] ${dataByTrdar.size}개 상권 분산 캐싱 시작`,
    );
    const cachePromises = [...dataByTrdar.entries()].map(([cd, rows]) =>
      redis!
        .set(`seoul:repop:${qc}:${cd}`, rows, { ex: TTL.QUARTER })
        .catch(() => {}),
    );
    Promise.all(cachePromises).catch(() => {});
  }

  const filtered = allRows.filter((r) =>
    params.trdarCodes.includes(r.TRDAR_CD),
  );
  console.log(
    `[서울 상주인구] 전체 ${allRows.length.toLocaleString()}건 → 상권(${params.trdarCodes.length}개) 필터 → ${filtered.length}건`,
  );
  return filtered;
}



/**
 * 추정매출 조회.
 * VwsmTrdarSelngQq는 URL 필터 미지원 → 전체(21K건)를 분기별 캐시.
 * API 호출: 최초 22회, 이후 0회 (7일 캐시)
 */
export async function getEstimatedSales(params: {
  quarter?: string;
  industryKeyword: string;
  trdarCodes: string[];
}): Promise<GolmokSales[]> {
  if (USE_MOCK) {
    const mock = await import("../mock/seoul-golmok-sales.json");
    return z.array(golmokSalesSchema)
      .parse(mock.default.row)
      .filter((r) => matchesIndustry(r.SVC_INDUTY_CD_NM, params.industryKeyword));
  }

  const qc = params.quarter ?? getRecentQuarterCode();

  // 상권코드별 분할 캐싱 (전체 21K건 23MB > Upstash 10MB 제한)
  // 상권당 ~13건(~6KB)이므로 개별 캐싱 가능

  // 1단계: 요청된 상권코드별 캐시 조회
  const perTrdarResults = await Promise.all(
    params.trdarCodes.map(async (cd) => {
      try {
        if (redis) {
          const cached = await redis.get<GolmokSales[]>(`seoul:sales:${qc}:${cd}`);
          if (cached) return { cd, data: cached, hit: true };
        }
      } catch { /* Redis 실패 → 캐시 미스 취급 */ }
      return { cd, data: null as GolmokSales[] | null, hit: false };
    }),
  );

  const hitCount = perTrdarResults.filter((r) => r.hit).length;

  // 2단계: 모든 상권 캐시 히트 → API 호출 없이 반환
  if (hitCount === params.trdarCodes.length) {
    const all = perTrdarResults.flatMap((r) => r.data!);
    const filtered = all.filter((r) =>
      matchesIndustry(r.SVC_INDUTY_CD_NM, params.industryKeyword),
    );
    console.log(
      `[서울 매출] 캐시 히트 ${hitCount}/${params.trdarCodes.length}개 상권 → 업종필터 → ${filtered.length}건 (API 0회)`,
    );
    return filtered;
  }

  // 3단계: 캐시 미스 → 전체 fetch (URL 필터 미지원이므로 불가피)
  console.log(
    `[서울 매출] 캐시 히트 ${hitCount}/${params.trdarCodes.length}개 → 전체 fetch 시작`,
  );

  const allSales = await fetchAllPages<GolmokSales>("VwsmTrdarSelngQq", [qc])
    .then((rows) => z.array(golmokSalesSchema).parse(rows));

  // 4단계: 전체 상권코드 분할 캐싱 (fire-and-forget)
  // 데이터 있는 상권 + 요청했지만 데이터 없는 상권 모두 캐싱
  // (빈 배열도 캐싱해야 다음 요청 시 "캐시 미스 → 전체 재호출" 방지)
  if (redis) {
    const dataByTrdar = new Map<string, GolmokSales[]>();
    for (const row of allSales) {
      const arr = dataByTrdar.get(row.TRDAR_CD) ?? [];
      arr.push(row);
      dataByTrdar.set(row.TRDAR_CD, arr);
    }
    // 요청된 상권코드 중 데이터 없는 것도 빈 배열로 캐싱
    for (const cd of params.trdarCodes) {
      if (!dataByTrdar.has(cd)) dataByTrdar.set(cd, []);
    }
    console.log(
      `[서울 매출] ${dataByTrdar.size}개 상권 분산 캐싱 시작`,
    );
    const cachePromises = [...dataByTrdar.entries()].map(([cd, rows]) =>
      redis!
        .set(`seoul:sales:${qc}:${cd}`, rows, { ex: TTL.SALES })
        .catch(() => {}),
    );
    Promise.all(cachePromises).catch(() => {});
  }

  const filtered = allSales.filter(
    (r) =>
      params.trdarCodes.includes(r.TRDAR_CD) &&
      matchesIndustry(r.SVC_INDUTY_CD_NM, params.industryKeyword),
  );

  console.log(
    `[서울 매출] 전체 ${allSales.length.toLocaleString()}건 → 상권(${params.trdarCodes.length}개)+업종 필터 → ${filtered.length}건`,
  );
  return filtered;
}

// ─── 집계 헬퍼 ───

function findPeakDay(s: GolmokSales): string {
  const days = [
    { n: "월요일", v: s.MON_SELNG_AMT },
    { n: "화요일", v: s.TUES_SELNG_AMT },
    { n: "수요일", v: s.WED_SELNG_AMT },
    { n: "목요일", v: s.THUR_SELNG_AMT },
    { n: "금요일", v: s.FRI_SELNG_AMT },
    { n: "토요일", v: s.SAT_SELNG_AMT },
    { n: "일요일", v: s.SUN_SELNG_AMT },
  ];
  return days.reduce((m, d) => (d.v > m.v ? d : m), days[0]).n;
}

function findPeakTimeSlot(s: GolmokSales): string {
  const slots = [
    { n: "00~06시", v: s.TMZON_00_06_SELNG_AMT },
    { n: "06~11시", v: s.TMZON_06_11_SELNG_AMT },
    { n: "11~14시", v: s.TMZON_11_14_SELNG_AMT },
    { n: "14~17시", v: s.TMZON_14_17_SELNG_AMT },
    { n: "17~21시", v: s.TMZON_17_21_SELNG_AMT },
    { n: "21~24시", v: s.TMZON_21_24_SELNG_AMT },
  ];
  return slots.reduce((m, sl) => (sl.v > m.v ? sl : m), slots[0]).n;
}

function findMainAgeGroup(s: GolmokSales): string {
  const groups = [
    { n: "10대", v: s.AGRDE_10_SELNG_AMT },
    { n: "20대", v: s.AGRDE_20_SELNG_AMT },
    { n: "30대", v: s.AGRDE_30_SELNG_AMT },
    { n: "40대", v: s.AGRDE_40_SELNG_AMT },
    { n: "50대", v: s.AGRDE_50_SELNG_AMT },
    { n: "60대 이상", v: s.AGRDE_60_ABOVE_SELNG_AMT },
  ];
  return groups.reduce((m, g) => (g.v > m.v ? g : m), groups[0]).n;
}

function findMainGender(s: GolmokSales): string {
  return s.ML_SELNG_AMT > s.FML_SELNG_AMT ? "남성" : "여성";
}

/** 골목상권 데이터 집계 결과 */
export interface GolmokAggregated {
  estimatedQuarterlySales: number;
  salesCount: number;
  weekdayRatio: number;
  peakTimeSlot: string;
  peakDay: string;
  storeCount: number;
  openRate: number;
  closeRate: number;
  franchiseCount: number;
  changeIndex?: string;
  changeIndexName?: string;
  mainAgeGroup: string;
  mainGender: string;
  /** 유동인구 집계 */
  floatingPopulation?: {
    totalFloating: number;
    maleRatio: number;
    peakTimeSlot: string;
    peakDay: string;
    mainAgeGroup: string;
  };
  /** 상주인구 집계 */
  residentPopulation?: {
    totalResident: number;
    totalHouseholds: number;
  };
}

/** 3개 API 응답을 단일 집계 객체로 변환 */
/** 유동인구 피크 시간대 */
function findPeakTimeSlotFlpop(data: GolmokFloatingPop[]): string {
  // 00~06시 제외: 수면 인구가 유동인구로 집계되어 78%가 새벽 피크로 왜곡됨
  const slots = [
    { n: "06~11시", v: data.reduce((s, d) => s + d.TMZON_06_11_FLPOP_CO, 0) },
    { n: "11~14시", v: data.reduce((s, d) => s + d.TMZON_11_14_FLPOP_CO, 0) },
    { n: "14~17시", v: data.reduce((s, d) => s + d.TMZON_14_17_FLPOP_CO, 0) },
    { n: "17~21시", v: data.reduce((s, d) => s + d.TMZON_17_21_FLPOP_CO, 0) },
    { n: "21~24시", v: data.reduce((s, d) => s + d.TMZON_21_24_FLPOP_CO, 0) },
  ];
  return slots.reduce((m, t) => (t.v > m.v ? t : m), slots[0]).n;
}

/** 유동인구 피크 요일 */
function findPeakDayFlpop(data: GolmokFloatingPop[]): string {
  const days = [
    { n: "월요일", v: data.reduce((s, d) => s + d.MON_FLPOP_CO, 0) },
    { n: "화요일", v: data.reduce((s, d) => s + d.TUES_FLPOP_CO, 0) },
    { n: "수요일", v: data.reduce((s, d) => s + d.WED_FLPOP_CO, 0) },
    { n: "목요일", v: data.reduce((s, d) => s + d.THUR_FLPOP_CO, 0) },
    { n: "금요일", v: data.reduce((s, d) => s + d.FRI_FLPOP_CO, 0) },
    { n: "토요일", v: data.reduce((s, d) => s + d.SAT_FLPOP_CO, 0) },
    { n: "일요일", v: data.reduce((s, d) => s + d.SUN_FLPOP_CO, 0) },
  ];
  return days.reduce((m, t) => (t.v > m.v ? t : m), days[0]).n;
}

/** 유동인구 주 연령대 */
function findMainAgeGroupFlpop(data: GolmokFloatingPop[]): string {
  // 60대 이상은 60~100+ (약 3~4개 10년 구간)를 하나로 묶은 것이므로
  // 공정한 비교를 위해 3으로 나눠서 10년 구간당 밀도로 비교
  const groups = [
    { n: "10대", v: data.reduce((s, d) => s + d.AGRDE_10_FLPOP_CO, 0) },
    { n: "20대", v: data.reduce((s, d) => s + d.AGRDE_20_FLPOP_CO, 0) },
    { n: "30대", v: data.reduce((s, d) => s + d.AGRDE_30_FLPOP_CO, 0) },
    { n: "40대", v: data.reduce((s, d) => s + d.AGRDE_40_FLPOP_CO, 0) },
    { n: "50대", v: data.reduce((s, d) => s + d.AGRDE_50_FLPOP_CO, 0) },
    { n: "60대 이상", v: data.reduce((s, d) => s + d.AGRDE_60_ABOVE_FLPOP_CO, 0) / 3 },
  ];
  return groups.reduce((m, g) => (g.v > m.v ? g : m), groups[0]).n;
}

/** 유동인구 집계 */
function aggregateFloatingPop(data: GolmokFloatingPop[]) {
  const totalFloating = data.reduce((s, d) => s + d.TOT_FLPOP_CO, 0);
  const totalMale = data.reduce((s, d) => s + d.ML_FLPOP_CO, 0);
  return {
    totalFloating,
    maleRatio: totalFloating > 0 ? totalMale / totalFloating : 0.5,
    peakTimeSlot: findPeakTimeSlotFlpop(data),
    peakDay: findPeakDayFlpop(data),
    mainAgeGroup: findMainAgeGroupFlpop(data),
  };
}

/** 상주인구 집계 */
function aggregateResidentPop(data: GolmokResidentPop[]) {
  const totalResident = data.reduce((s, d) => s + d.TOT_REPOP_CO, 0);
  const totalHouseholds = data.reduce((s, d) => s + d.TOT_HSHLD_CO, 0);
  return {
    totalResident,
    totalHouseholds,
  };
}



export function aggregateGolmokData(
  sales: GolmokSales[],
  stores: GolmokStore[],
  changeIndexes: GolmokChangeIndex[],
  floatingPop?: GolmokFloatingPop[],
  residentPop?: GolmokResidentPop[],
): GolmokAggregated | null {
  if (sales.length === 0) return null;

  const totalSales = sales.reduce((sum, s) => sum + s.THSMON_SELNG_AMT, 0);
  const totalCount = sales.reduce((sum, s) => sum + s.THSMON_SELNG_CO, 0);
  const totalMdwk = sales.reduce((sum, s) => sum + s.MDWK_SELNG_AMT, 0);

  // 대표 매출 데이터 (매출 최대 상권)
  const rep = sales.reduce(
    (max, s) => (s.THSMON_SELNG_AMT > max.THSMON_SELNG_AMT ? s : max),
    sales[0],
  );

  const totalStores = stores.reduce((sum, s) => sum + s.STOR_CO, 0);
  const totalFranchise = stores.reduce((sum, s) => sum + s.FRC_STOR_CO, 0);

  // 개폐업률: 비율의 평균이 아닌 절대 건수 합산 후 비율 계산
  // (개별 레코드의 90%가 0%이므로 비율 평균은 무의미)
  const totalOpenCount = stores.reduce((sum, s) => sum + s.OPBIZ_STOR_CO, 0);
  const totalCloseCount = stores.reduce((sum, s) => sum + s.CLSBIZ_STOR_CO, 0);
  const avgOpenRate =
    totalStores > 0 ? (totalOpenCount / totalStores) * 100 : 0;
  const avgCloseRate =
    totalStores > 0 ? (totalCloseCount / totalStores) * 100 : 0;

  // 상권변화지표: 가장 빈번한 등급
  const ixCounts = changeIndexes.reduce(
    (acc, ci) => {
      acc[ci.TRDAR_CHNGE_IX] = (acc[ci.TRDAR_CHNGE_IX] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const dominant = Object.entries(ixCounts).sort((a, b) => b[1] - a[1])[0];
  const domCi = changeIndexes.find((ci) => ci.TRDAR_CHNGE_IX === dominant?.[0]);

  // 유동인구 집계
  const floatingPopulation = floatingPop && floatingPop.length > 0
    ? aggregateFloatingPop(floatingPop) : undefined;

  // 상주인구 집계
  const residentPopulation = residentPop && residentPop.length > 0
    ? aggregateResidentPop(residentPop) : undefined;

  return {
    estimatedQuarterlySales: totalSales,
    salesCount: totalCount,
    weekdayRatio: totalSales > 0 ? totalMdwk / totalSales : 0.5,
    peakTimeSlot: findPeakTimeSlot(rep),
    peakDay: findPeakDay(rep),
    storeCount: totalStores,
    openRate: Math.round(avgOpenRate * 10) / 10,
    closeRate: Math.round(avgCloseRate * 10) / 10,
    franchiseCount: totalFranchise,
    changeIndex: domCi?.TRDAR_CHNGE_IX,
    changeIndexName: domCi?.TRDAR_CHNGE_IX_NM,
    mainAgeGroup: findMainAgeGroup(rep),
    mainGender: findMainGender(rep),
    floatingPopulation,
    residentPopulation,
  };
}
