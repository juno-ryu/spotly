import { env } from "@/lib/env";
import { cachedFetch, CACHE_TTL } from "@/server/cache/redis";

/** 서울 열린데이터 광장 API 베이스 URL */
const SEOUL_API_BASE = "http://openapi.seoul.go.kr:8088";

// ─── 응답 타입 ─────────────────────────────────────────

interface SeoulApiSuccessBody<T> {
  list_total_count: number;
  RESULT: { CODE: string; MESSAGE: string };
  row: T[];
}

interface SeoulApiErrorBody {
  RESULT?: { CODE: string; MESSAGE: string };
}

/**
 * OA-12252: 호선별 역별 시간대별 승하차 인원 (CardSubwayTime)
 * 월별 합계 데이터. HR_N_GET_ON_NOPE: N시 승차, HR_N_GET_OFF_NOPE: N시 하차 (04~익일03시)
 */
interface SubwayTimeRow {
  /** 사용월 (YYYYMM) */
  USE_MM: string;
  /** 호선명 (예: "2호선") */
  SBWY_ROUT_LN_NM: string;
  /** 역명 (예: "강남", "서울역") */
  STTN: string;
  [key: string]: number | string; // HR_N_GET_ON_NOPE, HR_N_GET_OFF_NOPE
}

/** 역별 일평균 승하차 집계 결과 */
export interface SubwayTrafficData {
  stationName: string;
  lineName: string;
  dailyAvgRide: number;
  dailyAvgAlight: number;
  dailyAvgTotal: number;
  /** 일평균 산출 기준 월 일수 */
  days: number;
  distanceMeters: number;
}

// ─── 서울 열린데이터 API 호출 ─────────────────────────

/** 서울 열린데이터 광장 단일 페이지 조회 */
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
  console.log(`[지하철 API 호출] ${label}`);
  const t0 = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`[지하철 API] ${label}: 10초 타임아웃 초과`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`[지하철 API] ${label}: HTTP ${res.status}`);

  const text = await res.text();

  if (text.startsWith("<")) {
    const code = text.match(/<CODE>([^<]+)<\/CODE>/)?.[1] ?? "UNKNOWN";
    if (code === "INFO-200") return { rows: [], totalCount: 0 };
    const msg =
      text.match(/<MESSAGE><!\[CDATA\[([^\]]+)\]\]><\/MESSAGE>/)?.[1] ??
      "XML 에러";
    throw new Error(`[지하철 API] ${label}: ${code} ${msg}`);
  }

  const data = JSON.parse(text);
  const svc = data[serviceName] as SeoulApiSuccessBody<T> | undefined;

  if (!svc) {
    const err = data as SeoulApiErrorBody;
    if (err.RESULT?.CODE === "INFO-200") return { rows: [], totalCount: 0 };
    throw new Error(
      `[지하철 API] ${label}: ${err.RESULT?.MESSAGE ?? "알 수 없는 응답"}`,
    );
  }

  if (svc.RESULT.CODE !== "INFO-000") {
    if (svc.RESULT.CODE === "INFO-200") return { rows: [], totalCount: 0 };
    throw new Error(`[지하철 API] ${label}: ${svc.RESULT.MESSAGE}`);
  }

  console.log(
    `[지하철 API 응답] ${label} → ${svc.row.length}건 / 전체 ${svc.list_total_count}건 (${Date.now() - t0}ms)`,
  );
  return { rows: svc.row, totalCount: svc.list_total_count };
}

/** 1000건 제한 우회: 전체 페이지 병렬 호출 */
async function fetchAllPages<T>(
  serviceName: string,
  conditions: string[] = [],
): Promise<T[]> {
  const first = await fetchPage<T>(serviceName, 1, 1000, conditions);
  if (first.totalCount <= 1000) return first.rows;

  const pageCount = Math.ceil(first.totalCount / 1000);
  console.log(
    `[지하철 API 페이지네이션] ${serviceName} 총 ${first.totalCount.toLocaleString()}건 → ${pageCount}페이지 병렬호출`,
  );

  const promises = Array.from({ length: pageCount - 1 }, (_, i) => {
    const s = (i + 1) * 1000 + 1;
    const e = Math.min((i + 2) * 1000, first.totalCount);
    return fetchPage<T>(serviceName, s, e, conditions)
      .then((r) => r.rows)
      .catch((err) => {
        console.warn(
          `[지하철 API 페이지네이션] 페이지 ${i + 2}/${pageCount} 실패:`,
          err instanceof Error ? err.message : String(err),
        );
        return [] as T[];
      });
  });

  const rest = await Promise.all(promises);
  const all = [first.rows, ...rest].flat();
  console.log(
    `[지하철 API 페이지네이션] ${serviceName} 완료: ${all.length.toLocaleString()}건`,
  );
  return all;
}

// ─── 날짜 유틸 ─────────────────────────────────────────

/**
 * CardSubwayTime API 조회 대상 월 산출 (YYYYMM)
 * 매월 5일 이후 전월 데이터 갱신 → 5일 이전이면 전전달 사용
 */
function getTargetMonth(): string {
  const d = new Date();
  const lag = d.getDate() < 5 ? 2 : 1;
  d.setMonth(d.getMonth() - lag);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 해당 월의 일수 산출 */
function daysInMonth(yyyymm: string): number {
  const year = parseInt(yyyymm.slice(0, 4));
  const month = parseInt(yyyymm.slice(4, 6));
  return new Date(year, month, 0).getDate();
}

// ─── 역명 정규화 ───────────────────────────────────────

/**
 * 카카오 Place 역명을 CardSubwayTime STTN 필드명으로 정규화
 * 예: "강남역 2호선" → "강남", "서울역" → "서울역"
 */
export function normalizeStationName(kakaoName: string): string {
  const match = kakaoName.match(/^(.+?)역?\s*\d*호선?$/);
  if (match) return match[1];
  const KEEP_SUFFIX = ["서울역"];
  if (KEEP_SUFFIX.includes(kakaoName)) return kakaoName;
  return kakaoName.replace(/역$/, "");
}

/** STTN 필드와 정규화된 역명 매칭 (역 접미사 유무 모두 허용) */
function matchStation(sttn: string, targetName: string): boolean {
  const norm = (s: string) => s.replace(/역$/, "");
  return norm(sttn) === norm(targetName);
}

// ─── 핵심: 월별 승하차 데이터 조회 ────────────────────

/** CardSubwayTime 시간대 목록 (04시~익일03시, 24개 슬롯) */
const SUBWAY_HOURS = [
  4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
  0, 1, 2, 3,
];

/**
 * OA-12252: 역별 시간대별 월 승하차 인원 조회 (CardSubwayTime)
 *
 * 전월 데이터(매월 5일 갱신)를 조회하여 역명 필터링 후 반환.
 * 전체 역 데이터(~620건/월)를 한 번에 수집 후 역명으로 필터.
 */
export async function getSubwayMonthlyTraffic(
  stationName: string,
): Promise<SubwayTimeRow[]> {
  const month = getTargetMonth();
  const cacheKey = `subway:monthly:${stationName}:${month}`;

  return cachedFetch(cacheKey, CACHE_TTL.SEOUL, async () => {
    const allRows = await fetchAllPages<SubwayTimeRow>("CardSubwayTime", [
      month,
    ]);

    const filtered = allRows.filter((r) => matchStation(String(r.STTN), stationName));
    console.log(
      `[지하철] 전체 ${allRows.length.toLocaleString()}건 → ${stationName}역 필터 → ${filtered.length}건`,
    );
    return filtered;
  });
}

/** 월별 시간대 데이터를 일평균으로 집계 */
export function aggregateMonthlyTraffic(
  rows: SubwayTimeRow[],
  stationName: string,
  distanceMeters: number,
): SubwayTrafficData | null {
  if (rows.length === 0) return null;

  const month = String(rows[0].USE_MM);
  const days = daysInMonth(month);

  let totalRide = 0;
  let totalAlight = 0;
  for (const row of rows) {
    for (const h of SUBWAY_HOURS) {
      totalRide += Number(row[`HR_${h}_GET_ON_NOPE`]) || 0;
      totalAlight += Number(row[`HR_${h}_GET_OFF_NOPE`]) || 0;
    }
  }

  // 대표 호선: 가장 많이 등장하는 호선
  const lineCount = new Map<string, number>();
  for (const r of rows) {
    lineCount.set(
      String(r.SBWY_ROUT_LN_NM),
      (lineCount.get(String(r.SBWY_ROUT_LN_NM)) ?? 0) + 1,
    );
  }
  const lineName =
    [...lineCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  return {
    stationName,
    lineName,
    dailyAvgRide: Math.round(totalRide / days),
    dailyAvgAlight: Math.round(totalAlight / days),
    dailyAvgTotal: Math.round((totalRide + totalAlight) / days),
    days,
    distanceMeters,
  };
}
