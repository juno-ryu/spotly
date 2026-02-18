import { fetchAllFranchiseBrands } from "./client";
import { cachedFetch, CACHE_TTL } from "@/server/cache/redis";
import { hasApiKey } from "@/lib/env";

/** 프랜차이즈 조회 결과 (내부용 — Set 기반) */
export interface FranchiseFetchResult {
  /** 공정위 등록 프랜차이즈 브랜드명 Set (매칭용) */
  brands: Set<string>;
  /** 등록된 프랜차이즈 총 수 */
  totalRegistered: number;
}

/** 프랜차이즈 지표 (직렬화 가능, AnalysisResult 저장용) */
export interface FranchiseMetrics {
  /** 공정위 등록 프랜차이즈 브랜드명 목록 */
  brands: string[];
  /** 등록된 프랜차이즈 총 수 */
  totalRegistered: number;
}

/**
 * 공정위 전체 프랜차이즈 목록 1회 조회 → 브랜드명 Set 반환.
 *
 * data.go.kr FftcBrandRlsInfo2_Service API 사용.
 * 전체 목록을 가져와서 브랜드명 Set으로 캐싱한다 (30일 TTL).
 * 연도는 현재년도-1부터 시도하고, 0건이면 -2로 fallback (클라이언트 내부 처리).
 */
export async function fetchFranchiseBrands(
  _industryName: string,
  _industryKeywords: string[],
): Promise<FranchiseFetchResult> {
  if (!hasApiKey.dataGoKr) {
    console.log("[Franchise] DATA_GO_KR_API_KEY 없음 — 빈 Set 반환 (하드코딩 fallback 사용)");
    return { brands: new Set(), totalRegistered: 0 };
  }

  try {
    const currentYear = new Date().getFullYear();

    // 전체 목록 1회 조회 (연도 fallback은 fetchAllFranchiseBrands 내부 처리)
    const allBrands = await cachedFetch(
      `franchise:all-brands:${currentYear}`,
      CACHE_TTL.FRANCHISE,
      async () => {
        const res = await fetchAllFranchiseBrands({ numOfRows: 5000 });
        console.log(`[Franchise] 공정위 전체 조회: ${res.totalCount}건`);
        return res.brands;
      },
    );

    // 브랜드명 Set 구성
    const brands = new Set<string>();
    for (const item of allBrands) {
      const name = item.brandNm;
      if (name) brands.add(name.trim());
    }

    console.log(
      `[Franchise] 공정위 등록 브랜드: ${brands.size}개 (전체 ${allBrands.length}건)`,
    );

    return { brands, totalRegistered: allBrands.length };
  } catch (error) {
    console.warn("[Franchise] 조회 실패 — 빈 Set 반환:", error);
    return { brands: new Set(), totalRegistered: 0 };
  }
}
