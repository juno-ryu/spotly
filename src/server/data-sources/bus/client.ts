import { z } from "zod";
import { cachedFetch, CACHE_TTL } from "@/server/cache/redis";
import { getDistanceMeters } from "@/lib/geo-utils";

/** TAGO BusSttnInfoInqireService 베이스 URL */
const BASE_URL = "http://apis.data.go.kr/1613000/BusSttnInfoInqireService";

/** 행정구역코드 앞 2자리 → TAGO cityCode 매핑
 * @deprecated 실제 노선 조회는 정류소 응답의 citycode 필드를 직접 사용해야 함.
 * 도 단위(경기 "41"→12 등)는 실제 응답의 정류소별 citycode(예: 31010)와 다르므로 이 매핑으로는 올바른 조회 불가.
 */
const REGION_PREFIX_TO_CITY_CODE: Record<string, number> = {
  "11": 11, // 서울
  "21": 21, // 부산
  "22": 22, // 대구
  "23": 23, // 인천
  "24": 24, // 광주
  "25": 25, // 대전
  "26": 26, // 울산
  "29": 29, // 세종
  "41": 12, // 경기 (행정구역코드 41로 시작)
  "42": 51, // 강원
  "43": 52, // 충북
  "44": 53, // 충남
  "45": 54, // 전북 (전북특별자치도 52번도 있음)
  "46": 55, // 전남
  "47": 56, // 경북
  "48": 57, // 경남
  "50": 58, // 제주
};

/** @deprecated 정류소 응답의 citycode 필드를 직접 사용하도록 변경됨. */
export function getCityCodeFromRegionCode(regionCode: string): number {
  const prefix = regionCode.slice(0, 2);
  return REGION_PREFIX_TO_CITY_CODE[prefix] ?? 11;
}

// ─── 응답 스키마 ────────────────────────────────────────

/** data.go.kr 공통 응답 래퍼 스키마 빌더 */
function dataGoKrResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    response: z.object({
      header: z.object({
        resultCode: z.coerce.string(),
        resultMsg: z.coerce.string(),
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
  /** 도시 코드 — 노선 조회(getSttnThrghRouteList)에 그대로 사용해야 함. 도시마다 다른 코드 체계를 씀. */
  citycode: z.coerce.number(),
});
export type ProxmtSttnItem = z.infer<typeof proxmtSttnItemSchema>;

const proxmtSttnResponseSchema = dataGoKrResponseSchema(proxmtSttnItemSchema);

/** getSttnThrghRouteList 응답 아이템
 * - 서울은 routenm, 부산/대구/인천 등 비서울은 routeno 필드로 노선 번호를 반환함
 * - 두 필드를 모두 optional로 받아 null 병합으로 노선명 결정
 */
const thrghRouteItemSchema = z.object({
  /** 노선 ID */
  routeid: z.string(),
  /** 노선명 (서울 등 일부 도시) */
  routenm: z.string().optional(),
  /** 노선 번호 (부산/대구/인천 등 비서울 도시) */
  routeno: z.union([z.string(), z.number()]).optional(),
  /** 노선 유형 */
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
  const { latitude, longitude, numOfRows = 15 } = params;
  const serviceKey = process.env.DATA_GO_KR_API_KEY!;

  const url = new URL(`${BASE_URL}/getCrdntPrxmtSttnList`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", String(numOfRows));
  url.searchParams.set("_type", "json");
  // cityCode 미전달 — 위경도 기반 전국 검색. 정류소 응답의 citycode 필드를 노선 조회에 사용.
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
  const { nodeId, cityCode = 11, numOfRows = 100 } = params;
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
  /** 경유 노선 목록 (노선명) */
  routes: string[];
  /** 경유 노선 ID 목록 (중복 제거용) */
  routeIds: string[];
  /** 경유 노선 수 */
  routeCount: number;
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
  /** @deprecated regionCode는 더 이상 사용하지 않음. 정류소 응답의 citycode 필드로 자동 결정. */
  regionCode?: string;
}): Promise<BusStationWithRoutes[]> {
  const lat = Number(params.latitude.toFixed(4));
  const lng = Number(params.longitude.toFixed(4));
  const cacheKey = `bus:sttn:${lat}:${lng}`;

  return cachedFetch(cacheKey, CACHE_TTL.BUS, async () => {
    // 1단계: 위경도 기반 전국 정류소 검색 (cityCode 미전달 — API 자체가 위경도로 검색)
    const stations = await getCrdntPrxmtSttnList({
      latitude: lat,
      longitude: lng,
      numOfRows: params.numOfRows,
    });

    if (stations.length === 0) return [];

    // 2단계: 각 정류소 경유 노선 병렬 조회 (실패 건너뜀)
    // 정류소 응답의 citycode를 사용 — 도시마다 코드 체계가 달라 하드코딩 불가
    const results = await Promise.all(
      stations.map(async (stn) => {
        const routes = await getSttnThrghRouteList({
          nodeId: stn.nodeid,
          cityCode: stn.citycode,
        }).catch((err) => {
          console.warn(
            `[버스] ${stn.nodenm}(${stn.nodeid}) 노선 조회 실패:`,
            err instanceof Error ? err.message : String(err),
          );
          return [] as ThrghRouteItem[];
        });

        // 도시마다 routenm(서울) 또는 routeno(부산/대구/인천 등) 필드를 사용
        const routeNames = routes
          .map((r) => String(r.routenm ?? r.routeno ?? ""))
          .filter(Boolean)
          .sort();
        const routeIds = routes.map((r) => r.routeid).filter(Boolean);
        const distance = Math.round(getDistanceMeters(lat, lng, stn.gpslati, stn.gpslong));

        return {
          nodeId: stn.nodeid,
          name: stn.nodenm,
          latitude: stn.gpslati,
          longitude: stn.gpslong,
          distanceMeters: distance,
          routes: routeNames,
          routeIds,
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


// ─────────────────────────────────────────────
// 서울 버스정보시스템 (ws.bus.go.kr) API
// TAGO API는 서울 버스 데이터를 제공하지 않으므로 서울 전용 API 사용.
// 공식 문서: https://www.data.go.kr/data/15000303/openapi.do
// ─────────────────────────────────────────────

/** 서울 버스정보시스템 베이스 URL */
const SEOUL_BUS_BASE_URL = "http://ws.bus.go.kr/api/rest";

/** 서울 위경도 기반 정류소 검색 응답 아이템 스키마 */
const seoulStationItemSchema = z.object({
  /** 정류소 ARS ID (노선 조회에 사용) */
  arsId: z.string(),
  /** 정류소명 */
  stationNm: z.string(),
  /** WGS84 경도 */
  gpsX: z.coerce.number(),
  /** WGS84 위도 */
  gpsY: z.coerce.number(),
  /** 분석 좌표로부터의 거리(m) */
  dist: z.coerce.number(),
});

type SeoulStationItem = z.infer<typeof seoulStationItemSchema>;

/** 서울 위경도 기반 정류소 검색 응답 스키마 */
const seoulStationResponseSchema = z.object({
  msgHeader: z.object({
    headerCd: z.string(),
    headerMsg: z.string(),
    itemCount: z.coerce.number(),
  }),
  msgBody: z
    .object({
      itemList: z
        .union([z.array(seoulStationItemSchema), seoulStationItemSchema])
        .nullable()
        .optional(),
    })
    .optional(),
});

/** 서울 정류소 경유 노선 응답 아이템 스키마 */
const seoulRouteItemSchema = z.object({
  /** 노선 ID */
  busRouteId: z.string(),
  /** 노선명 (예: 273, N16) */
  busRouteNm: z.string(),
  /** 노선 유형 (1:공항, 2:마을, 3:간선, 4:지선, 5:순환, 6:광역, 7:인천, 8:경기, 9:폐지, 0:공용) */
  busRouteType: z.coerce.number().optional(),
});

type SeoulRouteItem = z.infer<typeof seoulRouteItemSchema>;

/** 서울 정류소 경유 노선 응답 스키마 */
const seoulRouteResponseSchema = z.object({
  msgHeader: z.object({
    headerCd: z.string(),
    headerMsg: z.string(),
    itemCount: z.coerce.number(),
  }),
  msgBody: z
    .object({
      itemList: z
        .union([z.array(seoulRouteItemSchema), seoulRouteItemSchema])
        .nullable()
        .optional(),
    })
    .optional(),
});

/**
 * 서울 버스정보시스템 — 위경도 기반 정류소 검색.
 *
 * @param lat 위도
 * @param lng 경도
 * @param radius 검색 반경(m)
 */
export async function getSeoulStationByPos(
  lat: number,
  lng: number,
  radius: number,
): Promise<SeoulStationItem[]> {
  // ws.bus.go.kr는 data.go.kr에서 발급한 키 사용 (SEOUL_OPEN_API_KEY 아님)
  const serviceKey = process.env.DATA_GO_KR_API_KEY!;

  const url = new URL(`${SEOUL_BUS_BASE_URL}/stationinfo/getStationByPos`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("tmX", String(lng)); // 경도
  url.searchParams.set("tmY", String(lat)); // 위도
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("resultType", "json");

  console.log(`[버스 서울 API 요청] getStationByPos(lat=${lat}, lng=${lng}, radius=${radius})`);
  const t0 = Date.now();

  const res = await fetchWithRetry(url.toString());
  const json = await res.json();

  const parsed = seoulStationResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.warn("[버스 서울] 정류소 검색 응답 파싱 실패:", parsed.error.message);
    return [];
  }

  const { headerCd, headerMsg } = parsed.data.msgHeader;
  if (headerCd !== "0") {
    console.warn(`[버스 서울] 정류소 검색 오류 코드: ${headerCd} — ${headerMsg}`);
    return [];
  }

  const rawItems = parsed.data.msgBody?.itemList;
  // 단일 객체 응답을 배열로 정규화
  const items = rawItems == null ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];
  console.log(`[버스 서울 API 응답] getStationByPos → ${items.length}건 (${Date.now() - t0}ms)`);

  return items;
}

/**
 * 서울 버스정보시스템 — 정류소 경유 노선 조회.
 *
 * @param arsId 정류소 ARS ID (4자리면 앞에 0 추가)
 */
export async function getSeoulRouteByStation(arsId: string): Promise<string[]> {
  // ws.bus.go.kr는 data.go.kr에서 발급한 키 사용
  const serviceKey = process.env.DATA_GO_KR_API_KEY!;
  // 4자리 ARS ID는 앞에 0 추가
  const normalizedArsId = arsId.length === 4 ? `0${arsId}` : arsId;

  const url = new URL(`${SEOUL_BUS_BASE_URL}/stationinfo/getRouteByStation`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("arsId", normalizedArsId);
  url.searchParams.set("resultType", "json");

  const res = await fetchWithRetry(url.toString());
  const json = await res.json();

  const parsed = seoulRouteResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.warn(`[버스 서울] 노선 조회 파싱 실패 (arsId=${normalizedArsId}):`, parsed.error.message);
    return [];
  }

  const { headerCd } = parsed.data.msgHeader;
  if (headerCd !== "0") {
    return [];
  }

  const rawItems = parsed.data.msgBody?.itemList;
  const items = rawItems == null ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];

  // busRouteType=9는 폐지 노선 — 제외
  return items
    .filter((r) => r.busRouteType !== 9)
    .map((r) => r.busRouteNm)
    .filter(Boolean)
    .sort();
}

/**
 * 서울 버스정보시스템 — 위경도 기반 인근 정류소 + 경유 노선 수 조회.
 *
 * 캐시 키: `bus:seoul:sttn:{lat4}:{lng4}`
 */
export async function fetchSeoulNearbyBusStations(params: {
  latitude: number;
  longitude: number;
  radius: number;
}): Promise<BusStationWithRoutes[]> {
  const lat = Number(params.latitude.toFixed(4));
  const lng = Number(params.longitude.toFixed(4));
  const cacheKey = `bus:seoul:sttn:${lat}:${lng}`;

  return cachedFetch(cacheKey, CACHE_TTL.BUS, async () => {
    const stations = await getSeoulStationByPos(lat, lng, params.radius).catch((err) => {
      console.warn("[버스 서울] 정류소 검색 실패:", err instanceof Error ? err.message : String(err));
      return [] as SeoulStationItem[];
    });

    if (stations.length === 0) return [];

    // 각 정류소 경유 노선 병렬 조회
    const results = await Promise.all(
      stations.map(async (stn) => {
        // arsId가 없는 정류소는 노선 조회 불가 — 빈 배열 처리
        const routeNames = stn.arsId
          ? await getSeoulRouteByStation(stn.arsId).catch(() => [] as string[])
          : [];
        const distance = Math.round(getDistanceMeters(lat, lng, stn.gpsY, stn.gpsX));

        return {
          nodeId: stn.arsId,
          name: stn.stationNm,
          latitude: stn.gpsY,
          longitude: stn.gpsX,
          distanceMeters: distance,
          routes: routeNames,
          // 서울 버스 API는 routeId를 반환하지 않음 — 노선명 기반으로 중복 제거
          routeIds: [] as string[],
          routeCount: routeNames.length,
        };
      }),
    );

    results.sort((a, b) => a.distanceMeters - b.distanceMeters);

    console.log(
      `[버스 서울] 인근 정류소 ${results.length}개: ${results
        .map((s) => `${s.name}(${s.distanceMeters}m, ${s.routeCount}개 노선)`)
        .join(", ")}`,
    );

    return results;
  });
}
