import * as npsClient from "./client";
import type { NpsBusiness, NpsDetail, NpsTrendItem } from "./client";

export interface NpsBizInfo {
  name: string;
  address: string;
  bizNo: string;
  seq: string;
  status: "active" | "closed";
  bizType: string;
  dataYm: string;
  emdCode: string;
  detail?: {
    employeeCount: number;
    monthlyInsurance: number;
    estimatedAvgSalary: number;
    industryName: string;
    industryCode: string;
    joinDate: string;
    leaveDate: string;
    operatingMonths: number;
  };
  trend?: NpsTrendItem[];
}

export interface NpsMetrics {
  /** 검색된 사업장 수 (중복 제거 후) */
  totalCount: number;
  /** 평균 직원 수 (국민연금 가입자 기준) */
  avgEmployeeCount: number;
  /** 평균 월 급여 (보험료 기반 추정) */
  avgMonthlySalary: number;
  /** 평균 운영 기간 (개월) */
  avgOperatingMonths: number;
  /** 사업장 상세 목록 */
  businesses: NpsBizInfo[];
  /** API 호출 횟수 (디버깅용) */
  apiCalls: {
    search: number;
    detail: number;
    trend: number;
  };
}

const NON_FOOD_PATTERN = /건설|건축|공사|토목|설비|제조|기계|철강|시멘트|레미콘|운수|물류|창고/;

function filterIrrelevant(items: NpsBusiness[], industryCode: string): NpsBusiness[] {
  if (!industryCode.startsWith("I56")) return items;
  return items.filter((b) => !NON_FOOD_PATTERN.test(b.wkplNm));
}

function deduplicateByBizNo(items: NpsBusiness[]): NpsBusiness[] {
  const map = new Map<string, NpsBusiness>();
  for (const item of items) {
    const key = item.bzowrRgstNo?.substring(0, 6) ?? item.wkplNm;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    const existingActive = existing.wkplJnngStcd === "1";
    const itemActive = item.wkplJnngStcd === "1";
    if (
      (!existingActive && itemActive) ||
      (existingActive === itemActive && (item.dataCrtYm ?? "") > (existing.dataCrtYm ?? ""))
    ) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

function calcOperatingMonths(joinDate: string, leaveDate: string): number {
  const now = new Date();
  const join = parseDate(joinDate);
  if (!join) return 0;
  const end = leaveDate === "00010101" ? now : (parseDate(leaveDate) ?? now);
  const months = (end.getFullYear() - join.getFullYear()) * 12 + (end.getMonth() - join.getMonth());
  return Math.max(0, months);
}

function parseDate(yyyymmdd: string): Date | null {
  if (!yyyymmdd || yyyymmdd.length < 8 || yyyymmdd === "00010101") return null;
  const y = parseInt(yyyymmdd.substring(0, 4));
  const m = parseInt(yyyymmdd.substring(4, 6)) - 1;
  const d = parseInt(yyyymmdd.substring(6, 8));
  return new Date(y, m, d);
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function fetchNpsData(params: {
  regionCode: string;
  keywords: string[];
  industryCode: string;
}): Promise<NpsMetrics> {
  const apiCalls = { search: 0, detail: 0, trend: 0 };

  const searchResults = await Promise.allSettled(
    params.keywords.map((keyword) => {
      apiCalls.search++;
      return npsClient.searchBusinesses({
        regionCode: params.regionCode,
        keyword,
      });
    }),
  );

  const allItems: NpsBusiness[] = [];
  const seenSeqs = new Set<string>();
  for (const result of searchResults) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value.items) {
      if (!seenSeqs.has(item.seq)) {
        seenSeqs.add(item.seq);
        allItems.push(item);
      }
    }
  }

  const filtered = filterIrrelevant(allItems, params.industryCode);
  const deduplicated = deduplicateByBizNo(filtered);

  const active = deduplicated.filter((b) => b.wkplJnngStcd === "1");
  const closed = deduplicated.filter((b) => b.wkplJnngStcd !== "1");

  // 폐업 업장도 최대 5개까지 상세 조회 (운영 기간 평균 보정용)
  const closedSample = closed.slice(0, 5);

  const detailResults: Map<string, NpsDetail> = new Map();
  const trendResults: Map<string, NpsTrendItem[]> = new Map();

  for (const biz of active) {
    try {
      apiCalls.detail++;
      const detail = await npsClient.getBusinessDetail(biz.seq);
      if (detail) detailResults.set(biz.seq, detail);
    } catch {
      // skip
    }

    try {
      apiCalls.trend++;
      const trend = await npsClient.getMonthlyTrend(biz.seq, 12);
      trendResults.set(biz.seq, trend);
    } catch {
      // skip
    }
  }

  // 폐업 업장 상세 조회 (운영 기간만 필요, 트렌드는 불필요)
  for (const biz of closedSample) {
    try {
      apiCalls.detail++;
      const detail = await npsClient.getBusinessDetail(biz.seq);
      if (detail) detailResults.set(biz.seq, detail);
    } catch {
      // skip
    }
  }

  const businesses: NpsBizInfo[] = deduplicated.map((b) => {
    const detail = detailResults.get(b.seq);
    const trend = trendResults.get(b.seq);

    const employeeCount = detail?.jnngpCnt ?? 0;
    const monthlyInsurance = detail?.crrmmNtcAmt ?? 0;
    const joinDate = detail?.adptDt ?? "";
    const leaveDate = detail?.scsnDt ?? "00010101";

    const biz: NpsBizInfo = {
      name: b.wkplNm,
      address: b.wkplRoadNmDtlAddr ?? "",
      bizNo: b.bzowrRgstNo ?? "",
      seq: b.seq,
      status: b.wkplJnngStcd === "1" ? "active" : "closed",
      bizType: b.wkplStylDvcd ?? "",
      dataYm: b.dataCrtYm ?? "",
      emdCode: b.ldongAddrMgplSgguEmdCd ?? "",
    };

    if (detail) {
      const estimatedAvgSalary = employeeCount > 0
        ? Math.round(monthlyInsurance / 0.09 / employeeCount)
        : 0;

      biz.detail = {
        employeeCount,
        monthlyInsurance,
        estimatedAvgSalary,
        industryName: detail.vldtVlKrnNm ?? "",
        industryCode: detail.wkplIntpCd ?? "",
        joinDate,
        leaveDate,
        operatingMonths: calcOperatingMonths(joinDate, leaveDate),
      };
    }

    if (trend && trend.length > 0) {
      biz.trend = trend;
    }

    return biz;
  });

  const activeWithDetail = businesses.filter((b) => b.status === "active" && b.detail);
  const allWithDetail = businesses.filter((b) => b.detail);

  // 급여/직원수는 active만 (폐업 업장은 마지막 시점 데이터라 왜곡됨)
  const salaries = activeWithDetail.map((b) => b.detail!.estimatedAvgSalary).filter((s) => s > 0);
  const employees = activeWithDetail.map((b) => b.detail!.employeeCount).filter((e) => e > 0);
  // 운영기간은 폐업 포함 (생존편향 보정)
  const months = allWithDetail.map((b) => b.detail!.operatingMonths).filter((m) => m > 0);

  console.log(
    `[NPS 국민연금] 조회 성공: ${deduplicated.length}건 (활성 ${active.length}, 폐업 ${closed.length}) — API 호출 검색 ${apiCalls.search}회, 상세 ${apiCalls.detail}회, 추이 ${apiCalls.trend}회`,
  );

  return {
    totalCount: deduplicated.length,
    avgEmployeeCount: avg(employees),
    avgMonthlySalary: avg(salaries),
    avgOperatingMonths: avg(months),
    businesses,
    apiCalls,
  };
}
