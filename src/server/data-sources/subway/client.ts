import { env } from "@/lib/env";
import { cachedFetch, CACHE_TTL, redis } from "@/server/cache/redis";
import { fetchSeoulAllPages } from "@/server/data-sources/seoul-common";

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

// fetchSeoulPage / fetchSeoulAllPages → seoul-common.ts로 통합

// ─── 날짜 유틸 ─────────────────────────────────────────

/**
 * CardSubwayTime API 조회 대상 월 산출 (YYYYMM)
 * 매월 5일 이후 전월 데이터 갱신 → 5일 이전이면 전전달 사용
 */
export function getTargetMonth(): string {
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
  const KEEP_SUFFIX = ["서울역"];
  if (KEEP_SUFFIX.includes(kakaoName)) return kakaoName;

  // "해운대역 부산2호선", "강남역 2호선" 등 — 역 뒤에 공백+노선 정보
  const midMatch = kakaoName.match(/^(.+?)역\s+.+$/);
  if (midMatch) return midMatch[1];

  // "2호선 XX역" 등 앞에 노선명 오는 케이스
  const match = kakaoName.match(/^(.+?)역?\s*\d*호선?$/);
  if (match) return match[1];

  return kakaoName.replace(/역$/, "");
}

/** STTN 필드와 정규화된 역명 매칭 (역 접미사 유무 모두 허용) */
function matchStation(sttn: string, targetName: string): boolean {
  // "화랑대(공릉)", "봉화산(중계)" 같은 괄호 표기 제거 후 비교
  const norm = (s: string) =>
    s
      .replace(/역$/, "")
      .replace(/\s*\(.*?\)$/, "")
      .trim();
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
  // 서울 열린데이터 광장 CardSubwayTime 데이터 제공 상한 (보통 2~3개월 지연)
  // 해당 월 이후 데이터가 미집계 상태이므로 상한선으로 고정
  const LAST_AVAILABLE = "202412";
  const rawMonth = getTargetMonth();
  const month = rawMonth > LAST_AVAILABLE ? LAST_AVAILABLE : rawMonth;
  const cacheKey = `subway:monthly:${stationName}:${month}`;

  // 빈 배열을 캐시하면 이후 조회에서 계속 0건이 반환되므로,
  // 캐시 미스 시 직접 조회하고 데이터가 있을 때만 캐시에 저장
  const cached = await (async () => {
    try {
      if (!redis) return null;
      return await redis.get<SubwayTimeRow[]>(cacheKey);
    } catch {
      return null;
    }
  })();

  if (cached !== null && cached.length > 0) {
    console.log(`[지하철] 캐시 히트: ${stationName}역 ${cached.length}건`);
    return cached;
  }

  const allRows = await fetchSeoulAllPages<SubwayTimeRow>("CardSubwayTime", [month], "지하철 API");

  const filtered = allRows.filter((r) => matchStation(String(r.STTN), stationName));
  console.log(
    `[지하철] 전체 ${allRows.length.toLocaleString()}건 → ${stationName}역 필터 → ${filtered.length}건`,
  );

  // 0건일 때: STTN 목록에서 유사 후보 출력 (역명 매핑 오류 디버깅)
  if (filtered.length === 0 && allRows.length > 0) {
    const uniqueStations = [...new Set(allRows.map((r) => String(r.STTN)))];
    const candidates = uniqueStations.filter(
      (s) =>
        s.includes(stationName) ||
        stationName.includes(s.replace(/역$/, "").replace(/\s*\(.*?\)$/, "").trim()),
    );
    console.warn(
      `[지하철] "${stationName}" 매칭 실패. 유사 STTN 후보:`,
      candidates.length > 0 ? candidates.slice(0, 10) : "없음",
      `/ 전체 역수: ${uniqueStations.length}`,
    );
  }

  // 데이터가 있을 때만 캐시 저장 (빈 배열은 저장 안 함)
  if (filtered.length > 0 && redis) {
    redis.set(cacheKey, filtered, { ex: CACHE_TTL.SEOUL }).catch(() => {});
  }

  return filtered;
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


// ─── 광주 교통공사 API ────────────────────────────────────

/** 광주 승하차 API 응답 아이템 */
interface GwangjuSubwayItem {
  businessDate: string;
  /** 승차 또는 하차 */
  gubunName: string;
  stationHname: string;
  h05h06: string;
  h06h07: string;
  h07h08: string;
  h08h09: string;
  h09h10: string;
  h10h11: string;
  h11h12: string;
  h12h13: string;
  h13h14: string;
  h14h15: string;
  h15h16: string;
  h16h17: string;
  h17h18: string;
  h18h19: string;
  h19h20: string;
  h20h21: string;
  h21h22: string;
  h22h23: string;
  h23h24: string;
}

/** 광주 시간대 필드 목록 (05시~23시) */
const GWANGJU_HOURS: Array<keyof GwangjuSubwayItem> = [
  "h05h06", "h06h07", "h07h08", "h08h09", "h09h10",
  "h10h11", "h11h12", "h12h13", "h13h14", "h14h15",
  "h15h16", "h16h17", "h17h18", "h18h19", "h19h20",
  "h20h21", "h21h22", "h22h23", "h23h24",
];

/**
 * 광주교통공사 1호선 승하차량 조회
 * Base URL: https://apis.data.go.kr/B551232/OAMS_STAT_01/GET_OAMS_STAT_01
 * 역명으로 필터, BUSINESS_DATE는 해당 월 첫날~말일 조회 후 일평균 계산
 */
export async function getGwangjuSubwayTraffic(
  stationName: string,
  yyyymm: string,
): Promise<SubwayTrafficData | null> {
  const key = env.DATA_GO_KR_API_KEY;
  if (!key) return null;

  // 광주 도시철도 API 데이터는 2024-11까지만 제공 (이후 미갱신)
  // yyyymm이 2024-11 이후면 마지막 가용 날짜로 고정
  const LAST_AVAILABLE = "202411";
  const targetYyyymm = yyyymm > LAST_AVAILABLE ? LAST_AVAILABLE : yyyymm;
  const year = targetYyyymm.slice(0, 4);
  const month = targetYyyymm.slice(4, 6);
  const businessDate = `${year}${month}15`;

  const cacheKey = `subway:gwangju:${stationName}:${yyyymm}`;
  return cachedFetch(cacheKey, CACHE_TTL.SEOUL, async () => {
    const allItems: GwangjuSubwayItem[] = [];
    let pageNo = 1;
    const numOfRows = 1000;

    while (true) {
      const params = new URLSearchParams({
        serviceKey: key,
        pageNo: String(pageNo),
        numOfRows: String(numOfRows),
        BUSINESS_DATE: businessDate,
        STATION_HNAME: stationName, // API가 정규화된 역명("상무")으로 필터 지원
        apiType: "json",
      });
      const url = `https://apis.data.go.kr/B551232/OAMS_STAT_01/GET_OAMS_STAT_01?${params.toString()}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let res: Response;
      try {
        res = await fetch(url, { signal: controller.signal });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new Error(`[광주 지하철 API] 10초 타임아웃 초과`);
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) throw new Error(`[광주 지하철 API] HTTP ${res.status}`);

      const data = await res.json() as {
        header?: { resultCode: string; resultMsg: string };
        body?: {
          totalCount: number;
          items?: Array<{ item: GwangjuSubwayItem }>;
        };
      };

      if (data.header?.resultCode !== "00") {
        console.warn(`[광주 지하철 API] ${data.header?.resultMsg ?? "알 수 없는 오류"}`);
        return null;
      }

      const rawItems = data.body?.items;
      if (!rawItems || rawItems.length === 0) break;

      const items = rawItems.map((r) => r.item);
      allItems.push(...items);

      const totalCount = data.body?.totalCount ?? 0;
      if (allItems.length >= totalCount) break;
      pageNo++;
    }

    console.log(`[광주 지하철] 전체 ${allItems.length}건 (${businessDate}) → "${stationName}" 필터`);

    // 클라이언트 필터링: stationHname 필드 기준
    const filtered = allItems.filter((item) =>
      matchStation(item.stationHname, stationName),
    );

    console.log(`[광주 지하철] 필터 결과: ${filtered.length}건`);
    if (filtered.length === 0) return null;

    let totalRide = 0;
    let totalAlight = 0;
    const dateSet = new Set<string>();

    for (const item of filtered) {
      dateSet.add(item.businessDate);
      const sum = GWANGJU_HOURS.reduce((acc, h) => acc + (Number(item[h]) || 0), 0);
      if (item.gubunName === "승차") totalRide += sum;
      else totalAlight += sum;
    }

    const actualDays = dateSet.size || 1;
    console.log(
      `[광주 지하철] ${stationName}: 일평균 승하차 ${Math.round((totalRide + totalAlight) / actualDays).toLocaleString()}명 (${actualDays}일)`,
    );

    return {
      stationName,
      lineName: "1호선",
      dailyAvgRide: Math.round(totalRide / actualDays),
      dailyAvgAlight: Math.round(totalAlight / actualDays),
      dailyAvgTotal: Math.round((totalRide + totalAlight) / actualDays),
      days: actualDays,
      distanceMeters: 0,
    };
  });
}

// ─── 대전 교통공사 API ────────────────────────────────────

/**
 * 대전 1호선 역번호 → 역명 매핑
 * (판암→대동 방향 기준, 1101~1122)
 */
const DAEJEON_STATION_MAP: Record<number, string> = {
  1101: "판암",
  1102: "신흥",
  1103: "대동",
  1104: "대전역",
  1105: "중앙로",
  1106: "중구청",
  1107: "서대전네거리",
  1108: "오룡",
  1109: "용문",
  1110: "탄방",
  1111: "시청",
  1112: "정부청사",
  1113: "갈마",
  1114: "월평",
  1115: "갑천",
  1116: "유성온천",
  1117: "구암",
  1118: "현충원",
  1119: "월드컵경기장",
  1120: "노은",
  1121: "지족",
  1122: "반석",
};

/** 대전 승하차 XML 응답 타입 */
interface DaejeonSubwayRow {
  businessDay: string;
  stationNo: number;
  /** 1: 승차, 2: 하차 */
  entryFlag: number;
  sumCnt: number;
}

/**
 * 대전교통공사 역별 승하차인원 조회 (XML)
 * URL: http://www.djtc.kr/OpenAPI/service/StationPassengerSVC/getStationPassenger
 */
export async function getDaejeonSubwayTraffic(
  stationName: string,
  yyyymm: string,
): Promise<SubwayTrafficData | null> {
  const key = env.DATA_GO_KR_API_KEY;
  if (!key) return null;

  const year = yyyymm.slice(0, 4);
  const month = yyyymm.slice(4, 6);
  const days = daysInMonth(yyyymm);
  const startDate = `${year}${month}01`;
  const endDate = `${year}${month}${String(days).padStart(2, "0")}`;

  // 역번호 조회
  // map 값과 입력 역명 양쪽 모두 "역" 제거 후 비교
  // (DAEJEON_STATION_MAP 일부 값이 "대전역" 형태로 저장되어 있어 불일치 방지)
  const stationNo = Object.entries(DAEJEON_STATION_MAP).find(
    ([, name]) => name.replace(/역$/, "") === stationName.replace(/역$/, ""),
  )?.[0];
  if (!stationNo) {
    console.warn(`[대전 지하철] 역번호 매핑 없음: ${stationName}`);
    return null;
  }

  const cacheKey = `subway:daejeon:${stationName}:${yyyymm}`;
  return cachedFetch(cacheKey, CACHE_TTL.SEOUL, async () => {
    const params = new URLSearchParams({
      ServiceKey: key,
      startDate,
      endDate,
    });
    const url = `http://www.djtc.kr/OpenAPI/service/StationPassengerSVC/getStationPassenger?${params.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(`[대전 지하철 API] 10초 타임아웃 초과`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) throw new Error(`[대전 지하철 API] HTTP ${res.status}`);

    const text = await res.text();

    // XML 파싱: resultCode 확인
    const resultCode = text.match(/<resultCode>([^<]+)<\/resultCode>/)?.[1];
    if (resultCode !== "00") {
      const resultMsg = text.match(/<resultMsg>([^<]+)<\/resultMsg>/)?.[1] ?? "알 수 없는 오류";
      console.warn(`[대전 지하철 API] ${resultCode}: ${resultMsg}`);
      return null;
    }

    // 모든 item 파싱
    const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);
    const rows: DaejeonSubwayRow[] = [];
    for (const match of itemMatches) {
      const item = match[1];
      const businessDay = item.match(/<businessDay>([^<]+)<\/businessDay>/)?.[1] ?? "";
      const stnNo = Number(item.match(/<stationNo>([^<]+)<\/stationNo>/)?.[1] ?? 0);
      const entryFlag = Number(item.match(/<entryFlag>([^<]+)<\/entryFlag>/)?.[1] ?? 0);
      const sumCnt = Number(item.match(/<sumCnt>([^<]+)<\/sumCnt>/)?.[1] ?? 0);
      rows.push({ businessDay, stationNo: stnNo, entryFlag, sumCnt });
    }

    // 해당 역 필터
    const targetNo = Number(stationNo);
    const filtered = rows.filter((r) => r.stationNo === targetNo);
    if (filtered.length === 0) return null;

    let totalRide = 0;
    let totalAlight = 0;
    const dateSet = new Set<string>();

    for (const row of filtered) {
      dateSet.add(row.businessDay);
      if (row.entryFlag === 1) totalRide += row.sumCnt;
      else if (row.entryFlag === 2) totalAlight += row.sumCnt;
    }

    const actualDays = dateSet.size || 1;
    console.log(
      `[대전 지하철] ${stationName}: 일평균 승하차 ${Math.round((totalRide + totalAlight) / actualDays).toLocaleString()}명 (${actualDays}일)`,
    );

    return {
      stationName,
      lineName: "1호선",
      dailyAvgRide: Math.round(totalRide / actualDays),
      dailyAvgAlight: Math.round(totalAlight / actualDays),
      dailyAvgTotal: Math.round((totalRide + totalAlight) / actualDays),
      days: actualDays,
      distanceMeters: 0,
    };
  });
}

// ─── odcloud 공통 유틸 ─────────────────────────────────────

/** odcloud 자동변환 API 공통 응답 타입 */
interface OdcloudResponse<T> {
  currentCount: number;
  data: T[];
  matchCount: number;
  page: number;
  perPage: number;
  totalCount: number;
}

/**
 * odcloud 페이지네이션 전체 조회
 * host: api.odcloud.kr, basePath: /api
 */
async function fetchOdcloudAllPages<T>(path: string): Promise<T[]> {
  const key = env.DATA_GO_KR_API_KEY;
  if (!key) return [];

  const base = `https://api.odcloud.kr/api${path}`;
  const first = await fetchOdcloudPage<T>(base, key, 1, 1000);
  if (first.totalCount <= 1000) return first.data;

  const pageCount = Math.ceil(first.totalCount / 1000);
  const promises = Array.from({ length: pageCount - 1 }, (_, i) =>
    fetchOdcloudPage<T>(base, key, i + 2, 1000)
      .then((r) => r.data)
      .catch(() => [] as T[]),
  );
  const rest = await Promise.all(promises);
  return [first.data, ...rest].flat();
}

async function fetchOdcloudPage<T>(
  baseUrl: string,
  apiKey: string,
  page: number,
  perPage: number,
): Promise<OdcloudResponse<T>> {
  const url = `${baseUrl}?page=${page}&perPage=${perPage}&serviceKey=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`[odcloud API] 10초 타임아웃 초과: ${baseUrl}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`[odcloud API] HTTP ${res.status}: ${baseUrl}`);
  return res.json() as Promise<OdcloudResponse<T>>;
}

// ─── 부산 교통공사 API ────────────────────────────────────

/** 부산 odcloud 승하차 데이터 행 */
interface BusanSubwayRow {
  역번호: number;
  역명: string;
  년월일: string;
  요일: string;
  /** "승차" 또는 "하차" */
  구분: string;
  합계: number;
  [key: string]: string | number;
}

/** 부산 최신 데이터 path (2026년 1월) */
const BUSAN_ODCLOUD_PATH =
  "/3057229/v1/uddi:c03e50b4-8f95-4dfe-8b47-a46940ad0cc3";

/**
 * 부산교통공사 시간대별 승하차인원 조회 (odcloud)
 * 최신 파일 고정 path 사용, 역명으로 클라이언트 필터
 */
export async function getBusanSubwayTraffic(
  stationName: string,
  yyyymm: string,
): Promise<SubwayTrafficData | null> {
  if (!env.DATA_GO_KR_API_KEY) return null;

  const cacheKey = `subway:busan:${stationName}:${yyyymm}`;
  return cachedFetch(cacheKey, CACHE_TTL.SEOUL, async () => {
    const allRows = await fetchOdcloudAllPages<BusanSubwayRow>(BUSAN_ODCLOUD_PATH);

    const filtered = allRows.filter(
      (r) => matchStation(String(r["역명"]), stationName),
    );
    console.log(
      `[부산 지하철] 전체 ${allRows.length}건 → ${stationName}역 필터 → ${filtered.length}건`,
    );

    if (filtered.length === 0) return null;

    let totalRide = 0;
    let totalAlight = 0;
    const dateSet = new Set<string>();

    for (const row of filtered) {
      dateSet.add(String(row["년월일"]));
      if (row["구분"] === "승차") totalRide += Number(row["합계"]) || 0;
      else if (row["구분"] === "하차") totalAlight += Number(row["합계"]) || 0;
    }

    const actualDays = dateSet.size || 1;
    return {
      stationName,
      lineName: "부산 도시철도",
      dailyAvgRide: Math.round(totalRide / actualDays),
      dailyAvgAlight: Math.round(totalAlight / actualDays),
      dailyAvgTotal: Math.round((totalRide + totalAlight) / actualDays),
      days: actualDays,
      distanceMeters: 0,
    };
  });
}

// ─── 대구 교통공사 API ────────────────────────────────────

/** 대구 odcloud 승하차 데이터 행 */
interface DaeguSubwayRow {
  월: number;
  일: number;
  역번호: number;
  역명: string;
  /** "승차" 또는 "하차" */
  승하차: string;
  일계: number;
  [key: string]: string | number;
}

/** 대구 최신 데이터 path (2026년 1월) */
const DAEGU_ODCLOUD_PATH =
  "/15002503/v1/uddi:04600339-a283-483f-81cf-c4176b0310b1";

/**
 * 대구교통공사 역별일별시간별 승하차인원 조회 (odcloud)
 * 최신 파일 고정 path 사용, 역명으로 클라이언트 필터
 */
export async function getDaeguSubwayTraffic(
  stationName: string,
  yyyymm: string,
): Promise<SubwayTrafficData | null> {
  if (!env.DATA_GO_KR_API_KEY) return null;

  const cacheKey = `subway:daegu:${stationName}:${yyyymm}`;
  return cachedFetch(cacheKey, CACHE_TTL.SEOUL, async () => {
    const allRows = await fetchOdcloudAllPages<DaeguSubwayRow>(DAEGU_ODCLOUD_PATH);

    const filtered = allRows.filter(
      (r) => matchStation(String(r["역명"]), stationName),
    );
    console.log(
      `[대구 지하철] 전체 ${allRows.length}건 → ${stationName}역 필터 → ${filtered.length}건`,
    );

    if (filtered.length === 0) return null;

    let totalRide = 0;
    let totalAlight = 0;
    const dateSet = new Set<string>();

    for (const row of filtered) {
      // 월+일 조합으로 날짜 유니크 처리
      dateSet.add(`${row["월"]}-${row["일"]}`);
      if (row["승하차"] === "승차") totalRide += Number(row["일계"]) || 0;
      else if (row["승하차"] === "하차") totalAlight += Number(row["일계"]) || 0;
    }

    const actualDays = dateSet.size || 1;
    return {
      stationName,
      lineName: "대구 도시철도",
      dailyAvgRide: Math.round(totalRide / actualDays),
      dailyAvgAlight: Math.round(totalAlight / actualDays),
      dailyAvgTotal: Math.round((totalRide + totalAlight) / actualDays),
      days: actualDays,
      distanceMeters: 0,
    };
  });
}
