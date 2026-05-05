# GSC 수동 색인 요청 — 핸드오프 문서

## 한 줄 요약

`spotly.website` 도메인 속성에서 `/report/{id}` 페이지 62개에 대해 **GSC URL 검사 → 색인 생성 요청**을 1일 한도까지 순차 등록하는 작업. 1차 시도(2026-05-06 KST 00:30~00:43)에 7개 성공 후 할당량 초과로 중단. 다음 세션은 **#8부터 재개**한다.

---

## 다음 세션 즉시 실행 가이드

### Step 0 — 사전 조건

- 작업 시각이 **이전 차단 시각(2026-05-06 00:43 KST)으로부터 24시간 이상 경과**했는지 확인. (GSC 일일 할당량은 24시간 윈도우로 리셋되는 것으로 추정)
- Playwright MCP 사용 가능해야 함.
- DB(`DATABASE_URL`)는 추가 조회용으로만 필요. 작업 자체는 본 문서의 표만으로 진행 가능.

### Step 1 — 브라우저 열고 사용자 인증

```
mcp__playwright__browser_navigate("https://search.google.com/search-console?resource_id=sc-domain%3Aspotly.website")
```

> ⚠️ `resource_id=https://spotly.website/` (URL 접두어 형식)으로는 들어가면 안 된다. 이 형식은 **별도 미인증 속성**으로 잡혀 "이 속성에 액세스할 수 없습니다" 페이지가 뜬다. 반드시 `sc-domain:spotly.website` (도메인 속성).

페이지 제목이 "개요"로 뜨면 정상 진입. 다른 계정으로 로그인돼 있어 차단되면 사용자에게 "spotly.website 속성 소유자 계정으로 로그인해 달라"고 요청한 뒤 사용자 응답 대기.

### Step 2 — 다음 처리할 항목 확인

아래 **진행 상태 표**에서 가장 작은 # 중 상태가 `⏳ 대기` 또는 `⛔ 할당량 초과`인 행을 찾는다. 1차 시도 종료 시점 기준으로는 **#8 `cmnpywpzx0001la0458hi0g77`** (인천 부평구 부개동 465-12 꽃집)부터 시작.

### Step 3 — 단일 URL 처리 루틴 (per-item)

각 리포트마다 아래 4단계를 순서대로 실행:

#### 3-1. URL 검색바에 보고서 URL 입력

```
mcp__playwright__browser_type({
  target: 'input[aria-label="에 있는 모든 URL 검사"]',
  text: 'https://spotly.website/report/<REPORT_ID>',
  submit: true
})
```

> 기본 `aria-label`이 안 잡히면 `mcp__playwright__browser_snapshot`으로 ref 다시 확인 후 그 ref 사용.

#### 3-2. 검사 결과 로딩 대기

```
mcp__playwright__browser_evaluate({
  function: `() => new Promise(resolve => {
    const target = '<REPORT_ID>';
    const start = Date.now();
    const tick = () => {
      const text = document.body.innerText;
      if ((text.includes('URL이 Google에 등록') && text.includes(target)) || Date.now() - start > 60000) {
        resolve({ ready: text.includes(target), elapsed: Date.now() - start });
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  })`
})
```

`ready: true` 떨어지면 다음 단계로.

#### 3-3. "색인 생성 요청" 버튼 클릭

```
mcp__playwright__browser_click({
  element: "색인 생성 요청 버튼",
  target: 'role=button[name="색인 생성 요청다시 요청"]'
})
```

> 버튼의 accessibility name은 `"색인 생성 요청다시 요청"` (두 개 span 텍스트 결합). Playwright role-name 셀렉터로 안정 동작 확인됨. 순수 JS `document.querySelectorAll('button')`로는 못 잡히는 경우 있음.

#### 3-4. 결과 다이얼로그 판별 (성공 or 할당량 초과)

```
mcp__playwright__browser_evaluate({
  function: `() => new Promise(resolve => {
    const start = Date.now();
    const tick = () => {
      const text = document.body.innerText;
      if (text.includes('우선순위 크롤링 대기열') || text.includes('할당량') || Date.now() - start > 60000) {
        resolve({
          requested: text.includes('우선순위 크롤링 대기열'),
          quota: text.includes('할당량'),
          elapsed: Date.now() - start
        });
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  })`
})
```

판정:
- `requested: true` → 본 문서 표에서 해당 행 상태를 **`✅ 요청됨`** 으로 업데이트
- `quota: true` → 해당 행 상태를 **`⛔ 할당량 초과`** 로 업데이트한 뒤 **즉시 작업 중단**. Step 4로.

다이얼로그 닫기:

```
mcp__playwright__browser_press_key({ key: "Escape" })
```

#### 3-5. 다음 항목으로 이동

표의 다음 `⏳ 대기` 행으로 가서 3-1부터 반복.

### Step 4 — 종료 처리

- 할당량 초과 시: 화면 스크린샷 1장 저장 (`docs/gsc-quota-exceeded-{YYYY-MM-DD}.png`), 본 문서 하단 "시도 이력"에 새 항목 추가.
- 모든 행이 `✅`이면 작업 완료. 본 문서 상단 "한 줄 요약" 갱신하고 "시도 이력"에 완료 줄 추가.

---

## 작업 컨텍스트 (왜 이걸 하는가)

- spotly.website는 출시 이후 **수개월간 sitemap이 GSC에 정상 등록된 적이 없었음**. 최근 sitemap을 동적 metadata route로 재구성하고 최신 20개 리포트만 노출하도록 정리(커밋 `ac4a2f5`, `e9cab89` 등). 그러나 이미 4월 7일 이후 생성된 리포트 다수가 sitemap에서 제외돼 자동 색인 경로가 끊긴 상태.
- 외부 백링크가 거의 없어(네이버 위주) 자연 발견 경로도 부족.
- 따라서 **GSC 수동 URL 검사 → 색인 생성 요청**으로 우선순위 큐에 직접 밀어넣는 작업이 필요.
- 직전 색인 등록된 마지막 URL: `https://spotly.website/report/cmnofhrxj0004ju04lf5tn4qy` (2026-04-07T09:40:15.653Z). 이 시점 이후 생성된 62개가 본 작업 대상.

---

## 시도 이력

### 1차: 2026-05-06 00:30~00:43 KST

- 도구: Claude Code (Playwright MCP)
- 결과: ✅ 7개 성공 (#1~#7), ⛔ #8에서 할당량 초과 차단
- GSC 메시지: *"일일 할당량을 초과하여 이 요청을 처리할 수 없습니다. 내일 다시 제출해 주세요."*
- 차단 화면: `docs/gsc-quota-exceeded.png`
- 관찰: GSC 일일 한도가 통상 알려진 10~12회보다 낮은 **7회**에서 차단됐음. 다음 시도 시에도 7~12회 사이에서 차단될 가능성 큼.

---

## 진행 상태

> 한 행 처리할 때마다 상태 컬럼만 갱신하면 됨. **이 표가 단일 진실 소스(SSOT)** 다.

| # | Report ID | 주소 | 업종 | 생성일 | 상태 |
|---|-----------|------|------|--------|------|
| 1 | `cmnofn0l10005ju04ndq0l3y5` | 서울특별시 중구 다산로39길 32-5 | 한식음식점 | 2026-04-07T09:44 | ✅ 요청됨 |
| 2 | `cmnogqeqq0000jf04vbdb86m7` | 경기도 남양주시 다산순환로 397-134 | 한식음식점 | 2026-04-07T10:14 | ✅ 요청됨 |
| 3 | `cmnpfndbz0000jp04cblhomz9` | 서울특별시 서초구 동산로 60 | 커피전문점 | 2026-04-08T02:32 | ✅ 요청됨 |
| 4 | `cmnpovd780000i604zbe4268t` | 서울특별시 용산구 한강대로 95 | 한식음식점 | 2026-04-08T06:50 | ✅ 요청됨 |
| 5 | `cmnptbxc20000jo04njfiipd4` | 인천광역시 부평구 시장로 24 | 한식음식점 | 2026-04-08T08:55 | ✅ 요청됨 |
| 6 | `cmnpw7kee0000la04fs93c4z4` | 서울특별시 노원구 노해로 508 | 중식음식점 | 2026-04-08T10:15 | ✅ 요청됨 |
| 7 | `cmnpyt5ol0000la04tt48qoxa` | 인천 부평구 부평동 207-70 | 꽃집 | 2026-04-08T11:28 | ✅ 요청됨 |
| 8 | `cmnpywpzx0001la0458hi0g77` | 인천 부평구 부개동 465-12 | 꽃집 | 2026-04-08T11:31 | ⛔ 할당량 초과 |
| 9 | `cmnpz3irg0000ib042byz0rml` | 서울 강서구 마곡동 727-1471 | 꽃집 | 2026-04-08T11:36 | ⏳ 대기 |
| 10 | `cmnpz9udb0001ib044fnkg2rm` | 서울 강서구 내발산동 724-15 | 꽃집 | 2026-04-08T11:41 | ⏳ 대기 |
| 11 | `cmnpzcv3m0002ib04o8cciqh8` | 서울 강서구 마곡동 788-5 | 꽃집 | 2026-04-08T11:44 | ⏳ 대기 |
| 12 | `cmnpzkgzu0003ib04btzmn0na` | 서울특별시 강서구 공항대로 237 | 꽃집 | 2026-04-08T11:49 | ⏳ 대기 |
| 13 | `cmnpzotvy0004ib04ij3mku31` | 서울 마포구 성산동 274-33 | 꽃집 | 2026-04-08T11:53 | ⏳ 대기 |
| 14 | `cmnpzt07d0000la04h1oeajxs` | 인천광역시 부평구 부평문화로 64 | 꽃집 | 2026-04-08T11:56 | ⏳ 대기 |
| 15 | `cmnq02xtf0005ib04ukcml6pp` | 서울 영등포구 문래동3가 60-2 | 꽃집 | 2026-04-08T12:04 | ⏳ 대기 |
| 16 | `cmnq0jenm0000ih04trlta997` | 서울특별시 마포구 백범로 139 | 꽃집 | 2026-04-08T12:17 | ⏳ 대기 |
| 17 | `cmnqnccdw0000i9043hz64mrs` | 경기도 고양시 덕양구 일영로 139-14 | 중식음식점 | 2026-04-08T22:55 | ⏳ 대기 |
| 18 | `cmnqnglvo0001i904fdp4p7j2` | 경기도 고양시 덕양구 동송로 30 | 중식음식점 | 2026-04-08T22:58 | ⏳ 대기 |
| 19 | `cmnrl7pgf0000l404bdef5p5j` | 서울특별시 성북구 삼선교로23길 3 | 한식음식점 | 2026-04-09T14:43 | ⏳ 대기 |
| 20 | `cmnrlbqwa0001l404kkrlizl0` | 서울 성북구 삼선동4가 340-1 | 일반유흥주점 | 2026-04-09T14:46 | ⏳ 대기 |
| 21 | `cmns8opih0000la04d81r5qu0` | 인천광역시 부평구 경원대로 1385 | 한식음식점 | 2026-04-10T01:40 | ⏳ 대기 |
| 22 | `cmns976wk0000lb04pjzahpjp` | 인천광역시 부평구 부평문화로 51-1 | 한식음식점 | 2026-04-10T01:55 | ⏳ 대기 |
| 23 | `cmnsxmesd0000l7048ab1ykqc` | 서울 성북구 동선동1가 85-1 | 한식음식점 | 2026-04-10T13:18 | ⏳ 대기 |
| 24 | `cmnt0wh6d0000l204zt57dpkk` | 서울특별시 성동구 무학로2길 17 | 한식음식점 | 2026-04-10T14:50 | ⏳ 대기 |
| 25 | `cmnt13j5x0001l204x0epzbm2` | 서울 성동구 행당동 298-86 | 한식음식점 | 2026-04-10T14:56 | ⏳ 대기 |
| 26 | `cmnt1arwz0002l204oepmv1am` | 서울 중구 신당동 50-24 | 한식음식점 | 2026-04-10T15:01 | ⏳ 대기 |
| 27 | `cmnudzbh00000k104ksa36d67` | 경기 파주시 탄현면 법흥리 497-95 | 한식음식점 | 2026-04-11T13:44 | ⏳ 대기 |
| 28 | `cmnufx0xp0000kw04p7ekdask` | 경기 평택시 고덕동 2519 | 기타음식점 | 2026-04-11T14:38 | ⏳ 대기 |
| 29 | `cmnugffqt0000ks04kyg5hum0` | 인천 부평구 십정동 529-5 | 기타음식점 | 2026-04-11T14:53 | ⏳ 대기 |
| 30 | `cmnugioyg0001ks04xzjkhsox` | 인천 서구 석남동 617 | 기타음식점 | 2026-04-11T14:55 | ⏳ 대기 |
| 31 | `cmnveri170000jm04bftrdvwv` | 경기 평택시 고덕동 2519 | 기타음식점 | 2026-04-12T06:54 | ⏳ 대기 |
| 32 | `cmnvlap8o0000l804sh8wmx1q` | 경기 평택시 평택동 291-1 | 기타음식점 | 2026-04-12T09:57 | ⏳ 대기 |
| 33 | `cmnwgp1qv0000l804f7e04kwz` | 서울 광진구 군자동 79-2 | 한식음식점 | 2026-04-13T00:36 | ⏳ 대기 |
| 34 | `cmnwh76t20000jp04e53akhtk` | 서울특별시 성동구 아차산로7가길 33 | 한식음식점 | 2026-04-13T00:50 | ⏳ 대기 |
| 35 | `cmnwwj1ca0000jp045a383pmy` | 서울 광진구 자양동 223-18 | 한식음식점 | 2026-04-13T07:59 | ⏳ 대기 |
| 36 | `cmnwwl3yz0001jp041vbo7mx5` | 서울특별시 광진구 아차산로 325 | 일반유흥주점 | 2026-04-13T08:00 | ⏳ 대기 |
| 37 | `cmny2vriv0000l5049j4ltfgg` | 서울 광진구 구의동 243-7 | 한식음식점 | 2026-04-14T03:44 | ⏳ 대기 |
| 38 | `cmny30nwm0001l504v4fmn9wj` | 서울 성동구 성수동1가 656-853 | 한식음식점 | 2026-04-14T03:48 | ⏳ 대기 |
| 39 | `cmny95ezm0000jx04iot6irdq` | 서울 동대문구 답십리동 528 | 한식음식점 | 2026-04-14T06:40 | ⏳ 대기 |
| 40 | `cmny988ir0001jx04qfqjf23p` | 서울특별시 동대문구 황물로 150 | 한식음식점 | 2026-04-14T06:42 | ⏳ 대기 |
| 41 | `cmo0cnlny0000ld04zbvjsw6z` | 경기 평택시 평택동 300 | 일반유흥주점 | 2026-04-15T17:54 | ⏳ 대기 |
| 42 | `cmo0gsqwq0000ji04icgcsyku` | 경기 평택시 합정동 732-12 | 일반유흥주점 | 2026-04-15T19:50 | ⏳ 대기 |
| 43 | `cmo0h0lp50001ji04vkxh1t9e` | 인천 남동구 구월동 1409-25 | 일반유흥주점 | 2026-04-15T19:56 | ⏳ 대기 |
| 44 | `cmo0h3sp80002ji042phtv298` | 경기 화성시 동탄구 반송동 233-3 | 일반유흥주점 | 2026-04-15T19:58 | ⏳ 대기 |
| 45 | `cmo2t4qq60000l504h6sfw5ww` | 경기도 평택시 평택2로20번길 15 | 일반유흥주점 | 2026-04-17T11:10 | ⏳ 대기 |
| 46 | `cmo620svd0000k3040fec0i8p` | 울산광역시 울주군 청량읍 삼정로 816 | 일반유흥주점 | 2026-04-19T17:42 | ⏳ 대기 |
| 47 | `cmo8n28ug0000kt04d6cqebtf` | 인천 남동구 구월동 1409-31 | 중식음식점 | 2026-04-21T13:07 | ⏳ 대기 |
| 48 | `cmo8n359o0001kt048uiyeqt7` | 인천 남동구 구월동 1409-31 | 중식음식점 | 2026-04-21T13:08 | ⏳ 대기 |
| 49 | `cmo8n8fdl0002kt04k93myg67` | 인천 남동구 구월동 1589 | 중식음식점 | 2026-04-21T13:12 | ⏳ 대기 |
| 50 | `cmo9gdw1o0000ji04s5a5bnit` | 인천 부평구 부개동 64-35 | 분식전문점 | 2026-04-22T02:48 | ⏳ 대기 |
| 51 | `cmofw0kg10000jv04m4llsz1s` | 인천광역시 남동구 미래로 6 | 기타음식점 | 2026-04-26T14:52 | ⏳ 대기 |
| 52 | `cmofwuxqk0000l5047bpbtnpi` | 서울특별시 서초구 서초대로42길 96 | 커피전문점 | 2026-04-26T15:16 | ⏳ 대기 |
| 53 | `cmogysx020000jp04t7o4p4yt` | 인천광역시 남동구 미래로 6 | 일식음식점 | 2026-04-27T08:58 | ⏳ 대기 |
| 54 | `cmoh41p7o0000la04kqwoen3v` | 서울특별시 서초구 서초대로 114-15 | 한식음식점 | 2026-04-27T11:25 | ⏳ 대기 |
| 55 | `cmoj84ssb0000l504zmhakwez` | 인천광역시 연수구 하모니로 158 | PC방 | 2026-04-28T22:55 | ⏳ 대기 |
| 56 | `cmoj888ij0001l504ltoty7ux` | 인천광역시 연수구 하모니로 158 | PC방 | 2026-04-28T22:57 | ⏳ 대기 |
| 57 | `cmoj8ep3b0002l504cgtpjjft` | 인천 남동구 구월동 1409-25 | PC방 | 2026-04-28T23:02 | ⏳ 대기 |
| 58 | `cmoj8h58t0000l504borbo1bm` | 인천광역시 연수구 하모니로 158 | PC방 | 2026-04-28T23:04 | ⏳ 대기 |
| 59 | `cmoj8jsbe0001l504zozchijk` | 경기 안산시 단원구 고잔동 541-1 | PC방 | 2026-04-28T23:06 | ⏳ 대기 |
| 60 | `cmop938b00000jo04dgvnm2gz` | 서울 종로구 창신동 263-3 | 한식음식점 | 2026-05-03T04:08 | ⏳ 대기 |
| 61 | `cmop97uc30001jo04idume1al` | 서울특별시 광진구 면목로 92 | 한식음식점 | 2026-05-03T04:12 | ⏳ 대기 |
| 62 | `cmop9ekd90002jo04zbyqgosg` | 서울특별시 종로구 종로44길 92 | 한식음식점 | 2026-05-03T04:17 | ⏳ 대기 |

---

## 부록 — DB에서 신규 리포트 추가 발견 시

본 작업이 끝나기 전에 새 리포트가 더 생기면, 아래 스니펫으로 표 하단에 row 추가:

```typescript
// 프로젝트 루트에 임시 파일로 저장 후 npx tsx <파일> 실행
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  // 마지막으로 표에 들어간 createdAt 이후만 가져오기
  const after = new Date('2026-05-03T04:17:16.697Z');
  const rows = await prisma.analysisReport.findMany({
    where: { createdAt: { gt: after } },
    select: { id: true, createdAt: true, address: true, industryName: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(rows.map(r => `| - | \`${r.id}\` | ${r.address} | ${r.industryName} | ${r.createdAt.toISOString().slice(0, 16)} | ⏳ 대기 |`).join('\n'));
  await prisma.$disconnect();
})();
```

> 단, 본 작업은 **2026-04-07 컷오프 이후~2026-05-06 작업 시작 시점까지의 62개**가 SSOT임. 새 리포트는 sitemap.xml(최신 20개)이 자동 처리하도록 두는 것이 정상 흐름이고, 수동 색인은 sitemap이 놓친 과거분 보완용임을 잊지 말 것.

---

## 주의 사항

- **속성 형식 오인 금지**: `sc-domain:spotly.website` 만 사용. `https://spotly.website/` (URL prefix 형식)은 별개 미인증 속성으로 잡혀 들어가지 않음.
- **버튼 클릭 셀렉터**: 반드시 `role=button[name="색인 생성 요청다시 요청"]` 사용. 순수 JS `querySelectorAll('button')`+textContent 매칭은 빈 결과 나오는 경우 있음.
- **할당량 신호**: `body.innerText`에 `"할당량"` 포함되면 즉시 중단. 추가 시도해도 모두 실패하고 시간만 낭비됨.
- **사이트맵과의 관계**: 사이트맵 자동 색인 ≠ 수동 색인 요청. 수동 색인은 우선순위 큐에 한 번 넣을 뿐, 실제 색인 보장은 아님. 그래도 sitemap 외 경로가 끊긴 과거분에는 유의미함.
