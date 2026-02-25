# 리샬 직접 코딩 가이드 (Gemini CLI)

> 이 가이드는 Gemini CLI로 QA/CSAT 코드를 직접 수정하는 방법입니다.
> 환경 설정이 완료된 상태를 전제합니다 (setup-dev.sh 실행 완료).

---

## 0. 작업 전 체크리스트

```bash
# 1. 프로젝트 폴더로 이동
cd ~/Desktop/AI\ 자동화\ 구축\ 모음/kmcc-qc-dashbord

# 2. 최신 코드 받기 (반드시!)
git pull origin main

# 3. 내 브랜치 만들기
git checkout -b feature/리샬-qa-수정사항

# 4. 의존성 설치 확인
npm install

# 5. 로컬 서버 실행 (수정 결과 확인용)
npm run dev
# → http://localhost:3000 에서 확인
```

---

## 1. QA/CSAT 관련 파일 지도

### 수정해도 되는 파일 (리샬 담당)

| 파일 | 역할 | 수정 빈도 |
|------|------|-----------|
| `lib/constants.ts` | QA 항목, 등급, CSAT 목표, 가중치 등 상수 | **자주** |
| `lib/bigquery-qa.ts` | QA BigQuery 쿼리 | 가끔 |
| `lib/bigquery-csat.ts` | CSAT BigQuery 쿼리 + 서비스 매핑 | 가끔 |
| `components/qc/qa-dashboard/*` | QA 대시보드 UI (6개 컴포넌트) | 가끔 |
| `components/qc/csat-dashboard/*` | CSAT 대시보드 UI (7개 컴포넌트) | 가끔 |
| `hooks/use-qa-dashboard-data.ts` | QA 데이터 페칭 hook | 드물게 |
| `lib/qa-sheets.ts` | QA Google Sheets 파서 | 드물게 |

### 건드리면 안 되는 파일 (메이/공통 관리)

| 파일 | 이유 |
|------|------|
| `lib/bigquery.ts` | BigQuery 연결 공통 모듈 |
| `lib/types.ts` | 전체 타입 정의 (수정 시 메이와 상의) |
| `lib/predictions.ts` | 예측 알고리즘 |
| `app/page.tsx` | 메인 페이지 라우팅 |
| `components/ui/*` | shadcn/ui 공통 컴포넌트 |
| `.env.local` | 환경변수 (절대 커밋 금지) |

---

## 2. 자주 하는 수정 — Gemini 프롬프트 예시

### 2-1. QA 평가항목 배점 변경

> 예: "업무지식을 15점에서 20점으로 변경"

```
Gemini 프롬프트:

lib/constants.ts 파일을 열어서 QA_EVALUATION_ITEMS 배열을 찾아줘.
그 안에 key가 'businessKnowledge'인 항목의 maxScore를 15에서 20으로 변경해줘.
다른 항목은 건드리지 마.
```

**확인 방법**: `npm run dev` → 대시보드에서 QA 탭 → 항목별 분석에서 만점 변경 확인

### 2-2. QA 등급 기준 변경

> 예: "우수를 92점에서 95점으로 상향"

```
Gemini 프롬프트:

lib/constants.ts 파일에서 QA_SCORE_GRADES 배열을 찾아줘.
'우수' 등급의 min 값을 92에서 95로 변경해줘.
다른 등급은 건드리지 마.
```

### 2-3. QA 새 평가항목 추가

> 예: "멀티태스킹 항목 추가 (5점, 공통)"

```
Gemini 프롬프트:

lib/constants.ts 파일에서 QA_EVALUATION_ITEMS 배열을 찾아줘.
배열 끝에 새 항목을 추가해줘:
{
  key: 'multitasking',
  label: '멀티태스킹',
  maxScore: 5,
  channel: 'common'
}

그리고 lib/types.ts에서 QaEvaluationItem 타입에도
'multitasking' 키가 포함되도록 확인해줘.
```

**주의**: 새 항목 추가 시 → Google Sheets 파서(`lib/qa-sheets.ts`)에도 해당 컬럼 매핑 필요 → 메이에게 알려주세요.

### 2-4. CSAT 목표 평점 변경

> 예: "목표를 4.5에서 4.7로 상향"

```
Gemini 프롬프트:

lib/constants.ts에서 CSAT_TARGET_SCORE 값을 4.5에서 4.7로 변경해줘.
```

### 2-5. CSAT 서비스 매핑 추가/변경

> 예: "c2_kakaot_app을 택시로 매핑"

```
Gemini 프롬프트:

lib/bigquery-csat.ts 파일을 열어줘.
SERVICE_PATH_SQL 상수에서 CASE문을 찾아줘.
ELSE '기타' 바로 위에 다음 줄을 추가해줘:
    WHEN 'c2_kakaot_app' THEN '택시'

그리고 같은 파일의 SERVICE_DETAIL_SQL에도:
    WHEN 'c2_kakaot_app' THEN '택시_앱'
을 추가해줘.

마지막으로 buildCSATFilters 함수의 servicePathsMap에서
"택시" 배열에 "c2_kakaot_app"을 추가해줘.
```

### 2-6. CSAT 저점 기준 변경

> 예: "미흡 상담사 저점 기준을 주 3건에서 5건으로 완화"

```
Gemini 프롬프트:

lib/constants.ts에서 UNDERPERFORMING_CRITERIA 배열을 찾아줘.
id가 'csat_low_score'인 객체의 threshold를 3에서 5로 변경해줘.
resolution.threshold도 3에서 5로 변경해줘.
```

### 2-7. 통합 가중치 변경

> 예: "QA 30% → 35%, CSAT 25% → 20%"

```
Gemini 프롬프트:

lib/constants.ts에서 RISK_WEIGHTS 객체를 찾아줘.
qa를 0.30에서 0.35로, csat를 0.25에서 0.20으로 변경해줘.
합계가 1.0(100%)이 되는지 확인해줘.

채널별 가중치(CHANNEL_RISK_WEIGHTS)도 확인해서
같이 조정이 필요하면 알려줘.
```

### 2-8. 새로운 차트/컴포넌트 추가

> 예: "상담사별 CSAT 순위 테이블 추가"

```
Gemini 프롬프트:

1단계: 먼저 lib/bigquery-csat.ts를 읽어줘.
현재 있는 쿼리 함수들의 패턴을 파악해줘.

2단계: 같은 패턴으로 getCSATAgentRanking이라는 새 함수를 추가해줘.
- 상담사별 평균 평점, 리뷰 수, 저점 건수를 조회
- 센터/기간 필터 가능
- 평균 평점 높은 순으로 정렬

3단계: components/qc/csat-dashboard/ 폴더에
csat-agent-ranking.tsx 파일을 새로 만들어줘.
- 다른 csat-dashboard 컴포넌트의 패턴을 따라서
- shadcn/ui Table 컴포넌트 사용
- "use client" 선언 필수

4단계: 만든 컴포넌트를 어디에 배치할지는
메이에게 물어봐야 하니까, 일단 컴포넌트만 만들어줘.
```

---

## 3. 수정 후 확인 절차

### 3-1. 빌드 확인 (필수!)

```bash
# 타입 에러가 있으면 빌드가 실패합니다
npm run build -- --webpack

# 에러가 나면 Gemini에게:
# "이 에러를 고쳐줘: [에러 메시지 복사]"
```

### 3-2. 로컬에서 화면 확인

```bash
npm run dev
# 브라우저에서 http://localhost:3000 접속
# 품질 종합 → QA 탭, CSAT 탭에서 변경사항 확인
```

### 3-3. 커밋 & 푸시

```bash
# 변경된 파일 확인
git status

# 변경 내용 확인
git diff

# 스테이징
git add lib/constants.ts   # 변경한 파일만 추가

# 커밋 (메시지는 한글 OK)
git commit -m "QA 업무지식 배점 15→20점 변경"

# 푸시
git push origin feature/리샬-qa-수정사항
```

### 3-4. PR 생성

GitHub에서 PR(Pull Request) 만들기:
1. https://github.kakaocorp.com/csopp/komi 접속
2. "Compare & pull request" 버튼 클릭
3. 제목: 변경 내용 요약
4. 본문: 왜 변경했는지 설명
5. Reviewers: 메이 지정
6. "Create pull request" 클릭

> 또는 CLI로:
> ```bash
> gh pr create --title "QA 배점 변경" --body "업무지식 15→20점"
> ```

---

## 4. 자주 발생하는 에러 & 해결

### "Type error: Property 'xxx' does not exist"

```
Gemini 프롬프트:
lib/types.ts 파일을 읽고, 내가 추가한 필드 'xxx'에 맞게
관련 인터페이스를 업데이트해줘.
```

### "Module not found: Can't resolve '@/xxx'"

```
Gemini 프롬프트:
이 파일의 import 경로가 잘못된 것 같아.
프로젝트의 tsconfig.json에서 path alias를 확인하고
올바른 import 경로로 수정해줘.
```

### "BigQuery error: Not found: Table"

BigQuery 테이블명이 잘못된 경우입니다.
- 올바른 형식: `` `csopp-25f2.KMCC_QC.테이블명` ``
- CSAT는 다른 프로젝트: `` `dataanalytics-25f2.dw_review.review` ``

### "npm run build 실패"

```bash
# 에러 로그 전체를 복사해서 Gemini에게:
npm run build -- --webpack 2>&1 | tail -50

# Gemini 프롬프트:
# "다음 빌드 에러를 분석하고 수정해줘: [에러 로그]"
```

---

## 5. 코딩 규칙 (이것만 지키면 됩니다)

1. **파일 상단**: UI 컴포넌트는 반드시 `"use client"` 선언
2. **import 경로**: `@/lib/xxx`, `@/components/xxx` 형태 (절대경로)
3. **변수명**: 영문 camelCase (예: `avgScore`, `totalReviews`)
4. **UI 텍스트**: 한글 (예: `title="평균 평점"`)
5. **BigQuery**: 테이블명에 반드시 `csopp-25f2.KMCC_QC.` 접두사
6. **날짜**: `date-fns` 라이브러리 사용
7. **스타일**: Tailwind CSS 클래스 사용 (인라인 style 지양)
8. **.env.local**: 절대 커밋하지 않기

---

## 6. Gemini CLI 팁

### 파일 읽기

```
"lib/constants.ts 파일을 읽고 QA 관련 상수들을 정리해줘"
"components/qc/csat-dashboard/ 폴더의 파일 목록을 보여줘"
```

### 패턴 따라하기

```
"components/qc/qa-dashboard/qa-overview-section.tsx의 패턴을 참고해서
같은 구조로 새 컴포넌트를 만들어줘"
```

### 변경 범위 제한

```
"이 파일에서 XXX 부분만 변경하고 나머지는 건드리지 마"
"lib/constants.ts의 CSAT_TARGET_SCORE 값만 변경해줘. 다른 건 절대 수정하지 마"
```

### 여러 파일 동시 수정

```
"다음 파일들을 순서대로 수정해줘:
1. lib/constants.ts → QA 등급 기준 변경
2. components/qc/qa-dashboard/qa-overview-section.tsx → 등급 표시 확인
수정 후 npm run build로 에러가 없는지 확인해줘"
```

### 되돌리기 (실수했을 때)

```bash
# 특정 파일만 원래대로
git checkout -- lib/constants.ts

# 모든 변경 취소 (주의!)
git checkout -- .

# 마지막 커밋 취소 (push 전에만)
git reset --soft HEAD~1
```

---

## 7. 도움이 필요할 때

| 상황 | 누구에게 |
|------|---------|
| 빌드 에러 해결 안 될 때 | 메이 |
| BigQuery 쿼리 에러 | 메이 |
| 새 테이블 생성 필요 | 메이 |
| lib/types.ts 수정 필요 | 메이에게 요청 |
| SLA 연계 항목 결정 | 딘 |
| Git 충돌 해결 | 메이 |

---

> 이 가이드로 해결 안 되는 건 메이에게 편하게 물어보세요.
> 대부분의 수정은 `lib/constants.ts` 한 파일에서 끝납니다.
