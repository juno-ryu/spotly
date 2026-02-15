/**
 * 인사이트 엔진 — 스코어링 v2 라이트 버전
 *
 * Step 5 바텀시트에서 표시하는 인사이트를 v2 스코어링 로직과 동일한 기준으로 생성한다.
 * 데이터가 제한적(NPS 상세 5개, 추이 3개×6개월)이므로 샘플 주석을 함께 반환한다.
 */
import {
  COMPETITION_BASE_DENSITY,
  NATIONAL_AVG_APT_PRICE,
  NATIONAL_AVG_POP_DENSITY,
  REGIONAL_COEFF_RANGE,
} from "../constants/scoring";

// ── 입력 ──

export interface InsightInput {
  npsTotalCount: number;
  npsActiveCount: number;
  avgEmployeeCount: number;
  employeeGrowthRate: number | null;
  nearbyCount: number;
  transactionCount: number;
  avgAptPrice: number;
  districtTransactionCount: number;
  population: { totalPopulation: number; households: number } | null;
  radius: number;
  industryCode: string;
  industryName: string;
  address: string;
  dongName: string | null;
}

// ── 출력 ──

export interface InsightBlock {
  /** 핵심 인사이트 문장 */
  message: string;
  /** 보조 정보 (수치 요약) */
  detail?: string;
  /** 데이터 출처 · 샘플 주석 */
  sampleNote?: string;
}

export interface InsightResult {
  competition: InsightBlock;
  vitality: InsightBlock | null;
  purchasing: InsightBlock | null;
}

// ── 유틸 ──

const KAKAO_PLACES_CAP = 45;

function extractDistrict(address: string): string {
  const parts = address.split(/\s+/);
  return (
    parts.find(
      (p) =>
        p.endsWith("구") ||
        p.endsWith("군") ||
        (p.endsWith("시") && !p.includes("특별") && !p.includes("광역")),
    ) ??
    parts[1] ??
    ""
  );
}

function formatPrice(v: number): string {
  if (v >= 10000) {
    const uk = Math.floor(v / 10000);
    const r = v % 10000;
    return r > 0 ? `${uk}억 ${r.toLocaleString()}만원` : `${uk}억원`;
  }
  return `${v.toLocaleString()}만원`;
}

function formatRadius(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace(/\.0$/, "")}km` : `${m}m`;
}

// ══════════════════════════════════════════
// 1. 경쟁업체 인사이트 — v2 밀도 기준
// ══════════════════════════════════════════

function computeCompetitionInsight(input: InsightInput): InsightBlock {
  const { nearbyCount, radius, industryCode, npsTotalCount, population, npsActiveCount } = input;

  const radiusKm = radius / 1000;
  const areaKm2 = Math.PI * radiusKm * radiusKm;
  const isCountCapped = nearbyCount >= KAKAO_PLACES_CAP;

  // ① 간격 (카카오 Places — 실제 공간 데이터)
  const spacing =
    !isCountCapped && nearbyCount > 0
      ? Math.round(Math.sqrt((Math.PI * radius * radius) / nearbyCount) / 10) * 10
      : 0;

  let spacingLine: string;
  if (isCountCapped) {
    spacingLine = `반경 ${formatRadius(radius)} 안에 ${KAKAO_PLACES_CAP}개 이상 밀집해 있어요`;
  } else if (nearbyCount === 0) {
    spacingLine = "반경 내 경쟁업체가 없어요";
  } else if (spacing <= 100) {
    const density100 = Math.max(1, Math.round(100 / spacing));
    spacingLine = `약 100m마다 경쟁업체 ${density100}개가 보여요`;
  } else {
    spacingLine = `약 ${spacing}m마다 경쟁업체 1개가 보여요`;
  }

  // ② v2 밀도 기반 경쟁 판정 (NPS 총수 / 면적)
  const npsDensity = areaKm2 > 0 ? npsTotalCount / areaKm2 : 0;

  const regionPopDensity = population
    ? population.totalPopulation / areaKm2
    : NATIONAL_AVG_POP_DENSITY;
  const regionalCoeff = Math.max(
    REGIONAL_COEFF_RANGE.MIN,
    Math.min(regionPopDensity / NATIONAL_AVG_POP_DENSITY, REGIONAL_COEFF_RANGE.MAX),
  );

  const registered = COMPETITION_BASE_DENSITY[industryCode];
  const baseDensity =
    registered != null ? registered * regionalCoeff : npsDensity > 0 ? npsDensity * 1.2 : 10;

  const densityRatio = baseDensity > 0 ? npsDensity / baseDensity : 0;

  // ③ 생존율 (경쟁×생존 교차용)
  const survivalRate = npsTotalCount > 0 ? npsActiveCount / npsTotalCount : 0;
  const highSurvival = survivalRate >= 0.8;

  let competitionMsg: string;
  if (nearbyCount === 0 && npsTotalCount === 0) {
    competitionMsg = "동일 업종 사업장이 없어요. 수요를 먼저 확인하세요";
  } else if (densityRatio >= 1.5) {
    competitionMsg = highSurvival
      ? "경쟁은 치열하지만 기존 사업장 유지율이 높아요. 수요가 뒷받침되는 상권이에요"
      : "경쟁이 치열하고 폐업도 잦아요. 차별화 전략과 신중한 진입이 필요해요";
  } else if (densityRatio >= 0.8) {
    competitionMsg = highSurvival
      ? "업종 평균 수준의 경쟁이고, 기존 사업장도 안정적이에요"
      : "경쟁은 평균 수준이지만 사업장 변동이 있어요. 수요를 꼼꼼히 확인하세요";
  } else {
    competitionMsg = highSurvival
      ? "경쟁이 적고 기존 사업장도 안정적이에요. 진입하기 좋은 환경이에요"
      : "경쟁은 적지만 사업장 변동이 있어요. 수요를 꼼꼼히 확인하세요";
  }

  return {
    message: spacingLine,
    detail: competitionMsg,
    sampleNote: `카카오 Places ${isCountCapped ? "45+" : nearbyCount}개 · NPS ${npsTotalCount}개 기준`,
  };
}

// ══════════════════════════════════════════
// 2. 상권 활력도 인사이트 — v2 복합 지표
// ══════════════════════════════════════════

function computeVitalityInsight(input: InsightInput): InsightBlock | null {
  const { npsTotalCount, npsActiveCount, avgEmployeeCount, employeeGrowthRate, industryName, address } = input;

  if (npsTotalCount === 0) return null;

  const district = extractDistrict(address);
  const activeRatio = npsActiveCount / npsTotalCount;
  const survivalPct = Math.round(activeRatio * 100);

  // v2 4-요소 중 3-요소 평가 (신규창업비율은 Step 5 미확보 → 제외)
  // 각 요소 0~3점, 합계 0~9

  // (1) 영업중 비율 — v2 activeRatio 기준 동일
  let activeScore = 0;
  if (activeRatio >= 0.9) activeScore = 3;
  else if (activeRatio >= 0.7) activeScore = 2;
  else if (activeRatio >= 0.5) activeScore = 1;

  // (2) 평균 직원 규모 — v2 MAX_AVG_EMPLOYEES=20 기준 비례
  let employeeScore = 0;
  if (avgEmployeeCount >= 10) employeeScore = 3;
  else if (avgEmployeeCount >= 5) employeeScore = 2;
  else if (avgEmployeeCount >= 2) employeeScore = 1;

  // (3) 고용 모멘텀 — v2 추이 모멘텀과 동일 방향
  let momentumScore = 1; // 중립 (데이터 없을 때)
  if (employeeGrowthRate != null) {
    if (employeeGrowthRate >= 10) momentumScore = 3;
    else if (employeeGrowthRate >= 0) momentumScore = 2;
    else if (employeeGrowthRate >= -10) momentumScore = 1;
    else momentumScore = 0;
  }

  const composite = activeScore + employeeScore + momentumScore;

  // 종합 메시지
  let message: string;
  if (composite >= 7) {
    message = "사업장 유지율·고용 규모·성장세가 모두 양호한 활력 있는 상권이에요";
  } else if (composite >= 5) {
    message = "대체로 안정적인 상권이에요";
  } else if (composite >= 3) {
    message = "일부 지표에서 주의가 필요한 상권이에요";
  } else {
    message = "사업장 변동이 크고 고용 규모도 작은 편이에요. 신중한 검토가 필요해요";
  }

  // 수치 요약
  const detailParts: string[] = [];
  detailParts.push(
    `${district} ${industryName} 사업장 ${npsTotalCount}개 중 ${npsActiveCount}개 영업중 (${survivalPct}%)`,
  );
  if (avgEmployeeCount > 0) {
    detailParts.push(`평균 직원 ${avgEmployeeCount}명`);
  }

  let momentumLabel = "";
  if (employeeGrowthRate != null) {
    if (employeeGrowthRate > 0) momentumLabel = `📈 고용 ${employeeGrowthRate}% 증가`;
    else if (employeeGrowthRate < 0) momentumLabel = `📉 고용 ${Math.abs(employeeGrowthRate)}% 감소`;
    else momentumLabel = "→ 고용 변동 없음";
  }

  return {
    message,
    detail: detailParts.join(" · ") + (momentumLabel ? ` ${momentumLabel}` : ""),
    sampleNote: "사업장 5개 샘플 기준 추정 · 본분석 시 20개 기준으로 재계산",
  };
}

// ══════════════════════════════════════════
// 3. 구매력 인사이트 — v2 상대 기준
// ══════════════════════════════════════════

function computePurchasingInsight(input: InsightInput): InsightBlock | null {
  const { population, avgAptPrice, transactionCount, dongName, address } = input;

  if (!population && avgAptPrice === 0) return null;

  const district = extractDistrict(address);
  const locationName = dongName ?? district;

  // ① 소득 — v2 동일: 전국 평균 아파트가 대비 비율
  const priceRatio = avgAptPrice > 0 ? avgAptPrice / NATIONAL_AVG_APT_PRICE : 0;

  // ② 주거 밀도 — v2 동일: 인구수+세대수 기반 (절대 라벨 제거)
  const hasPop = population != null && population.totalPopulation > 0;
  const hasPrice = avgAptPrice > 0;

  // 종합 판정
  let message: string;
  if (hasPop && hasPrice) {
    const highPop = population!.totalPopulation >= 200000;
    const highIncome = priceRatio >= 1.0;

    if (highPop && highIncome) {
      message = "배후 인구와 구매력 모두 충분한 지역이에요";
    } else if (highPop && priceRatio >= 0.7) {
      message = "배후 인구는 풍부하지만 소득 수준은 전국 평균 수준이에요";
    } else if (highPop) {
      message = "배후 인구는 풍부하지만 소득 수준은 전국 평균보다 낮아요";
    } else if (highIncome) {
      message = "구매력 있는 고객층이 있지만, 배후 인구 규모는 크지 않아요";
    } else if (priceRatio >= 0.7) {
      message = "배후 인구와 소득 수준 모두 평균 수준이에요";
    } else {
      message = "타겟 고객 확보 전략이 중요한 지역이에요";
    }
  } else if (hasPrice) {
    if (priceRatio >= 1.5) {
      message = `전국 평균 대비 ${Math.round(priceRatio * 100 - 100)}% 높은 고소득 지역이에요`;
    } else if (priceRatio >= 1.0) {
      message = "전국 평균 수준의 소득 지역이에요";
    } else if (priceRatio >= 0.7) {
      message = "전국 평균보다 다소 낮은 소득 수준이에요";
    } else {
      message = "전국 평균 대비 소득 수준이 낮아요. 가격 전략이 중요해요";
    }
  } else {
    const pop = population!;
    message =
      pop.totalPopulation >= 200000
        ? `${district} 인구 ${Math.round(pop.totalPopulation / 10000)}만명 — 배후 인구 풍부`
        : `${district} 인구 ${pop.totalPopulation.toLocaleString()}명`;
  }

  // 상세 정보
  const detailParts: string[] = [];

  if (hasPop) {
    const pop = population!;
    const popStr =
      pop.totalPopulation >= 10000
        ? `${Math.round(pop.totalPopulation / 10000)}만명`
        : `${pop.totalPopulation.toLocaleString()}명`;
    const hhStr =
      pop.households >= 10000
        ? `${Math.round(pop.households / 10000)}만세대`
        : `${pop.households.toLocaleString()}세대`;
    detailParts.push(`${district} 인구 ${popStr} · ${hhStr}`);
  }

  if (hasPrice) {
    detailParts.push(
      `${locationName} 아파트 평균 ${formatPrice(avgAptPrice)} · ${transactionCount}건`,
    );
    detailParts.push(
      `전국 평균 ${formatPrice(NATIONAL_AVG_APT_PRICE)} 대비 ${Math.round(priceRatio * 100)}%`,
    );
  }

  return {
    message,
    detail: detailParts.join("\n"),
  };
}

// ══════════════════════════════════════════
// 메인
// ══════════════════════════════════════════

export function computeInsights(input: InsightInput): InsightResult {
  return {
    competition: computeCompetitionInsight(input),
    vitality: computeVitalityInsight(input),
    purchasing: computePurchasingInsight(input),
  };
}
