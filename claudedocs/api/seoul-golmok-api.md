# 서울시 골목상권 Open API 연동 가이드

> **소상공인 창업 분석기** 프로젝트용 — data.seoul.go.kr 상권분석서비스 API 정리
> 작성일: 2026-02-08

---

## 1. 개요

서울시 골목상권 분석 데이터는 **서울 열린데이터광장**(data.seoul.go.kr)에서 Open API로 제공됩니다. PRD에서 정의한 F1(상권 건강도), F2(경쟁 강도), F3(입지 적합성) 기능에 필요한 데이터를 아래 API들에서 가져올 수 있습니다.

### 우리 서비스에서 활용할 API 매핑

| PRD 기능        | 필요 데이터                                      | 사용할 API                                                                                               |
| :-------------- | :----------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| F1. 상권 건강도 | 개폐업률, 상권변화지표                           | 점포(OA-15577) + 상권변화지표(OA-15576)                                                                  |
| F2. 경쟁 강도   | 점포수, 업종별 밀도, 프랜차이즈 비율             | 점포(OA-15577) + 영역(OA-15560)                                                                          |
| F3. 입지 적합성 | 추정매출, 유동인구, 직장인구, 상주인구, 소득소비 | 추정매출(OA-15572) + 길단위인구(OA-15568) + 직장인구(OA-15569) + 상주인구(OA-15581) + 소득소비(OA-22166) |
| F4. AI 리포트   | 위 데이터 종합                                   | 모든 API 조합                                                                                            |

---

## 2. 인증 및 공통 호출 방식

### 2.1 인증키 발급

1. [서울 열린데이터광장](https://data.seoul.go.kr) 회원가입
2. 로그인 후 상단 메뉴 **"Open API"** → **"인증키 신청"**
3. 인증키 즉시 발급 (무료)

### 2.2 API 호출 URL 패턴

```
http://openapi.seoul.go.kr:8088/{인증키}/{응답형식}/{서비스명}/{시작INDEX}/{끝INDEX}/{조건}
```

| 구성요소    | 설명                            | 예시                     |
| :---------- | :------------------------------ | :----------------------- |
| `인증키`    | 발급받은 API Key                | `4a6f7e8d9b...`          |
| `응답형식`  | `json`, `xml`, `xmlf`, `xls`    | `json`                   |
| `서비스명`  | API별 고유 서비스명 (아래 참조) | `VwsmTrdarSelngQq`       |
| `시작INDEX` | 요청 시작 위치 (1부터)          | `1`                      |
| `끝INDEX`   | 요청 끝 위치 (최대 1000건씩)    | `1000`                   |
| `조건`      | 선택적 필터 파라미터            | `20243` (기준년분기코드) |

### 2.3 제약사항

- **1회 최대 1,000건** 조회 가능 → 1,000건 초과 시 페이징 필요
- **일 트래픽 제한** 있음 (기본 1,000회/일)
- 응답 형식: `json` 권장 (파싱 용이)

### 2.4 호출 예시 (Python)

```python
import requests

API_KEY = "YOUR_API_KEY"
BASE_URL = "http://openapi.seoul.go.kr:8088"

def call_seoul_api(service_name, start=1, end=1000, extra_params=""):
    url = f"{BASE_URL}/{API_KEY}/json/{service_name}/{start}/{end}/{extra_params}"
    response = requests.get(url)
    data = response.json()
    return data.get(service_name, {})

# 추정매출 조회 예시
result = call_seoul_api("VwsmTrdarSelngQq", 1, 5)
print(result)
```

### 2.5 페이징 처리 (1,000건 초과)

```python
def fetch_all(service_name, extra=""):
    all_rows = []
    start = 1
    while True:
        end = start + 999
        data = call_seoul_api(service_name, start, end, extra)
        rows = data.get("row", [])
        if not rows:
            break
        all_rows.extend(rows)
        total = data.get("list_total_count", 0)
        if end >= total:
            break
        start = end + 1
    return all_rows
```

---

## 3. API 상세 목록

---

### 3.1 상권 영역 정보

> 상권의 위치, 좌표, 구분(골목/발달/전통시장/관광특구)을 조회합니다. **상권코드(TRDAR_CD)** 를 얻는 기본 API입니다.

| 항목            | 내용             |
| :-------------- | :--------------- |
| **데이터셋 ID** | OA-15560         |
| **서비스명**    | `TbgisTrdarRelm` |
| **갱신주기**    | 반기             |

**호출 URL**

```
http://openapi.seoul.go.kr:8088/{KEY}/json/TbgisTrdarRelm/1/1000/
```

**주요 응답 필드**

| 필드명           | 설명                                                                        |
| :--------------- | :-------------------------------------------------------------------------- |
| `STDR_YYQU_CD`   | 기준 년분기 코드 (합산형, 예: `20244` = 2024년 4분기)                       |
| `TRDAR_SE_CD`    | 상권 구분 코드 (`A`: 골목상권, `D`: 발달상권, `R`: 전통시장, `G`: 관광특구) |
| `TRDAR_SE_CD_NM` | 상권 구분 명칭                                                              |
| `TRDAR_CD`       | 상권 코드 ⭐ (다른 API 호출 시 키값)                                        |
| `TRDAR_CD_NM`    | 상권 명칭                                                                   |
| `XCNTS_VALUE`    | X좌표 (EPSG:5181)                                                           |
| `YDNTS_VALUE`    | Y좌표 (EPSG:5181)                                                           |
| `SIGNGU_CD`      | 자치구 코드                                                                 |
| `SIGNGU_CD_NM`   | 자치구 명칭                                                                 |
| `ADSTRD_CD`      | 행정동 코드                                                                 |
| `ADSTRD_CD_NM`   | 행정동 명칭                                                                 |

---

### 3.2 추정매출 (상권 단위) ⭐ 핵심 API

> 상권 영역 내 점포들의 추정매출 정보. 요일별, 시간대별, 성별, 연령대별 매출금액/건수를 분기 단위로 제공합니다.

| 항목            | 내용                             |
| :-------------- | :------------------------------- |
| **데이터셋 ID** | OA-15572                         |
| **서비스명**    | `VwsmTrdarSelngQq`               |
| **갱신주기**    | 분기 (매월 3개월 전 데이터 적재) |

**호출 URL**

```
http://openapi.seoul.go.kr:8088/{KEY}/json/VwsmTrdarSelngQq/1/1000/
```

**주요 응답 필드**

| 필드명                                            | 설명                       | 비고       |
| :------------------------------------------------ | :------------------------- | :--------- |
| `STDR_YYQU_CD`                                    | 기준 년분기 코드 (합산형)  |            |
| `TRDAR_SE_CD` / `_NM`                             | 상권 구분 코드/명          |            |
| `TRDAR_CD` / `_NM`                                | 상권 코드/명               |            |
| `SVC_INDUTY_CD` / `_NM`                           | 서비스 업종 코드/명        | 100개 업종 |
| `THSMON_SELNG_AMT`                                | 당월 매출 금액             | 원(₩)      |
| `THSMON_SELNG_CO`                                 | 당월 매출 건수             |            |
| `MON_SELNG_AMT` ~ `SUN_SELNG_AMT`                 | 월~일요일 매출 금액        |            |
| `MON_SELNG_CO` ~ `SUN_SELNG_CO`                   | 월~일요일 매출 건수        |            |
| `MDWK_SELNG_AMT` / `WKEND_SELNG_AMT`              | 주중/주말 매출 금액        |            |
| `TMZON_00_06_SELNG_AMT`                           | 00~06시 매출 금액          |            |
| `TMZON_06_11_SELNG_AMT`                           | 06~11시 매출 금액          |            |
| `TMZON_11_14_SELNG_AMT`                           | 11~14시 매출 금액          |            |
| `TMZON_14_17_SELNG_AMT`                           | 14~17시 매출 금액          |            |
| `TMZON_17_21_SELNG_AMT`                           | 17~21시 매출 금액          |            |
| `TMZON_21_24_SELNG_AMT`                           | 21~24시 매출 금액          |            |
| `ML_SELNG_AMT` / `FML_SELNG_AMT`                  | 남/여 매출 금액            |            |
| `AGRDE_10_SELNG_AMT` ~ `AGRDE_60_ABOVE_SELNG_AMT` | 연령대별(10~60+) 매출 금액 |            |

---

### 3.3 점포 정보 (상권 단위) ⭐ 핵심 API

> 상권 영역 내 점포 수, 개폐업률, 프랜차이즈 점포 수 등을 분기 단위로 제공합니다.

| 항목            | 내용              |
| :-------------- | :---------------- |
| **데이터셋 ID** | OA-15577          |
| **서비스명**    | `VwsmTrdarStorQq` |
| **갱신주기**    | 분기              |

**호출 URL**

```
http://openapi.seoul.go.kr:8088/{KEY}/json/VwsmTrdarStorQq/1/1000/
```

**주요 응답 필드**

| 필드명                  | 설명                | 활용            |
| :---------------------- | :------------------ | :-------------- |
| `TRDAR_CD` / `_NM`      | 상권 코드/명        |                 |
| `SVC_INDUTY_CD` / `_NM` | 서비스 업종 코드/명 |                 |
| `STOR_CO`               | 점포 수             | F2. 경쟁 강도   |
| `SIMILR_INDUTY_STOR_CO` | 유사 업종 점포 수   | F2. 경쟁 강도   |
| `OPBIZ_RT`              | 개업률 (%)          | F1. 상권 건강도 |
| `OPBIZ_STOR_CO`         | 개업 점포 수        | F1. 상권 건강도 |
| `CLSBIZ_RT`             | 폐업률 (%)          | F1. 상권 건강도 |
| `CLSBIZ_STOR_CO`        | 폐업 점포 수        | F1. 상권 건강도 |
| `FRC_STOR_CO`           | 프랜차이즈 점포 수  | F2. 경쟁 강도   |

---

### 3.4 상권변화지표

> 상권의 성장/쇠퇴 여부를 4단계 등급으로 분류한 지표입니다.

| 항목            | 내용               |
| :-------------- | :----------------- |
| **데이터셋 ID** | OA-15576           |
| **서비스명**    | `VwsmTrdarIxQq` |
| **갱신주기**    | 분기               |

**호출 URL**

```
http://openapi.seoul.go.kr:8088/{KEY}/json/VwsmTrdarIxQq/1/1000/
```

**주요 응답 필드**

| 필드명             | 설명                          |
| :----------------- | :---------------------------- |
| `TRDAR_CD` / `_NM` | 상권 코드/명                  |
| `TRDAR_CHNGE_IX`     | 상권변화지표 등급             |
| `TRDAR_CHNGE_IX_NM`  | 상권변화지표 명칭             |
| `OPR_SALE_MT_AVRG`   | 생존 사업체 평균 영업기간(월) |
| `CLS_SALE_MT_AVRG`   | 폐업 사업체 평균 영업기간(월) |

**등급 해석**

| 등급 | 의미                | 창업 시사점                          |
| :--- | :------------------ | :----------------------------------- |
| `LL` | 생존·폐업 모두 낮음 | 신규/재생 상권, 진출 시 주의         |
| `LH` | 생존 낮음·폐업 높음 | 신규 업체에 유리한 상권              |
| `HL` | 생존 높음·폐업 낮음 | 기존 업체가 강한 상권, 진입장벽 높음 |
| `HH` | 생존·폐업 모두 높음 | 안정적이나 경쟁 치열                 |

---

### 3.5 길단위 유동인구 (상권 단위)

> 상권 영역 내 생활인구(유동인구) 정보. 시간대별, 성별, 연령대별로 제공합니다.

| 항목            | 내용               |
| :-------------- | :----------------- |
| **데이터셋 ID** | OA-15568           |
| **서비스명**    | `VwsmTrdarFlpopQq` |
| **갱신주기**    | 분기               |

**호출 URL**

```
http://openapi.seoul.go.kr:8088/{KEY}/json/VwsmTrdarFlpopQq/1/1000/
```

**주요 응답 필드**

| 필드명                                          | 설명                     |
| :---------------------------------------------- | :----------------------- |
| `TRDAR_CD` / `_NM`                              | 상권 코드/명             |
| `TOT_FLPOP_CO`                                  | 총 유동인구 수           |
| `ML_FLPOP_CO` / `FML_FLPOP_CO`                  | 남/여 유동인구           |
| `AGRDE_10_FLPOP_CO` ~ `AGRDE_60_ABOVE_FLPOP_CO` | 연령대별 유동인구        |
| `TMZON_00_06_FLPOP_CO` ~ `TMZON_21_24_FLPOP_CO` | 시간대별(6구간) 유동인구 |
| `MON_FLPOP_CO` ~ `SUN_FLPOP_CO`                 | 요일별 유동인구          |

---

### 3.6 직장인구 (상권 단위)

> 상권 영역 내 직장 소재 인구 수를 제공합니다.

| 항목            | 내용                                             |
| :-------------- | :----------------------------------------------- |
| **데이터셋 ID** | OA-15569                                         |
| **서비스명**    | `VwsmTrdarWrcPopltnQq`                           |
| **갱신주기**    | 연 1회 (4분기 업데이트 → 다음 해 1~3분기 동일값) |

**호출 URL**

```
http://openapi.seoul.go.kr:8088/{KEY}/json/VwsmTrdarWrcPopltnQq/1/1000/
```

**주요 응답 필드**

| 필드명                                                    | 설명              |
| :-------------------------------------------------------- | :---------------- |
| `TRDAR_CD` / `_NM`                                        | 상권 코드/명      |
| `TOT_WRC_POPLTN_CO`                                       | 총 직장인구 수    |
| `ML_WRC_POPLTN_CO` / `FML_WRC_POPLTN_CO`                  | 남/여 직장인구    |
| `AGRDE_10_WRC_POPLTN_CO` ~ `AGRDE_60_ABOVE_WRC_POPLTN_CO` | 연령대별 직장인구 |

---

### 3.7 상주인구 (행정동 단위)

> 행정동 단위의 상주인구 정보입니다.

| 항목            | 내용                    |
| :-------------- | :---------------------- |
| **데이터셋 ID** | OA-15581                |
| **서비스명**    | `VwsmAdstrdLivPopltnQq` |
| **갱신주기**    | 분기                    |

**호출 URL**

```
http://openapi.seoul.go.kr:8088/{KEY}/json/VwsmAdstrdLivPopltnQq/1/1000/
```

---

### 3.8 소득소비 (행정동 단위)

> 행정동 단위 추정 소득 및 소비 패턴 정보입니다.

| 항목            | 내용                   |
| :-------------- | :--------------------- |
| **데이터셋 ID** | OA-22166               |
| **서비스명**    | `VwsmAdstrdIcmCnsmpQq` |
| **갱신주기**    | 연 1회                 |

**호출 URL**

```
http://openapi.seoul.go.kr:8088/{KEY}/json/VwsmAdstrdIcmCnsmpQq/1/1000/
```

---

### 3.9 추정매출 — 상권배후지 단위

> 상권배후지(상권 주변 영향 지역) 단위의 추정매출 정보입니다.

| 항목            | 내용                  |
| :-------------- | :-------------------- |
| **데이터셋 ID** | OA-15573              |
| **서비스명**    | `VwsmTrdarHflSelngQq` |
| **갱신주기**    | 분기                  |

**호출 URL**

```
http://openapi.seoul.go.kr:8088/{KEY}/json/VwsmTrdarHflSelngQq/1/1000/
```

---

### 3.10 추정매출 — 행정동/자치구 단위

| 단위   | 데이터셋 ID | 서비스명            |
| :----- | :---------- | :------------------ |
| 행정동 | OA-22175    | `VwsmAdstrdSelngQq` |
| 자치구 | OA-22174    | `VwsmSignguSelngQq` |

---

### 3.11 점포 정보 — 상권배후지/행정동/자치구 단위

| 단위       | 데이터셋 ID              | 서비스명             |
| :--------- | :----------------------- | :------------------- |
| 상권배후지 | OA-15579 (또는 OA-15578) | `VwsmTrdarHflStorQq` |
| 행정동     | OA-22172                 | `VwsmAdstrdStorQq`   |
| 자치구     | OA-22173                 | `VwsmSignguStorQq`   |

---

## 4. 서비스 업종코드 참고

100개 생활밀접업종을 3개 대분류로 구분합니다.

| 대분류   | 업종 수 | 예시                                                                      |
| :------- | :-----: | :------------------------------------------------------------------------ |
| 외식업   |  10개   | 한식, 중식, 일식, 양식, 제과제빵, 패스트푸드, 치킨, 분식, 커피, 호프/주점 |
| 서비스업 |  47개   | 미용실, 세탁소, 학원, 부동산중개, 병원, 약국 등                           |
| 소매업   |  43개   | 편의점, 슈퍼마켓, 의류, 화장품, 핸드폰, 안경 등                           |

---

## 5. 전체 API 요약 테이블

|  #  | API 이름          | 데이터셋 ID | 서비스명                | 핵심 데이터                   | PRD 기능      |
| :-: | :---------------- | :---------: | :---------------------- | :---------------------------- | :------------ |
|  1  | 영역-상권         |  OA-15560   | `TbgisTrdarRelm`        | 상권코드, 좌표, 자치구/행정동 | 기초 조회     |
|  2  | 추정매출-상권     |  OA-15572   | `VwsmTrdarSelngQq`      | 매출액, 요일/시간/성별/연령별 | F3 입지적합성 |
|  3  | 추정매출-배후지   |  OA-15573   | `VwsmTrdarHflSelngQq`   | 배후지 매출                   | F3            |
|  4  | 추정매출-행정동   |  OA-22175   | `VwsmAdstrdSelngQq`     | 행정동별 매출                 | F3            |
|  5  | 추정매출-자치구   |  OA-22174   | `VwsmSignguSelngQq`     | 자치구별 매출                 | F3            |
|  6  | 점포-상권         |  OA-15577   | `VwsmTrdarStorQq`       | 점포수, 개폐업률, 프랜차이즈  | F1, F2        |
|  7  | 점포-배후지       |  OA-15578   | `VwsmTrdarHflStorQq`    | 배후지 점포                   | F1, F2        |
|  8  | 점포-행정동       |  OA-22172   | `VwsmAdstrdStorQq`      | 행정동별 점포                 | F1, F2        |
|  9  | 점포-자치구       |  OA-22173   | `VwsmSignguStorQq`      | 자치구별 점포                 | F1, F2        |
| 10  | 상권변화지표      |  OA-15576   | `VwsmTrdarIxQq`      | 4단계 등급, 평균영업기간      | F1 건강도     |
| 11  | 길단위인구-상권   |  OA-15568   | `VwsmTrdarFlpopQq`      | 유동인구(시간/성별/연령)      | F3            |
| 12  | 길단위인구-배후지 |  OA-15582   | `VwsmTrdarHflFlpopQq`   | 배후지 유동인구               | F3            |
| 13  | 직장인구-상권     |  OA-15569   | `VwsmTrdarWrcPopltnQq`  | 직장인구(성별/연령)           | F3            |
| 14  | 상주인구-행정동   |  OA-15581   | `VwsmAdstrdLivPopltnQq` | 상주인구                      | F3            |
| 15  | 소득소비-행정동   |  OA-22166   | `VwsmAdstrdIcmCnsmpQq`  | 추정소득, 소비패턴            | F3            |

---

## 6. 데이터 파이프라인 연동 흐름

PRD 7.3의 데이터 파이프라인 중 **[서울] golmok Open API** 단계 구현:

```
사용자 입력 (주소 + 업종)
    │
    ▼
[1] Geocoding → 좌표 변환 → 서울 여부 판별
    │
    ├─ 서울이 아닌 경우 → golmok API 스킵, KOSIS 대체
    │
    ▼
[2] TbgisTrdarRelm (영역-상권) 호출
    → 좌표 기반으로 가장 가까운 상권 코드(TRDAR_CD) 매칭
    │
    ▼  (TRDAR_CD 획득)
    │
    ├──▶ [3] VwsmTrdarSelngQq (추정매출) ── 병렬 호출
    ├──▶ [4] VwsmTrdarStorQq (점포정보) ── 병렬 호출
    ├──▶ [5] VwsmTrdarIxQq (상권변화지표) ── 병렬 호출
    ├──▶ [6] VwsmTrdarFlpopQq (유동인구) ── 병렬 호출
    ├──▶ [7] VwsmTrdarWrcPopltnQq (직장인구) ── 병렬 호출
    │
    ▼
[8] 결과 조합 → Redis 캐싱 (TTL 24h)
    │
    ▼
[9] NPS/NTS MCP 결과 + golmok 결과 → AI 엔진 → 리포트 생성
```

---

## 7. 구현 시 주의사항

### ⚠️ 서비스명 대소문자 주의 (가장 흔한 실수)

서울시 골목상권 API의 서비스명은 **`Vwsm`** (소문자 `sm`)으로 시작합니다. `VwSm` (대문자 `S`)으로 호출하면 `ERROR-500`을 반환하며, 서비스명이 존재하지 않는다는 명확한 에러 메시지 없이 **서버 오류**로만 표시됩니다.

| 잘못된 서비스명 (ERROR-500) | 올바른 서비스명 (INFO-000) |
| :-------------------------- | :------------------------- |
| `VwsmTrdarSelngQq`          | `VwsmTrdarSelngQq`         |
| `VwsmTrdarStorQq`           | `VwsmTrdarStorQq`          |
| `VwSmTrdarChgIxQq`          | `VwsmTrdarIxQq`            |
| `VwSmTrdarFlpopQq`          | `VwsmTrdarFlpopQq`         |

> **상권변화지표** 서비스명은 `ChgIx`가 아니라 `Ix`입니다: `VwsmTrdarIxQq`

**분기코드 필드도 주의**:
- 실제 필드: `STDR_YYQU_CD` (합산형, 예: `"20244"` = 2024년 4분기)
- ~~`STDR_YR_CD` + `STDR_QU_CD`~~ (존재하지 않음)

**상권변화지표 필드명 주의**:
- `TRDAR_CHNGE_IX` / `TRDAR_CHNGE_IX_NM` (~~`TRDAR_CHG_IX`~~ 가 아님!)
- `OPR_SALE_MT_AVRG` (~~`OPR_AVG_BIZ_MT`~~ 가 아님!)
- `CLS_SALE_MT_AVRG` (~~`CLS_AVG_BIZ_MT`~~ 가 아님!)

### 7.1 상권코드 매칭 로직

API는 좌표 기반 검색을 직접 지원하지 않습니다. 사용자 입력 주소에서 상권코드를 찾으려면 **영역-상권(OA-15560)** 데이터를 전체 로드하여 좌표 매칭해야 합니다.

```python
# 좌표계 변환 필요: WGS84(일반 GPS) → EPSG:5181(서울시 좌표계)
from pyproj import Transformer

transformer = Transformer.from_crs("EPSG:4326", "EPSG:5181", always_xy=True)
x, y = transformer.transform(longitude, latitude)

# 가장 가까운 상권코드 찾기 (사전에 TbgisTrdarRelm 데이터 DB 저장)
```

### 7.2 캐싱 전략

분기별 갱신 데이터이므로 적극적인 캐싱이 가능합니다.

| 데이터            | 캐싱 TTL | 전략                 |
| :---------------- | :------- | :------------------- |
| 영역-상권 (좌표)  | 30일     | DB에 저장, 반기 갱신 |
| 추정매출/점포     | 7일      | Redis 캐싱           |
| 유동인구/직장인구 | 7일      | Redis 캐싱           |
| 상권변화지표      | 30일     | Redis 캐싱           |

### 7.3 업종코드 매핑

사용자가 "치킨"이라고 입력하면 서울시 업종코드(`SVC_INDUTY_CD`)로 매핑해야 합니다. 업종코드 매핑 테이블을 사전에 구축해야 합니다.

```python
INDUSTRY_MAP = {
    "치킨": "CS200009",
    "커피": "CS200010",
    "한식": "CS200001",
    "중식": "CS200002",
    "일식": "CS200003",
    "양식": "CS200004",
    "분식": "CS200007",
    "호프/주점": "CS200012",
    "미용실": "CS300001",
    "편의점": "CS100001",
    # ... 100개 업종 전체 매핑 필요
}
```

### 7.4 에러 처리

```json
// 정상 응답 (JSON)
{
  "VwsmTrdarSelngQq": {
    "list_total_count": 12345,
    "RESULT": { "CODE": "INFO-000", "MESSAGE": "정상 처리되었습니다" },
    "row": [ ... ]
  }
}

// 에러 응답 (JSON) — 데이터 없음 등
{
  "RESULT": {
    "CODE": "INFO-200",     // 해당하는 데이터가 없습니다
    "MESSAGE": "..."
  }
}

// 에러 응답 (XML) — 인증키 오류 등에서 XML로 반환될 수 있음!
// <RESULT><CODE>INFO-100</CODE><MESSAGE><![CDATA[인증키가 유효하지 않습니다]]></MESSAGE></RESULT>
```

| 에러코드    | 의미                            | 비고                                       |
| :---------- | :------------------------------ | :----------------------------------------- |
| `INFO-000`  | 정상 처리                       |                                            |
| `INFO-100`  | 인증키 오류                     | **XML로 반환될 수 있음** (JSON 파싱 주의!) |
| `INFO-200`  | 해당 데이터 없음                |                                            |
| `INFO-300`  | 필수 파라미터 누락              |                                            |
| `ERROR-300` | 데이터 건수 초과 (1,000건 제한) |                                            |
| `ERROR-500` | 서버 오류                       | **서비스명 오류도 이 코드로 반환됨!**      |

> **주의**: `ERROR-500`은 실제 서버 오류뿐 아니라 **서비스명이 틀린 경우**에도 동일하게 반환됩니다.
> 서비스명 대소문자가 정확한지 먼저 확인하세요.

---

## 8. 참고 링크

| 리소스                    | URL                                                           |
| :------------------------ | :------------------------------------------------------------ |
| 서울 열린데이터광장       | https://data.seoul.go.kr                                      |
| Open API 이용방법 가이드  | https://data.seoul.go.kr/together/guide/useGuide.do           |
| 골목상권 분석 서비스 (웹) | https://golmok.seoul.go.kr                                    |
| OA-15572 추정매출 API     | https://data.seoul.go.kr/dataList/OA-15572/S/1/datasetView.do |
| OA-15577 점포 API         | https://data.seoul.go.kr/dataList/OA-15577/S/1/datasetView.do |
| OA-15560 영역 API         | https://data.seoul.go.kr/dataList/OA-15560/S/1/datasetView.do |
| OA-15576 상권변화지표 API | https://data.seoul.go.kr/dataList/OA-15576/S/1/datasetView.do |
| OA-15568 길단위인구 API   | https://data.seoul.go.kr/dataList/OA-15568/S/1/datasetView.do |
| OA-15569 직장인구 API     | https://data.seoul.go.kr/dataList/OA-15569/S/1/datasetView.do |
