import { env } from "@/lib/env";

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

// ─── 서울 열린데이터 API 공통 호출 ─────────────────────

/** 서울 열린데이터 광장 단일 페이지 조회 */
export async function fetchSeoulPage<T>(
  serviceName: string,
  start: number,
  end: number,
  conditions: string[] = [],
  logPrefix = "서울 API",
): Promise<{ rows: T[]; totalCount: number }> {
  const key = env.SEOUL_OPEN_API_KEY!;
  const condPath = conditions.length > 0 ? `/${conditions.join("/")}` : "";
  const url = `${SEOUL_API_BASE}/${key}/json/${serviceName}/${start}/${end}${condPath}`;

  const label = `${serviceName}/${start}~${end}${condPath}`;
  console.log(`[${logPrefix} 호출] ${label}`);
  const t0 = Date.now();

  // 10초 타임아웃 (서울시 API 간헐적 지연 대비)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`[${logPrefix}] ${label}: 10초 타임아웃 초과`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`[${logPrefix}] ${label}: HTTP ${res.status}`);

  const text = await res.text();

  // XML 에러 응답 (인증키 오류 등)
  if (text.startsWith("<")) {
    const code = text.match(/<CODE>([^<]+)<\/CODE>/)?.[1] ?? "UNKNOWN";
    if (code === "INFO-200") return { rows: [], totalCount: 0 };
    const msg = text.match(/<MESSAGE><!\[CDATA\[([^\]]+)\]\]><\/MESSAGE>/)?.[1] ?? "XML 에러";
    throw new Error(`[${logPrefix}] ${label}: ${code} ${msg}`);
  }

  const data = JSON.parse(text);
  const svc = data[serviceName] as SeoulApiSuccessBody<T> | undefined;

  if (!svc) {
    const err = data as SeoulApiErrorBody;
    if (err.RESULT?.CODE === "INFO-200") return { rows: [], totalCount: 0 };
    throw new Error(`[${logPrefix}] ${label}: ${err.RESULT?.MESSAGE ?? "알 수 없는 응답"}`);
  }

  if (svc.RESULT.CODE !== "INFO-000") {
    if (svc.RESULT.CODE === "INFO-200") return { rows: [], totalCount: 0 };
    throw new Error(`[${logPrefix}] ${label}: ${svc.RESULT.MESSAGE}`);
  }

  console.log(`[${logPrefix} 응답] ${label} → ${svc.row.length}건 / 전체 ${svc.list_total_count}건 (${Date.now() - t0}ms)`);
  return { rows: svc.row, totalCount: svc.list_total_count };
}

/** 1000건 제한 우회: 전체 페이지 병렬 호출 */
export async function fetchSeoulAllPages<T>(
  serviceName: string,
  conditions: string[] = [],
  logPrefix = "서울 API",
): Promise<T[]> {
  const first = await fetchSeoulPage<T>(serviceName, 1, 1000, conditions, logPrefix);
  if (first.totalCount <= 1000) return first.rows;

  const pageCount = Math.ceil(first.totalCount / 1000);
  console.log(`[${logPrefix} 페이지네이션] ${serviceName} 총 ${first.totalCount.toLocaleString()}건 → ${pageCount}페이지 병렬호출`);

  let failedPages = 0;
  const promises = Array.from({ length: pageCount - 1 }, (_, i) => {
    const s = (i + 1) * 1000 + 1;
    const e = Math.min((i + 2) * 1000, first.totalCount);
    return fetchSeoulPage<T>(serviceName, s, e, conditions, logPrefix)
      .then((r) => r.rows)
      .catch((err) => {
        failedPages++;
        console.warn(`[${logPrefix} 페이지네이션] ${serviceName} 페이지 ${i + 2}/${pageCount} 실패: ${err instanceof Error ? err.message : String(err)}`);
        return [] as T[];
      });
  });

  const rest = await Promise.all(promises);

  // 전체 페이지의 30% 이상 실패 시 데이터 신뢰성 부족으로 throw
  const failRate = failedPages / pageCount;
  if (failRate >= 0.3) {
    throw new Error(
      `[${logPrefix}] ${serviceName}: ${pageCount}페이지 중 ${failedPages}페이지 실패 (${Math.round(failRate * 100)}%) — 데이터 신뢰성 부족`,
    );
  }
  if (failedPages > 0) {
    console.warn(`[${logPrefix} 페이지네이션] ${serviceName}: ${failedPages}/${pageCount}페이지 실패 — 부분 데이터로 진행`);
  }

  const all = [first.rows, ...rest].flat();
  console.log(`[${logPrefix} 페이지네이션] ${serviceName} 완료: ${all.length.toLocaleString()}건`);
  return all;
}
