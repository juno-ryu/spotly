# Plan: payment (토스페이먼츠 결제 연동)

> 작성일: 2026-03-15
> 레벨: Dynamic
> 상태: Plan 완료
> 연관: preview-redesign.plan.md Phase 2

---

## 1. 목표

분석 결과 미리보기 → AI 리포트 열람 시 **건당 결제**를 붙여 수익화한다.
토스페이먼츠 SDK를 사용하며, 서버 코드를 최소화한다.

### 핵심 원칙
- **최소 구현**: Server Action 1개 + DB 필드 추가 수준
- **건당 결제 MVP**: 구독/크레딧은 데이터 쌓인 후 판단
- **무료 체험 유지**: 환경변수 플래그로 결제 on/off 전환 가능

---

## 2. 현황 분석

### 현재 상태
- `/analyze/[id]/purchase/` 라우트: 마케팅 랜딩 껍데기만 존재
- `PurchaseClient`: "무료로 AI 분석 받기" 버튼 → 결제 없이 `generateReport()` 직접 호출
- `AnalysisRequest` 모델: 결제 관련 필드 없음
- package.json: 결제 SDK 의존성 없음
- 현재 텍스트: "지금은 무료 체험 기간입니다"

### 기존 UX 플로우
```
분석 완료 → /analyze/[id] (결과) → /analyze/[id]/purchase (구매 랜딩) → 무료로 AI 리포트 생성
```

### 목표 UX 플로우 (preview-redesign 연계)
```
분석 완료 → /analyze/[id] (미리보기) → 결제 CTA → 토스 결제창 → 결제 완료 → AI 리포트 생성 → /analyze/[id]/report
```

---

## 3. PG사 선정: 토스페이먼츠

### 선정 근거

| 항목 | 토스페이먼츠 | 비교 (포트원) |
|------|-------------|-------------|
| 개발 난이도 | ★☆☆ 쉬움 | ★★☆ 보통 |
| 문서 품질 | 최상 (한국어, 예제 풍부) | 좋음 |
| SDK | `@tosspayments/tosspayments-sdk` | `@portone/browser-sdk` |
| 카드 수수료 | ~3.3% | PG별 상이 |
| 간편결제 | 토스/카카오/네이버 통합 | PG별 별도 설정 |
| 테스트 모드 | 즉시 사용 가능 | 즉시 사용 가능 |
| 관리비 | 연 11만원 | 패키지 무료 |
| Next.js 연동 레퍼런스 | 많음 | 보통 |

### 지원 결제 수단
- 신용/체크카드
- 계좌이체
- 토스페이
- 카카오페이
- 네이버페이
- 휴대폰 결제

---

## 4. 결제 모델: 건당 결제 (Pay-Per-Use)

### 가격 전략

| 항목 | 값 | 근거 |
|------|-----|------|
| AI 리포트 1건 | 2,900 ~ 5,900원 | 소상공인 심리적 부담 최소, 커피 1잔 가격대 |
| 무료 체험 | 환경변수 플래그 | `PAYMENT_ENABLED=false` 시 기존처럼 무료 |

### MVP에서 건당 결제를 선택한 이유
- 소상공인은 "필요할 때만" 사용 경향
- 초기 사용자 확보에 구독 모델은 진입장벽
- 구현 복잡도 최소 (구독 관리, 크레딧 잔액 로직 불필요)
- 사용자 행동 데이터 수집 후 구독/크레딧 모델 추가 검토

---

## 5. 기술 설계

### 5-1. 결제 흐름

```
[클라이언트]                          [서버]                          [토스페이먼츠]
     │                                  │                                  │
     │  1. "결제하기" 버튼 클릭          │                                  │
     │──────────────────────────────────>│                                  │
     │  2. Server Action: 주문 생성      │                                  │
     │  (orderId, amount DB 저장)        │                                  │
     │<──────────────────────────────────│                                  │
     │  3. 토스 SDK 결제창 호출          │                                  │
     │─────────────────────────────────────────────────────────────────────>│
     │  4. 사용자 결제 진행              │                                  │
     │<─────────────────────────────────────────────────────────────────────│
     │  5. 성공 리다이렉트               │                                  │
     │  (paymentKey, orderId, amount)    │                                  │
     │──────────────────────────────────>│                                  │
     │                                  │  6. 결제 승인 API 호출             │
     │                                  │─────────────────────────────────>│
     │                                  │  7. 승인 결과 반환                │
     │                                  │<─────────────────────────────────│
     │                                  │  8. DB 업데이트 (isPaid=true)     │
     │  9. AI 리포트 생성 + 리다이렉트   │                                  │
     │<──────────────────────────────────│                                  │
```

### 5-2. 필요한 서버 코드 (최소)

| 파일 | 역할 | 예상 코드량 |
|------|------|-----------|
| `src/features/payment/actions.ts` | `createOrder()` + `confirmPayment()` Server Action | ~50줄 |
| `src/app/api/webhooks/toss/route.ts` | 결제 웹훅 수신 (선택, 안전장치) | ~30줄 |
| prisma 마이그레이션 | Payment 모델 추가 | ~20줄 |

### 5-3. DB 스키마 확장

```prisma
model Payment {
  id             String   @id @default(cuid())
  analysisId     String
  analysis       AnalysisRequest @relation(fields: [analysisId], references: [id])
  orderId        String   @unique    // 토스 주문번호
  paymentKey     String?  @unique    // 토스 결제키 (승인 후)
  amount         Int                 // 결제 금액 (원)
  status         PaymentStatus @default(PENDING)
  method         String?             // 카드, 계좌이체, 토스페이 등
  paidAt         DateTime?
  failReason     String?
  receiptUrl     String?             // 영수증 URL
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([analysisId])
  @@index([status])
}

enum PaymentStatus {
  PENDING      // 주문 생성됨
  PAID         // 결제 완료
  FAILED       // 결제 실패
  CANCELLED    // 취소됨
}
```

`AnalysisRequest`에 추가:
```prisma
model AnalysisRequest {
  // ... 기존 필드
  payments  Payment[]
}
```

### 5-4. 환경변수

```env
# 토스페이먼츠
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...   # 클라이언트 키 (공개)
TOSS_SECRET_KEY=test_sk_...                # 시크릿 키 (서버 전용)

# 결제 설정
PAYMENT_ENABLED=false                      # true로 변경 시 결제 활성화
PAYMENT_AMOUNT=4900                        # 건당 가격 (원)
```

### 5-5. 접근 제어 로직

```
/analyze/[id]/report 접근 시:
  1. PAYMENT_ENABLED === false → 무료 통과
  2. PAYMENT_ENABLED === true → Payment 테이블에서 PAID 상태 확인
  3. 결제 완료 → AI 리포트 표시
  4. 미결제 → /analyze/[id]/purchase로 리다이렉트
```

---

## 6. 프론트엔드 변경

### 수정 대상

| 파일 | 변경 내용 |
|------|---------|
| `src/app/(main)/analyze/[id]/purchase/` | 토스 SDK 결제창 호출 로직 추가 |
| `purchase-client.tsx` | "무료로 AI 분석 받기" → 결제 버튼으로 전환 (PAYMENT_ENABLED 분기) |
| 성공/실패 페이지 | 결제 승인 후 리다이렉트 처리 |

### 의존성 추가

```
npm install @tosspayments/tosspayments-sdk
```

---

## 7. 구현 순서

```
Phase 1: 기반 (1일)
  1. npm install @tosspayments/tosspayments-sdk
  2. Prisma: Payment 모델 + 마이그레이션
  3. 환경변수 설정 (테스트 키)
  4. Server Action: createOrder() + confirmPayment()

Phase 2: 프론트 연동 (0.5일)
  5. purchase-client.tsx: 토스 SDK 결제창 호출
  6. 성공 페이지: confirmPayment → AI 리포트 생성 → /report 리다이렉트
  7. 실패 페이지: 에러 메시지 + 재시도 버튼

Phase 3: 안전장치 (0.5일)
  8. 접근 제어: /report 페이지에서 결제 여부 확인
  9. 웹훅 핸들러 (선택): 결제 상태 동기화 보조
  10. PAYMENT_ENABLED 플래그 분기 확인
```

---

## 8. 성공 기준

| 항목 | 기준 |
|------|------|
| 테스트 결제 | 토스 테스트 모드에서 결제 → 승인 → DB 저장 정상 동작 |
| 결제 후 리포트 | 결제 완료 시 AI 리포트 자동 생성 + 표시 |
| 미결제 차단 | PAYMENT_ENABLED=true 시 미결제 사용자 /report 접근 차단 |
| 무료 모드 | PAYMENT_ENABLED=false 시 기존처럼 무료 동작 |
| 에러 처리 | 결제 실패/취소 시 사용자에게 명확한 안내 + 재시도 가능 |
| 영수증 | 결제 완료 시 토스 영수증 URL 저장 |

---

## 9. 리스크 및 고려사항

| 리스크 | 대응 |
|--------|------|
| 토스 테스트→실결제 전환 | 사업자 등록 후 심사 필요 (1~3일), 테스트 키로 개발 선행 |
| 결제 후 리포트 생성 실패 | Payment.status=PAID 유지, 리포트 재생성 버튼 제공 |
| 중복 결제 | orderId 유니크 제약 + 결제 전 기존 Payment 확인 |
| 환불 요청 | MVP에서는 수동 처리 (토스 대시보드), 추후 자동화 |
| 가격 변경 | PAYMENT_AMOUNT 환경변수로 코드 수정 없이 변경 가능 |
| preview-redesign과 순서 | 미리보기 화면 먼저 구현 후 결제 붙이는 것이 자연스러움 |

---

## 10. 향후 확장 (MVP 이후)

- **구독 모델**: 월정액 (분석 무제한 또는 N건)
- **크레딧 충전**: 10건 묶음 할인
- **쿠폰/프로모션**: 첫 결제 할인, 추천인 무료 1건
- **환불 자동화**: 토스 취소 API 연동
- **매출 대시보드**: 관리자용 결제 통계
