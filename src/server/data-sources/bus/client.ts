import { z } from "zod";
import { cachedFetch, CACHE_TTL } from "@/server/cache/redis";

/** TAGO BusSttnInfoInqireService 베이스 URL */
const BASE_URL = "http://apis.data.go.kr/1613000/BusSttnInfoInqireService";

// ─── 응답 스키마 ────────────────────────────────────────

/** data.go.kr 공통 응답 래퍼 스키마 빌더 */
function dataGoKrResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    response: z.object({
      header: z.object({
        resultCode: z.string(),
        resultMsg: z.string(),
      }),
      body: z.object({
        items: z
          .union([
            z.object({
              item: z.union([z.array(itemSchema), itemSchema]).transform((v) =>
                Array.isArray(v) ? v : [v],
              ),
            }),
            // 결과 없을 때 공공 API가 빈 문자열 ""로 반환
            z.literal(""),
            z.null(),
          ])
          .optional()
          .transform((v) => (v && typeof v === "object" ? v : null)),
        totalCount: z.coerce.number(),
      }),
    }),
  });
}

/** getCrdntPrxmtSttnList 응답 아이템 */
const proxmtSttnItemSchema = z.object({
  /** 정류소 ID */
  nodeid: z.string(),
  /** 정류소명 */
  nodenm: z.string(),
  /** 위도 */
  gpslati: z.coerce.number(),
  /** 경도 */
  gpslong: z.coerce.number(),
});
export type ProxmtSttnItem = z.infer<typeof proxmtSttnItemSchema>;

const proxmtSttnResponseSchema = dataGoKrResponseSchema(proxmtSttnItemSchema);

/** getSttnThrghRouteList 응답 아이템 */
const thrghRouteItemSchema = z.object({
  /** 노선 ID */
  routeid: z.string(),
  /** 노선명 */
  routenm: z.string(),
  /** 노선 유형 (1:일반, 2:좌석, ...) */
  routetp: z.string().optional(),
});
export type ThrghRouteItem = z.infer<typeof thrghRouteItemSchema>;

const thrghRouteResponseSchema = dataGoKrResponseSchema(thrghRouteItemSchema);

// ─── 공통 fetch 유틸 ─────────────────────────────────────

/** 재시도(최대 3회) + 타임아웃(10초) */
async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  baseDelay = 250,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) return res;
      if (attempt === maxRetries) return res;
    } catch (err) {
      if (attempt === maxRetries) throw err;
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((r) => setTimeout(r, baseDelay * (attempt + 1)));
  }
  throw new Error("[버스 API] fetchWithRetry: unreachable");
}

// ─── API 함수 ────────────────────────────────────────────

/**
 * 위경도 기준 반경 내 버스 정류소 목록 조회.
 *
 * TAGO BusSttnInfoInqireService / getCrdntPrxmtSttnList
 */
export async function getCrdntPrxmtSttnList(params: {
  latitude: number;
  longitude: number;
  numOfRows?: number;
}): Promise<ProxmtSttnItem[]> {
  const { latitude, longitude, numOfRows = 5 } = params;
  const serviceKey = process.env.DATA_GO_KR_API_KEY!;

  const url = new URL(`${BASE_URL}/getCrdntPrxmtSttnList`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", String(numOfRows));
  url.searchParams.set("_type", "json");
  url.searchParams.set("gpsLati", String(latitude));
  url.searchParams.set("gpsLong", String(longitude));

  const label = `getCrdntPrxmtSttnList(lat=${latitude}, lng=${longitude})`;
  console.log(`[버스 API 요청] ${label}`);
  const t0 = Date.now();

  const res = await fetchWithRetry(url.toString());
  const json = await res.json();
  const parsed = proxmtSttnResponseSchema.parse(json);

  if (parsed.response.header.resultCode !== "00") {
    throw new Error(
      `[버스 API] ${label}: ${parsed.response.header.resultMsg}`,
    );
  }

  const items = parsed.response.body.items?.item ?? [];
  console.log(
    `[버스 API 응답] ${label} → ${items.length}건 (${Date.now() - t0}ms)`,
  );

  return items;
}

/**
 * 정류소 경유 노선 목록 조회.
 *
 * TAGO BusSttnInfoInqireService / getSttnThrghRouteList
 * cityCode 11 = 서울
 */
export async function getSttnThrghRouteList(params: {
  nodeId: string;
  cityCode?: number;
  numOfRows?: number;
}): Promise<ThrghRouteItem[]> {
  const { nodeId, cityCode = 11, numOfRows = 50 } = params;
  const serviceKey = process.env.DATA_GO_KR_API_KEY!;

  const url = new URL(`${BASE_URL}/getSttnThrghRouteList`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", String(numOfRows));
  url.searchParams.set("_type", "json");
  url.searchParams.set("cityCode", String(cityCode));
  url.searchParams.set("nodeid", nodeId);

  const label = `getSttnThrghRouteList(nodeId=${nodeId})`;
  console.log(`[버스 API 요청] ${label}`);
  const t0 = Date.now();

  const res = await fetchWithRetry(url.toString());
  const json = await res.json();
  const parsed = thrghRouteResponseSchema.parse(json);

  if (parsed.response.header.resultCode !== "00") {
    throw new Error(
      `[버스 API] ${label}: ${parsed.response.header.resultMsg}`,
    );
  }

  const items = parsed.response.body.items?.item ?? [];
  console.log(
    `[버스 API 응답] ${label} → ${items.length}건 (${Date.now() - t0}ms)`,
  );

  return items;
}

// ─── 집계 타입 & 유틸 ───────────────────────────────────

/** 인근 정류소 + 경유 노선 집계 결과 */
export interface BusStationWithRoutes {
  /** 정류소 ID */
  nodeId: string;
  /** 정류소명 */
  name: string;
  /** 위도 */
  latitude: number;
  /** 경도 */
  longitude: number;
  /** 분석 좌표로부터의 거리(m) — Haversine */
  distanceMeters: number;
  /** 경유 노선 목록 */
  routes: string[];
  /** 경유 노선 수 */
  routeCount: number;
}

/** Haversine 거리 계산 (미터) */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * 위경도 기준 인근 정류소 + 각 정류소 경유 노선 수 조회.
 *
 * 캐시 키: `bus:sttn:{lat4}:{lng4}` — 소수점 4자리로 정규화
 */
export async function fetchNearbyBusStations(params: {
  latitude: number;
  longitude: number;
  numOfRows?: number;
}): Promise<BusStationWithRoutes[]> {
  const lat = Number(params.latitude.toFixed(4));
  const lng = Number(params.longitude.toFixed(4));
  const cacheKey = `bus:sttn:${lat}:${lng}`;

  return cachedFetch(cacheKey, CACHE_TTL.SEOUL, async () => {
    // 1단계: 반경 내 정류소 목록
    const stations = await getCrdntPrxmtSttnList({
      latitude: lat,
      longitude: lng,
      numOfRows: params.numOfRows,
    });

    if (stations.length === 0) return [];

    // 2단계: 각 정류소 경유 노선 병렬 조회 (실패 건너뜀)
    const results = await Promise.all(
      stations.map(async (stn) => {
        const routes = await getSttnThrghRouteList({
          nodeId: stn.nodeid,
        }).catch((err) => {
          console.warn(
            `[버스] ${stn.nodenm}(${stn.nodeid}) 노선 조회 실패:`,
            err instanceof Error ? err.message : String(err),
          );
          return [] as ThrghRouteItem[];
        });

        const routeNames = routes.map((r) => r.routenm).sort();
        const distance = haversineMeters(lat, lng, stn.gpslati, stn.gpslong);

        return {
          nodeId: stn.nodeid,
          name: stn.nodenm,
          latitude: stn.gpslati,
          longitude: stn.gpslong,
          distanceMeters: distance,
          routes: routeNames,
          routeCount: routeNames.length,
        };
      }),
    );

    // 거리 오름차순 정렬
    results.sort((a, b) => a.distanceMeters - b.distanceMeters);

    console.log(
      `[버스] 인근 정류소 ${results.length}개: ${results
        .map((s) => `${s.name}(${s.distanceMeters}m, ${s.routeCount}개 노선)`)
        .join(", ")}`,
    );

    return results;
  });
}
