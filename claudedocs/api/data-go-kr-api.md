# 공공데이터포털(data.go.kr) API 연동 가이드

> **소상공인 창업 분석기** 프로젝트용 — NPS(국민연금), 부동산 실거래가 API 정리
> 작성일: 2026-02-08

---

## 1. 개요

공공데이터포털(data.go.kr)은 정부 공공데이터를 Open API로 제공합니다.
이 프로젝트에서는 **NPS(국민연금 사업장)** 와 **부동산 실거래가** 2개 API를 활용하여 상권 분석 데이터를 수집합니다.

### 우리 서비스에서 활용할 API 매핑

| 분석 지표 | 필요 데이터 | 사용할 API |
|:----------|:-----------|:-----------|
| 상권 활력도 (30점) | 신규 창업 비율, 직원 규모, 활성 비율 | NPS 사업장 검색/상세/추이 |
| 경쟁 강도 (25점) | 동일 업종 밀집도 | NPS 사업장 검색 |
| 생존율 (20점) | 활성 / (활성 + 폐업) | NPS 사업장 검색 (가입상태) |
| 주거 밀도 (15점) | 아파트 거래 건수 | 부동산 실거래 |
| 소득 수준 (10점) | 평균 아파트 거래가 | 부동산 실거래 |

---

## 2. 인증 및 공통 사항

### 2.1 인증키 발급

1. [공공데이터포털](https://www.data.go.kr) 회원가입
2. 원하는 API 활용 신청 (자동 승인 또는 관리자 승인)
3. 마이페이지에서 **인코딩 키(Encoding)** 확인 → 환경변수 `DATA_GO_KR_API_KEY`에 설정

### 2.2 공통 응답 형식 (JSON)

```json
{
  "response": {
    "header": {
      "resultCode": "00",
      "resultMsg": "NORMAL SERVICE."
    },
    "body": {
      "items": {
        "item": [ ... ]
      },
      "numOfRows": 100,
      "pageNo": 1,
      "totalCount": 250
    }
  }
}
```

### 2.3 공통 주의사항

- **User-Agent 필수**: `User-Agent` 헤더 없으면 HTTP 502 반환
- **단건 응답**: `totalCount === 1`일 때 `items.item`이 배열이 아닌 **단일 객체**로 올 수 있음 → 배열 보정 필요
- **인코딩 키**: URL에 포함 시 `+`, `=`, `/` 등 특수문자가 포함됨 → `serviceKey`는 **이중 인코딩 하지 않도록** 주의
- **일시적 502/503**: data.go.kr 서버 간헐적 오류 → 자동 재시도 또는 mock 모드로 전환

### 2.4 TypeScript 공통 타입

```typescript
// src/server/data-sources/types.ts
interface DataGoKrResponse<T> {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      items: { item: T[] };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}
```

### 2.5 환경변수

| 변수명 | 용도 | 없으면 |
|:-------|:-----|:-------|
| `DATA_GO_KR_API_KEY` | NPS + 부동산 통합 인증키 | mock JSON으로 자동 전환 |

---

## 3. NPS 국민연금 사업장 API

> 국민연금 가입 사업장 정보를 통해 상권 내 사업체 현황(직원 수, 가입/탈퇴 상태, 업종, 월별 추이)을 파악합니다.

### 3.1 사업장 검색 (getBassInfoSearchV2)

| 항목 | 내용 |
|:-----|:-----|
| **Base URL** | `https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2` |
| **엔드포인트** | `/getBassInfoSearchV2` |
| **메서드** | GET |
| **응답 형식** | JSON |

**요청 파라미터**

| 파라미터 | 필수 | 설명 | 예시 |
|:---------|:----:|:-----|:-----|
| `serviceKey` | O | 인증키 | (인코딩된 키) |
| `ldongAddrMgplDgCd` | O | 시도 코드 (2자리) | `11` (서울) |
| `ldongAddrMgplSgguCd` | O | 시군구 코드 (3자리) | `680` (강남구) |
| `wkplNm` | | 사업장명 (키워드 검색) | `치킨` |
| `pageNo` | | 페이지 번호 (기본 1) | `1` |
| `numOfRows` | | 페이지당 건수 (기본 10) | `100` |
| `dataType` | | 응답 형식 | `json` |

> **지역코드 분리**: 우리 시스템의 5자리 시군구코드 `11680`을 시도(`11`) + 시군구(`680`)로 분리하여 전달

**curl 테스트**

```bash
curl -s -H "User-Agent: Mozilla/5.0" \
  "https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2/getBassInfoSearchV2?serviceKey=${DATA_GO_KR_API_KEY}&ldongAddrMgplDgCd=11&ldongAddrMgplSgguCd=680&pageNo=1&numOfRows=3&dataType=json"
```

**주요 응답 필드**

| 필드명 | 설명 | 활용 |
|:-------|:-----|:-----|
| `seq` | 일련번호 (상세/추이 조회 키) | 상세 조회 |
| `wkplNm` | 사업장명 | 표시 |
| `bzowrRgstNo` | 사업자등록번호 (마스킹) | 참고 |
| `wkplRoadNmDtlAddr` | 도로명 주소 | 표시 |
| `ldongAddrMgplDgCd` | 시도 코드 | 필터링 |
| `ldongAddrMgplSgguCd` | 시군구 코드 | 필터링 |
| `ldongAddrMgplSgguEmdCd` | 읍면동 코드 | 필터링 |
| `wkplJnngStcd` | 가입상태 (`1`=가입, `2`=탈퇴) | 생존율 |
| `wkplStylDvcd` | 사업장형태 (`1`=법인, `2`=개인) | 분류 |
| `dataCrtYm` | 데이터 생성 년월 | 참고 |

**성공 판단**: `resultCode === "00"`, `totalCount > 0`

---

### 3.2 사업장 상세 (getDetailInfoSearchV2)

| 항목 | 내용 |
|:-----|:-----|
| **엔드포인트** | `/getDetailInfoSearchV2` |

**요청 파라미터**

| 파라미터 | 필수 | 설명 |
|:---------|:----:|:-----|
| `serviceKey` | O | 인증키 |
| `seq` | O | 사업장 일련번호 (검색 결과에서 획득) |
| `dataType` | | `json` |

**주요 응답 필드** (검색 필드 + 추가 필드)

| 필드명 | 설명 | 활용 |
|:-------|:-----|:-----|
| `jnngpCnt` | 가입자 수 (**직원 수**) | 상권 활력도 |
| `crrmmNtcAmt` | 당월 고지금액 (원) | 소득 수준 추정 |
| `vldtVlKrnNm` | 업종명 (한글) | 업종 매칭 |
| `wkplIntpCd` | 업종코드 | 업종 분류 |
| `adptDt` | 적용일 (가입일) | 신규 창업 판별 |
| `scsnDt` | 탈퇴일 | 폐업 판별 |

---

### 3.3 월별 가입자 변동 추이 (getPdAcctoSttusInfoSearchV2)

| 항목 | 내용 |
|:-----|:-----|
| **엔드포인트** | `/getPdAcctoSttusInfoSearchV2` |

**요청 파라미터**

| 파라미터 | 필수 | 설명 | 예시 |
|:---------|:----:|:-----|:-----|
| `serviceKey` | O | 인증키 | |
| `seq` | O | 사업장 일련번호 | |
| `stYm` | O | 시작 년월 (`YYYYMM`) | `202401` |
| `endYm` | O | 종료 년월 (`YYYYMM`) | `202501` |
| `dataType` | | `json` | |

**주요 응답 필드**

| 필드명 | 설명 | 활용 |
|:-------|:-----|:-----|
| `nwAcqzrCnt` | 신규 가입자 수 | 고용 추세 |
| `lssJnngpCnt` | 퇴사자 수 | 이직 추세 |

---

## 4. 부동산 실거래가 API

> 아파트 매매 실거래 정보를 통해 주거 밀도와 소득 수준을 추정합니다.

### 4.1 아파트 매매 실거래 상세 (getRTMSDataSvcAptTradeDev)

| 항목 | 내용 |
|:-----|:-----|
| **Base URL** | `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev` |
| **엔드포인트** | `/getRTMSDataSvcAptTradeDev` |
| **메서드** | GET |
| **응답 형식** | **XML** (JSON 미지원!) |

**요청 파라미터**

| 파라미터 | 필수 | 설명 | 예시 |
|:---------|:----:|:-----|:-----|
| `serviceKey` | O | 인증키 | |
| `LAWD_CD` | O | 법정동 코드 5자리 | `11680` (강남구) |
| `DEAL_YMD` | O | 거래 년월 (`YYYYMM`) | `202410` |
| `pageNo` | | 페이지 번호 | `1` |
| `numOfRows` | | 페이지당 건수 | `1000` |

**curl 테스트**

```bash
curl -s -H "User-Agent: Mozilla/5.0" \
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${DATA_GO_KR_API_KEY}&LAWD_CD=11680&DEAL_YMD=202410&pageNo=1&numOfRows=3"
```

**XML 응답 예시**

```xml
<response>
  <header>
    <resultCode>000</resultCode>
    <resultMsg>정상</resultMsg>
  </header>
  <body>
    <items>
      <item>
        <dealAmount>180,000</dealAmount>
        <buildYear>2004</buildYear>
        <dealYear>2024</dealYear>
        <dealMonth>10</dealMonth>
        <dealDay>12</dealDay>
        <aptNm>래미안 역삼</aptNm>
        <excluUseAr>84.97</excluUseAr>
        <floor>15</floor>
        <umdNm>역삼동</umdNm>
      </item>
    </items>
    <numOfRows>3</numOfRows>
    <pageNo>1</pageNo>
    <totalCount>120</totalCount>
  </body>
</response>
```

**주요 응답 필드**

| XML 태그 | 설명 | 활용 |
|:---------|:-----|:-----|
| `dealAmount` | 거래금액 (만원, 쉼표 포함) | 소득 수준 |
| `buildYear` | 건축년도 | 참고 |
| `dealYear` / `dealMonth` / `dealDay` | 거래 일자 | 기간 필터 |
| `aptNm` | 아파트명 | 표시 |
| `excluUseAr` | 전용면적 (m²) | 참고 |
| `floor` | 층 | 참고 |
| `umdNm` | 법정동명 | 필터링 |

**성공 판단**: `<resultCode>000</resultCode>` 또는 `<resultCode>00</resultCode>`, `<item>` 존재

### 4.2 XML 파싱 주의사항

이 API는 **JSON 응답을 지원하지 않습니다**. 프로젝트에서 정규식 기반 XML 파서를 자체 구현하여 사용합니다.

```typescript
// src/server/data-sources/real-estate-client.ts

// 1. <item>...</item> 블록 추출
const itemRegex = /<item>([\s\S]*?)<\/item>/g;

// 2. 각 아이템 내부 필드 추출
const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;

// 3. dealAmount의 쉼표 제거 후 숫자 변환
parseInt(dealAmount.replace(/,/g, ""), 10);
```

**에러 응답 체크**:
- `resultCode`가 `"000"` 또는 `"00"`이 아니면 에러
- `resultMsg`에 에러 사유 포함

---

## 5. 데이터 파이프라인

```
사용자 입력 (주소 + 업종 + 반경)
    │
    ▼
[1] Kakao 지오코딩 → 좌표 + 법정동코드 (5자리)
    │
    ▼  (시군구코드: 11680)
    │
    ├──▶ [2] NPS 사업장 검색 (시도11 + 시군구680) ── 병렬 호출
    │         └── 상위 20개 → [3] 각각 상세 + 추이 조회 (직렬)
    │
    ├──▶ [4] 부동산 실거래 (LAWD_CD=11680, 최근 6개월) ── 병렬 호출
    │
    ├──▶ [5] KOSIS 인구 (시군구코드=11680) ── 병렬 호출
    │
    └──▶ [6] 서울시 골목상권 (서울 한정) ── 병렬 호출
         │
         ▼
    [7] Promise.allSettled → extractFulfilled
         │
         ▼
    [8] 스코어링 엔진 (5대 지표 가중 합산)
         │
         ▼
    [9] Claude AI 리포트 생성
```

---

## 6. Graceful Degradation (Mock 모드)

| 조건 | 동작 |
|:-----|:-----|
| `DATA_GO_KR_API_KEY` 없음 | NPS + 부동산 모두 mock JSON 사용 |
| NPS 502/503 일시적 오류 | `fetchWithRetry`로 최대 3회 재시도 (500ms 점진적 대기), 3회 실패 시 throw → `Promise.allSettled`로 격리 |
| 부동산 502/503 일시적 오류 | `Promise.allSettled`로 격리, 다른 API 결과는 정상 활용 |
| NPS `totalCount === 0` | 해당 지역에 사업장 없음으로 처리 |
| 부동산 거래 건수 0 | 해당 월 거래 없음으로 처리 |

### Mock 파일 위치

| API | Mock 파일 |
|:----|:----------|
| NPS 검색 | `src/server/data-sources/mock/nps-search.json` |
| NPS 상세 | `src/server/data-sources/mock/nps-detail.json` |
| NPS 추이 | `src/server/data-sources/mock/nps-trend.json` |
| 부동산 | `src/server/data-sources/mock/real-estate.json` |

---

## 7. 구현 파일

| 파일 | 용도 |
|:-----|:-----|
| `src/server/data-sources/nps-client.ts` | NPS API 클라이언트 (검색/상세/추이) |
| `src/server/data-sources/real-estate-client.ts` | 부동산 API 클라이언트 (XML 파싱 포함) |
| `src/server/data-sources/types.ts` | `DataGoKrResponse<T>` 공통 타입 |
| `src/lib/env.ts` | `DATA_GO_KR_API_KEY` 환경변수 + `hasApiKey.dataGoKr` 헬퍼 |
| `src/features/analysis/lib/data-aggregator.ts` | 전체 API 병렬 호출 + 데이터 집계 |

---

## 8. 캐싱 전략

| 데이터 | Redis TTL | 비고 |
|:-------|:----------|:-----|
| NPS 사업장 검색 | 24시간 | 일 단위 변동 가능 |
| NPS 사업장 상세 | 24시간 | |
| NPS 월별 추이 | 24시간 | |
| 부동산 실거래 | 7일 | 월 단위 갱신 |

캐시 키 패턴: `nps:search:{regionCode}:{keyword}`, `re:apt:{lawdCd}:{dealYmd}`

---

## 9. 세션 시작 시 API 상태 확인

`.claude/rules/api-health-check.mdc`에 정의된 curl 명령으로 API 상태를 확인합니다.

### NPS

```bash
curl -s -H "User-Agent: Mozilla/5.0" \
  "https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2/getBassInfoSearchV2?serviceKey=${DATA_GO_KR_API_KEY}&ldongAddrMgplDgCd=11&ldongAddrMgplSgguCd=680&pageNo=1&numOfRows=3&dataType=json"
```
- 성공: `resultCode: "00"`, `totalCount > 0`
- 실패 시: 502 → data.go.kr 일시적 서버 오류 (mock 모드로 자동 전환, 코드 수정 불필요)

### 부동산 실거래

```bash
curl -s -H "User-Agent: Mozilla/5.0" \
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${DATA_GO_KR_API_KEY}&LAWD_CD=11680&DEAL_YMD=202410&pageNo=1&numOfRows=3"
```
- 성공: XML 응답, `<resultCode>000</resultCode>`, `<item>` 존재

---

## 10. 참고 링크

| 리소스 | URL |
|:-------|:----|
| 공공데이터포털 | https://www.data.go.kr |
| NPS API 상세 | https://www.data.go.kr/data/3046071/openapi.do |
| 부동산 실거래 API 상세 | https://www.data.go.kr/data/3050988/openapi.do |
| data.go.kr API 활용 가이드 | https://www.data.go.kr/ugs/selectPublicDataUseGuideView.do |
