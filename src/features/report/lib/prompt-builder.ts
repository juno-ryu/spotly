import { formatRadius } from "@/lib/format";
import type { CompetitionAnalysis } from "@/features/analysis/lib/scoring/types";
import type { VitalityAnalysis } from "@/features/analysis/lib/scoring/vitality";
import type { PopulationAnalysis } from "@/features/analysis/lib/scoring/population";
import type { SubwayAnalysis } from "@/server/data-sources/subway/adapter";
import type { BusAnalysis } from "@/server/data-sources/bus/adapter";
import type { SchoolAnalysis } from "@/server/data-sources/school/adapter";
import type { UniversityAnalysis } from "@/server/data-sources/university/adapter";
import type { MedicalAnalysis } from "@/server/data-sources/medical/adapter";

/** 반경별 분석 컨텍스트 */
function getRadiusContext(radius: number): string {
  if (radius <= 200) {
    return "200m 밀착 분석: 도보 1~2분, 바로 옆 가게가 직접 경쟁자. 즉각적 경쟁 압력과 목적성 방문이 핵심. 프랜차이즈 1개라도 바로 옆이면 체감 경쟁 극심.";
  }
  if (radius <= 300) {
    return "300m 균형 분석: 도보 3~5분, 가장 보편적 상권 단위. 경쟁·수요·유동인구 모두 의미 있는 해석 가능.";
  }
  return "500m 광역 분석: 도보 7~10분, 동네 전체 시각. 경쟁업체가 많이 잡혀도 실제 직접 경쟁이 아닐 수 있음. 역세권·대학가·배달 업종에 적합한 단위.";
}

export const ANALYSIS_SYSTEM_PROMPT = `<role>
너는 직접 가게를 3번 창업해보고, 지금은 소상공인 상권 분석 컨설턴트로 일하고 있는 10년 차 전문가야.
창업 초보자가 "여기서 이 장사하면 될까요?"라고 물어보면, 데이터를 보고 솔직하게 답해주는 역할이야.
</role>

<tone>
- 따뜻하고 다정하게, 하지만 핵심은 정확하게. "~해요", "~거든요", "~이에요" 체.
- 숫자를 말할 때는 근거 데이터를 같이 언급하되 부드럽게 전달해줘.
- 위험한 부분도 "이 부분은 조금 신경 써야 할 것 같아요"처럼 응원의 톤으로.
- "당신" 표현 금지. "이 위치에서는", "이 상권에서는"으로 표현해줘.
</tone>

<principles>
1. 점수는 참고, 판단은 네가 해. 알고리즘 점수를 그대로 따르지 마. 너의 전문가적 판단으로 verdict를 결정해.
2. 단일 지표만 보고 판단하지 마. 지표 간 교차 분석을 반드시 해줘.
3. 주소를 보고 상권 유형(관광지/대학가/오피스/주거)을 판단하고, 그 맥락에 맞게 해석해줘.
4. 반경 크기에 따라 데이터의 의미가 달라져. 반경 컨텍스트를 반드시 반영해줘.
5. 데이터 없는 항목은 절대 만들어내지 마. 있는 데이터로 최대한 분석해줘.
</principles>

<cross_analysis_guide>
- 경쟁 많음 + 매출 높음 → 검증된 수요. 차별화하면 진입 가능
- 경쟁 적음 + 매출 낮음 → 수요 자체 부재 가능. 위험 신호
- 유동인구 피크 ≠ 매출 피크 → 지나가는 사람 ≠ 소비하는 사람
- 프랜차이즈 비율 높음 → 상권 검증됐지만 개인 생존 어려움
- 인구 적음 + 교통 좋음 → 외부 유입형 상권 가능성
- 관광지: 배후인구 적어도 관광객이 매출 핵심. 계절성·외국인 비율 반영
- 대학가: 학기/방학 사이클, 저가·빠른회전 유리
- 오피스: 점심·저녁 집중, 주말 급감
- 주거: 배달·저녁·주말 매출 비중 높음
</cross_analysis_guide>

<output_rules>
반드시 유효한 JSON만 응답해. 한국어로 작성. 마크다운(**, ##) 금지. 맥락에 맞는 이모지는 적절히 사용 가능.
한 단어 안에 한글과 영문을 섞지 마(예: "프리미um" ❌ → "프리미엄" ✅). 외래어는 반드시 완전한 한글 표기로.
</output_rules>`;

/** 분석 데이터 → 사용자 메시지 조립 */
export function buildAnalysisPrompt(params: {
  address: string;
  industryName: string;
  radius: number;
  totalScore: number;
  scoreGrade: string;
  competition: CompetitionAnalysis;
  vitality: VitalityAnalysis | null;
  population: PopulationAnalysis | null;
  subway: SubwayAnalysis | null;
  bus: BusAnalysis | null;
  school: SchoolAnalysis | null;
  university: UniversityAnalysis | null;
  medical: MedicalAnalysis | null;
}): string {
  const { competition: c, vitality: v } = params;
  const radiusLabel = formatRadius(params.radius);

  // ── 데이터 블록 ──
  const competitionData = `경쟁 강도: ${c.competitionScore.grade}등급 (${c.competitionScore.score}점)
반경 내 전체 경쟁업체: ${c.totalCount}개 (카카오 Places 기준)
밀집도: ${c.densityPerMeter}m당 1개 (기준 ${c.densityBaseline}m) | 직접경쟁 약 ${c.estimatedDirectCount}개(${(c.directCompetitorRatio * 100).toFixed(0)}%) | 간접 약 ${c.estimatedIndirectCount}개(${((1 - c.directCompetitorRatio) * 100).toFixed(0)}%) | 프랜차이즈 약 ${c.estimatedFranchiseCount}개(${(c.franchiseRatio * 100).toFixed(0)}%)${c.franchiseBrandNames.length > 0 ? ` | 브랜드: ${c.franchiseBrandNames.join(", ")}` : ""}
※ 직접/간접/프랜차이즈 수는 샘플 ${c.fetchedCount}개의 비율을 전체 ${c.totalCount}개에 적용한 추정치`;

  let vitalityData = "";
  if (v) {
    const d = v.details;
    const monthlyPerStore = d.storeCount > 0 ? Math.round(d.salesPerStore / 10000) : 0;
    vitalityData = `활력도: ${v.vitalityScore.grade}등급 (${v.vitalityScore.score}점) — 매출${v.salesScore} 변화${v.changeScore} 유동${v.footTrafficScore}
점포당 월매출 ${monthlyPerStore.toLocaleString()}만원(${d.storeCount}개 기준) | 피크 ${d.peakTimeSlot} | 주소비층 ${d.mainAgeGroup} | 상권변화 ${d.changeIndexName ?? "미확인"} | 개업 ${d.openRate}% 폐업 ${d.closeRate}%${d.floatingPopulation ? `\n유동인구(분기) ${d.floatingPopulation.totalFloating.toLocaleString()}명 | 남${Math.round(d.floatingPopulation.maleRatio * 100)}%:여${Math.round((1 - d.floatingPopulation.maleRatio) * 100)}% | 피크 ${d.floatingPopulation.peakDay} ${d.floatingPopulation.peakTimeSlot} | 주연령 ${d.floatingPopulation.mainAgeGroup}` : ""}${d.residentPopulation ? ` | 상주 ${d.residentPopulation.totalResident.toLocaleString()}명` : ""}`;
  } else {
    vitalityData = "활력도: 비서울 — 매출/유동인구 데이터 없음";
  }

  const popData = params.population
    ? `인구: ${params.population.score.grade}등급 (${params.population.score.score}점) — ${params.population.details.totalPopulation.toLocaleString()}명 (${params.population.details.isDongLevel ? "읍면동" : "시군구"})`
    : "인구: 데이터 없음";

  const infraParts: string[] = [];
  if (params.subway) {
    const s = params.subway;
    infraParts.push(s.isStationArea && s.nearestStation
      ? `지하철: 역세권 — ${s.nearestStation.stationName}(${s.nearestStation.lineName}) ${s.nearestStation.distanceMeters}m, 일 ${s.nearestStation.dailyAvgTotal.toLocaleString()}명`
      : "지하철: 비역세권");
  }
  if (params.bus) {
    const b = params.bus;
    infraParts.push(`버스: 정류장 ${b.stopCount}개${b.nearestStop ? `, 최근접 ${b.nearestStop.name}(${b.nearestStop.distanceMeters}m), 노선 ${b.totalRouteCount}개` : ""}`);
  }
  if (params.school && params.school.totalCount > 0) {
    const sc = params.school;
    infraParts.push(`학교: 초${sc.elementaryCount} 중${sc.middleCount} 고${sc.highCount} (합계 ${sc.totalCount}개)`);
  }
  if (params.university?.hasUniversity) {
    infraParts.push(`대학: ${params.university.universities.map((u) => `${u.name}(${u.distanceMeters}m)`).join(", ")}`);
  }
  if (params.medical?.hasHospital) {
    infraParts.push(`의료: ${params.medical.count}개`);
  }
  const infraData = infraParts.length > 0 ? infraParts.join("\n") : "인프라: 데이터 없음";

  // ── JSON 출력 스키마 ──
  const outputSchema = `{
  "_reasoning": "여기에 먼저 네 사고 과정을 적어줘. 1) 이 주소의 상권 유형은? 2) 반경 ${radiusLabel}에서 이 데이터가 의미하는 바는? 3) 지표 간 교차 분석 결과는? 4) 알고리즘 점수(${params.scoreGrade}등급 ${params.totalScore}점)에 동의하는지, 다르게 판단한다면 이유는? 5) 이 업종에 이 입지가 적합한 최종 판단",
  "_confidence": "상/중/하 — 데이터 완성도 기반 분석 신뢰도",
  "_counterpoint": "내 분석의 가장 큰 약점 또는 반론 1가지",
  "verdict": "추천|조건부 추천|주의|비추천",
  "analysisScope": "반경 ${radiusLabel} 기준 이 분석의 범위와 의미 한 줄",
  "summary": "종합 의견 50자 이내",
  "competitorCount": { "direct": 수, "indirect": 수, "franchise": 수, "interpretation": "한 줄 해석", "densityPercent": 0~100 경쟁 밀집도(밀집도·프랜차이즈·지역특성 종합 판단), "densityLabel": "밀집도 한 줄 해석" },
  "competitionGrade": { "grade": "A~F", "score": 0~100, "label": "등급 해석", "rationale": "근거+수치" },
  "revenueEstimate": { "monthlyPerStoreMaan": 만원수, "peakTimeSlot": "시간대", "mainAgeGroup": "연령대", "storeCount": 수, "interpretation": "해석" } 또는 null,
  "revenueEstimateUnavailableReason": "사유" 또는 null,
  "survivalAnalysis": { "closeRate": 수, "openRate": 수, "isHighCloseRate": bool, "interpretation": "2~3문장", "dataSource": "출처" } 또는 null,
  "riskWarnings": [{ "title": "제목", "detail": "수치 포함 내용", "severity": "위험|경고|주의" }],
  "strategy": { "positioning": "1~2문장", "actionItems": ["구체적 행동 3~5개"], "targetCustomer": "타겟", "recommendedHours": "시간대 또는 null" },
  "locationAdvice": { "currentAssessment": "현 입지 총평 (다른 위치 추천 금지)", "suggestions": [{ "direction": "방향", "rationale": "근거" }] },
  "populationInsight": { "headline": "핵심 한 줄", "body": "2~3문장", "exteriorDependencyPercent": 0~100 외부수요의존도(유동인구/배후인구 비율·상권유형·교통 종합 판단), "exteriorDependencyLabel": "의존도 한 줄 해석" } 또는 null,
  "infrastructureInsight": { "headline": "핵심 한 줄", "body": "2~3문장" } 또는 null,
  "detailedAnalysis": "3~5문단 상세 분석. 반드시 데이터 수치를 인용하고, 교차 분석하고, 반경·장소 맥락을 반영해줘.",
  "relatedIndustries": [{ "name": "업종명(아래 목록에서만 선택)", "reason": "이 업종이 분석 대상 업종에 어떤 영향을 끼치는지 한 줄" }]
}`;

  return `<data>
<target>
위치: ${params.address}
업종: ${params.industryName}
반경: ${radiusLabel}
반경 컨텍스트: ${getRadiusContext(params.radius)}
알고리즘 종합 점수: ${params.scoreGrade}등급 ${params.totalScore}점 (참고용)
</target>

<competition>
${competitionData}
</competition>

<vitality>
${vitalityData}
</vitality>

<population>
${popData}
</population>

<infrastructure>
${infraData}
</infrastructure>
</data>

<task>
위 데이터를 분석해서 아래 JSON 형식으로 응답해줘.
_reasoning을 반드시 첫 번째로 작성하고, 그 사고 과정에 기반해서 나머지 필드를 채워줘.

relatedIndustries: "${params.industryName}"과 직접적으로 고객을 뺏거나, 같이 있으면 매출이 오르는 업종 2~3개만 추천해줘.
조건: 1) 같은 상권에서 실제로 고객층이 겹치는 업종만. 2) 억지로 연결짓지 마. 진짜 현장에서 체감되는 관계만. 3) 분석 대상 업종 자체는 제외.
반드시 다음 목록에서만 선택: 한식음식점, 중식음식점, 일식음식점, 서양식음식점, 치킨전문점, 피자전문점, 분식전문점, 햄버거전문점, 커피전문점, 주스/음료전문점, 제과점, 편의점, 슈퍼마켓, 미용실, 네일숍, 피부관리실, 약국, 일반의원, 치과의원, 한의원, 헬스클럽, 요가/필라테스, 학원, 어학원, 예체능학원, 부동산중개, 노래방, PC방

${outputSchema}
</task>`;
}
