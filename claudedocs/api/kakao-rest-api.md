# Kakao REST API 연동 가이드

> **소상공인 창업 분석기** 프로젝트용 — Kakao 로컬(Local) API 정리
> 작성일: 2026-02-08

---

## 1. 개요

Kakao REST API의 **로컬(Local)** 서비스를 활용하여 사용자가 입력한 주소를 좌표로 변환하고, 좌표에서 법정동코드를 추출합니다. 이 법정동코드(시군구코드 5자리)가 NPS, 부동산, KOSIS 등 모든 후속 API 호출의 기준값이 됩니다.

### 우리 서비스에서 활용할 API

| 기능 | Kakao API | 용도 |
|:-----|:----------|:-----|
| 주소 → 좌표 | 주소 검색 (address) | 사용자 입력 주소를 위경도로 변환 |
| 좌표 → 법정동코드 | 좌표→행정구역 (coord2regioncode) | 위경도에서 시군구코드 추출 |
| 주변 장소 검색 | 키워드 검색 (keyword) | 반경 내 동일 업종 검색 (보조) |

---

## 2. 인증

### 2.1 API 키 발급

1. [Kakao Developers](https://developers.kakao.com) 로그인
2. **내 애플리케이션** → 앱 생성
3. **앱 키** 탭에서 **REST API 키** 복사

### 2.2 환경변수

| 변수명 | 용도 | 없으면 |
|:-------|:-----|:-------|
| `KAKAO_REST_API_KEY` | 서버 전용 REST API 키 | 강남구 역삼동 기본 좌표로 모킹 |
| `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` | 클라이언트 지도 SDK JavaScript 키 | 지도 비활성 |

### 2.3 인증 헤더

```
Authorization: KakaoAK {REST_API_KEY}
```

> **주의**: `KakaoAK ` 접두사 뒤에 공백이 있음. `Bearer`가 아님!

---

## 3. API 상세

### Base URL

```
https://dapi.kakao.com/v2/local
```

### 3.1 주소 검색 (주소 → 좌표)

| 항목 | 내용 |
|:-----|:-----|
| **엔드포인트** | `/search/address.json` |
| **메서드** | GET |

**요청 파라미터**

| 파라미터 | 필수 | 설명 | 예시 |
|:---------|:----:|:-----|:-----|
| `query` | O | 검색할 주소 문자열 | `서울 강남구 역삼동 123` |

**curl 테스트**

```bash
curl -s -H "Authorization: KakaoAK ${KAKAO_REST_API_KEY}" \
  "https://dapi.kakao.com/v2/local/search/address.json?query=서울+강남구+역삼동"
```

**응답 예시**

```json
{
  "meta": { "total_count": 1, "pageable_count": 1, "is_end": true },
  "documents": [
    {
      "address_name": "서울 강남구 역삼동",
      "x": "127.0276",
      "y": "37.4979",
      "address_type": "REGION_ADDR",
      "address": { ... },
      "road_address": { ... }
    }
  ]
}
```

**주요 응답 필드**

| 필드 | 설명 | 활용 |
|:-----|:-----|:-----|
| `x` | 경도 (longitude) | 좌표 |
| `y` | 위도 (latitude) | 좌표 |
| `address_name` | 전체 주소 | 표시 |

> **좌표 주의**: Kakao는 `x`=경도, `y`=위도 (일반적인 lat/lng 순서와 반대!)

---

### 3.2 좌표 → 행정구역 (법정동코드 변환) ⭐ 핵심 API

| 항목 | 내용 |
|:-----|:-----|
| **엔드포인트** | `/geo/coord2regioncode.json` |
| **메서드** | GET |

**요청 파라미터**

| 파라미터 | 필수 | 설명 | 예시 |
|:---------|:----:|:-----|:-----|
| `x` | O | 경도 (longitude) | `127.0276` |
| `y` | O | 위도 (latitude) | `37.4979` |

**curl 테스트**

```bash
curl -s -H "Authorization: KakaoAK ${KAKAO_REST_API_KEY}" \
  "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=127.0276&y=37.4979"
```

**응답 예시**

```json
{
  "meta": { "total_count": 2 },
  "documents": [
    {
      "region_type": "B",
      "code": "1168010100",
      "address_name": "서울특별시 강남구 역삼1동",
      "region_1depth_name": "서울특별시",
      "region_2depth_name": "강남구",
      "region_3depth_name": "역삼1동",
      "x": 127.03,
      "y": 37.49
    },
    {
      "region_type": "H",
      "code": "1168053000",
      "address_name": "서울특별시 강남구 역삼1동",
      "region_1depth_name": "서울특별시",
      "region_2depth_name": "강남구",
      "region_3depth_name": "역삼1동",
      "x": 127.03,
      "y": 37.49
    }
  ]
}
```

**주요 응답 필드**

| 필드 | 설명 | 활용 |
|:-----|:-----|:-----|
| `region_type` | `B`=법정동, `H`=행정동 | **`B` 우선 사용** |
| `code` | 법정동 코드 (10자리) | 앞 5자리 = 시군구코드 |
| `region_1depth_name` | 시/도 | 표시 |
| `region_2depth_name` | 시/군/구 | 표시 |
| `region_3depth_name` | 읍/면/동 | 표시 |

**시군구코드 추출 로직**:

```typescript
// code: "1168010100" (10자리 법정동코드)
const districtCode = code.substring(0, 5); // "11680" (강남구)
// → NPS: 시도 "11" + 시군구 "680"
// → 부동산: LAWD_CD "11680"
// → KOSIS: objL1 "11680"
// → 서울 판별: startsWith("11") → 골목상권 API 호출
```

> **중요**: `documents`에 `B`(법정동)와 `H`(행정동) 2개가 반환됩니다. **법정동(B)을 우선 사용**하세요. 행정동은 법정동과 코드 체계가 다릅니다.

---

### 3.3 키워드 장소 검색

| 항목 | 내용 |
|:-----|:-----|
| **엔드포인트** | `/search/keyword.json` |
| **메서드** | GET |

**요청 파라미터**

| 파라미터 | 필수 | 설명 | 예시 |
|:---------|:----:|:-----|:-----|
| `query` | O | 검색 키워드 | `강남역 치킨` |
| `x` | | 중심 경도 | `127.0276` |
| `y` | | 중심 위도 | `37.4979` |
| `radius` | | 검색 반경 (미터, 최대 20000) | `1000` |

**curl 테스트**

```bash
curl -s -H "Authorization: KakaoAK ${KAKAO_REST_API_KEY}" \
  "https://dapi.kakao.com/v2/local/search/keyword.json?query=치킨&x=127.0276&y=37.4979&radius=1000"
```

**주요 응답 필드**

| 필드 | 설명 |
|:-----|:-----|
| `place_name` | 장소명 |
| `address_name` | 주소 |
| `x` / `y` | 경도/위도 |
| `category_name` | 카테고리 (예: `음식점 > 치킨`) |

---

## 4. 공통 응답 래퍼

```typescript
// src/server/data-sources/types.ts
interface KakaoResponse<T> {
  meta: {
    total_count: number;
    pageable_count?: number;
    is_end?: boolean;
  };
  documents: T[];
}
```

---

## 5. 에러 처리

| HTTP 상태 | 의미 | 대응 |
|:----------|:-----|:-----|
| 200 | 정상 (결과 0건도 200) | `documents` 배열 길이 확인 |
| 401 | 인증키 오류 | `KAKAO_REST_API_KEY` 확인 |
| 429 | 일일 쿼터 초과 | 다음날 재시도 또는 키 재발급 |

> Kakao API는 결과가 0건이어도 HTTP 200을 반환합니다. `documents` 배열이 비어있는지 확인해야 합니다.

---

## 6. Graceful Degradation (Mock 모드)

`KAKAO_REST_API_KEY`가 없으면 아래 기본값으로 모킹:

```typescript
// 주소 → 좌표: 강남구 역삼동 기본 좌표
{ latitude: 37.4979, longitude: 127.0276 }

// 좌표 → 법정동: 강남구 역삼동 기본 정보
{
  code: "1168010100",
  region1: "서울특별시",
  region2: "강남구",
  region3: "역삼동",
  districtCode: "11680",
}

// 키워드 검색: 빈 배열
[]
```

---

## 7. 구현 파일

| 파일 | 용도 |
|:-----|:-----|
| `src/server/data-sources/kakao-geocoding.ts` | Kakao REST API 클라이언트 (지오코딩/장소검색) |
| `src/server/data-sources/types.ts` | `KakaoResponse<T>`, `Coordinate`, `RegionInfo` 공통 타입 |
| `src/lib/env.ts` | `KAKAO_REST_API_KEY` 환경변수 + `hasApiKey.kakaoRest` 헬퍼 |
| `src/app/api/geocode/route.ts` | 클라이언트 → 서버 지오코딩 프록시 API Route |

---

## 8. 세션 시작 시 API 상태 확인

```bash
curl -s -H "Authorization: KakaoAK ${KAKAO_REST_API_KEY}" \
  "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=127.0276&y=37.4979"
```

- 성공: HTTP 200, `documents` 배열에 지역 정보 포함
- 실패: 401 → API 키 확인

---

## 9. Kakao Maps JavaScript SDK 트러블슈팅

### 9.1 Projection 메서드명 주의 (2026-02-15 발견)

`map.getProjection()`으로 얻는 Projection 객체의 메서드명이 다른 지도 라이브러리와 다름.

| 용도 | ❌ 잘못된 이름 | ✅ 올바른 이름 |
|:-----|:-------------|:-------------|
| 화면좌표 → 지도좌표 | `containerPointToCoord()` | `coordsFromContainerPoint()` |
| 지도좌표 → 화면좌표 | `coordToContainerPoint()` | `containerPointFromCoords()` |
| 절대좌표 → 지도좌표 | - | `coordsFromPoint()` |
| 지도좌표 → 절대좌표 | - | `pointFromCoords()` |

**Projection 전체 메서드 목록** (실측 확인):
- `pointFromCoords(latlng)` — LatLng → 절대 Point
- `coordsFromPoint(point)` — 절대 Point → LatLng
- `containerPointFromCoords(latlng)` — LatLng → 컨테이너 내 Point
- `coordsFromContainerPoint(point)` — 컨테이너 내 Point → LatLng

### 9.2 CustomOverlay 드래그 구현 시 필수 사항

카카오맵의 CustomOverlay는 네이티브 드래그를 지원하지 않음. 직접 구현 시 반드시 아래 사항 준수:

1. **`kakao.maps.event.preventMap()`** — mousedown/touchstart 핸들러에서 반드시 호출. 미호출 시 지도 패닝이 이벤트를 가로챔.
2. **React Strict Mode 대응** — useEffect cleanup에서 `mapRef.current = null` 등 refs 초기화 필요. 미초기화 시 double-mount에서 이벤트 리스너가 소실됨.
3. **mousemove/mouseup은 `document`에 등록** — overlay 요소가 아닌 document에 등록해야 드래그 중 포인터가 요소를 벗어나도 추적 가능.

**공식 샘플**: https://apis.map.kakao.com/web/sample/dragCustomOverlay/

### 9.3 Circle 객체 제한사항

- `draggable` 옵션 없음 (Marker와 달리)
- 지원 이벤트: `mouseover`, `mouseout`, `mousemove`, `mousedown`, `click` (drag 계열 없음)
- 반경 드래그 변경은 CustomOverlay 핸들 + 수동 계산으로 구현해야 함

---

## 10. 참고 링크

| 리소스 | URL |
|:-------|:----|
| Kakao Developers | https://developers.kakao.com |
| 로컬 API 문서 | https://developers.kakao.com/docs/latest/ko/local/dev-guide |
| 주소 검색 API | https://developers.kakao.com/docs/latest/ko/local/dev-guide#address-coord |
| 좌표→행정구역 API | https://developers.kakao.com/docs/latest/ko/local/dev-guide#coord-to-district |
| 키워드 검색 API | https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword |
