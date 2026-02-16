import { searchFranchiseByIndustry } from "@/server/data-sources/franchise-client";
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
 * 업종별 프랜차이즈 브랜드 목록을 공정위 API에서 조회한다.
 * 여러 키워드로 병렬 조회 후 Set으로 통합, 30일 캐싱.
 * API 키 없거나 실패 시 빈 Set 반환 (graceful degradation).
 */
export async function fetchFranchiseBrands(
  industryName: string,
  industryKeywords: string[],
): Promise<FranchiseFetchResult> {
  if (!hasApiKey.franchise) {
    console.log("[Franchise] API 키 없음 — 빈 Set 반환 (하드코딩 fallback 사용)");
    return { brands: new Set(), totalRegistered: 0 };
  }

  try {
    // 업종명 + 키워드에서 고유한 검색어 추출 (중복 제거)
    const searchTerms = [...new Set([industryName, ...industryKeywords])];

    // 각 키워드별 병렬 조회 (cachedFetch로 30일 캐싱)
    const results = await Promise.allSettled(
      searchTerms.map((keyword) =>
        cachedFetch(
          `franchise:brands:${keyword}`,
          CACHE_TTL.FRANCHISE,
          async () => {
            const res = await searchFranchiseByIndustry(keyword, {
              numOfRows: 1000,
            });
            return res.data ?? [];
          },
        ),
      ),
    );

    // 성공한 결과의 브랜드명을 Set으로 통합
    const brands = new Set<string>();
    let totalRegistered = 0;

    for (const result of results) {
      if (result.status !== "fulfilled") continue;

      const items = result.value;
      totalRegistered += items.length;

      for (const item of items) {
        // 브랜드명 우선, 없으면 가맹본부명 사용
        const name = item.brdNm ?? item.frcsBizNm;
        if (name) brands.add(name.trim());
      }
    }

    console.log(
      `[Franchise] 조회 완료: ${brands.size}개 브랜드 (검색어 ${searchTerms.length}개, 총 ${totalRegistered}건)`,
    );

    return { brands, totalRegistered };
  } catch (error) {
    console.warn("[Franchise] 조회 실패 — 빈 Set 반환:", error);
    return { brands: new Set(), totalRegistered: 0 };
  }
}
