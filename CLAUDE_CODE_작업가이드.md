# Claude Code 작업 가이드 - QC 대시보드 BigQuery 연동

## 📋 현재 상태
- 프로젝트: `csopp-25f2`
- 데이터셋: `KMCC_QC` (생성 완료)
- 테이블: 아직 없음
- 리전: `asia-northeast3` (서울)

---

## 🎯 작업 목록

### 1. BigQuery 테이블 생성 (SQL 실행)

BigQuery 콘솔 또는 bq 명령어로 아래 SQL 실행:

```sql
-- ============================================================
-- 테이블 1: evaluations (QC 평가 원천 데이터)
-- ============================================================
CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.evaluations` (
  -- 기본 정보
  evaluation_id STRING NOT NULL,
  evaluation_date DATE NOT NULL,
  consult_date TIMESTAMP,
  consult_id STRING,
  evaluation_round INT64,
  
  -- 센터/서비스/채널
  center STRING NOT NULL,
  service STRING NOT NULL,
  channel STRING NOT NULL,
  
  -- 상담사 정보
  agent_id STRING NOT NULL,
  agent_name STRING NOT NULL,
  hire_date DATE,
  tenure_months INT64,
  tenure_group STRING,
  
  -- 태도 항목 (5개)
  greeting_error BOOL DEFAULT FALSE,
  empathy_error BOOL DEFAULT FALSE,
  apology_error BOOL DEFAULT FALSE,
  additional_inquiry_error BOOL DEFAULT FALSE,
  unkind_error BOOL DEFAULT FALSE,
  
  -- 오상담 항목 (11개)
  consult_type_error BOOL DEFAULT FALSE,
  guide_error BOOL DEFAULT FALSE,
  identity_check_error BOOL DEFAULT FALSE,
  required_search_error BOOL DEFAULT FALSE,
  wrong_guide_error BOOL DEFAULT FALSE,
  process_missing_error BOOL DEFAULT FALSE,
  process_incomplete_error BOOL DEFAULT FALSE,
  system_error BOOL DEFAULT FALSE,
  id_mapping_error BOOL DEFAULT FALSE,
  flag_keyword_error BOOL DEFAULT FALSE,
  history_error BOOL DEFAULT FALSE,
  
  -- 집계용
  attitude_error_count INT64,
  ops_error_count INT64,
  total_error_count INT64,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY evaluation_date
CLUSTER BY center, service, channel;

-- ============================================================
-- 테이블 2: agents (상담사 마스터)
-- ============================================================
CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.agents` (
  agent_id STRING NOT NULL,
  agent_name STRING NOT NULL,
  center STRING NOT NULL,
  service STRING,
  channel STRING,
  hire_date DATE,
  tenure_months INT64,
  tenure_group STRING,
  is_active BOOL DEFAULT TRUE,
  total_evaluations INT64 DEFAULT 0,
  total_attitude_errors INT64 DEFAULT 0,
  total_ops_errors INT64 DEFAULT 0,
  current_attitude_rate FLOAT64,
  current_ops_rate FLOAT64,
  risk_level STRING,
  is_watch_list BOOL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 테이블 3: metrics_daily (일별 집계)
-- ============================================================
CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.metrics_daily` (
  metric_date DATE NOT NULL,
  dimension_type STRING NOT NULL,
  dimension_value STRING NOT NULL,
  center STRING,
  total_checks INT64,
  attitude_errors INT64,
  ops_errors INT64,
  attitude_rate FLOAT64,
  ops_rate FLOAT64,
  total_rate FLOAT64,
  greeting_errors INT64 DEFAULT 0,
  empathy_errors INT64 DEFAULT 0,
  apology_errors INT64 DEFAULT 0,
  additional_inquiry_errors INT64 DEFAULT 0,
  unkind_errors INT64 DEFAULT 0,
  consult_type_errors INT64 DEFAULT 0,
  guide_errors INT64 DEFAULT 0,
  identity_check_errors INT64 DEFAULT 0,
  required_search_errors INT64 DEFAULT 0,
  wrong_guide_errors INT64 DEFAULT 0,
  process_missing_errors INT64 DEFAULT 0,
  process_incomplete_errors INT64 DEFAULT 0,
  system_errors INT64 DEFAULT 0,
  id_mapping_errors INT64 DEFAULT 0,
  flag_keyword_errors INT64 DEFAULT 0,
  history_errors INT64 DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY metric_date
CLUSTER BY dimension_type, center;

-- ============================================================
-- 테이블 4: predictions (월말 예측)
-- ============================================================
CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.predictions` (
  prediction_id STRING NOT NULL,
  prediction_date DATE NOT NULL,
  target_month STRING NOT NULL,
  dimension_type STRING NOT NULL,
  dimension_value STRING NOT NULL,
  center STRING,
  days_passed INT64,
  days_remaining INT64,
  current_checks INT64,
  current_attitude_rate FLOAT64,
  current_ops_rate FLOAT64,
  w1_attitude_rate FLOAT64,
  w2_attitude_rate FLOAT64,
  w3_attitude_rate FLOAT64,
  w4_attitude_rate FLOAT64,
  w1_ops_rate FLOAT64,
  w2_ops_rate FLOAT64,
  w3_ops_rate FLOAT64,
  w4_ops_rate FLOAT64,
  predicted_attitude_rate FLOAT64,
  predicted_ops_rate FLOAT64,
  w4_predicted_attitude FLOAT64,
  w4_predicted_ops FLOAT64,
  target_attitude_rate FLOAT64,
  target_ops_rate FLOAT64,
  attitude_gap FLOAT64,
  ops_gap FLOAT64,
  attitude_achievement_prob FLOAT64,
  ops_achievement_prob FLOAT64,
  attitude_trend STRING,
  ops_trend STRING,
  attitude_risk_level STRING,
  ops_risk_level STRING,
  overall_risk_level STRING,
  alert_flag BOOL DEFAULT FALSE,
  alert_reason STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY prediction_date;

-- ============================================================
-- 테이블 5: watch_list (집중관리 대상)
-- ============================================================
CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.watch_list` (
  watch_id STRING NOT NULL,
  created_date DATE NOT NULL,
  dimension_type STRING NOT NULL,
  dimension_value STRING NOT NULL,
  center STRING,
  agent_id STRING,
  agent_name STRING,
  service STRING,
  channel STRING,
  reason STRING,
  risk_factors ARRAY<STRING>,
  current_checks INT64,
  attitude_rate FLOAT64,
  ops_rate FLOAT64,
  rate_change_from_prev FLOAT64,
  action_plan STRING,
  action_status STRING DEFAULT 'registered',
  due_date DATE,
  manager_id STRING,
  registered_attitude_rate FLOAT64,
  registered_ops_rate FLOAT64,
  improvement_rate FLOAT64,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 테이블 6: targets (목표 설정)
-- ============================================================
CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.targets` (
  target_id STRING NOT NULL,
  target_name STRING NOT NULL,
  center STRING,
  target_type STRING NOT NULL,
  target_rate FLOAT64 NOT NULL,
  period_type STRING NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  is_active BOOL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 초기 목표 데이터 입력 (2026년 1월)
-- ============================================================
INSERT INTO `csopp-25f2.KMCC_QC.targets` 
(target_id, target_name, center, target_type, target_rate, period_type, period_start, period_end)
VALUES
-- 전체
('202601_all_attitude', '1월 전체 상담태도', NULL, 'attitude', 3.0, 'monthly', '2026-01-01', '2026-01-31'),
('202601_all_ops', '1월 전체 오상담', NULL, 'ops', 3.0, 'monthly', '2026-01-01', '2026-01-31'),
-- 용산
('202601_yongsan_attitude', '1월 용산 상담태도', '용산', 'attitude', 3.3, 'monthly', '2026-01-01', '2026-01-31'),
('202601_yongsan_ops', '1월 용산 오상담', '용산', 'ops', 3.9, 'monthly', '2026-01-01', '2026-01-31'),
-- 광주
('202601_gwangju_attitude', '1월 광주 상담태도', '광주', 'attitude', 2.7, 'monthly', '2026-01-01', '2026-01-31'),
('202601_gwangju_ops', '1월 광주 오상담', '광주', 'ops', 1.7, 'monthly', '2026-01-01', '2026-01-31');
```

---

### 2. lib/bigquery.ts 수정

기존 파일에서 데이터셋 ID 변경:

```typescript
// 변경 전
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'QC';

// 변경 후  
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';
```

---

### 3. 예측 로직 파일 추가

`/lib/predictions.ts` 파일 생성 (내용은 별도 파일 참조)

---

### 4. 예측 API Route 추가

`/app/api/predictions/route.ts` 파일 생성

---

### 5. 환경변수 (.env.local)

```env
BIGQUERY_PROJECT_ID=csopp-25f2
BIGQUERY_DATASET_ID=KMCC_QC
BIGQUERY_LOCATION=asia-northeast3
```

---

## 📁 파일 구조 (추가/수정)

```
kmcc_QC_dashbord/
├── lib/
│   ├── bigquery.ts          # 수정: DATASET_ID 변경
│   └── predictions.ts       # 신규: 예측 로직
├── app/
│   └── api/
│       ├── bigquery-sync/
│       │   └── route.ts     # 기존
│       └── predictions/
│           └── route.ts     # 신규: 예측 API
└── .env.local               # 환경변수
```
