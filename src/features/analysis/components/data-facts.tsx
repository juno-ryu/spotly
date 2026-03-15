"use client";

import type { SubwayAnalysis } from "@/server/data-sources/subway/adapter";
import type { BusAnalysis } from "@/server/data-sources/bus/adapter";
import type { SchoolAnalysis } from "@/server/data-sources/school/adapter";
import type { UniversityAnalysis } from "@/server/data-sources/university/adapter";
import type { MedicalAnalysis } from "@/server/data-sources/medical/adapter";

interface DataFactsProps {
  subway: SubwayAnalysis | null;
  bus: BusAnalysis | null;
  school: SchoolAnalysis | null;
  university: UniversityAnalysis | null;
  medical: MedicalAnalysis | null;
}

interface FactLine {
  emoji: string;
  text: string;
}

/** 수집된 주변 데이터를 팩트 라인으로 변환 (0건인 항목은 제외) */
function buildFacts({
  subway,
  bus,
  school,
  university,
  medical,
}: DataFactsProps): FactLine[] {
  const facts: FactLine[] = [];

  // 지하철 — nearestStation은 일부 도시만 존재하므로 stationsInRadius 기준으로 표시
  if (subway?.isStationArea && subway.stationsInRadius.length > 0) {
    const count = subway.stationsInRadius.length;
    const nearest = subway.stationsInRadius[0];
    const dist = Math.round(nearest?.distance ?? 0);
    const distText = dist <= 10 ? "바로 앞" : `${dist}m`;
    // nearestStation이 없는 비서울 도시는 stationsInRadius의 name 사용
    const stationName =
      subway.nearestStation?.stationName ?? nearest.name.replace(/역$/, "");
    facts.push({
      emoji: "🚇",
      text:
        count === 1
          ? `${stationName}역 ${distText}`
          : `지하철 ${count}개역 · ${stationName}역 ${distText}`,
    });
  }

  // 버스
  if (bus?.hasBusStop && bus.nearestStop) {
    const nearest = bus.nearestStop;
    const dist = Math.round(nearest.distanceMeters);
    // 가장 가까운 정류장의 노선 수 사용
    const routeCount = nearest.routeCount;
    facts.push({
      emoji: "🚌",
      text: `정류장 ${bus.stopCount}곳 · ${nearest.name} ${dist}m (${routeCount}개 노선)`,
    });
  }

  // 학교
  if (school && school.totalCount > 0) {
    const kinds: string[] = [];
    if (school.elementaryCount > 0) kinds.push(`초${school.elementaryCount}`);
    if (school.middleCount > 0) kinds.push(`중${school.middleCount}`);
    if (school.highCount > 0) kinds.push(`고${school.highCount}`);
    facts.push({
      emoji: "🏫",
      text: `학교 ${school.totalCount}곳 (${kinds.join("·")})`,
    });
  }

  // 대학교
  if (university?.hasUniversity && university.count > 0) {
    const nearest = university.universities[0];
    const dist = Math.round(nearest.distanceMeters);
    facts.push({
      emoji: "🎓",
      text:
        university.count === 1
          ? `${nearest.name} ${dist}m`
          : `대학교 ${university.count}곳 · ${nearest.name} ${dist}m`,
    });
  }

  // 병의원
  if (medical?.hasHospital && medical.count > 0) {
    facts.push({
      emoji: "🏥",
      text: `종합병원 ${medical.count}곳`,
    });
  }

  return facts;
}

interface DataFactsWithTickerProps extends DataFactsProps {
  ticker?: React.ReactNode;
}

/** 수집된 주변 데이터 팩트 리스트 + 하단 롤링 티커 */
export function DataFacts({ ticker, ...props }: DataFactsWithTickerProps) {
  const facts = buildFacts(props);
  if (facts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground tracking-wide">
        수집된 주변 데이터
      </p>
      {ticker}
      <div className="space-y-1.5">
        {facts.map(({ emoji, text }) => (
          <div key={text} className="flex items-center gap-2 text-sm text-foreground/80">
            <span className="text-base shrink-0">{emoji}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground/60">
        이 데이터를 AI가 종합 분석해 맞춤 전략을 제안합니다
      </p>
    </div>
  );
}
