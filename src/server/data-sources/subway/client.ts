import { env, hasApiKey } from "@/lib/env";
import { cachedFetch, CACHE_TTL } from "@/server/cache/redis";

/** 서울 열린데이터 광장 API 베이스 URL */
const SEOUL_API_BASE = "http://openapi.seoul.go.kr:8088";

/**
 * 일평균 산출을 위한 조회 일수.
 * 7일이면 주중/주말 패턴을 포함하여 충분한 대표성을 가진다.
 * 30일에서 7일로 축소: CardSubwayStatsNew API는 전체 역 데이터를 반환하므로
 * 하루당 ~600건, 7일 x 600건 = ~4,200건을 5페이지로 커버 가능.
 */
const QUERY_DAYS = 7;

// ─── 응답 타입 ─────────────────────────────────────────

interface SeoulApiSuccessBody<T> {
  list_total_count: number;
  RESULT: { CODE: string; MESSAGE: string };
  row: T[];
}

interface SeoulApiErrorBody {
  RESULT?: { CODE: string; MESSAGE: string };
}

/** OA-12914: 일별 승하차 인원 원시 행 */
interface SubwayDailyRow {
  /** 사용일자 (YYYYMMDD) */
  USE_DT: string;
  /** 호선명 (예: "2호선") */
  LINE_NUM: string;
  /** 역명 (예: "강남") */
  SUB_STA_NM: string;
  /** 승차 인원 */
  RIDE_PASGR_NUM: number;
  /** 하차 인원 */
  ALIGHT_PASGR_NUM: number;
}

/** 역별 일평균 승하차 집계 결과 */
export interface SubwayTrafficData {
  /** 역명 */
  stationName: string;
  /** 호선명 (대표) */
  lineName: string;
  /** 일평균 승차 인원 */
  dailyAvgRide: number;
  /** 일평균 하차 인원 */
  dailyAvgAlight: number;
  /** 일평균 총 승하차 인원 */
  dailyAvgTotal: number;
  /** 조회 기간 일수 */
  days: number;
  /** 분석 대상 역까지의 거리(m) */
  distanceMeters: number;
}

// ─── 서울 열린데이터 API 호출 ─────────────────────────

/** 서울 열린데이터 광장 단일 페이지 조회 (seoul-golmok 패턴 재사용) */
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

  // 10초 타임아웃
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

  // XML 에러 응답 처리
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

/**
 * 1000건 제한 우회: 전체 페이지 병렬 호출 (seoul-golmok 패턴 재사용).
 *
 * CardSubwayStatsNew API는 날짜 범위 내 전체 역 데이터를 반환한다.
 * 7일 기준 ~4,200건(~600역-호선 조합/일) → 5페이지 병렬 호출.
 */
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

/** 최근 N일 기간의 시작/종료 날짜 (YYYYMMDD) */
function getRecentDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  // 서울 열린데이터 반영 지연 감안하여 7일 전부터 역산
  end.setDate(end.getDate() - 7);
  const start = new Date(end);
  start.setDate(start.getDate() - QUERY_DAYS);

  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

// ─── 역명 정규화 ───────────────────────────────────────

/**
 * 카카오 Place에서 반환하는 역명을 서울 열린데이터 API 역명으로 정규화
 * 예: "강남역 2호선" → "강남", "서울역" → "서울역"
 */
export function normalizeStationName(kakaoName: string): string {
  // "OO역 N호선" 패턴 → "OO" 추출
  const match = kakaoName.match(/^(.+?)역?\s*\d*호선?$/);
  if (match) return match[1];
  // "OO역" → "OO" (단, "서울역"처럼 역 자체가 이름인 경우 보존)
  const KEEP_SUFFIX = ["서울역"];
  if (KEEP_SUFFIX.includes(kakaoName)) return kakaoName;
  return kakaoName.replace(/역$/, "");
}

// ─── 핵심: 일별 승하차 데이터 조회 ────────────────────

/**
 * OA-12914: 역별 일별 승하차 인원 조회 (최근 7일)
 *
 * CardSubwayStatsNew API는 날짜 범위 내 전체 역 데이터를 반환한다.
 * 7일 조회 시 ~4,200건 → fetchAllPages로 전체 수집 후 역명 필터링.
 * 결과는 역명+기간 키로 캐시하여 반복 호출 방지.
 */
export async function getSubwayDailyTraffic(
  stationName: string,
): Promise<SubwayDailyRow[]> {
  const { startDate, endDate } = getRecentDateRange();
  const cacheKey = `subway:daily:${stationName}:${startDate}`;

  return cachedFetch(cacheKey, CACHE_TTL.SEOUL, async () => {
    // 전체 페이지 수집 후 역명 필터링
    const allRows = await fetchAllPages<SubwayDailyRow>(
      "CardSubwayStatsNew",
      [startDate, endDate],
    );

    const filtered = allRows.filter((r) => r.SUB_STA_NM === stationName);
    console.log(
      `[지하철] 전체 ${allRows.length.toLocaleString()}건 → ${stationName}역 필터 → ${filtered.length}건`,
    );
    return filtered;
  });
}

/** 일별 데이터를 일평균으로 집계 */
export function aggregateDailyTraffic(
  rows: SubwayDailyRow[],
  stationName: string,
  distanceMeters: number,
): SubwayTrafficData | null {
  if (rows.length === 0) return null;

  // 날짜별 그룹핑하여 정확한 일수 산출
  const dateSet = new Set(rows.map((r) => r.USE_DT));
  const days = dateSet.size;

  const totalRide = rows.reduce((sum, r) => sum + Number(r.RIDE_PASGR_NUM), 0);
  const totalAlight = rows.reduce(
    (sum, r) => sum + Number(r.ALIGHT_PASGR_NUM),
    0,
  );

  // 대표 호선: 가장 많이 등장하는 호선
  const lineCount = new Map<string, number>();
  for (const r of rows) {
    lineCount.set(r.LINE_NUM, (lineCount.get(r.LINE_NUM) ?? 0) + 1);
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

// ─── Mock 데이터 ───────────────────────────────────────


