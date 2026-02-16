# 공정거래위원회 가맹사업거래 API 연동 가이드

## 📋 개요

공정위 가맹사업거래 API를 활용하여 **프랜차이즈 브랜드 여부를 확인**하고, 창업 분석의 **경쟁 강도 계산에 가중치를 적용**합니다.

### 주요 활용 사례

```
사용자가 "강남역 + 커피" 검색
    ↓
Kakao Places API로 주변 커피점 20개 검색
    ↓
공정위 API로 프랜차이즈 여부 확인
    ↓
"20개 중 8개가 프랜차이즈 (40%)"
    ↓
경쟁 강도 계산 시 프랜차이즈는 1.5배 가중치 적용
```

---

## 🔧 설정

### 1. 환경 변수

`.env` 파일에 API 키가 설정되어 있어야 합니다:

```bash
# 공정거래 위원회 가맹 사업 거래
FRANCHISE_OPEN_API_KEY=sCxs2AA+9pMA+RlIypwNnJnbXw96DvAU+M8NKFpm
```

⚠️ **주의**: URL 인코딩된 키(`%2B`)가 아닌 **디코딩된 키**(`+`)를 사용해야 합니다.

### 2. 환경 변수 검증

`src/lib/env.ts`에 이미 추가되어 있습니다:

```typescript
import { env, hasApiKey } from "@/lib/env";

// API 키 존재 여부 확인
if (hasApiKey.franchise) {
  // 프랜차이즈 API 사용 가능
}
```

---

## 📚 API 함수

### 1. 브랜드명으로 검색 (주요 활용)

```typescript
import { searchFranchiseByBrand } from "@/server/data-sources/franchise-client";

// 스타벅스가 프랜차이즈인지 확인
const result = await searchFranchiseByBrand("스타벅스");

if (result.totalCount > 0) {
  console.log("프랜차이즈입니다!");
  console.log(result.data[0]);
  // {
  //   jngIfrmpSn: "123456",
  //   frcsBizNm: "스타벅스커피코리아(주)",
  //   brdNm: "스타벅스",
  //   bzmnLicenNo: "110111****",
  //   regDt: "20230515"
  // }
} else {
  console.log("개인 사업장입니다.");
}
```

### 2. 업종별 검색

```typescript
import { searchFranchiseByIndustry } from "@/server/data-sources/franchise-client";

// 커피 업종의 프랜차이즈 목록 조회
const result = await searchFranchiseByIndustry("커피", {
  numOfRows: 10,
});

console.log(`커피 프랜차이즈: ${result.totalCount}개`);
```

### 3. 전체 목록 조회

```typescript
import { getFranchiseList } from "@/server/data-sources/franchise-client";

// 2023년 등록된 프랜차이즈 목록
const result = await getFranchiseList({
  yr: "2023",
  pageNo: 1,
  numOfRows: 10,
});

console.log(`총 ${result.totalCount}개`);
result.data.forEach((brand) => {
  console.log(`- ${brand.brdNm} (${brand.frcsBizNm})`);
});
```

### 4. 상세 정보 조회

```typescript
import { getFranchiseDetail } from "@/server/data-sources/franchise-client";

const detail = await getFranchiseDetail("150958"); // 일련번호
console.log(detail);
```

---

## 🎯 프로젝트 통합 방법

### 시나리오: Kakao Places 검색 결과에서 프랜차이즈 체크

#### 1단계: 공정위 API에서 업종별 프랜차이즈 전체 목록 가져오기 (1회만)

```typescript
import { searchFranchiseByIndustry } from "@/server/data-sources/franchise-client";

// 커피 업종의 모든 프랜차이즈 목록 조회
const franchiseData = await searchFranchiseByIndustry("커피", {
  numOfRows: 1000, // 충분히 큰 값으로 전체 조회
});

// 빠른 검색을 위해 Set 생성
const franchiseBrands = new Set(
  franchiseData.data
    ?.map((f) => f.brdNm?.toLowerCase().trim())
    .filter(Boolean) ?? []
);

console.log(`커피 프랜차이즈 ${franchiseBrands.size}개 로드됨`);
// → 스타벅스, 투썸플레이스, 이디야, 카페베네, 엔제리너스, ...
```

#### 2단계: 주변 업체 검색 (Kakao Places)

```typescript
// Kakao Places API로 주변 커피점 검색
const places = [
  { name: "스타벅스 강남역점", category: "카페" },
  { name: "투썸플레이스 강남점", category: "카페" },
  { name: "민수네커피", category: "카페" },
  { name: "카페베네 역삼점", category: "카페" },
  // ... 총 20개
];
```

#### 3단계: 문자열 매칭으로 프랜차이즈 필터링

```typescript
// 브랜드명 추출 함수
function extractBrandName(placeName: string): string {
  return (
    placeName
      // 지점명 패턴 제거
      .replace(/\s+(강남|역삼|서초|신사|압구정).*점$/, "")
      .replace(/\s+\d+호점$/, "")
      .replace(/\s+점$/, "")
      // 지역명 제거
      .replace(/\s+(강남|역삼|서초|신사|압구정)$/, "")
      .toLowerCase()
      .trim()
  );
}

// 프랜차이즈 필터링 (API 호출 0회!)
const enrichedPlaces = places.map((place) => {
  const brandName = extractBrandName(place.name);
  const isFranchise = franchiseBrands.has(brandName);

  return {
    ...place,
    brandName,
    isFranchise,
  };
});

const franchiseCount = enrichedPlaces.filter((p) => p.isFranchise).length;
console.log(`${places.length}개 중 ${franchiseCount}개가 프랜차이즈`);
// "20개 중 8개가 프랜차이즈 (40%)"
```

#### 3단계: 경쟁 강도 계산 (가중치 적용)

```typescript
// src/features/analysis/lib/scoring-engine.ts

function calculateCompetitionScore(competitors: Competitor[]): number {
  let weightedCount = 0;

  competitors.forEach((competitor) => {
    if (competitor.isFranchise) {
      weightedCount += 1.5; // 프랜차이즈는 1.5배 가중치
    } else {
      weightedCount += 1.0; // 개인 사업장은 1.0배
    }
  });

  // 정규화 (0~25점)
  const maxCompetitors = 50; // 최대 경쟁 업체 수 기준
  const score = Math.min((weightedCount / maxCompetitors) * 25, 25);

  return 25 - score; // 경쟁이 적을수록 높은 점수
}

// 예시
const competitors = [
  { name: "스타벅스", isFranchise: true },
  { name: "투썸플레이스", isFranchise: true },
  { name: "민수네커피", isFranchise: false },
  // ... 총 20개
];

const score = calculateCompetitionScore(competitors);
console.log(`경쟁 강도 점수: ${score.toFixed(1)}점`);
```

---

## 📊 데이터 구조

### API 응답 타입

```typescript
interface FranchiseApiResponse<T> {
  resultCode?: string; // "00" = 성공
  resultMsg?: string; // 결과 메시지
  totalCount?: number; // 전체 개수
  data?: T[]; // 데이터 배열
}

interface FranchiseBrand {
  jngIfrmpSn: string; // 정보공개서 일련번호 (고유 ID)
  frcsBizNm: string; // 가맹본부명 (법인명)
  brdNm?: string; // 브랜드명
  bzmnLicenNo?: string; // 사업자등록번호 (일부 마스킹)
  regDt?: string; // 정보공개서 등록번호 (YYYYNNNN)
  rprsntNm?: string; // 대표자명
  induty?: string; // 업종
  addr?: string; // 주소
  telno?: string; // 전화번호
}
```

### 실제 응답 예시

```json
{
  "resultCode": "00",
  "resultMsg": "SUCCESS",
  "totalCount": 30,
  "data": [
    {
      "jngIfrmpSn": "149646",
      "frcsBizNm": "(주)바디퍼스트",
      "brdNm": "바디퍼스트",
      "bzmnLicenNo": "6308801910",
      "regDt": "20221253"
    }
  ]
}
```

---

## 🚀 성능 최적화

### 1. 캐싱 (Redis)

프랜차이즈 목록을 캐싱하여 반복 API 호출 방지:

```typescript
import { cachedFetch } from "@/server/cache/redis";
import { searchFranchiseByIndustry } from "@/server/data-sources/franchise-client";

async function getFranchiseBrandsWithCache(
  industry: string
): Promise<Set<string>> {
  const cacheKey = `franchise:industry:${industry}`;

  const brands = await cachedFetch(
    cacheKey,
    60 * 60 * 24 * 7, // 7일 캐싱
    async () => {
      const result = await searchFranchiseByIndustry(industry, {
        numOfRows: 1000,
      });
      return result.data?.map((f) => f.brdNm?.toLowerCase().trim()) ?? [];
    }
  );

  return new Set(brands.filter(Boolean));
}

// 사용 예시
const coffeeFranchises = await getFranchiseBrandsWithCache("커피");
```

### 2. 여러 업종 처리

여러 업종의 프랜차이즈를 한 번에 조회:

```typescript
async function getMultiIndustryFranchises(
  industries: string[]
): Promise<Set<string>> {
  // 병렬로 여러 업종 조회
  const results = await Promise.all(
    industries.map((industry) =>
      searchFranchiseByIndustry(industry, { numOfRows: 1000 })
    )
  );

  // 모든 브랜드를 하나의 Set으로 통합
  const allBrands = new Set<string>();
  results.forEach((result) => {
    result.data?.forEach((franchise) => {
      if (franchise.brdNm) {
        allBrands.add(franchise.brdNm.toLowerCase().trim());
      }
    });
  });

  return allBrands;
}

// 사용 예시
const franchises = await getMultiIndustryFranchises([
  "커피",
  "한식",
  "치킨",
  "편의점",
]);
```

### 3. 브랜드명 정규화

지점명, 지역명을 제거하여 정확도 향상:

```typescript
function normalizeBrandName(placeName: string): string {
  return (
    placeName
      // 지점명 제거
      .replace(/\s+(강남|역삼|서초|신사|압구정).*점$/, "")
      // 지역명 제거
      .replace(/\s+(강남|역삼|서초|신사|압구정)$/, "")
      // 공백 정리
      .trim()
  );
}

// 예시
normalizeBrandName("스타벅스 강남역점"); // "스타벅스"
normalizeBrandName("투썸플레이스 강남"); // "투썸플레이스"
```

---

## ⚠️ 주의사항

### 1. API 응답 구조

공정위 API는 **목록 조회(`type=list`)**에서 제공하는 정보가 제한적입니다:

| 제공됨 | 제공 안됨 |
|--------|----------|
| ✅ 브랜드명 | ❌ 업종 (목록에서) |
| ✅ 사업자번호 | ❌ 주소 |
| ✅ 등록번호 | ❌ 전화번호 |

### 2. 브랜드명 매칭

**문자열 매칭 주의사항:**

- 공정위 등록명과 실제 상호명이 다를 수 있음
  - 공정위: "스타벅스" / 카카오: "스타벅스커피"
  - 공정위: "투썸플레이스" / 카카오: "A TWOSOME PLACE"
- 부분 일치 또는 유사도 검색 필요:

```typescript
function fuzzyMatch(placeName: string, franchiseName: string): boolean {
  const place = placeName.toLowerCase().replace(/\s+/g, "");
  const franchise = franchiseName.toLowerCase().replace(/\s+/g, "");

  // 한쪽이 다른 쪽을 포함하면 매칭
  return place.includes(franchise) || franchise.includes(place);
}

// 사용
const isFranchise = Array.from(franchiseBrands).some(brand =>
  fuzzyMatch(placeName, brand)
);
```

### 3. API 제한

- **호출 제한**: 공공 API이므로 과도한 호출 주의
- **응답 시간**: 외부 API이므로 타임아웃 설정 권장
- **에러 처리**: 네트워크 오류, API 오류 대비

```typescript
try {
  const result = await searchFranchiseByBrand(brandName);
  return result.totalCount > 0;
} catch (error) {
  console.error("프랜차이즈 체크 실패:", error);
  // 기본값 반환 (false = 개인 사업장으로 간주)
  return false;
}
```

---

## 🧪 테스트

### 개발 환경에서 테스트

```bash
# Next.js 개발 서버 실행
npm run dev

# 브라우저에서 테스트
http://localhost:3000/api/test-franchise
```

### 수동 테스트

```typescript
import { searchFranchiseByBrand } from "@/server/data-sources/franchise-client";

// Server Component 또는 API Route에서
const brands = ["스타벅스", "투썸플레이스", "카페베네", "민수네커피"];

for (const brand of brands) {
  const result = await searchFranchiseByBrand(brand);
  console.log(
    `${brand}: ${result.totalCount > 0 ? "프랜차이즈" : "개인"}`
  );
}
```

---

## 📖 참고 자료

- **공정위 API 가이드**: https://franchise.ftc.go.kr/openApi/guide.do
- **공공데이터포털**: https://www.data.go.kr/data/15125569/openapi.do
- **프로젝트 코드**: `src/server/data-sources/franchise-client.ts`

---

## 💡 활용 아이디어

### 1. 프랜차이즈 비율 표시

```typescript
// UI에 표시
"주변 커피점 20개 중 8개가 프랜차이즈 (40%)"
```

### 2. 경쟁 강도 조절

```typescript
// 프랜차이즈는 자본력/브랜드 파워가 강하므로 가중치 적용
가중 경쟁 수 = (개인 × 1.0) + (프랜차이즈 × 1.5)
```

### 3. 프랜차이즈 목록 표시

```typescript
// 검색된 프랜차이즈만 별도 표시
프랜차이즈:
- 스타벅스 (3개 지점)
- 투썸플레이스 (2개 지점)
- 이디야커피 (1개 지점)
```

### 4. AI 리포트에 포함

```typescript
// Claude AI 리포트에 프랜차이즈 정보 추가
"이 지역은 스타벅스, 투썸플레이스 등 대형 프랜차이즈가 8개 위치해 있어,
개인 창업자에게는 브랜드 경쟁력 확보가 중요합니다."
```

---

## 🔄 업데이트 로그

- **2026-02-16**: 초기 연동 완료
  - `searchFranchiseByBrand()` 구현
  - `searchFranchiseByIndustry()` 구현
  - 환경 변수 설정
  - API 테스트 완료
