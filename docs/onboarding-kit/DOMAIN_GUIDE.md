# KMCC QC Dashboard - 도메인별 작업 가이드

> 각 담당자가 **자기 영역에서 어떤 파일을 수정하면 되는지** 안내합니다.
> 다른 사람의 폴더는 건드리지 않으면 충돌이 거의 발생하지 않습니다.

---

## 담당자 & 도메인 매핑

| 담당자 | 도메인 | 상태 | 브랜치 |
|--------|--------|------|--------|
| **콥** | 생산성 (Productivity) | 신규 개발 | `feature/productivity-cop` |
| **딘** | SLA 평가 | 신규 개발 | `feature/sla-din` |
| **리샬** | QA 상담평점 | 기존 코드 있음 | `feature/qa-rishal` |
| **메이** | QC + 직무테스트 | 기존 코드 있음 | `feature/qc-may` |

---

## 프로젝트 구조 한눈에 보기

```
kmcc-qc-dashbord/
├── app/
│   ├── api/              # API 엔드포인트 (서버 로직)
│   │   ├── data/         # 공통 데이터 API
│   │   ├── mypage/       # 마이페이지 API
│   │   └── ...
│   └── page.tsx          # 메인 페이지
├── lib/                  # 핵심 비즈니스 로직
│   ├── bigquery.ts       # BigQuery 기본 클라이언트 (공통 - 수정 금지)
│   ├── bigquery-qa.ts    # QA 쿼리 ← 리샬
│   ├── bigquery-csat.ts  # CSAT 쿼리
│   ├── bigquery-quiz.ts  # 퀴즈 쿼리 ← 메이
│   ├── constants.ts      # 설정값 모음 (수정 시 메이에게 알려주세요)
│   ├── types.ts          # 타입 정의 (수정 시 메이에게 알려주세요)
│   └── ...
├── components/qc/        # UI 컴포넌트
│   ├── dashboard/        # QC 메인 대시보드 ← 메이
│   ├── qa-dashboard/     # QA 대시보드 ← 리샬
│   ├── csat-dashboard/   # CSAT 대시보드
│   ├── quiz-dashboard/   # 퀴즈 대시보드 ← 메이
│   └── quality-dashboard/# 품질 종합 (탭 래퍼)
└── docs/                 # 문서
```

---

## 콥 - 생산성 (Productivity)

### 만들어야 할 파일

```
lib/
  bigquery-productivity.ts     # BigQuery 쿼리 (생산성 지표 조회)

components/qc/
  productivity-dashboard/
    index.tsx                  # 대시보드 컨테이너
    productivity-overview.tsx  # KPI 카드 (처리건수, 시간당 처리량 등)
    productivity-trend.tsx     # 추이 차트
    productivity-table.tsx     # 상세 테이블

app/api/
  productivity/
    route.ts                   # API 엔드포인트
```

### 참고할 기존 코드

- `lib/bigquery-qa.ts` — BigQuery 쿼리 작성 패턴 참고
- `components/qc/qa-dashboard/index.tsx` — 대시보드 구조 참고
- `lib/types.ts` — 타입 정의 시 여기에 추가

### BigQuery에서 필요한 것

- 생산성 데이터가 담길 테이블이 필요합니다
- 테이블 설계가 필요하면 메이에게 요청하세요
- 쿼리 예시:
```sql
SELECT
  agent_name,
  service,
  DATE(work_date) as work_date,
  total_calls,
  avg_handle_time
FROM `csopp-25f2.KMCC_QC.productivity`
WHERE work_date BETWEEN @start AND @end
```

### AI(Gemini/Cursor)에게 이렇게 요청하세요

> "lib/bigquery-qa.ts 파일을 참고해서 lib/bigquery-productivity.ts를 만들어줘.
> BigQuery 테이블은 csopp-25f2.KMCC_QC.productivity이고,
> agent_name, service, work_date, total_calls, avg_handle_time 컬럼이 있어.
> 날짜 범위와 센터별 필터링이 가능해야 해."

---

## 딘 - SLA 평가

### 만들어야 할 파일

```
lib/
  bigquery-sla.ts              # BigQuery 쿼리 (SLA 지표 조회)

components/qc/
  sla-dashboard/
    index.tsx                  # 대시보드 컨테이너
    sla-overview.tsx           # KPI 카드 (응답률, 평균대기시간 등)
    sla-trend.tsx              # 추이 차트
    sla-service-table.tsx      # 서비스별 SLA 테이블

app/api/
  sla/
    route.ts                   # API 엔드포인트
```

### 참고할 기존 코드

- `lib/bigquery-qa.ts` — BigQuery 쿼리 작성 패턴 참고
- `components/qc/qa-dashboard/index.tsx` — 대시보드 구조 참고
- `lib/constants.ts` — 서비스명 정규화 맵 (`SERVICE_NORMALIZATION_MAP`)

### BigQuery에서 필요한 것

- SLA 데이터 테이블 설계 필요
- 주요 지표 예시: 응답률, 서비스레벨(20초 내 응답), 평균대기시간, 포기율
- 쿼리 예시:
```sql
SELECT
  service,
  DATE(metric_date) as metric_date,
  response_rate,
  service_level_20s,
  avg_wait_time,
  abandon_rate
FROM `csopp-25f2.KMCC_QC.sla_metrics`
WHERE metric_date BETWEEN @start AND @end
```

### AI(Gemini/Cursor)에게 이렇게 요청하세요

> "lib/bigquery-qa.ts 파일을 참고해서 lib/bigquery-sla.ts를 만들어줘.
> BigQuery 테이블은 csopp-25f2.KMCC_QC.sla_metrics이고,
> 서비스별, 날짜별 SLA 지표(응답률, 서비스레벨, 평균대기시간, 포기율)를 조회해야 해."

---

## 리샬 - QA 상담평점

### 이미 있는 파일 (수정 대상)

```
lib/
  bigquery-qa.ts               # QA BigQuery 쿼리 (471줄)
  qa-sheets.ts                 # QA Google Sheets 파서

components/qc/
  qa-dashboard/
    index.tsx                  # QA 대시보드 컨테이너
    qa-overview-section.tsx    # QA KPI 카드
    qa-score-trend-chart.tsx   # QA 추이 차트
    qa-agent-analysis.tsx      # 상담사별 점수
    qa-center-comparison.tsx   # 센터 비교
    qa-item-analysis-v2.tsx    # 항목별 분석
    qa-monthly-table.tsx       # 월별 테이블

app/api/
  import-qa/
    route.ts                   # QA 데이터 임포트 API

lib/
  use-qa-dashboard-data.ts     # QA 데이터 fetching hook
```

### 주로 수정할 내용

1. **`lib/bigquery-qa.ts`** — QA 쿼리 조건 변경, 새 지표 추가
2. **`components/qc/qa-dashboard/`** — 차트/테이블 UI 수정
3. **`lib/constants.ts`** — QA 평가항목 정의 (`QA_EVALUATION_ITEMS` 부분만)

### 수정 예시: QA 점수 기준 변경

`lib/bigquery-qa.ts`에서 점수 계산 로직을 찾아서 수정:
```typescript
// 예: 합격 기준을 70점에서 75점으로 변경
const PASS_THRESHOLD = 75; // 기존: 70
```

### AI(Gemini/Cursor)에게 이렇게 요청하세요

> "components/qc/qa-dashboard/qa-overview-section.tsx를 열어서
> QA 평균 점수 카드에 전월 대비 증감을 표시하는 기능을 추가해줘.
> 기존 코드 스타일을 따라가줘."

---

## 메이 - QC + 직무테스트

### 관리 파일

```
# QC 대시보드
lib/bigquery.ts                # QC BigQuery 메인 쿼리
components/qc/dashboard/       # QC 메인 대시보드 (10+ 컴포넌트)

# 직무테스트
lib/bigquery-quiz.ts           # 퀴즈 BigQuery 쿼리
components/qc/quiz-dashboard/  # 퀴즈 대시보드 (4 컴포넌트)

# 공통 (다른 사람이 수정 시 검토 필요)
lib/constants.ts               # 전체 설정값
lib/types.ts                   # 전체 타입 정의
lib/bigquery-integrated.ts     # 통합 쿼리
```

---

## 공통 규칙

### 1. 이 파일들은 혼자 수정하지 마세요

| 파일 | 이유 | 수정하고 싶을 때 |
|------|------|------------------|
| `lib/constants.ts` | 모든 도메인 설정이 모여있음 | 메이에게 알리고 같이 수정 |
| `lib/types.ts` | 공통 타입 정의 | 새 타입은 본인 파일에 먼저 정의, 나중에 통합 |
| `app/page.tsx` | 메인 라우팅 | 메이가 관리 |
| `components/qc/quality-dashboard/index.tsx` | 탭 래퍼 | 새 탭 추가 시 메이에게 요청 |

### 2. 새 파일 만들 때 네이밍 규칙

```
# BigQuery 쿼리
lib/bigquery-{도메인}.ts       # 예: bigquery-sla.ts

# 컴포넌트 폴더
components/qc/{도메인}-dashboard/
  index.tsx                    # 컨테이너 (필수)
  {도메인}-overview.tsx        # KPI 카드
  {도메인}-trend.tsx           # 추이 차트
  {도메인}-table.tsx           # 테이블

# API 라우트
app/api/{도메인}/route.ts      # 예: app/api/sla/route.ts

# 데이터 hook
lib/use-{도메인}-dashboard-data.ts
```

### 3. 코드 스타일

- **UI 라벨**: 한국어 (`상담사`, `오류율`, `평균 점수`)
- **변수/함수명**: 영어 (`agentName`, `errorRate`, `avgScore`)
- **BigQuery 테이블 참조**: 항상 풀네임 (`csopp-25f2.KMCC_QC.테이블명`)
- **차트**: Recharts 라이브러리 사용
- **UI 컴포넌트**: shadcn/ui 기반 (`components/ui/` 참고)

### 4. 새 대시보드를 품질 종합 탭에 추가하는 법

새 도메인 대시보드를 완성하면, 메이에게 요청하세요.
`components/qc/quality-dashboard/index.tsx`에 탭을 추가합니다:

```
현재 탭: QC | QA | CSAT | 직무테스트
추가 후:  QC | QA | CSAT | 직무테스트 | 생산성 | SLA
```

---

## BigQuery 테이블 현황

| 테이블 | 용도 | 담당 |
|--------|------|------|
| `evaluations` | QC 평가 원천 데이터 | 메이 |
| `agents` | 상담사 마스터 | 공통 |
| `targets` | 센터 목표 | 메이 |
| `qa_evaluations` | QA 평가 데이터 | 리샬 |
| `productivity` | 생산성 지표 (생성 필요) | 콥 |
| `sla_metrics` | SLA 지표 (생성 필요) | 딘 |

새 테이블이 필요하면 메이에게 요청하세요. DDL을 만들어서 BigQuery에 생성해드립니다.
