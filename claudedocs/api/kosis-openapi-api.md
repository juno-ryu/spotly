# KOSIS 공유서비스(OpenAPI) API 연동 레퍼런스

> 통계청 국가통계포털(KOSIS) OpenAPI 개발가이드 v1.0 기반 정리

---

## 공통 사항

- **Base Domain**: `http://kosis.kr` (HTTPS: `https://kosis.kr`)
- **인증**: 모든 API 호출 시 `apiKey` 파라미터 필수
- **인증키 발급**: KOSIS 회원가입 → 활용신청 → 자동승인 후 인증키 발급 (회원당 1개)
- **결과 형식**: JSON, SDMX, XML 등 API별 상이
- **통계자료 요청 제한**: 4만셀 이하

---

## 에러 코드

| 코드 |       메시지       |     조치방법      |
| :--: | :----------------: | :---------------: |
|  10  |    인증키 누락     |    인증키 확인    |
|  11  |  인증키 기간만료   | 인증키 기간 연장  |
|  20  | 필수요청변수 누락  | 필수요청변수 확인 |
|  21  |  잘못된 요청변수   |   요청변수 확인   |
|  30  |   조회결과 없음    |   조회조건 확인   |
|  31  |   조회결과 초과    |   호출건수 조정   |
|  40  | 호출가능건수 제한  |  관리자에게 문의  |
|  41  | 호출가능ROW수 제한 |  관리자에게 문의  |
|  42  | 사용자별 이용 제한 |  관리자에게 문의  |
|  50  |      서비오류      |  관리자에게 문의  |

---

## 1. 통계목록 API

통계표의 목록구성 정보를 레벨 형태로 제공합니다.

### 호출 URL

```
http://kosis.kr/openapi/statisticsList.do
```

### 제공 형태

JSON, SDMX

### 입력 변수

| 파라미터       |  타입  | 설명                       | 필수 |
| :------------- | :----: | :------------------------- | :--: |
| `apiKey`       | String | 발급된 인증키              |  ✅  |
| `vwCd`         | String | 서비스뷰 코드 (아래 참조)  |  ✅  |
| `parentListId` | String | 시작목록 ID                |  ✅  |
| `format`       | String | 결과 유형 (`json`, `sdmx`) |  ✅  |
| `content`      | String | 헤더 유형 (`html`, `json`) | 선택 |

#### vwCd 코드 값

| 코드              | 설명                     |
| :---------------- | :----------------------- |
| `MT_ZTITLE`       | 주제별 통계              |
| `MT_OTITLE`       | 기관별 통계              |
| `MT_CHOSUN_TITLE` | 광복이전통계 (1908~1943) |
| `MT_HANKUK_TITLE` | 대한민국통계연감         |
| `MT_STOP_TITLE`   | 작성중지통계             |
| `MT_ATITLE01`     | 지역통계 (주제별)        |
| `MT_ATITLE02`     | 지역통계 (기관별)        |
| `MT_GTITLE01`     | e-지방지표 (주제별)      |
| `MT_ETITLE`       | 영문 KOSIS               |

### 출력 변수

| 필드명       | 설명             | 형식          |
| :----------- | :--------------- | :------------ |
| `VW_CD`      | 서비스뷰ID       | VARCHAR2(40)  |
| `VW_NM`      | 서비스뷰명       | VARCHAR2(300) |
| `LIST_ID`    | 목록ID           | VARCHAR2(40)  |
| `LIST_NM`    | 목록명           | VARCHAR2(300) |
| `ORG_ID`     | 기관코드         | VARCHAR2(40)  |
| `TBL_ID`     | 통계표ID         | VARCHAR2(40)  |
| `TBL_NM`     | 통계표명         | VARCHAR2(300) |
| `STAT_ID`    | 통계조사ID       | VARCHAR2(40)  |
| `SEND_DE`    | 최종갱신일       | VARCHAR2(8)   |
| `REC_TBL_SE` | 추천 통계표 여부 | VARCHAR2(10)  |

---

## 2. 통계자료 API

통계표의 수치자료 및 메타정보(수록정보, 출처, 단위 등)를 제공합니다.

### 호출 URL

```
http://kosis.kr/openapi/statisticsData.do
```

### 제공 형태

JSON, SDMX (DSD, Generic, StructureSpecific)

### 입력 변수 — URL 선택 방식 (통계표선택)

| 파라미터          |  타입  | 설명                       |  필수  |
| :---------------- | :----: | :------------------------- | :----: |
| `apiKey`          | String | 발급된 인증키              |   ✅   |
| `orgId`           | String | 기관 ID                    |   ✅   |
| `tblId`           | String | 통계표 ID                  |   ✅   |
| `objL1`           | String | 분류1 (첫번째 분류코드)    |   ✅   |
| `objL2` ~ `objL8` | String | 분류2~분류8                |  선택  |
| `itmId`           | String | 항목                       |   ✅   |
| `prdSe`           | String | 수록주기                   |   ✅   |
| `startPrdDe`      | String | 시작수록시점               | 선택\* |
| `endPrdDe`        | String | 종료수록시점               | 선택\* |
| `newEstPrdCnt`    | String | 최근수록시점 개수          | 선택\* |
| `prdInterval`     | String | 수록시점 간격              | 선택\* |
| `format`          | String | 결과 유형 (`json`, `sdmx`) |   ✅   |

> \*시점기준(`startPrdDe`/`endPrdDe`) 또는 최신자료기준(`newEstPrdCnt`/`prdInterval`) 중 택1

### 입력 변수 — 자료등록 방식

| 파라미터       |  타입  | 설명                       |  필수  |
| :------------- | :----: | :------------------------- | :----: |
| `apiKey`       | String | 발급된 인증키              |   ✅   |
| `userStatsId`  | String | 사용자 등록 통계표         |   ✅   |
| `prdSe`        | String | 수록주기                   |   ✅   |
| `startPrdDe`   | String | 시작수록시점               | 선택\* |
| `endPrdDe`     | String | 종료수록시점               | 선택\* |
| `newEstPrdCnt` | String | 최근수록시점 개수          | 선택\* |
| `prdInterval`  | String | 수록시점 간격              | 선택\* |
| `format`       | String | 결과 유형 (`json`, `sdmx`) |   ✅   |
| `content`      | String | 헤더 유형 (`html`, `json`) |  선택  |

### 항목/분류 간편 키워드

- 항목 전체 선택: `itmId = all`
- 분류 전체 선택: `objL1 = all`
- 하위레벨 전체 포함: `objL1 = 11*` (예: 행정구역별에서 서울의 하위 전체)
- 복수 분류값 추가: `objL1 = 11+21` (예: 서울 + 부산)

### 출력 변수

| 필드명                            | 설명             | 형식           |
| :-------------------------------- | :--------------- | :------------- |
| `ORG_ID`                          | 기관코드         | VARCHAR2(40)   |
| `TBL_ID`                          | 통계표ID         | VARCHAR2(40)   |
| `TBL_NM`                          | 통계표명         | VARCHAR2(300)  |
| `C1` ~ `C8`                       | 분류값 ID1~8     | VARCHAR2(40)   |
| `C1_OBJ_NM` ~ `C8_OBJ_NM`         | 분류명1~8        | VARCHAR2(3000) |
| `C1_OBJ_NM_ENG` ~ `C8_OBJ_NM_ENG` | 분류 영문명1~8   | VARCHAR2(3000) |
| `C1_NM` ~ `C8_NM`                 | 분류값 명1~8     | VARCHAR2(3000) |
| `C1_NM_ENG` ~ `C8_NM_ENG`         | 분류값 영문명1~8 | VARCHAR2(3000) |
| `ITM_ID`                          | 항목 ID          | VARCHAR2(40)   |
| `ITM_NM`                          | 항목명           | VARCHAR2(3000) |
| `ITM_NM_ENG`                      | 항목영문명       | VARCHAR2(3000) |
| `UNIT_ID`                         | 단위ID           | VARCHAR2(40)   |
| `UNIT_NM`                         | 단위명           | VARCHAR2(1000) |
| `UNIT_NM_ENG`                     | 단위영문명       | VARCHAR2(1000) |
| `PRD_SE`                          | 수록주기         | VARCHAR2(20)   |
| `PRD_DE`                          | 수록시점         | VARCHAR2(8)    |
| `DT`                              | 수치값           | VARCHAR2(100)  |
| `LST_CHN_DE`                      | 최종수정일       | VARCHAR2(8)    |

---

## 3. 대용량 통계자료 API

통계표 전체, 분류 전체/일부, 항목 전체/일부를 선택적으로 요청합니다.

### 호출 URL

```
http://kosis.kr/openapi/statisticsBigData.do
```

### 제공 형태

SDMX (DSD, Generic, StructureSpecific), XLS/CSV

### 입력 변수 — SDMX (DSD)

| 파라미터      |  타입  | 설명                                              | 필수 |
| :------------ | :----: | :------------------------------------------------ | :--: |
| `apiKey`      | String | 발급된 인증키                                     |  ✅  |
| `userStatsId` | String | 사용자 등록 통계표                                |  ✅  |
| `type`        | String | SDMX 유형 (`DSD`, `Generic`, `StructureSpecific`) |  ✅  |
| `format`      | String | 결과 유형 (`json`, `sdmx`)                        |  ✅  |
| `version`     | String | 결과값 구분 (생략 시 구버전 데이터 출력)          | 선택 |

### 입력 변수 — SDMX (Generic / StructureSpecific)

| 파라미터       |  타입  | 설명                       |  필수  |
| :------------- | :----: | :------------------------- | :----: |
| `apiKey`       | String | 발급된 인증키              |   ✅   |
| `userStatsId`  | String | 사용자 등록 통계표         |   ✅   |
| `type`         | String | SDMX 유형                  |   ✅   |
| `prdSe`        | String | 수록주기                   |   ✅   |
| `startPrdDe`   | String | 시작수록시점               | 선택\* |
| `endPrdDe`     | String | 종료수록시점               | 선택\* |
| `newEstPrdCnt` | String | 최근수록시점 개수          | 선택\* |
| `prdInterval`  | String | 수록시점 간격              | 선택\* |
| `format`       | String | 결과 유형 (`json`, `sdmx`) |   ✅   |
| `version`      | String | 결과값 구분                |  선택  |

### 입력 변수 — XLS

| 파라미터       |  타입  | 설명                       |  필수  |
| :------------- | :----: | :------------------------- | :----: |
| `apiKey`       | String | 발급된 인증키              |   ✅   |
| `userStatsId`  | String | 사용자 등록 통계표         |   ✅   |
| `prdSe`        | String | 수록주기                   |   ✅   |
| `startPrdDe`   | String | 시작수록시점               | 선택\* |
| `endPrdDe`     | String | 종료수록시점               | 선택\* |
| `newEstPrdCnt` | String | 최근수록시점 개수          | 선택\* |
| `prdInterval`  | String | 수록시점 간격              | 선택\* |
| `format`       | String | 결과 유형 (`json`, `sdmx`) |   ✅   |

---

## 4. 통계설명 API

통계조사에 대한 설명자료(조사명, 통계종류, 법적근거, 조사목적, 조사주기 등)를 제공합니다.

### 호출 URL

```
http://kosis.kr/openapi/statisticsExplData.do
```

### 제공 형태

JSON, XML

### 입력 변수

| 파라미터                        |  타입  | 설명                       | 필수 |
| :------------------------------ | :----: | :------------------------- | :--: |
| `apiKey`                        | String | 발급된 인증키              |  ✅  |
| `statId` (또는 `orgId`+`tblId`) | String | 통계조사 ID                |  ✅  |
| `metaItm`                       | String | 요청 항목 (아래 참조)      |  ✅  |
| `format`                        | String | 결과유형 (`JSON`, `SDMX`)  |  ✅  |
| `content`                       | String | 헤더 유형 (`html`, `json`) | 선택 |

#### metaItm 값 목록

| 값               | 설명                         |
| :--------------- | :--------------------------- |
| `All`            | 전체                         |
| `statsNm`        | 조사명                       |
| `statsKind`      | 작성유형                     |
| `statsEnd`       | 통계종류                     |
| `statsContinue`  | 계속여부                     |
| `basisLaw`       | 법적근거                     |
| `writingPurps`   | 조사목적                     |
| `examinPd`       | 조사기간                     |
| `statsPeriod`    | 조사주기                     |
| `writingSystem`  | 조사체계                     |
| `writingTel`     | 연락처                       |
| `statsField`     | 통계(활용)분야 실태          |
| `examinObjrange` | 조사 대상범위                |
| `examinObjArea`  | 조사 대상지역                |
| `josaUnit`       | 조사단위 및 조사대상규모     |
| `applyGroup`     | 적용분류                     |
| `josaItm`        | 조사항목                     |
| `pubPeriod`      | 공표주기                     |
| `pubExtent`      | 공표범위                     |
| `pubDate`        | 공표시기                     |
| `publictMth`     | 공표방법 및 URL              |
| `examinTrgetPd`  | 조사대상기간 및 조사기준시점 |
| `dataUserNote`   | 자료이용시 유의사항          |
| `mainTermExpl`   | 주요 용어해설                |
| `dataCollectMth` | 자료 수집방법                |
| `examinHistory`  | 조사연혁                     |
| `confmNo`        | 승인번호                     |
| `confmDt`        | 승인일자                     |

### 출력 변수

| 필드명           | 설명                         |
| :--------------- | :--------------------------- |
| `statsNm`        | 조사명                       |
| `statsKind`      | 작성유형                     |
| `statsEnd`       | 통계종류                     |
| `statsContinue`  | 계속여부                     |
| `basisLaw`       | 법적근거                     |
| `writingPurps`   | 조사목적                     |
| `examinPd`       | 조사기간                     |
| `statsPeriod`    | 조사주기                     |
| `writingSystem`  | 조사체계                     |
| `writingTel`     | 연락처                       |
| `statsField`     | 통계(활용)분야 실태          |
| `examinObjrange` | 조사 대상범위                |
| `examinObjArea`  | 조사 대상지역                |
| `josaUnit`       | 조사단위 및 조사대상규모     |
| `applyGroup`     | 적용분류                     |
| `josaItm`        | 조사항목                     |
| `pubPeriod`      | 공표주기                     |
| `pubExtent`      | 공표범위                     |
| `pubDate`        | 공표시기                     |
| `publictMth`     | 공표방법 및 URL              |
| `examinTrgetPd`  | 조사대상기간 및 조사기준시점 |
| `dataUserNote`   | 자료이용자 유의사항          |
| `mainTermExpl`   | 주요 용어해설                |
| `dataCollectMth` | 자료 수집방법                |
| `examinHistory`  | 조사연혁                     |
| `confmNo`        | 승인번호                     |
| `confmDt`        | 승인일자                     |

---

## 5. 메타자료 API

통계자료에 대한 메타자료(통계표 명칭, 기관명칭, 수록정보, 분류/항목, 주석, 단위, 출처, 가중치, 자료갱신일)를 제공합니다.

### 호출 Base URL

```
http://kosis.kr/openapi/statisticsData.do?method=getMeta&type={TYPE}
```

### 제공 형태

JSON, XML(SDMX)

---

### 5.1 통계표 명칭 (`type=TBL`)

**URL**: `http://kosis.kr/openapi/statisticsData.do?method=getMeta&type=TBL`

| 파라미터  |  타입  | 설명                       | 필수 |
| :-------- | :----: | :------------------------- | :--: |
| `apiKey`  | String | 발급된 인증키              |  ✅  |
| `orgId`   | String | 기관 ID                    |  ✅  |
| `tblId`   | String | 통계표 ID                  |  ✅  |
| `format`  | String | 결과유형 (`JSON`, `SDMX`)  |  ✅  |
| `content` | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `TBL_NM` (통계표 국문명), `TBL_NM_ENG` (통계표 영문명)

---

### 5.2 기관 명칭 (`type=ORG`)

**URL**: `http://kosis.kr/openapi/statisticsData.do?method=getMeta&type=ORG`

| 파라미터  |  타입  | 설명                       | 필수 |
| :-------- | :----: | :------------------------- | :--: |
| `apiKey`  | String | 발급된 인증키              |  ✅  |
| `orgId`   | String | 기관 ID                    |  ✅  |
| `format`  | String | 결과유형 (`JSON`, `SDMX`)  |  ✅  |
| `content` | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `ORG_NM` (기관 국문명), `ORG_NM_ENG` (기관 영문명)

---

### 5.3 수록정보 (`type=PRD`)

**URL**: `http://kosis.kr/openapi/statisticsData.do?method=getMeta&type=PRD`

| 파라미터  |  타입  | 설명                       | 필수 |
| :-------- | :----: | :------------------------- | :--: |
| `apiKey`  | String | 발급된 인증키              |  ✅  |
| `orgId`   | String | 기관 ID                    |  ✅  |
| `tblId`   | String | 통계표ID                   |  ✅  |
| `format`  | String | 결과유형 (`JSON`, `SDMX`)  |  ✅  |
| `detail`  | String | 전체시점 정보 제공         | 선택 |
| `content` | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `PRD_SE` (수록주기), `PRD_DE` (수록시점)

---

### 5.4 분류/항목 (`type=ITM`)

**URL**: `http://kosis.kr/openapi/statisticsData.do?method=getMeta&type=ITM`

| 파라미터  |  타입  | 설명                       | 필수 |
| :-------- | :----: | :------------------------- | :--: |
| `apiKey`  | String | 발급된 인증키              |  ✅  |
| `orgId`   | String | 기관 코드                  |  ✅  |
| `tblId`   | String | 통계표ID                   |  ✅  |
| `objId`   | String | 분류코드                   | 선택 |
| `itmId`   | String | 자료코드                   | 선택 |
| `format`  | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content` | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `OBJ_ID`, `OBJ_NM`, `OBJ_NM_ENG`, `ITM_ID`, `ITM_NM`, `ITM_NM_ENG`, `UP_ITM_ID`, `OBJ_ID_SN`, `UNIT_ID`, `UNIT_NM`, `UNIT_ENG_NM`

---

### 5.5 주석 (`type=CMMT`)

**URL**: `http://kosis.kr/openapi/statisticsData.do?method=getMeta&type=CMMT`

| 파라미터  |  타입  | 설명                       | 필수 |
| :-------- | :----: | :------------------------- | :--: |
| `apiKey`  | String | 발급된 인증키              |  ✅  |
| `orgId`   | String | 기관 ID                    |  ✅  |
| `tblId`   | String | 통계표ID                   |  ✅  |
| `format`  | String | 결과유형 (`JSON`, `SDMX`)  |  ✅  |
| `content` | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `CMMT_NM` (주석유형), `CMMT_DC` (주석), `OBJ_ID`, `OBJ_NM`, `ITM_ID`, `ITM_NM`

---

### 5.6 단위 (`type=UNIT`)

**URL**: `http://kosis.kr/openapi/statisticsData.do?method=getMeta&type=UNIT`

| 파라미터  |  타입  | 설명                       | 필수 |
| :-------- | :----: | :------------------------- | :--: |
| `apiKey`  | String | 발급된 인증키              |  ✅  |
| `orgId`   | String | 기관코드                   |  ✅  |
| `tblId`   | String | 통계표ID                   |  ✅  |
| `format`  | String | 결과유형 (`JSON`, `SDMX`)  |  ✅  |
| `content` | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `UNIT_NM` (단위 국문명), `UNIT_NM_ENG` (단위 영문명)

---

### 5.7 출처 (`type=SOURCE`)

**URL**: `http://kosis.kr/openapi/statisticsData.do?method=getMeta&type=SOURCE`

| 파라미터  |  타입  | 설명                       | 필수 |
| :-------- | :----: | :------------------------- | :--: |
| `apiKey`  | String | 발급된 인증키              |  ✅  |
| `orgId`   | String | 기관 ID                    |  ✅  |
| `tblId`   | String | 통계표ID                   |  ✅  |
| `format`  | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content` | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `JOSA_NM` (조사명), `DEPT_NM` (담당부서), `DEPT_PHONE` (전화번호), `STAT_ID` (통계조사ID)

---

### 5.8 가중치 (`type=WGT`)

**URL**: `http://kosis.kr/openapi/statisticsData.do?method=getMeta&type=WGT`

| 파라미터              |  타입  | 설명                       | 필수 |
| :-------------------- | :----: | :------------------------- | :--: |
| `apiKey`              | String | 발급된 인증키              |  ✅  |
| `orgId`               | String | 기관 ID                    |  ✅  |
| `tblId`               | String | 통계표ID                   |  ✅  |
| `분류코드1~분류코드8` | String | 분류코드                   | 선택 |
| `ITEM`                | String | 항목                       | 선택 |
| `format`              | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content`             | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `C1`~`C8` (분류값 ID), `C1_NM`~`C8_NM` (분류값 명), `ITM_ID` (항목 ID), `ITM_NM` (항목명), `WGT_CO` (가중치)

---

### 5.9 자료갱신일 (`type=NCD`)

**URL**: `http://kosis.kr/openapi/statisticsData.do?method=getMeta&type=NCD`

| 파라미터  |  타입  | 설명                       | 필수 |
| :-------- | :----: | :------------------------- | :--: |
| `apiKey`  | String | 발급된 인증키              |  ✅  |
| `orgId`   | String | 기관 ID                    |  ✅  |
| `tblId`   | String | 통계표ID                   |  ✅  |
| `prdSe`   | String | 수록주기                   | 선택 |
| `format`  | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content` | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `ORG_NM` (기관명), `TBL_NM` (통계표명), `PRD_SE` (수록주기), `PRD_DE` (수록시점), `SEND_DE` (자료갱신일)

---

## 6. KOSIS 통합검색 API

국가통계포털(kosis.kr)의 통합검색결과를 제공합니다.

### 호출 URL

```
http://kosis.kr/openapi/statisticsSearch.do?method=getList
```

### 제공 형태

JSON

### 입력 변수

| 파라미터      |  타입  | 설명                                  | 필수 |
| :------------ | :----: | :------------------------------------ | :--: |
| `apiKey`      | String | 발급된 인증키                         |  ✅  |
| `searchNm`    | String | 검색명                                |  ✅  |
| `sort`        | String | 정렬 (`RANK`: 정확도, `DATE`: 최신순) | 선택 |
| `startCount`  | String | 페이지 번호                           | 선택 |
| `resultCount` | String | 데이터 출력 개수 (기본 20)            | 선택 |
| `format`      | String | 결과유형 (`json`)                     |  ✅  |
| `content`     | String | 헤더 유형 (`html`, `json`)            | 선택 |

> 페이징: `resultCount=20, startCount=1` → 1~20번, `startCount=2` → 21~40번

### 출력 변수

| 필드명         | 설명                          |
| :------------- | :---------------------------- |
| `ORG_ID`       | 기관코드                      |
| `ORG_NM`       | 기관명                        |
| `TBL_ID`       | 통계표ID                      |
| `TBL_NM`       | 통계표명                      |
| `STAT_ID`      | 조사코드                      |
| `STAT_NM`      | 조사명                        |
| `VW_CD`        | KOSIS 목록구분                |
| `MT_ATITLE`    | KOSIS 통계표 위치             |
| `FULL_PATH_ID` | 통계표 위치                   |
| `CONTENTS`     | 통계표 주요내용               |
| `STRT_PRD_DE`  | 수록기간 시작일               |
| `END_PRD_DE`   | 수록기간 종료일               |
| `ITEM03`       | 통계표 주석                   |
| `REC_TBL_SE`   | 추천통계표 여부               |
| `TBL_VIEW_URL` | 통계표 이동URL (KOSIS 목록)   |
| `LINK_URL`     | 통계표 이동URL (KOSIS 통계표) |
| `STAT_DB_CNT`  | 검색결과 건수                 |
| `QUERY`        | 검색어명                      |

---

## 7. 통계주요지표 API

지표 Open API 서비스를 위한 JSON, XML 기반 데이터를 제공합니다.

### 제공 형태

JSON, XML

---

### 7.1 지표 고유번호별 설명자료조회

**URL**:

```
http://kosis.kr/openapi/pkNumberService.do?method=getList&service=1&serviceDetail=pkAll
```

| 파라미터    |  타입  | 설명                       | 필수 |
| :---------- | :----: | :------------------------- | :--: |
| `apiKey`    | String | 발급된 인증키              |  ✅  |
| `jipyoId`   | String | 지표 ID                    |  ✅  |
| `pageNo`    | String | 페이지 번호                | 선택 |
| `numOfRows` | String | 데이터 출력 개수           | 선택 |
| `format`    | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content`   | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `statJipyoId` (지표ID), `statJipyoNm` (지표명), `jipyoExplan` (설명자료 제목), `jipyoExplan1` (개념)

---

### 7.2 지표명별 설명자료조회

**URL**:

```
http://kosis.kr/openapi/indExpService.do?method=getList&service=2&serviceDetail=indAll
```

| 파라미터    |  타입  | 설명                       | 필수 |
| :---------- | :----: | :------------------------- | :--: |
| `apiKey`    | String | 발급된 인증키              |  ✅  |
| `jipyoNm`   | String | 지표명                     |  ✅  |
| `pageNo`    | String | 페이지 번호                | 선택 |
| `numOfRows` | String | 데이터 출력 개수           | 선택 |
| `format`    | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content`   | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `statJipyoId`, `statJipyoNm`, `jipyoExplan`, `jipyoExplan1`

---

### 7.3 목록별 지표조회

**URL**:

```
http://kosis.kr/openapi/indiListService.do?method=getList&service=3
```

| 파라미터    |  타입  | 설명                       | 필수 |
| :---------- | :----: | :------------------------- | :--: |
| `apiKey`    | String | 발급된 인증키              |  ✅  |
| `listId`    | String | 목록ID                     |  ✅  |
| `pageNo`    | String | 페이지 번호                | 선택 |
| `numOfRows` | String | 데이터 출력 개수           | 선택 |
| `format`    | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content`   | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `listId`, `listNm`, `statJipyoId`, `statJipyoNm`, `unit`, `areaTypeName`, `prdSeName`, `strtPrdDe`, `endPrdDe`, `m`, `listSn1`, `listSn2`, `prdDe`, `repJipyoId`, `repJipyoNm`, `repJipyoUrl`, `explainUrl`

---

### 7.4 지표명별 목록조회

**URL**:

```
http://kosis.kr/openapi/indListSearchRequest.do?method=getList&service=4&serviceDetail=indList
```

| 파라미터    |  타입  | 설명                       | 필수 |
| :---------- | :----: | :------------------------- | :--: |
| `apiKey`    | String | 발급된 인증키              |  ✅  |
| `jipyoNm`   | String | 지표명                     |  ✅  |
| `pageNo`    | String | 페이지 번호                | 선택 |
| `numOfRows` | String | 데이터 출력 개수           | 선택 |
| `format`    | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content`   | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `statJipyoId`, `statJipyoNm`, `unit`, `areaTypeName`, `prdSeName`, `strtPrdDe`, `endPrdDe`, `m`, `prdDe`

---

### 7.5 고유번호별 목록조회

**URL**:

```
http://kosis.kr/openapi/indListSearchRequest.do?method=getList&service=4&serviceDetail=indList
```

| 파라미터    |  타입  | 설명                       | 필수 |
| :---------- | :----: | :------------------------- | :--: |
| `apiKey`    | String | 발급된 인증키              |  ✅  |
| `jipyoId`   | String | 지표ID                     |  ✅  |
| `pageNo`    | String | 페이지 번호                | 선택 |
| `numOfRows` | String | 데이터 출력 개수           | 선택 |
| `format`    | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content`   | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `statJipyoId`, `statJipyoNm`, `unit`, `areaTypeName`, `prdSeName`, `strtPrdDe`, `endPrdDe`, `m`, `prdDe`

---

### 7.6 고유번호별 지표 상세조회

**URL**:

```
http://kosis.kr/openapi/indIdDetailSearchRequest.do?method=getList&service=4&serviceDetail=indIdDetail
```

| 파라미터     |  타입  | 설명                       | 필수 |
| :----------- | :----: | :------------------------- | :--: |
| `apiKey`     | String | 발급된 인증키              |  ✅  |
| `jipyoId`    | String | 지표ID                     |  ✅  |
| `startPrdDe` | String | 조회 시작 시점             | 선택 |
| `endPrdDe`   | String | 조회 종료 시점             | 선택 |
| `rn`         | String | 조회 기준 시점             | 선택 |
| `srvRn`      | String | 조회 시점 개수             | 선택 |
| `pageNo`     | String | 페이지 번호                | 선택 |
| `numOfRows`  | String | 데이터 출력 개수           | 선택 |
| `format`     | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content`    | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `statJipyoId`, `statJipyoNm`, `prdSe` (수록주기), `prdDe` (시점), `itmNm` (항목), `val` (통계수치)

---

### 7.7 수록주기별 목록조회

**URL**:

```
http://kosis.kr/openapi/prListSearchRequest.do?method=getList&service=4&serviceDetail=prList
```

| 파라미터    |  타입  | 설명                       | 필수 |
| :---------- | :----: | :------------------------- | :--: |
| `apiKey`    | String | 발급된 인증키              |  ✅  |
| `prdSe`     | String | 수록주기                   |  ✅  |
| `pageNo`    | String | 페이지 번호                | 선택 |
| `numOfRows` | String | 데이터 출력 개수           | 선택 |
| `format`    | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content`   | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `statJipyoId`, `statJipyoNm`, `unit`, `areaTypeName`, `prdSeName`, `strtPrdDe`, `endPrdDe`, `m`, `prdDe`

---

### 7.8 지표명별 상세조회

**URL**:

```
http://kosis.kr/openapi/indDetailSearchRequest.do?method=getList&service=4&serviceDetail=indDetail
```

| 파라미터     |  타입  | 설명                       | 필수 |
| :----------- | :----: | :------------------------- | :--: |
| `apiKey`     | String | 발급된 인증키              |  ✅  |
| `jipyoNm`    | String | 지표명                     |  ✅  |
| `startPrdDe` | String | 조회 시작 시점             | 선택 |
| `endPrdDe`   | String | 조회 종료 시점             | 선택 |
| `rn`         | String | 조회 기준 시점             | 선택 |
| `srvRn`      | String | 조회 시점 개수             | 선택 |
| `pageNo`     | String | 페이지 번호                | 선택 |
| `numOfRows`  | String | 데이터 출력 개수           | 선택 |
| `format`     | String | 결과유형 (`json`, `xml`)   |  ✅  |
| `content`    | String | 헤더 유형 (`html`, `json`) | 선택 |

**출력**: `statJipyoId`, `statJipyoNm`, `prdSe`, `prdDe`, `itmNm`, `val`

---

## API URL 요약 테이블

|  #  | API 서비스               | URL                                                                                                      | 제공형태   |
| :-: | :----------------------- | :------------------------------------------------------------------------------------------------------- | :--------- |
|  1  | 통계목록                 | `http://kosis.kr/openapi/statisticsList.do`                                                              | JSON, SDMX |
|  2  | 통계자료                 | `http://kosis.kr/openapi/statisticsData.do`                                                              | JSON, SDMX |
|  3  | 대용량 통계자료          | `http://kosis.kr/openapi/statisticsBigData.do`                                                           | SDMX, XLS  |
|  4  | 통계설명                 | `http://kosis.kr/openapi/statisticsExplData.do`                                                          | JSON, XML  |
|  5  | 메타자료                 | `http://kosis.kr/openapi/statisticsData.do?method=getMeta`                                               | JSON, XML  |
|  6  | KOSIS 통합검색           | `http://kosis.kr/openapi/statisticsSearch.do?method=getList`                                             | JSON       |
| 7-1 | 지표 고유번호별 설명자료 | `http://kosis.kr/openapi/pkNumberService.do?method=getList&service=1&serviceDetail=pkAll`                | JSON, XML  |
| 7-2 | 지표명별 설명자료        | `http://kosis.kr/openapi/indExpService.do?method=getList&service=2&serviceDetail=indAll`                 | JSON, XML  |
| 7-3 | 목록별 지표조회          | `http://kosis.kr/openapi/indiListService.do?method=getList&service=3`                                    | JSON, XML  |
| 7-4 | 지표명별 목록조회        | `http://kosis.kr/openapi/indListSearchRequest.do?method=getList&service=4&serviceDetail=indList`         | JSON, XML  |
| 7-5 | 고유번호별 목록조회      | `http://kosis.kr/openapi/indListSearchRequest.do?method=getList&service=4&serviceDetail=indList`         | JSON, XML  |
| 7-6 | 고유번호별 지표 상세     | `http://kosis.kr/openapi/indIdDetailSearchRequest.do?method=getList&service=4&serviceDetail=indIdDetail` | JSON, XML  |
| 7-7 | 수록주기별 목록조회      | `http://kosis.kr/openapi/prListSearchRequest.do?method=getList&service=4&serviceDetail=prList`           | JSON, XML  |
| 7-8 | 지표명별 상세조회        | `http://kosis.kr/openapi/indDetailSearchRequest.do?method=getList&service=4&serviceDetail=indDetail`     | JSON, XML  |
