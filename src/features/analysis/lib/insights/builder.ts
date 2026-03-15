import type { InsightData, InsightItem, InsightRule } from "./types";
import { scoreToGrade, type Grade } from "../scoring/types";
import { competitionRules } from "./rules/competition";
import { populationRules } from "./rules/population";
import { subwayRules, calcSubwayGrade } from "./rules/subway";
import { busRules, calcBusGrade } from "./rules/bus";
import { schoolRules, calcSchoolGrade } from "./rules/school";
import { universityRules, calcUniversityGrade } from "./rules/university";
import { medicalRules, calcMedicalGrade } from "./rules/medical";

/** 등록된 룰 목록 — 새 룰 추가 시 여기에 push */
const ALL_RULES: InsightRule[] = [competitionRules, populationRules, subwayRules, busRules, schoolRules, universityRules, medicalRules];

/** 모든 룰을 실행하여 인사이트 목록 생성 */
/** 업종에 따라 인사이트 섹션 순서를 재구성한다. 관련성 높은 섹션을 앞에 배치. */
function getRulesForIndustry(industryName: string): InsightRule[] {
  if (industryName.includes("학원")) {
    return [schoolRules, competitionRules, populationRules, subwayRules, busRules, universityRules, medicalRules];
  }
  if (industryName.includes("약국")) {
    return [medicalRules, populationRules, competitionRules, subwayRules, busRules, schoolRules, universityRules];
  }
  // 카페·음식·의류·편의점 등 기본 순서
  return ALL_RULES;
}

export function buildInsights(data: InsightData): InsightItem[] {
  const rules = getRulesForIndustry(data.industryName);
  return [...rules.flatMap((rule) => rule(data)), ...combinedRiskInsights(data)];
}

/**
 * 위험 신호 조합 패턴 감지 — 복수의 지표가 동시에 나쁜 경우 명시적 경고
 *
 * 단일 지표 인사이트로는 포착되지 않는 복합 위험 패턴을 감지한다.
 * 각 패턴은 독립적으로 평가되며 해당하는 경우 모두 반환된다.
 */
export function combinedRiskInsights(data: InsightData): InsightItem[] {
  const items: InsightItem[] = [];
  const vitality = data.vitality;
  const competition = data.competition;
  const population = data.population;
  const subway = data.subway;
  const bus = data.bus;
  const industry = data.industryName;

  // 1. 유령 상권: 유동인구 낮음 + 추정매출 매우 낮음 + 폐업률 높음
  // 상권이 사실상 침체 상태 — 신규 입점 시 생존 가능성 매우 낮음
  if (vitality) {
    const d = vitality.details;
    const hasLowFootTraffic = vitality.footTrafficScore < 30;
    const hasLowSales = d.salesPerStore > 0 && vitality.salesScore < 20;
    const hasHighCloseRate = d.closeRate > 8;

    if (hasLowFootTraffic && hasLowSales && hasHighCloseRate) {
      items.push({
        type: "text",
        emoji: "⚠️",
        text: "유동인구·매출·폐업률 복합 이상 신호",
        sub: `유동인구 낮음 + 점포당 매출 낮음 + 분기 폐업률 ${d.closeRate.toFixed(1)}% — 입점 전 현장 확인을 권장해요`,
        category: "fact",
      });
    }
  }

  // 2. 레드오션: 경쟁점수 매우 낮음(경쟁 과포화) + 프랜차이즈 비율 60% 초과
  // 음식점·카페·편의점·미용실 등 프랜차이즈 경쟁이 실질적으로 영향을 주는 업종만 적용
  // 학원·병의원·부동산은 프랜차이즈 경쟁 구조와 무관하므로 제외
  if (competition) {
    const isFranchiseRelevant =
      industry.includes("음식") ||
      industry.includes("한식") ||
      industry.includes("분식") ||
      industry.includes("중식") ||
      industry.includes("일식") ||
      industry.includes("양식") ||
      industry.includes("치킨") ||
      industry.includes("피자") ||
      industry.includes("버거") ||
      industry.includes("베이커") ||
      industry.includes("카페") ||
      industry.includes("커피") ||
      industry.includes("편의점") ||
      industry.includes("미용") ||
      industry.includes("의류") ||
      industry.includes("패션");

    const isOverCrowded = (competition.competitionScore?.score ?? 100) < 20;
    const isFranchiseDominated = competition.franchiseRatio > 0.6;

    if (isFranchiseRelevant && isOverCrowded && isFranchiseDominated) {
      items.push({
        type: "text",
        emoji: "⚠️",
        text: "프랜차이즈 과밀 상권이에요",
        sub: `프랜차이즈 비율 ${(competition.franchiseRatio * 100).toFixed(0)}% — 브랜드 인지도·자본력 경쟁에서 불리할 수 있어요`,
        category: "fact",
      });
    }
  }

  // 3. 거품 상권: 개업률 10% 초과 + 폐업률 8% 초과 + 상권변화지표 HL(성숙/축소)
  // 창업 러시 후 대량 폐업이 반복되는 불안정 상권
  if (vitality) {
    const d = vitality.details;
    const isHighOpenRate = d.openRate > 10;
    const isHighCloseRate = d.closeRate > 8;
    // HL = 첫 글자(생존 사업체 영업기간) 높음, 둘째 글자(폐업 사업체 영업기간) 낮음 → 오래된 가게만 살아남는 성숙/축소 상권
    const isHlChange = vitality.details.changeIndexName?.startsWith("HL") ?? false;

    if (isHighOpenRate && isHighCloseRate && isHlChange) {
      items.push({
        type: "text",
        emoji: "⚠️",
        text: "개업·폐업이 반복되는 불안정 상권이에요",
        sub: `개업률 ${d.openRate.toFixed(1)}% · 폐업률 ${d.closeRate.toFixed(1)}% — 장기 생존율을 신중히 검토하세요`,
        category: "fact",
      });
    }
  }

  // 4. 수요 부족: 배후인구 5,000명 미만 + 유동인구 10,000명 미만
  // 고객 기반 자체가 부족한 지역 — 어떤 업종이든 기본 수요 확보가 어려움
  if (population) {
    const totalPop = population.details.totalPopulation;
    const isLowResident = totalPop < 5_000;
    const floatingTotal = vitality?.details.floatingPopulation?.totalFloating ?? 0;
    const isLowFloating = floatingTotal > 0 && floatingTotal < 10_000;

    if (isLowResident && isLowFloating) {
      items.push({
        type: "text",
        emoji: "⚠️",
        text: "배후인구·유동인구 모두 적은 편이에요",
        sub: `배후인구 ${totalPop.toLocaleString()}명 · 유동인구 ${(floatingTotal / 10_000).toFixed(1)}만명 — 고객 기반을 현장에서 직접 확인하세요`,
        category: "fact",
      });
    }
  }

  // 5. 교통 사각지대: 역세권 아님 + 버스 노선 3개 미만
  // 배달 업종 및 부동산(방문 목적이 다름)은 교통 접근성이 매출에 무관하므로 제외
  const isDeliveryOnly = industry.includes("배달");
  const isRealEstate = industry.includes("부동산");
  const isNotSubwayArea = subway ? !subway.isStationArea : false;
  const busRouteCount = bus?.nearestStop?.routeCount ?? 0;
  const hasLowBusRoute = busRouteCount > 0 && busRouteCount < 3;

  if (!isDeliveryOnly && !isRealEstate && isNotSubwayArea && hasLowBusRoute) {
    items.push({
      type: "text",
      emoji: "⚠️",
      text: "대중교통 접근성이 낮은 편이에요",
      sub: `역세권 아님 · 버스 노선 ${busRouteCount}개 — 도보 유동인구 확보에 불리한 입지예요`,
      category: "fact",
    });
  }

  return items;
}

/** 경쟁강도 지표 인사이트 */
export function buildCompetitionInsights(data: InsightData): InsightItem[] {
  return competitionRules(data);
}

/** 배후 인구 지표 인사이트 */
export function buildPopulationInsights(data: InsightData): InsightItem[] {
  return populationRules(data);
}

/** 지하철 역세권 인사이트 */
export function buildSubwayInsights(data: InsightData): InsightItem[] {
  return subwayRules(data);
}

/** 버스 접근성 인사이트 */
export function buildBusInsights(data: InsightData): InsightItem[] {
  return busRules(data);
}

/** 학교 접근성 인사이트 */
export function buildSchoolInsights(data: InsightData): InsightItem[] {
  return schoolRules(data);
}

/** 대학교 접근성 인사이트 */
export function buildUniversityInsights(data: InsightData): InsightItem[] {
  return universityRules(data);
}

/** 의료시설 접근성 인사이트 */
export function buildMedicalInsights(data: InsightData): InsightItem[] {
  return medicalRules(data);
}

/** 아코디언 헤더 반환 타입 */
type HeaderInfo = { emoji: string; text: string; sub: string };

/** 교통입지 헤더 (지하철 + 버스 통합) */
export function buildTransitHeader(data: InsightData): HeaderInfo | null {
  const { subway, bus } = data;
  const isRealEstate = data.industryName.includes("부동산");

  const subwayGood = subway ? ["A", "B"].includes(calcSubwayGrade(subway).grade) : false;
  const busGood = bus ? ["A", "B"].includes(calcBusGrade(bus).grade) : false;

  // 지하철 + 버스 모두 양호 — 교통망 풍부 강조
  if (subwayGood && busGood) {
    const s = subway!.nearestStation;
    const sub = s
      ? `${s.stationName}(${s.lineName}) ${s.distanceMeters}m · 버스 ${bus!.stopCount}개 정류장`
      : `지하철·버스 정류장 ${bus!.stopCount}개`;
    const text = isRealEstate
      ? "지하철·버스 노선이 풍부해요, 고객 접근성이 높아요"
      : "지하철·버스 노선이 풍부해요, 유동인구 수요를 기대할 수 있어요";
    return { emoji: "🚇", text, sub };
  }

  // 지하철만 양호
  if (subwayGood && subway) {
    const s = subway.nearestStation;
    if (s) {
      const sub = `${s.stationName}(${s.lineName}) ${s.distanceMeters}m · 일평균 ${(s.dailyAvgTotal / 10000).toFixed(1)}만명`;
      const text = isRealEstate
        ? "지하철 접근성이 뛰어나요, 고객 접근성이 높아요"
        : "지하철 접근성이 뛰어나요, 유동인구 수요를 기대할 수 있어요";
      return { emoji: "🚇", text, sub };
    }
    const first = subway.stationsInRadius[0];
    if (first) {
      const text = isRealEstate
        ? "역세권 안에 위치해요, 고객 접근성이 높아요"
        : "역세권 안에 위치해요, 유동인구 수요를 기대할 수 있어요";
      return { emoji: "🚇", text, sub: `${first.name} ${first.distance}m` };
    }
  }

  // 버스만 양호
  if (busGood && bus) {
    const nearest = bus.nearestStop;
    if (nearest) {
      const sub = `${nearest.name} ${nearest.distanceMeters}m · ${nearest.routeCount}개 노선`;
      const text = isRealEstate
        ? "버스 노선이 풍부해요, 고객 접근성이 높아요"
        : "버스 노선이 풍부해요, 유동인구 수요를 기대할 수 있어요";
      return { emoji: "🚌", text, sub };
    }
    const text = isRealEstate
      ? "버스 접근성이 좋아요, 고객 접근성이 높아요"
      : "버스 접근성이 좋아요, 유동인구 수요를 기대할 수 있어요";
    return { emoji: "🚌", text, sub: `반경 내 정류장 ${bus.stopCount}개` };
  }

  // 지하철/버스 등급이 낮아도 실제 데이터가 있으면 교통 현황 표시
  const hasSubwayData = subway && (subway.nearestStation || subway.stationsInRadius.length > 0);
  const hasBusData = bus && bus.stopCount > 0;

  if (hasSubwayData || hasBusData) {
    const nearest = bus?.nearestStop;
    const subwayNearest = subway?.nearestStation;
    const sub = subwayNearest
      ? `${subwayNearest.stationName}(${subwayNearest.lineName}) ${subwayNearest.distanceMeters}m`
      : nearest
        ? `${nearest.name} ${nearest.distanceMeters}m · ${nearest.routeCount}개 노선`
        : `반경 내 버스 정류장 ${bus!.stopCount}개`;
    return { emoji: "🚌", text: "교통 접근성 현황", sub };
  }

  return null;
}

/** 대학교 접근성 헤더 */
export function buildUniversityHeader(data: InsightData): HeaderInfo | null {
  const { university } = data;
  if (!university?.hasUniversity || university.count === 0) return null;

  // 부동산·병의원·학원은 대학 인근 수요와 무관 → 헤더 숨김
  const industry = data.industryName;
  const isIrrelevant =
    industry.includes("부동산") ||
    industry.includes("병원") ||
    industry.includes("의원") ||
    industry.includes("치과") ||
    industry.includes("한의") ||
    industry.includes("학원");
  if (isIrrelevant) return null;

  const { grade } = calcUniversityGrade(university);
  // D/F 등급은 헤더로 노출하지 않음
  if (grade === "D" || grade === "F") return null;

  const nearest = university.universities[0];
  const distanceM = Math.round(nearest.distanceMeters);
  const text = grade === "A" || grade === "B" ? "대학가 인근이에요, 젊은 고객 수요를 기대할 수 있어요" : "대학교가 근처에 있어요";
  const sub =
    university.count === 1
      ? `${nearest.name} ${distanceM}m`
      : `${nearest.name} 등 ${university.count}곳 · 가장 가까운 곳 ${distanceM}m`;

  return { emoji: "🎓", text, sub };
}

/** 학교 접근성 헤더 */
export function buildSchoolHeader(data: InsightData): HeaderInfo | null {
  const { school } = data;
  if (!school || school.totalCount === 0) return null;

  const isAcademy = data.industryName.includes("학원");

  const text = isAcademy
    ? "근처에 학교들을 찾았어요, 학원 수요를 기대할 수 있어요"
    : "근처에 학교들을 찾았어요, 학생 수요를 기대할 수 있어요";

  const parts: string[] = [];
  if (school.elementaryCount > 0) parts.push(`초${school.elementaryCount}`);
  if (school.middleCount > 0) parts.push(`중${school.middleCount}`);
  if (school.highCount > 0) parts.push(`고${school.highCount}`);
  const sub = parts.length > 0 ? parts.join(" · ") : `총 ${school.totalCount}곳`;

  return { emoji: "🏫", text, sub };
}

/** 의료시설 접근성 헤더 */
export function buildMedicalHeader(data: InsightData): HeaderInfo | null {
  const { medical } = data;
  if (!medical?.hasHospital) return null;

  const { grade } = calcMedicalGrade(medical);
  // D/F 등급은 헤더로 노출하지 않음
  if (grade === "D" || grade === "F") return null;

  const isPharmacy = data.industryName.includes("약국");
  const isConvenience = data.industryName.includes("편의점");
  const text = isPharmacy
    ? "의료시설이 밀집해요, 처방전 수요를 기대할 수 있어요"
    : isConvenience
      ? "편의점은 의료시설 방문객 수요를 기대할 수 있어요"
      : "의료시설이 가까이 있어요 — 병원 방문객 동선에 포함돼요";

  const { count, hospitals, searchRadius } = medical;
  const sub =
    count >= 5
      ? `반경 ${searchRadius}m · ${count}곳`
      : count <= 2
        ? hospitals.map((h) => h.name).join(", ")
        : `${hospitals.slice(0, 2).map((h) => h.name).join(", ")} 외 ${count - 2}곳`;

  return { emoji: "🏥", text, sub };
}

/** 배후 인구 헤더 */
export function buildPopulationHeader(data: InsightData): HeaderInfo | null {
  const { population } = data;
  if (!population) return null;

  const totalPop = population.details.totalPopulation;
  const text =
    totalPop >= 50000
      ? "배후 수요가 충분한 상권이에요"
      : totalPop >= 20000
        ? "배후 인구가 보통 수준인 상권이에요"
        : "배후 인구가 적어요, 유동인구 의존 업종은 불리할 수 있어요";

  const level = population.details.isDongLevel ? "행정동" : "시군구";
  const sub = `${totalPop.toLocaleString()}명 (${level} 기준)`;

  return { emoji: "👥", text, sub };
}

/** 경쟁강도 헤더 */
export function buildCompetitionHeader(data: InsightData): HeaderInfo | null {
  const { competition } = data;
  if (!competition?.competitionScore) return null;

  const grade = (competition.competitionScore?.grade ?? "C") as Grade;
  const industry = data.industryName;
  const isMedical =
    industry.includes("병원") ||
    industry.includes("의원") ||
    industry.includes("치과") ||
    industry.includes("한의");

  let text: string;
  if (isMedical) {
    // 병의원은 "경쟁" 표현 대신 수요-공급 관점 사용
    text =
      grade === "A" || grade === "B"
        ? "수요 대비 공급 여력이 있어요"
        : grade === "C"
          ? "의료 수요 대비 공급이 균형적이에요"
          : "동종 의료시설이 밀집한 편이에요";
  } else {
    text =
      grade === "A" || grade === "B"
        ? "경쟁이 적어요, 시장 선점 기회를 노려볼 수 있어요"
        : grade === "C"
          ? "경쟁 강도가 평균 수준이에요"
          : "경쟁이 치열한 편이에요, 차별화 전략이 필요해요";
  }

  const total = competition.directCompetitorCount + competition.indirectCompetitorCount;
  const sub = `동종업체 ${total}개 · 약 ${Math.round(competition.densityPerMeter)}m마다 1개`;

  return { emoji: "🏪", text, sub };
}

/** 상권 활력도 헤더 */
export function buildVitalityHeader(data: InsightData): HeaderInfo | null {
  const { vitality } = data;
  if (!vitality) return null;

  // 활력도 등급 기반 맥락 해석
  const { grade } = scoreToGrade(vitality.salesScore);
  const text =
    grade === "A" || grade === "B"
      ? "활성화된 상권을 찾았어요"
      : grade === "C"
        ? "평균 수준의 상권이에요"
        : "상권 침체 신호가 있어요, 임대료와 함께 신중히 검토해보세요";

  const fp = vitality.details.floatingPopulation;
  if (fp) {
    const totalMan = (fp.totalFloating / 10000).toFixed(1);
    const sub = `분기 유동인구 ${totalMan}만명 · 피크 ${fp.peakDay} ${fp.peakTimeSlot}`;
    return { emoji: "📊", text, sub };
  }

  const monthlyPerStore = Math.round(vitality.details.salesPerStore / 3 / 10000);
  const sub = `점포당 월평균 ${monthlyPerStore}만원 · 총 ${vitality.details.storeCount}개 점포`;
  return { emoji: "📊", text, sub };
}
