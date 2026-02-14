# `service/` 레거시 구조 분석 및 현행 프로젝트 적용 제안

## 1. 분석 대상 개요

`service/` 디렉토리는 이전 프로젝트에서 사용하던 **REST API 통신 계층**으로, 4개 하위 모듈로 구성되어 있다.

```
service/
├── api/          # API 요청 로직 (서비스별 분리)
│   ├── consts/   # URI 상수 정의
│   ├── service/  # 서비스별 API 함수
│   └── type/     # 서비스 전용 타입
├── enum/         # 비즈니스 열거형 (39개 파일)
├── input/        # 요청(Request) 타입 정의
│   └── common/   # 페이지네이션, 정렬 등 공통 입력
└── output/       # 응답(Response) 타입 정의
    └── common/   # 페이지네이션 등 공통 출력
```

---

## 2. 구조별 평가

### 2.1 `api/` — API 서비스 계층

**구조:**
- `api.common.ts`: `BASE_URL`, `BASE_SERVICE` 상수
- `api.const.ts`: 모든 URI를 하나의 객체(`API_URIS`)에 합산
- `api.service.ts`: 모든 API 함수를 하나의 객체(`API_APIS`)에 합산
- `service/*.service.ts`: 서비스별 API 함수 정의
- `consts/*.const.ts`: 서비스별 URI + tag 정의

**평가:**

| 항목 | 판정 | 사유 |
|------|------|------|
| URI + tag 한 쌍 관리 패턴 | ✅ **채택 (수정 판단)** | Server Component의 Next.js fetch tags 관리에 유용. endpoint와 cache tag를 한 곳에서 관리하면 `revalidateTag` 호출 시 실수 방지 |
| feature별 endpoint 상수 정의 | ✅ **채택** | 레거시의 `consts/*.const.ts` 역할을 feature별 `api.ts` 내부에서 수행 |
| 서비스별 파일 분리 | ⚠️ 이미 반영됨 | 현행 `features/[name]/api.ts`가 동일 역할 |
| 모든 API를 하나의 객체로 합산 | ❌ 불채택 | feature 기반 구조에서는 분산이 더 적절. 전역 합산은 feature 간 결합도 증가 |
| `Operation` enum (GET, POST 등) | ❌ 불채택 | 현행 `httpClient.get()`, `httpClient.post()` 메서드 체인이 더 직관적 |

**결론:** URI + tag 한 쌍 관리 패턴은 Server Component 캐시 관리에 유용하므로 채택. 단, 전역 합산 레지스트리(`API_URIS`, `API_APIS`)는 채택하지 않고 feature별 `api.ts` 내부에서 관리.

> **참고 — 판단 수정 경위:** 초기 분석에서 tag 관리를 "React Query queryKey가 대체"한다고 판단했으나, React Query 자체를 선택적으로 전환하는 방향이 논의되면서 Next.js 네이티브 fetch의 `tags` 관리 수단이 필요해짐. 이에 따라 URI + tag 레지스트리 패턴의 가치를 재평가.

---

### 2.2 `input/common/` — 공통 요청 타입

**분석 대상:**

```typescript
// pageable.ts — 페이지네이션 입력
type PageableInput = {
  page: Nullable<number>;
  size: Nullable<number>;
};

// sort.ts — 정렬 입력
enum DirectionInput { ASC = 'asc', DESC = 'desc' }
type SortInput = {
  sort: Nullable<string[]>;
};

// language-set.ts — 다국어 입력
type LanguageSet = {
  lang: LanguageCode;
  text: string;
};
```

**평가:**

| 항목 | 판정 | 사유 |
|------|------|------|
| `PageableInput` | ✅ **채택 권장** | 백엔드가 Spring 기반이라면 페이지네이션 요청 구조가 동일할 것. zod 스키마로 전환하여 사용 |
| `SortInput` + `DirectionInput` | ✅ **채택 권장** | 정렬 파라미터 표준화에 유용 |
| `LanguageSet` | ⚠️ 조건부 | 다국어 기능 구현 시 필요 |

---

### 2.3 `output/common/` — 공통 응답 타입

**분석 대상:**

```typescript
// pagination-output.ts — Spring 페이지네이션 응답
type PaginationOutput = {
  total: number;
  page: number;
  size: number;
  last: number;
};

// sort-output.ts — 정렬 응답
type SortOutput = {
  field: string;
  direction: string;
};
```

**평가:**

| 항목 | 판정 | 사유 |
|------|------|------|
| `PaginationOutput` | ✅ **채택 권장** | 리스트 API 응답의 표준 래퍼로 매우 유용 |
| `SortOutput` | ✅ **채택 권장** | 위와 함께 사용 |

---

### 2.4 `output/` — 도메인 응답 타입

- `category-node-output.ts`: 재귀 트리 구조 (children/parent)
- `localize-output.ts`: 다국어 응답 구조

**평가:** 도메인 특화 타입이므로 현행 프로젝트의 feature 요구사항에 따라 개별 판단. 구조적으로 채택할 패턴은 없음.

---

### 2.5 `enum/` — 비즈니스 열거형 (39개)

**두 가지 패턴이 혼재:**

```typescript
// 패턴 A: TypeScript enum (대다수)
export enum OrderItemStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  // ...
}

// 패턴 B: as const + 타입 추출 (일부)
export type SocialLoginProvider = (typeof SocialLoginProvider)[keyof typeof SocialLoginProvider];
export const SocialLoginProvider = {
  GOOGLE: 'GOOGLE',
  NAVER: 'NAVER',
} as const;
```

**평가:**

| 항목 | 판정 | 사유 |
|------|------|------|
| 비즈니스 enum 중앙 관리 | ✅ **패턴 채택** | enum을 한 곳에서 관리하는 것은 유용. 다만 위치는 `src/constants/enums/`가 적절 |
| `as const` 패턴 (B) | ✅ **이 패턴으로 통일 권장** | TypeScript enum은 tree-shaking 불가, 런타임 객체 생성 등 단점이 있음. `as const`가 현대적 |
| 한글 JSDoc 주석 | ✅ **채택** | 비즈니스 도메인 값에 한글 설명은 가독성에 큰 기여 |
| 39개 파일 전부 | ❌ 불채택 | 이전 프로젝트 도메인 특화. 필요할 때 개별 생성 |

---

## 3. 채택 제안 요약

### 즉시 적용 가능

| 패턴 | 원본 | 현행 프로젝트 적용 위치 | 전환 방식 |
|------|------|------------------------|-----------|
| 페이지네이션 입출력 타입 | `input/common/pageable.ts`, `output/common/pagination-output.ts` | `src/constants/api-types.ts` (zod 스키마) | zod 스키마로 전환 |
| 정렬 입출력 타입 | `input/common/sort.ts`, `output/common/sort-output.ts` | 위 파일에 함께 정의 | zod 스키마로 전환 |
| 비즈니스 enum `as const` 패턴 | `enum/social-login-provider.ts` 패턴 | `src/constants/enums/*.ts` | `as const` 통일 |
| 한글 JSDoc 주석 관행 | 전체 enum 파일 | 프로젝트 전체 | 관행으로 유지 |

### 현행 프로젝트로 전환 시 코드 예시

```typescript
// src/constants/api-types.ts
import { z } from "zod";

// 페이지네이션 요청
export const pageableSchema = z.object({
  page: z.number().int().nullable().optional(),
  size: z.number().int().nullable().optional(),
});
export type PageableInput = z.infer<typeof pageableSchema>;

// 정렬
export const sortDirectionSchema = z.enum(["asc", "desc"]);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export const sortInputSchema = z.object({
  sort: z.array(z.string()).nullable().optional(),
});
export type SortInput = z.infer<typeof sortInputSchema>;

// 페이지네이션 응답
export const paginationOutputSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  size: z.number().int(),
  last: z.number().int(),
});
export type PaginationOutput = z.infer<typeof paginationOutputSchema>;

// 정렬 응답
export const sortOutputSchema = z.object({
  field: z.string(),
  direction: z.string(),
});
export type SortOutput = z.infer<typeof sortOutputSchema>;

// 페이지네이션 포함 리스트 응답 제네릭
export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: paginationOutputSchema,
    sort: sortOutputSchema.optional(),
  });
```

```typescript
// src/constants/enums/example.ts
// as const 패턴으로 통일 (TypeScript enum 사용 금지)

/** 주문 상품 상태 */
export const OrderItemStatus = {
  /** 대기 */
  PENDING: "PENDING",
  /** 결제완료 */
  PAID: "PAID",
  /** 상품준비 */
  STANDBY: "STANDBY",
  /** 배송중 */
  SHIPPING: "SHIPPING",
  /** 완료 */
  COMPLETED: "COMPLETED",
} as const;
export type OrderItemStatus = (typeof OrderItemStatus)[keyof typeof OrderItemStatus];
```

---

## 4. 현행 프로젝트 룰과의 충돌 사항 및 수정 제안

분석 과정에서 현행 `.claude/rules/`와 충돌하거나 보완이 필요한 부분을 발견했다.

### 4.1 `architecture.mdc` — enum/상수 관리 디렉토리 누락

**문제:** 현행 Directory Structure에 `src/constants/enums/` 경로가 없음. 비즈니스 enum을 어디에 둘지 가이드가 없다.

**수정 제안:**
```diff
 ## Directory Structure

 - src/constants: Common constants
+- src/constants/enums: Business enum definitions (as const pattern)
```

### 4.2 `architecture.mdc` — enum 작성 패턴 가이드 누락

**문제:** TypeScript `enum` vs `as const` 중 어떤 패턴을 사용할지 명시되어 있지 않음. 레거시 코드에서도 두 패턴이 혼재했음.

**수정 제안:** Code Guidelines 또는 Architecture에 다음 규칙 추가:
```
- TypeScript `enum` 사용 금지. `as const` + 타입 추출 패턴을 사용한다.
- 비즈니스 도메인 값에는 한글 JSDoc 주석을 필수로 작성한다.
```

### 4.3 `new-feature-process.mdc` — 공통 API 타입 참조 누락

**문제:** 페이지네이션/정렬 같은 공통 API 타입을 어디서 import할지 가이드가 없음. feature별 `schema.ts`에 매번 중복 정의될 위험.

**수정 제안:** Building Blocks에 추가:
```
- src/constants/api-types.ts: 페이지네이션, 정렬 등 공통 API 요청/응답 zod 스키마
```

---

## 5. 최종 판정

| 계층 | 판정 | 핵심 사유 |
|------|------|-----------|
| `api/` URI+tag 패턴 | ✅ 패턴 채택 | endpoint와 cache tag를 한 쌍으로 관리하는 패턴은 Server Component 캐시 관리에 유용. 단 전역 합산 레지스트리(`API_URIS`)는 불채택 |
| `input/common/` | ✅ zod로 전환 채택 | 페이지네이션/정렬 표준 타입은 재사용 가치 높음 |
| `output/common/` | ✅ zod로 전환 채택 | 위와 동일 |
| `output/*.ts` | ❌ 폐기 | 이전 도메인 특화. 필요시 새로 작성 |
| `enum/` | ✅ 패턴만 채택 | `as const` 패턴 + 한글 JSDoc. 내용물은 도메인 특화이므로 폐기 |

> **요약:** 레거시 `service/`에서 가져갈 것은 **구조적 패턴 4가지**(URI+tag 한 쌍 관리, 페이지네이션 타입, 정렬 타입, `as const` enum 패턴)이며, 구현체 자체는 현행 프로젝트 스택(zod + Next.js 네이티브 fetch)으로 재작성하는 것이 적절하다. 전역 합산 레지스트리(`API_URIS`, `API_APIS`)는 채택하지 않는다.

---

## 6. 추가 논의: React Query vs Next.js 네이티브 fetch

### 배경

이 분석에서 `httpClient` + React Query를 전제로 판단했으나, 근본적인 질문이 제기됨:

> "Server Component가 기본인 상황에서 React Query를 쓰는 것 자체가 오버엔지니어링 아닌가?"

### Next.js 15 App Router가 이미 제공하는 것

```typescript
// Server Component — fetch + 캐시/재검증 내장
async function ProductList() {
  const products = await fetch("https://api.example.com/products", {
    next: { revalidate: 60 },         // 시간 기반 캐시
    // next: { tags: ["products"] },   // 태그 기반 무효화
  });
  const data = await products.json();
  return <div>{/* ... */}</div>;
}

// Server Action — 뮤테이션 + 캐시 무효화
"use server";
import { revalidateTag, revalidatePath } from "next/cache";

async function createProduct(formData: FormData) {
  await fetch("https://api.example.com/products", {
    method: "POST",
    body: JSON.stringify(Object.fromEntries(formData)),
  });
  revalidateTag("products");
}
```

### React Query가 정당화되는 경우 (제한적)

| 시나리오 | Next.js 네이티브 | React Query |
|---------|-----------------|-------------|
| 리스트/상세 조회 | ✅ Server Component fetch | 불필요 |
| 생성/수정/삭제 | ✅ Server Action + revalidate | 불필요 |
| 캐시 무효화 | ✅ revalidateTag/Path | 불필요 |
| 실시간 폴링 | ⚠️ 직접 구현 필요 | ✅ refetchInterval |
| 낙관적 업데이트 | ⚠️ useOptimistic | ✅ onMutate |
| 무한 스크롤 | ⚠️ 직접 구현 필요 | ✅ useInfiniteQuery |
| 오프라인 지원 | ❌ | ✅ |

### 현재 프로젝트 상태

- `providers.tsx`에 `QueryClientProvider` 설정은 있으나 **실제 사용처 0개**
- Server Component 기본 룰로 전환 완료
- features 폴더 비어있음 (구현 시작 전)

### 제안 방향

**React Query를 "필수"에서 "선택"으로 격하하고, 기본 데이터 fetching을 Next.js 네이티브로 전환하는 것을 검토.**

이 경우 변경이 필요한 부분:

1. **`architecture.mdc`** — Library 목록에서 `@tanstack/react-query` 설명을 "필요시 클라이언트 사이드 상태 관리"로 변경
2. **`new-feature-process.mdc`** — 기본 패턴을 Server Component fetch + Server Action으로 변경, React Query는 선택적 사용
3. **`features/[name]/api.ts`의 역할 재정의** — 현재는 클라이언트에서 호출하는 함수를 정의하지만, Server Component에서는 직접 fetch를 호출하므로 역할이 달라짐
4. **`features/[name]/queries/` 디렉토리** — 필수에서 선택으로

이 방향으로 갈 경우, `httpClient` 자체의 역할도 재검토가 필요하다. Server Component에서는 Next.js의 확장된 `fetch`를 직접 사용하는 것이 캐시/재검증 이점을 온전히 누릴 수 있기 때문.

> **이 섹션은 즉시 룰 변경이 아닌, 향후 논의를 위한 기록임.**

---

## 7. 타 AI 분석과의 비교 (SERVICE_STRUCTURE_REVIEW.md)

별도 AI가 동일한 `service/` 디렉토리를 분석한 결과와의 주요 견해 차이를 기록한다.

### 반박 사항

| 쟁점 | 타 AI 견해 | 본 분석 견해 | 판정 근거 |
|------|-----------|-------------|-----------|
| URI + tag 한 쌍 관리 | ✅ 채택 권장 | ✅ **수정 동의** (feature별 `api.ts` 내부에서 관리) | Server Component의 Next.js fetch tags 관리에 유용. 단 별도 `api.const.ts` 파일까지는 불필요, `api.ts` 내부에서 충분 |
| 전역 합산 레지스트리 | ✅ 채택 권장 | ❌ 여전히 불채택 | feature 간 결합도 증가. feature별 분리가 더 적절 |
| DTO 타입 분리 | ✅ zod + DTO 병행 허용 | ❌ zod 단일 소스 통일 | 두 패턴 혼재 시 일관성 붕괴. `z.infer<>`로 타입 추출이면 DTO 파일 불필요 |
| TypeScript `enum` | ⚠️ 논의 없음 (그대로 제시) | ❌ `as const` 통일 필수 | `enum`은 tree-shaking 불가, 런타임 양방향 매핑 객체 생성. 레거시에서도 두 패턴 혼재 |

### 수용 사항

| 쟁점 | 타 AI 견해 | 본 분석 견해 |
|------|-----------|-------------|
| 페이지네이션/정렬 타입 재사용 | ✅ 채택 | ✅ 동의 (zod 전환) |
| enum 중앙화 | ✅ `src/constants/enums/` | ✅ 동의 |
| 패턴만 이식, 구조 자체 병행 불가 | ✅ | ✅ 동의 |
| feature 중심 디렉토리 유지 | ✅ | ✅ 동의 |

> **요약:** 타 AI는 레거시 구조에 좀 더 우호적이고, 본 분석은 현행 스택의 강점을 살려 불필요한 레이어를 과감히 버리는 방향. 프로젝트가 초기 단계인 만큼, 간결한 구조에서 출발하여 복잡성이 필요해질 때 추가하는 것이 합리적이라 판단.

### 2차 반박 대응 (타 AI의 재반박에 대한 최종 입장)

타 AI가 두 가지 쟁점을 지속적으로 제기했으며, 최종 입장을 기록한다.

#### 쟁점 A: "Zod 단일 소스 강제는 과하다, DTO 분리 병행이 안전"

**타 AI:** 복잡한 API/다수 팀 협업 환경에서는 DTO 분리 병행이 더 안전할 수 있음.

**최종 입장: ❌ 기각.**

- 이 프로젝트는 **개인 프로젝트**. "다수 팀 협업 환경" 전제가 성립하지 않음.
- Zod `z.infer<>`로 타입을 추출하면 스키마-타입 싱크가 원천적으로 깨질 수 없음. DTO를 별도 관리하면 두 파일 싱크를 수동으로 맞춰야 하는 부담만 증가.
- Zod는 런타임 검증 + 타입 추론을 동시에 제공. 순수 DTO 타입은 컴파일 타임 체크만 가능하여 외부 API 데이터 불일치를 런타임에 감지 불가.

#### 쟁점 B: "TypeScript enum 전면 금지는 과하다, 외부 SDK 호환 시 예외 허용"

**타 AI:** 기본은 `as const` 권장, 외부 SDK/스펙 호환이 필요할 때 enum 예외 허용이 합리적.

**최종 입장: ⚠️ 이론상 맞지만 실익 없음. 룰 변경 불필요.**

- "외부 SDK가 enum을 export하면 그걸 쓴다" → 이는 **남의 enum을 import하는 것**이지 **우리가 enum을 정의하는 것**이 아님. 룰과 충돌하지 않음.
- `as const` 값은 string 리터럴이므로 외부 SDK에 넘겨도 호환됨.
- 예외 조항을 넣으면 "이건 외부 호환이니까 enum 써도 되지 않나?"라는 판단이 매번 필요해져 룰의 명확성이 떨어짐.

#### 최종 합의 요약

| 쟁점 | 타 AI | 본 분석 | 결론 |
|------|-------|--------|------|
| URI + tag 패턴 | ✅ 채택 | ✅ 수정 동의 | **합의** — feature별 `api.ts` 내부에서 관리 |
| 전역 합산 레지스트리 | ✅ 채택 | ❌ 불채택 | **불합의** — feature별 분리 유지 |
| Zod + DTO 병행 | ✅ 허용 | ❌ zod 단일 | **불합의** — 개인 프로젝트에서 DTO 병행은 관리 부담 |
| enum 예외 허용 | ✅ 허용 | ❌ 실익 없음 | **불합의** — 외부 SDK import와 자체 정의는 별개 |
| React Query 선택적 | ✅ 동의 | ✅ 동의 | **합의** |
| 페이지네이션/정렬 타입 | ✅ 채택 | ✅ zod 전환 | **합의** |
| enum 중앙화 | ✅ 채택 | ✅ 동의 | **합의** |
| `as const` 패턴 | 언급 없음 | ✅ 필수 | **본 분석 단독 제안** |
