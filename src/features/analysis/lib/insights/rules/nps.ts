import type { InsightRule, InsightItem } from "../types";

/** 최소 데이터 건수 (신뢰도 기준) */
const MIN_COUNT = 10;

/** 직원 규모 임계값 */
const EMPLOYEE_THRESHOLDS = [
  { min: 10, text: "중대형 업장이 많아요" },
  { min: 5, text: "중소규모 업장이 많아요" },
  { min: 2, text: "소규모 업장이 많아요" },
  { min: 0, text: "1인 운영이 대부분이에요" },
] as const;

/** 운영 기간 임계값 */
const OPERATING_THRESHOLDS = [
  { min: 60, text: "주변 같은 업종은 오래 운영하는 곳이 많아요" },
  { min: 36, text: "주변 같은 업종 운영 기간이 안정적이에요" },
  { min: 18, text: "주변 같은 업종 운영 기간이 짧은 편이에요" },
  { min: 0, text: "주변에 신규 업장이 많은 지역이에요" },
] as const;

/** "치킨전문점" → "치킨" */
function shortenIndustry(name: string): string {
  return (
    name
      .replace(/전문점|음식점|판매점|관리실|연습장|[점소실장원]$/g, "")
      .trim() || name
  );
}

/** 개월수 → 읽기 좋은 형식 */
function formatPeriod(months: number): string {
  const years = Math.floor(months / 12);
  const remain = months % 12;
  if (years > 0) {
    return `${years}년${remain > 0 ? ` ${remain}개월` : ""}`;
  }
  return `${months}개월`;
}

/** NPS 국민연금 룰 */
export const npsRules: InsightRule = (data) => {
  if (!data.nps || data.nps.totalCount < MIN_COUNT) return [];

  const { nps } = data;
  const short = shortenIndustry(data.industryName);
  const insights: InsightItem[] = [];

  // 1. 직원 규모 — fact (스코어에 직접 반영 안 함)
  const emp = nps.avgEmployeeCount;
  const empThreshold = EMPLOYEE_THRESHOLDS.find((t) => emp >= t.min);
  insights.push({
    type: "text",
    emoji: "👥",
    text: `주변 ${short} 업종은 ${empThreshold?.text ?? EMPLOYEE_THRESHOLDS.at(-1)!.text}`,
    sub: `평균 직원 수 ${emp.toFixed(1)}명 (국민연금 기준)`,
    category: "fact",
  });

  // 2. 평균 급여 — fact
  const salary = Math.round(nps.avgMonthlySalary);
  insights.push({
    type: "text",
    emoji: "💰",
    text: `주변 ${short} 업종의 평균 급여는 월 ${salary.toLocaleString()}원이에요`,
    sub: "국민연금 보험료 기반 추정",
    category: "fact",
  });

  // 3. 운영 기간 — scoring (생존율 지표에 반영)
  const months = Math.round(nps.avgOperatingMonths);
  const opThreshold = OPERATING_THRESHOLDS.find((t) => months >= t.min);
  insights.push({
    type: "text",
    emoji: "📅",
    text: opThreshold?.text ?? OPERATING_THRESHOLDS.at(-1)!.text,
    sub: `평균 운영 기간 ${formatPeriod(months)}`,
    category: "scoring",
  });

  return insights;
};
