import { searchStoresInRadius, type SbizStore } from "./client";
import { getSbizFilter } from "./industry-mapping";

/**
 * 소상공인 상가정보 Adapter
 *
 * 역할: Kakao Places 경쟁업체 데이터의 "보조 검증" 소스
 * - totalCount는 Kakao 단독 유지 (스코어링 공식 변경 없음)
 * - 상가정보는 Kakao에서 누락된 업체를 보충하고, 업종 분포를 제공
 *
 * 스코어링 반영: 없음 (박사님 승인 — 방안 A: 보조 검증용만)
 * 용도: UI 표시 ("상가정보 기준 약 N개"), AI 리포트 참고 데이터
 */

/** 업종 분류별 점포 수 */
export interface IndustryBreakdown {
  /** 업종대분류명 */
  category: string;
  /** 업종대분류코드 */
  categoryCode: string;
  /** 점포 수 */
  count: number;
}

/** 상가정보 분석 결과 */
export interface SbizAnalysis {
  /** 반경 내 전체 점포 수 (상가정보 기준) */
  totalCount: number;
  /** 업종대분류별 점포 수 (상위 10개) */
  industryBreakdown: IndustryBreakdown[];
  /** 반경 내 상가 목록 (최대 100건, 거리순 — AI 리포트용) */
  stores: SbizStoreItem[];
  /** 기준년월 (YYYYMM) */
  stdrYm?: string;
}

/** UI/AI 리포트용 상가 항목 (경량) */
export interface SbizStoreItem {
  name: string;
  branch: string;
  categoryL: string;
  categoryM: string;
  categoryS: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * 좌표 기준 반경 내 상가정보 분석
 *
 * orchestrator에서 Promise.all로 병렬 호출.
 * 실패 시 null 반환 (다른 지표에 영향 없음).
 */
export async function fetchSbizAnalysis(params: {
  latitude: number;
  longitude: number;
  radius: number;
  /** 스팟리 업종 코드 (KSIC) — 업종 필터링에 사용 */
  industryCode?: string;
}): Promise<SbizAnalysis> {
  const { latitude, longitude, radius, industryCode } = params;

  // 업종 매핑 → API 레벨 필터 (소분류 우선, 대분류 fallback)
  const filter = industryCode ? getSbizFilter(industryCode) : null;
  // 소분류 코드가 1개면 API에서 직접 필터, 여러 개면 첫 번째만 API 필터 + 나머지 앱 필터
  const indsSclsCd = filter?.type === "sclsCd" && filter.codes.length === 1
    ? filter.codes[0]
    : undefined;
  const indsLclsCd = !indsSclsCd && filter?.type === "lclsCd"
    ? filter.codes[0]
    : undefined;

  const result = await searchStoresInRadius({
    latitude,
    longitude,
    radius,
    indsLclsCd,
    indsSclsCd,
  });

  // 소분류 코드가 여러 개인 경우 앱 레벨 추가 필터링
  const filteredStores = filter?.type === "sclsCd" && filter.codes.length > 1
    ? result.stores.filter((s) => filter.codes.includes(s.indsSclsCd))
    : result.stores;
  const filteredCount = filter?.type === "sclsCd" && filter.codes.length > 1
    ? filteredStores.length
    : result.totalCount;

  // 업종대분류별 집계
  const categoryMap = new Map<string, { code: string; count: number }>();
  for (const store of filteredStores) {
    const key = store.indsLclsNm;
    const existing = categoryMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      categoryMap.set(key, { code: store.indsLclsCd, count: 1 });
    }
  }

  const industryBreakdown = [...categoryMap.entries()]
    .map(([category, { code, count }]) => ({
      category,
      categoryCode: code,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // AI 리포트용 경량 목록 (최대 100건)
  const stores: SbizStoreItem[] = filteredStores.slice(0, 100).map((s) => ({
    name: s.bizesNm,
    branch: s.brchNm,
    categoryL: s.indsLclsNm,
    categoryM: s.indsMclsNm,
    categoryS: s.indsSclsNm,
    address: s.rdnmAdr || s.lnoAdr,
    lat: s.lat,
    lng: s.lon,
  }));

  console.log(
    `[상가정보] 분석 완료: 전체 ${result.totalCount}건 → 업종 필터 후 ${filteredCount}건, ${industryBreakdown.length}개 분류`,
  );

  return {
    totalCount: filteredCount,
    industryBreakdown,
    stores,
    stdrYm: result.stdrYm,
  };
}
