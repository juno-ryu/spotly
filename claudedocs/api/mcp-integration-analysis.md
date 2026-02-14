# data-go-mcp-servers 레포 분석 및 MCP 연동 의견서

## 1. 레포 개요

`Koomook/data-go-mcp-servers`는 공공데이터포털(data.go.kr) API를 **MCP(Model Context Protocol) 서버**로 래핑한 Python 프로젝트입니다.

### 포함된 MCP 서버 (6개)

| 서버 | 설명 | 우리 서비스 관련도 |
|------|------|:---:|
| **NPS Business Enrollment** | 국민연금공단 사업장 정보 | ⭐⭐⭐ 핵심 |
| **NTS Business Verification** | 국세청 사업자등록 진위확인/상태조회 | ⭐⭐⭐ 핵심 (새 발견) |
| FSC Financial Info | 금융위원회 기업 재무정보 | ⭐ 법인만 해당 |
| PPS Narajangteo | 나라장터 입찰공고 | - |
| Presidential Speeches | 대통령기록관 연설문 | - |
| MSDS Chemical Info | 화학물질 안전보건자료 | - |

### 기술 스택
- Python 3.10+ / FastMCP (`mcp.server.fastmcp`)
- httpx (비동기 HTTP 클라이언트)
- Pydantic v2 (타입 검증)
- 배포: PyPI + uvx (Docker 없음)

---

## 2. 핵심 발견 3가지

### 발견 1: NPS MCP 서버 = 우리 서비스와 동일한 API

이 레포의 NPS 서버는 우리 서비스가 이미 사용 중인 **동일한 3개 엔드포인트**를 래핑합니다:

```
NPS MCP Tool              ↔  우리 서비스 API 호출
─────────────────────────────────────────────────────
search_business()         ↔  getBassInfoSearchV2
get_business_detail(seq)  ↔  getDetailInfoSearchV2
get_period_status(seq)    ↔  getPdAcctoSttusInfoSearchV2
```

**그리고 이미 추정 평균 월급을 계산하고 있습니다:**

```python
# server.py line 112-118 (NPS MCP 서버)
if subscribers > 0 and monthly_amount > 0:
    estimated_salary = monthly_amount / subscribers / 0.09
    item['estimated_avg_monthly_salary'] = round(estimated_salary)
```

→ 이것은 우리가 Phase 2 PRD의 "스코어링 모델 개선 Tier 1"에서 제안한 **정확히 같은 공식**입니다. 즉, 이 접근법이 이미 실무에서 검증된 패턴이라는 확인입니다.


### 발견 2: NTS API — 사업자 3단계 상태 (가장 중요한 발견)

현재 우리 서비스의 **가장 큰 한계점** 중 하나는 사업자 상태를 NPS의 2단계로만 구분한다는 것입니다:

```
현재 (NPS만 사용):
  wkplJnngStcd = 1 → 가입 (영업 중)
  wkplJnngStcd = 2 → 탈퇴 (폐업)

NTS API 추가 시:
  b_stt_cd = 01 → 계속사업자 (정상 영업)
  b_stt_cd = 02 → 휴업자 (일시 휴업)     ← 구분 불가능했던 상태
  b_stt_cd = 03 → 폐업자 (완전 폐업)
```

**핵심: NTS `check_business_status`는 한 번에 최대 100개 사업자를 배치 조회할 수 있습니다.**

```python
# NTS API 호출 방식
POST https://api.odcloud.kr/api/nts-businessman/v1/status
Body: { "b_no": ["1234567890", "0987654321", ...] }  # 최대 100개
```

이것은 단순히 "3단계 상태 구분"만의 문제가 아닙니다:
- **휴업 중인 가게를 폐업으로 잘못 카운트하면** 생존율이 과소평가됩니다
- **휴업율 자체가** 해당 상권의 건강도를 나타내는 새로운 지표가 됩니다
- NTS 응답에는 `end_dt`(폐업일), `tax_type`(과세유형)도 포함 — 추가 분석 가능


### 발견 3: API 호출 수 최적화 가능성

NPS 검색 결과에서 `bzowrRgstNo`(사업자등록번호)가 반환되므로, 이를 NTS 배치 조회에 활용하면:

```
현재 흐름 (41 NPS 호출):
  NPS 검색(1) → 20개 사업장
  NPS 상세 × 20 = 20
  NPS 기간별 × 20 = 20
  합계: 41 calls

개선 흐름 (22 호출):
  NPS 검색(1) → 20개 사업장
  NPS 상세 × 10 = 10    ← 샘플 10개로 축소
  NPS 기간별 × 10 = 10
  NTS 배치 상태(1) → 20개 전체 3단계 상태 한번에
  합계: 22 calls

전체 분석 1건당:
  현재: 49 calls  →  개선: 30 calls (≈39% 감소)
```

| API | 현재 | 개선 후 | 차이 |
|-----|:---:|:---:|:---:|
| Kakao 지도 | 1 | 1 | - |
| NPS 검색 | 1 | 1 | - |
| NPS 상세 | 20 | 10 | -10 |
| NPS 기간별 | 20 | 10 | -10 |
| **NTS 배치 상태** | **0** | **1** | **+1** |
| 부동산 시세 | 1 | 1 | - |
| KOSIS 인구 | 2 | 2 | - |
| 서울 골목 | 3 | 3 | - |
| Claude AI | 1 | 1 | - |
| **합계** | **49** | **30** | **-19** |

---

## 3. MCP 연동에 대한 솔직한 의견

### MCP란?

MCP(Model Context Protocol)는 **AI 모델이 외부 도구를 사용할 때**의 통신 프로토콜입니다:

```
[Claude Desktop] ←MCP→ [MCP Server] ←HTTP→ [외부 API]
[AI Agent]       ←MCP→ [MCP Server] ←HTTP→ [외부 API]
```

### 우리 서비스의 현재 아키텍처

```
[사용자 모바일] → [Next.js 서버] → [data.go.kr APIs]
                                 → [Score 계산 (결정적)]
                                 → [Claude Haiku] → [리포트]
```

### 솔직한 평가: MCP 프로토콜 자체의 연동은 비추천

MCP 프로토콜을 우리 서비스에 직접 연동하는 것은 **오버엔지니어링**입니다. 이유:

**1. 아키텍처 미스매치**
- MCP는 "AI 에이전트 ↔ 도구" 통신 프로토콜
- 우리 서비스는 "웹 서버 → API → 결정적 스코어링" 구조
- Next.js 서버가 MCP 클라이언트 역할을 하는 것은 프로토콜의 의도된 용도가 아님

**2. 불필요한 레이어 추가**
```
현재:  Next.js → data.go.kr API (1 hop)
MCP:   Next.js → MCP Client → MCP Server(Python) → data.go.kr API (3 hops)
```
- 레이턴시 증가, 장애 포인트 증가, 운영 복잡도 증가

**3. 스코어링은 결정적이어야 함**
- 5개 지표의 점수 계산은 **공식 기반 (deterministic)**
- AI가 "어떤 API를 호출할지" 결정하는 구조가 아님
- 같은 입력 → 항상 같은 점수가 나와야 사용자 신뢰 확보

**4. 언어/런타임 불일치**
- 서비스: TypeScript/Node.js
- MCP 서버: Python
- 별도 Python 프로세스 관리 필요 → DevOps 복잡도 ↑

### 그러나: 이 레포의 진짜 가치

이 레포는 MCP 프로토콜 연동용이 아니라, **3가지 실용적 가치**를 가집니다:

| 가치 | 설명 |
|------|------|
| 📖 레퍼런스 구현 | NPS/NTS API 호출 패턴, 파라미터 매핑, 응답 파싱의 검증된 코드 |
| 🔍 NTS API 발견 | 3단계 사업자 상태 + 배치 조회 — 서비스에 꼭 필요한 API |
| ✅ 공식 검증 | 추정 월급 계산 공식이 동일 → 우리 접근법의 실무 검증 |

---

## 4. 추천 통합 방안: 3단계

### Phase 2-A: NTS API 직접 통합 (우선 시행, 1주)

MCP 프로토콜을 거치지 않고, NTS API를 Next.js 서비스에 **직접 통합**합니다.

```typescript
// lib/api/nts-business.ts (새 파일)

interface BusinessStatusResult {
  b_no: string;           // 사업자등록번호
  b_stt: string;          // "계속사업자" | "휴업자" | "폐업자"
  b_stt_cd: string;       // "01" | "02" | "03"
  tax_type: string;       // 과세유형
  end_dt?: string;        // 폐업일 (YYYYMMDD)
}

export async function checkBusinessStatus(
  businessNumbers: string[]   // 최대 100개
): Promise<BusinessStatusResult[]> {
  const API_KEY = process.env.NTS_API_KEY;  // data.go.kr에서 별도 발급 필요

  const response = await fetch(
    `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ b_no: businessNumbers })
    }
  );

  const data = await response.json();
  return data.data;  // BusinessStatusResult[]
}
```

**스코어링 개선:**

```typescript
// 기존: NPS 2단계
const survivalRate = businesses.filter(b => b.wkplJnngStcd === '1').length / total;

// 개선: NTS 3단계
const statusCounts = {
  active: statuses.filter(s => s.b_stt_cd === '01').length,    // 계속사업자
  suspended: statuses.filter(s => s.b_stt_cd === '02').length,  // 휴업자
  closed: statuses.filter(s => s.b_stt_cd === '03').length      // 폐업자
};

const survivalRate = statusCounts.active / total;
const suspensionRate = statusCounts.suspended / total;  // 새 지표!

// 생존율 점수 (더 정밀)
const survivalScore = (
  (survivalRate * 0.7) +                    // 정상 영업 비율
  (suspensionRate * 0.15) +                 // 휴업은 절반 가중치
  ((1 - statusCounts.closed / total) * 0.15) // 폐업 아닌 비율
) * 20;  // 20점 만점
```

### Phase 2-B: NPS 샘플링 최적화 (2-A와 동시)

```
변경 전: NPS 상세/기간별 × 20개 = 40 calls
변경 후: NPS 상세/기간별 × 10개 = 20 calls

이유:
- 10개 샘플로도 통계적 유의성 확보 (95% 신뢰구간, 오차범위 ≈ ±20%)
- 상위 5개 + 무작위 5개 조합으로 대표성 유지
- 사용자는 10개와 20개의 차이를 체감하기 어려움
```

### Phase 3 (미래): MCP 기반 AI 에이전트 모드

서비스가 성장하면, **프리미엄 "AI 컨설턴트" 모드**에서 MCP를 활용할 수 있습니다:

```
일반 분석 (현재 방식):
  Next.js → APIs → 결정적 스코어링 → Claude 리포트

AI 컨설턴트 모드 (미래 프리미엄):
  사용자 질문 → Claude Agent
       ↓ MCP
  [NPS Tool] [NTS Tool] [FSC Tool] [KOSIS Tool]
       ↓
  Claude가 직접 데이터 탐색 + 분석 + 답변
```

이 모드에서는:
- 사용자가 "이 동네에서 카페 vs 음식점 뭐가 나을까?" 같은 자유 질문 가능
- Claude가 MCP 도구로 양쪽 데이터를 직접 가져와서 비교 분석
- 고정 공식이 아닌 AI 판단 기반 → 프리미엄 가치
- 이때 이 레포의 MCP 서버를 직접 활용하거나, TypeScript MCP 서버를 새로 구현

---

## 5. 추천 플로우 (Phase 2-A 기준)

```
사용자: "강남구 역삼동 카페 분석해줘"
              │
              ▼
┌─────────────────────────────────┐
│  Step 1: 기본 데이터 조회        │
│  Kakao 지도 검색 (1 call)       │
│  → 위경도, 행정동 코드 확보       │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Step 2: 병렬 API 호출 (Promise.all)     │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │NPS 검색   │  │KOSIS 인구│  │서울골목 │ │
│  │(1 call)   │  │(2 calls) │  │(3 calls)│ │
│  └─────┬─────┘  └──────────┘  └────────┘ │
│        │                                   │
│        ▼                                   │
│  NPS 검색 결과: 사업장 20개                 │
│  (사업자등록번호 포함)                      │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Step 3: 상세 데이터 (병렬)               │
│                                           │
│  ┌───────────────────┐  ┌──────────────┐ │
│  │NPS 상세 × 10      │  │NTS 배치 상태  │ │
│  │NPS 기간별 × 10    │  │(1 call, 20개) │ │
│  │(20 calls)         │  │              │  │
│  │                   │  │→ 3단계 상태    │ │
│  │→ 직원수, 월급 추정 │  │→ 폐업일       │ │
│  │→ 고용 트렌드       │  │→ 과세유형     │ │
│  └───────────────────┘  └──────────────┘ │
└──────────────┬───────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Step 4: 스코어링 (서버 사이드)           │
│                                          │
│  상권 활력도(30%) ← NPS + 서울골목        │
│  경쟁 강도(25%) ← NPS 밀도 + 업종        │
│  생존율(20%) ← NTS 3단계 + NPS 탈퇴일    │  ← 개선!
│  주거 밀도(15%) ← KOSIS 인구             │
│  소득 수준(10%) ← NPS 월급추정 + 부동산   │  ← 개선!
│                                          │
│  총점: XX/100                            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Step 5: AI 리포트 (Claude Haiku)        │
│                                          │
│  Input: 스코어 + 원시 데이터 + 프롬프트   │
│  Output: 구조화된 JSON 리포트             │
│                                          │
│  → verdict, summary, strengths, risks    │
│  → detailedAnalysis (4 paragraphs)       │
│  → confidenceLevel (1-5)                 │
└──────────────────────────────────────────┘

총 API 호출: 약 30회 (현재 49회에서 39% 감소)
예상 소요시간: 3-5초 (병렬 처리 기준)
```

---

## 6. NTS API 연동 시 필요한 것들

### data.go.kr API 키 발급

NTS 사업자등록상태조회 API는 NPS와 **별도 API 키**가 필요합니다:
- API: `국세청_사업자등록정보 진위확인 및 상태조회 서비스`
- URL: https://www.data.go.kr/data/15081808/openapi.do
- 인증키: 별도 신청 필요 (승인 소요 1-3일)

### 주의사항

1. **사업자등록번호 전체 10자리 필요**: NPS 검색 응답에서 `bzowrRgstNo`가 전체 10자리로 반환되는지 실제 테스트 필요 (일부 공공 API는 마스킹 처리)
2. **NTS API 엔드포인트 차이**: NPS는 `apis.data.go.kr` (XML/JSON), NTS는 `api.odcloud.kr` (JSON only)
3. **일일 호출 제한**: NTS API 호출 제한 확인 필요 (일반적으로 1,000회/일)

### 환경 변수 추가

```env
# .env.local
NPS_API_KEY=xxxxx      # 기존
NTS_API_KEY=xxxxx      # 신규 추가
KOSIS_API_KEY=xxxxx    # 기존
```

---

## 7. 결론

### 한 줄 요약

> **MCP 프로토콜 연동은 지금은 불필요하지만, 이 레포에서 NTS API를 발견한 것은 서비스 개선의 핵심 돌파구입니다.**

### 우선순위

| 순위 | 액션 | 효과 | 난이도 |
|:---:|------|------|:---:|
| 1 | NTS 배치 상태 조회 API 연동 | 3단계 생존율 + API 1회로 20개 상태 | 하 |
| 2 | NPS 샘플링 20→10 축소 | API 호출 20회 감소 | 하 |
| 3 | 추정 월급 계산 로직 추가 | 소득 수준 지표 정밀화 | 하 |
| 4 | (미래) AI 에이전트 모드 MCP 연동 | 프리미엄 자유질문 기능 | 상 |

### FSC(금융위원회) API 참고사항

FSC Financial Info 서버는 **법인등록번호(13자리)**가 필요하므로, 개인사업자 위주의 소상공인 분석에는 적용이 제한적입니다. 다만 법인 프랜차이즈(스타벅스, 이디야 등)의 재무건전성 비교 용도로 미래에 활용 가능합니다.
