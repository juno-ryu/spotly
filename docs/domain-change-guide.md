# 도메인 변경 가이드

> 마지막 변경: 2026-03-25 | `spotly-beta.vercel.app` → `spotly.website`

---

## 1. 코드 변경

| 파일 | 변경 내용 |
|------|----------|
| `src/constants/site.ts` | `SITE_CONFIG.url`, `ogImage` URL 변경 |
| `src/app/(main)/page.tsx` | `canonical` URL 변경 |
| `src/app/layout.tsx` | 네이버 메타태그 (필요 시) |
| `public/sitemap.xml` | 정적 사이트맵 내 URL 일괄 치환 |
| `public/ads.txt` | 변경 불필요 (게시자 ID 기반) |

### 일괄 치환 명령어

```bash
# 코드 내 도메인 치환
grep -rl "OLD_DOMAIN" src/ public/sitemap.xml | xargs sed -i '' 's|OLD_DOMAIN|NEW_DOMAIN|g'

# 마케팅 문서 치환
sed -i '' 's|OLD_DOMAIN|NEW_DOMAIN|g' docs/naver-cafe-marketing.md docs/youtube-marketing.md docs/naver-blog-marketing.md docs/youtube-shorts-guide.md docs/dcinside-marketing.md docs/email-update-report-v2.html docs/email-template-feedback.html docs/apps-in-toss-deployment.md

# 잔여 확인
grep -r "OLD_DOMAIN" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.html" .
```

---

## 2. Vercel 설정

1. **Domains** → 새 도메인 추가 (Buy 또는 Add Existing)
2. **Domains** → 기존 도메인 Edit → **Redirect to Another Domain** → 308 Permanent Redirect → 새 도메인 선택 → Save
3. **Environment Variables** → 도메인 관련 변수 있으면 변경 (현재는 없음)

---

## 3. 외부 서비스 변경

### 카카오 개발자
- https://developers.kakao.com → 앱 → 플랫폼 키 → JavaScript SDK 도메인에 새 도메인 추가
- https://developers.kakao.com → 앱 → **제품 링크 관리** → 웹 도메인에 새 도메인 추가 (⚠️ 필수! 이게 빠지면 카카오톡 공유 버튼 클릭 시 지정 URL이 아닌 기본 도메인으로 이동됨)
- 기존 도메인은 남겨둬도 됨 (리다이렉트 호환)

### Supabase Auth
- https://supabase.com → Authentication → URL Configuration
- **Site URL** → 새 도메인으로 변경
- **Redirect URLs** → `https://NEW_DOMAIN/auth/callback` 추가

### Google Search Console
- https://search.google.com/search-console → 속성 추가 → 새 도메인
- 소유권 확인 (HTML 파일 또는 GA 방식)
- 사이트맵 `sitemap.xml` 제출

### Google Analytics
- https://analytics.google.com → 관리(⚙️) → 데이터 스트림 → 웹 스트림 → 스트림 URL 변경

### Google AdSense
- https://adsense.google.com → 사이트 → 사이트 추가 → 새 도메인
- `ads.txt` 확인 방식으로 소유권 인증 (이미 배포되어 있음)

### 카카오 애드핏
- https://adfit.kakao.com → 광고 단위 → 새 도메인으로 광고 단위 생성
- `.env`의 `NEXT_PUBLIC_KAKAO_ADFIT_UNIT_ID` 값을 새 광고 단위 ID로 변경
- Vercel 환경변수도 동일하게 변경

### 네이버 서치어드바이저
- https://searchadvisor.naver.com → 사이트 추가 → **https://** 로 등록 (http 아님!)
- 소유권 확인: `layout.tsx`에 메타태그 방식 권장
- robots.txt 수집요청
- 사이트맵 제출

---

## 4. 소유권 확인 파일 위치

| 서비스 | 파일/방식 |
|--------|----------|
| Google Search Console | `public/google352278890235e457.html` |
| Google AdSense | `public/ads.txt` |
| 네이버 서치어드바이저 | `src/app/layout.tsx` 메타태그 |

---

## 5. 체크리스트

- [ ] `src/constants/site.ts` URL 변경
- [ ] `src/app/(main)/page.tsx` canonical 변경
- [ ] `public/sitemap.xml` URL 치환
- [ ] 마케팅 문서 URL 일괄 치환
- [ ] 잔여 구 도메인 grep 확인 (0건)
- [ ] Vercel 새 도메인 추가
- [ ] Vercel 기존 도메인 → 308 리다이렉트
- [x] 카카오 개발자 SDK 도메인 추가
- [x] 카카오 개발자 제품 링크 관리 → 웹 도메인 추가
- [ ] Supabase Site URL + Redirect URL 변경
- [ ] Google Search Console 새 속성 + 사이트맵
- [ ] Google Analytics 스트림 URL 변경
- [ ] Google AdSense 사이트 추가
- [ ] 카카오 애드핏 새 광고 단위 생성 + `.env` ID 변경
- [ ] 네이버 서치어드바이저 사이트 추가 + 사이트맵
- [ ] 기존 도메인 접속 시 리다이렉트 확인
