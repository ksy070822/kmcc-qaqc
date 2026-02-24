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

### AI(Gemini/Cursor) 프롬프트 예시

**1단계: BigQuery 쿼리 파일 만들기**
> "이 프로젝트의 lib/bigquery-qa.ts 파일을 참고해서 lib/bigquery-productivity.ts를 만들어줘.
> BigQuery 테이블은 csopp-25f2.KMCC_QC.productivity이고,
> agent_name, service, center, work_date, total_calls, avg_handle_time 컬럼이 있어.
> 날짜 범위(startDate, endDate)와 센터별(용산/광주) 필터링이 가능해야 해.
> 함수 이름은 getProductivityData로 해줘."

**2단계: API 엔드포인트 만들기**
> "app/api/data/route.ts 파일의 패턴을 참고해서
> app/api/productivity/route.ts를 만들어줘.
> lib/bigquery-productivity.ts의 getProductivityData 함수를 호출하고,
> searchParams에서 startDate, endDate, center를 받아서 넘겨줘."

**3단계: 대시보드 UI 만들기**
> "components/qc/qa-dashboard/index.tsx 구조를 참고해서
> components/qc/productivity-dashboard/index.tsx를 만들어줘.
> /api/productivity에서 데이터를 fetch하고,
> 상단에 KPI 카드 3개(총 처리건수, 시간당 처리량, 평균 처리시간),
> 아래에 Recharts로 일별 추이 라인 차트를 넣어줘.
> shadcn/ui의 Card 컴포넌트를 사용하고, 기존 프로젝트 스타일을 따라가줘."

**4단계: 차트/테이블 추가**
> "productivity-dashboard 폴더에 productivity-table.tsx를 추가해줘.
> 상담사별 생산성 테이블이고, 컬럼은: 상담사명, 서비스, 처리건수, 시간당 처리량.
> shadcn/ui의 Table 컴포넌트를 사용하고, 정렬 기능도 넣어줘.
> components/qc/qa-dashboard/qa-monthly-table.tsx를 참고해."

**에러가 났을 때**
> "이 에러 메시지를 보고 원인을 알려줘: [에러 메시지 붙여넣기]"
> "lib/bigquery-productivity.ts에서 BigQuery 쿼리 에러가 나. 쿼리를 확인해줘."

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

### AI(Gemini/Cursor) 프롬프트 예시

**1단계: BigQuery 쿼리 파일 만들기**
> "이 프로젝트의 lib/bigquery-qa.ts 파일을 참고해서 lib/bigquery-sla.ts를 만들어줘.
> BigQuery 테이블은 csopp-25f2.KMCC_QC.sla_metrics이고,
> service, center, metric_date, response_rate, service_level_20s, avg_wait_time, abandon_rate 컬럼이 있어.
> 날짜 범위와 센터별, 서비스별 필터링이 가능해야 해.
> 함수 이름은 getSlaData로 해줘."

**2단계: API 엔드포인트 만들기**
> "app/api/data/route.ts 패턴을 참고해서 app/api/sla/route.ts를 만들어줘.
> lib/bigquery-sla.ts의 getSlaData 함수를 호출하고,
> searchParams에서 startDate, endDate, center, service를 받아서 넘겨줘."

**3단계: 대시보드 UI 만들기**
> "components/qc/qa-dashboard/index.tsx 구조를 참고해서
> components/qc/sla-dashboard/index.tsx를 만들어줘.
> /api/sla에서 데이터를 fetch하고,
> 상단에 KPI 카드 4개(응답률, 서비스레벨, 평균대기시간, 포기율),
> 아래에 Recharts로 일별 추이 차트를 넣어줘.
> 목표 대비 달성률도 색상으로 표시해줘 (달성=초록, 미달=빨강).
> shadcn/ui 기반으로, 기존 프로젝트 스타일을 따라가줘."

**4단계: 서비스별 비교 테이블**
> "sla-dashboard 폴더에 sla-service-table.tsx를 추가해줘.
> 서비스별 SLA 지표 비교 테이블이야.
> 컬럼: 서비스명, 응답률, 서비스레벨(20s), 평균대기시간, 포기율.
> 목표 대비 색상 표시하고, components/qc/qa-dashboard/qa-monthly-table.tsx를 참고해."

**에러가 났을 때**
> "이 에러 메시지를 보고 원인을 알려줘: [에러 메시지 붙여넣기]"

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

### AI(Gemini/Cursor) 프롬프트 예시

**기존 쿼리 수정하기**
> "lib/bigquery-qa.ts 파일을 열어줘.
> getQADashboardData 함수에서 QA 점수 조회 시
> 채널(유선/채팅)별로 구분해서 가져오도록 수정해줘.
> 기존 코드 패턴을 유지하면서 channel 파라미터를 추가해."

**KPI 카드에 전월 대비 추가**
> "components/qc/qa-dashboard/qa-overview-section.tsx를 열어서
> QA 평균 점수 카드에 전월 대비 증감을 표시하는 기능을 추가해줘.
> 증가면 초록색 화살표, 감소면 빨간색 화살표로 보여줘.
> 기존 코드 스타일을 따라가줘."

**차트 수정하기**
> "components/qc/qa-dashboard/qa-score-trend-chart.tsx를 열어서
> 현재 월별 평균 점수만 보여주는데, 센터별(용산/광주) 라인을 분리해줘.
> Recharts의 Line 컴포넌트를 센터별로 하나씩 추가하면 돼.
> 용산은 파란색, 광주는 초록색으로."

**평가 항목 기준 변경**
> "lib/constants.ts에서 QA_EVALUATION_ITEMS 부분을 찾아줘.
> 여기서 '상담 지식' 항목의 배점을 15점에서 20점으로 변경하고 싶어.
> 변경 시 다른 항목에 영향이 있는지도 확인해줘."

**새 테이블 추가**
> "components/qc/qa-dashboard/ 폴더에 qa-agent-ranking.tsx를 만들어줘.
> 상담사별 QA 점수 순위 테이블이야.
> 컬럼: 순위, 상담사명, 서비스, 평균점수, 평가건수, 전월대비.
> qa-monthly-table.tsx 스타일을 참고하고, 점수 높은 순으로 정렬해줘."

**에러가 났을 때**
> "이 에러 메시지를 보고 원인을 알려줘: [에러 메시지 붙여넣기]"
> "qa-dashboard가 빈 화면이야. 브라우저 콘솔에 이런 에러가 나와: [에러 붙여넣기]"

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
