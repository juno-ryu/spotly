# 외부 API 연동 패턴 가이드

## 아키텍처 개요

외부 API 연동은 **3-Layer 패턴**을 사용한다.

```
┌─────────────────────────────────────────────────────────┐
│  Orchestrator (features/{feature}/lib/)                  │
│  - 여러 어댑터를 조합하여 비즈니스 플로우 구성            │
│  - 외부 API 원시 형태를 모름, 정제된 타입만 사용           │
├─────────────────────────────────────────────────────────┤
│  Adapter (server/data-sources/{name}/adapter.ts)         │
│  - client를 호출하고, 원시 응답을 비즈니스 타입으로 변환   │
│  - 도메인에 의미 있는 인터페이스 export                    │
├─────────────────────────────────────────────────────────┤
│  HTTP Client (server/data-sources/{name}/client.ts)      │
│  - 순수 HTTP 호출 + 응답 파싱                             │
│  - API 인증, 페이지네이션, 에러 핸들링, 모킹              │
└─────────────────────────────────────────────────────────┘
```

**의존 방향**: Orchestrator → Adapter → Client (단방향, 역참조 금지)

---

## 디렉토리 구조

```
src/server/data-sources/
├── types.ts                    # 공통 응답 래퍼 타입 (DataGoKrResponse, KakaoResponse 등)
├── mock/                       # 개발용 모킹 JSON
│   ├── nps-search.json
│   └── ...
├── kakao/
│   ├── client.ts               # Kakao REST API 호출
│   └── adapter.ts              # KakaoPlace 변환, fetchKakaoPlaces()
├── nps/
│   ├── client.ts               # 국민연금 API 호출
│   └── adapter.ts              # NpsBizInfo 집계
└── {new-api}/                  # ← 새 API 추가 시 이 구조를 따름
    ├── client.ts
    └── adapter.ts
```

---

## Layer별 상세 규칙

### 1. HTTP Client (`client.ts`)

**역할**: 외부 API와의 HTTP 통신만 담당한다.

**규칙**:
- 외부 API의 원시 응답 타입을 그대로 다룸 (`r.x`, `r.y`, `place_name` 등)
- API 키 없으면 mock 데이터 반환 (Graceful Degradation)
- 페이지네이션, 재시도, 에러 핸들링을 이 레이어에서 처리
- `../types.ts`에서 공통 응답 래퍼 import
- 개발 환경 로깅 (`IS_DEV` 조건부)

**참고 구현**: `src/server/data-sources/kakao/client.ts`

```typescript
// client.ts 기본 구조
import type { KakaoResponse } from "../types";

const BASE_URL = "https://api.example.com";
const USE_MOCK = !process.env.EXAMPLE_API_KEY;
const IS_DEV = process.env.NODE_ENV === "development";

/** 공통 fetch 래퍼 */
async function apiFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  if (IS_DEV) console.log(`[API 요청] Example ${path}`);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.EXAMPLE_API_KEY}` },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.warn(`[Example API] ${res.status} — ${path}`, errorBody);
    throw new Error(`Example API 오류: ${res.status}`);
  }

  return res.json();
}

/** 개별 API 메서드 */
export async function fetchSomething(query: string): Promise<RawResponseType> {
  if (USE_MOCK) {
    const mock = await import("../mock/example.json");
    return mock.default as RawResponseType;
  }
  return apiFetch("/endpoint", { q: query });
}
```

**체크리스트**:
- [ ] `USE_MOCK` 분기 — API 키 없으면 mock 반환
- [ ] 공통 fetch 래퍼 함수 (인증 헤더, 에러 핸들링)
- [ ] 개발 환경 로깅 (`IS_DEV`)
- [ ] 원시 응답 타입 export (adapter에서 사용)

---

### 2. Adapter (`adapter.ts`)

**역할**: client의 원시 응답을 비즈니스에서 쓸 수 있는 정제된 타입으로 변환한다.

**규칙**:
- `./client`를 상대경로로 import
- 비즈니스 의미가 있는 인터페이스를 정의하고 export (`KakaoPlace`, `NpsBizInfo` 등)
- 필드명 변환 (`r.place_name` → `name`), 타입 캐스팅 (`parseFloat(r.y)` → `latitude: number`)
- 간단한 집계/변환 로직 포함 가능 (평균 계산, 비율 계산 등)
- 캐시가 필요하면 `@/server/cache/redis`의 `cachedFetch()` 사용

**참고 구현**: `src/server/data-sources/kakao/adapter.ts`

```typescript
// adapter.ts 기본 구조
import * as exampleClient from "./client";

/** 비즈니스 타입 — 외부 API 형태와 무관한 깨끗한 인터페이스 */
export interface ExampleItem {
  id: string;
  name: string;
  value: number;
}

/** 어댑터 함수 — client 호출 + 변환 */
export async function fetchExampleItems(query: string): Promise<ExampleItem[]> {
  const raw = await exampleClient.fetchSomething(query);

  return raw.items.map((r) => ({
    id: r.item_id,
    name: r.item_name,
    value: parseFloat(r.raw_value) || 0,
  }));
}
```

**체크리스트**:
- [ ] `./client` 상대경로 import
- [ ] 정제된 비즈니스 인터페이스 정의 + export
- [ ] 원시 필드명 → 비즈니스 필드명 매핑
- [ ] 타입 변환 (string → number 등)

---

### 3. Orchestrator (`features/{feature}/lib/`)

**역할**: 여러 어댑터를 조합하여 하나의 분석/비즈니스 플로우를 구성한다.

**규칙**:
- adapter의 정제된 타입만 사용 — 원시 API 응답 형태를 모름
- `@/server/data-sources/{name}/adapter` 절대경로로 import
- 여러 데이터 소스를 `Promise.allSettled` 등으로 병렬 호출 가능
- 결과를 조합하여 feature-specific한 `AnalysisResult` 등의 타입으로 반환

**참고 구현**: `src/features/analysis/lib/analysis-orchestrator.ts`

```typescript
// orchestrator 기본 구조
import { fetchExampleItems } from "@/server/data-sources/example/adapter";
import { fetchAnotherData } from "@/server/data-sources/another/adapter";

export interface FeatureResult {
  examples: ExampleItem[];
  another: AnotherData;
}

export async function runFeatureAnalysis(params: { ... }): Promise<FeatureResult> {
  const [examples, another] = await Promise.all([
    fetchExampleItems(params.query),
    fetchAnotherData(params.id),
  ]);

  return { examples, another };
}
```

---

## 새 외부 API 추가 절차

### Step 1: 환경 변수 등록
`src/lib/env.ts`의 `envSchema`에 API 키 추가 (optional).
`hasApiKey` 객체에 키 존재 여부 헬퍼 추가.

### Step 2: 공통 타입 확인
`src/server/data-sources/types.ts`에 응답 래퍼 타입이 필요하면 추가.
(예: `DataGoKrResponse<T>`는 data.go.kr 계열 API가 공유)

### Step 3: Mock 데이터 준비
`src/server/data-sources/mock/{name}.json`에 샘플 응답 저장.
API 키 없는 개발 환경에서 사용.

### Step 4: HTTP Client 작성
`src/server/data-sources/{name}/client.ts` 생성.
- 공통 fetch 래퍼 + 개별 메서드
- `USE_MOCK` 분기

### Step 5: Adapter 작성
`src/server/data-sources/{name}/adapter.ts` 생성.
- 비즈니스 인터페이스 정의
- client 호출 + 변환
- 필요 시 `cachedFetch()` 래핑

### Step 6: Orchestrator 연결
`features/{feature}/lib/` 내 orchestrator에서 adapter import.

### Step 7: 캐시 TTL 등록 (선택)
`src/server/cache/redis.ts`의 `CACHE_TTL`에 TTL 상수 추가.

---

## Graceful Degradation 원칙

- 모든 외부 API 키는 **optional** (env.ts에서 `.optional()`)
- `hasApiKey.{name}`으로 키 존재 여부 확인
- 키 없으면 → mock 반환 또는 기능 비활성
- API 호출 실패 → `try/catch`로 격리, 다른 데이터 소스에 영향 없음
- Redis 캐시 실패 → fetcher 직행 (서비스 중단 방지)

---

## 현재 등록된 데이터 소스

| 디렉토리 | API | 상태 | 환경 변수 |
|----------|-----|------|-----------|
| `kakao/` | Kakao REST API (지오코딩, 장소검색) | **활성** | `KAKAO_REST_API_KEY` |
| `nps/` | 국민연금 사업장 API | 미사용 (향후) | `DATA_GO_KR_API_KEY` |
| `franchise/` | 공정위 프랜차이즈 API | 미사용 (향후) | `DATA_GO_KR_API_KEY` |
| `real-estate/` | 부동산 실거래가 API | 미사용 (향후) | `DATA_GO_KR_API_KEY` |
| `kosis/` | 통계청 KOSIS API | 미사용 (향후) | `KOSIS_API_KEY` |
| `seoul-golmok/` | 서울시 골목상권 API | 미사용 (향후) | `SEOUL_OPEN_API_KEY` |
