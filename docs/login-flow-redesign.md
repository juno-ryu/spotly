# 로그인 플로우 개편 계획

> 상태: 검토 중 (2026-03-19)

## 현재 플로우

```
웰컴 → 시작하기 → 로그인 페이지 → 업종 → 지역 → 지도+반경 → /analyze → 오버레이 → 리포트
```

- 로그인이 진입 장벽으로 작용
- 비로그인 사용자는 분석 결과를 볼 수 없음

## 제안 플로우

```
웰컴 → 시작하기 → 업종 → 지역 → 지도+반경 → /analyze → 오버레이 → "리포트 받기" 클릭
  ├─ 로그인됨 → 리포트 생성 → /report/[id]
  └─ 비로그인 → 팝업 로그인 → 리포트 생성 → /report/[id]
```

- 분석 결과까지는 로그인 없이 접근 가능
- 리포트 생성 시점에만 로그인 요구

## 팝업 로그인 방식 (채택 검토 중)

### 왜 팝업인가

| 방식 | 문제 |
|------|------|
| 리다이렉트 로그인 | OAuth 후 /analyze로 돌아오면 executeAnalysis 재실행 (8개 API 재호출, 패킷 낭비) |
| /auth/callback에서 바로 리포트 생성 | 서버 사이드 redirect라 로딩 UI 불가, 수 초~십 초 빈 화면 |
| **팝업 로그인** | 메인 페이지 JS 컨텍스트 유지, 분석 데이터 손실 없음, 재호출 없음 |

### 동작 원리

```
/analyze 페이지 (분석 데이터 + generateReport 함수 살아있음)
  └─ PurchaseOverlay (비교표 + "리포트 받기" 버튼)
      └─ 비로그인 감지 → 팝업(새 창) 열림
          └─ Google/Kakao OAuth → /auth/callback?popup=1 → 세션 교환 → 팝업 닫힘
      └─ 팝업 닫힘 감지 → generateReport() 실행 → /report/[id] 이동
```

### 구현 변경 목록

#### 1. `src/app/(main)/page.tsx` (HomePage)
- 로그인 여부 무관하게 `/industry`로 이동하도록 변경
- `if (user) redirect("/industry")` → 항상 WelcomePageClient 표시, "시작하기" → `/industry`

#### 2. `src/app/auth/callback/route.ts`
- `popup=1` 쿼리 파라미터 감지
- popup인 경우: redirect 대신 팝업 닫기 HTML 반환
  ```html
  <script>
    window.opener.postMessage('auth-complete', window.location.origin);
    window.close();
  </script>
  ```

#### 3. 팝업 로그인 유틸 (신규)
- 클라이언트 사이드 Supabase로 OAuth URL 생성 (`skipBrowserRedirect: true`)
- `redirectTo`에 `popup=1` 추가
- `window.open()`으로 팝업 열기
- `message` 이벤트 리스닝 → Promise resolve

#### 4. `src/features/analysis/components/purchase-overlay.tsx`
- "AI 리포트 무료로 받기" 버튼에 로그인 체크 추가
- 비로그인 → 팝업 로그인 → 성공 → `onGenerate` 호출
- 로그인됨 → 기존과 동일하게 `onGenerate` 호출

#### 5. `src/features/analysis/components/analysis-result.tsx`
- 로그인 여부를 PurchaseOverlay에 전달 (또는 PurchaseOverlay 내부에서 체크)

### 기술 참고

- 클라이언트 사이드 Supabase: `src/server/supabase/browser.ts` 존재
- 분석 데이터는 AnalysisResult 클라이언트 컴포넌트의 `data` prop으로 유지됨
- OAuth 팝업은 메인 페이지의 JS 상태에 영향 없음
- `AnalysisReport.userId`는 nullable이므로 DB 스키마 변경 불필요
