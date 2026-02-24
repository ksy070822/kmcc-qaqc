-- ============================================================
-- QC 대시보드 BigQuery 테이블 스키마
-- 프로젝트: csopp-25f2
-- 데이터셋: KMCC_QC
-- 리전: asia-northeast3 (서울)
-- 
-- 실행 방법: BigQuery 콘솔 > SQL 쿼리에서 실행
-- ============================================================

-- 테이블 1: evaluations (QC 평가 원천 데이터)
CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.evaluations` (
  evaluation_id STRING NOT NULL,
  evaluation_date DATE NOT NULL,
  consultation_datetime TIMESTAMP,
  consultation_id STRING,
  evaluation_round INT64,
  center STRING NOT NULL,
  service STRING NOT NULL,
  channel STRING NOT NULL,
  `group` STRING,
  agent_id STRING NOT NULL,
  agent_name STRING NOT NULL,
  hire_date DATE,
  tenure_months INT64,
  tenure_group STRING,
  greeting_error BOOL DEFAULT FALSE,
  empathy_error BOOL DEFAULT FALSE,
  apology_error BOOL DEFAULT FALSE,
  additional_inquiry_error BOOL DEFAULT FALSE,
  unkind_error BOOL DEFAULT FALSE,
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
  attitude_error_count INT64,
  business_error_count INT64,
  total_error_count INT64,
  -- 상담유형 뎁스 (수정 전: 상담사 원래 설정)
  consult_type_orig_depth1 STRING,    -- 1뎁스 (서비스명)
  consult_type_orig_depth2 STRING,    -- 2뎁스 (문의유형)
  consult_type_orig_depth3 STRING,    -- 3뎁스 (세부유형)
  consult_type_orig_depth4 STRING,    -- 4뎁스 (상세)
  -- 상담유형 뎁스 (수정 후: QC 검수자 정정, NULL이면 원래 설정이 정상)
  consult_type_corrected_depth1 STRING,
  consult_type_corrected_depth2 STRING,
  consult_type_corrected_depth3 STRING,
  consult_type_corrected_depth4 STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY evaluation_date
CLUSTER BY center, service, channel;

-- evaluations 테이블 상담유형 뎁스 컬럼 추가 (기존 테이블 마이그레이션용)
ALTER TABLE `csopp-25f2.KMCC_QC.evaluations`
  ADD COLUMN IF NOT EXISTS consult_type_orig_depth1 STRING,
  ADD COLUMN IF NOT EXISTS consult_type_orig_depth2 STRING,
  ADD COLUMN IF NOT EXISTS consult_type_orig_depth3 STRING,
  ADD COLUMN IF NOT EXISTS consult_type_orig_depth4 STRING,
  ADD COLUMN IF NOT EXISTS consult_type_corrected_depth1 STRING,
  ADD COLUMN IF NOT EXISTS consult_type_corrected_depth2 STRING,
  ADD COLUMN IF NOT EXISTS consult_type_corrected_depth3 STRING,
  ADD COLUMN IF NOT EXISTS consult_type_corrected_depth4 STRING;

-- 테이블 2: agents (상담사 마스터)
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

-- 테이블 3: metrics_daily (일별 집계)
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

-- 테이블 4: predictions (월말 예측)
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

-- 테이블 5: watch_list (집중관리 대상)
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

-- 테이블 6: targets (목표 설정)
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

-- 초기 목표 데이터 (2026년 1월)
INSERT INTO `csopp-25f2.KMCC_QC.targets` 
(target_id, target_name, center, target_type, target_rate, period_type, period_start, period_end)
VALUES
('202601_all_attitude', '1월 전체 상담태도', NULL, 'attitude', 3.0, 'monthly', '2026-01-01', '2026-01-31'),
('202601_all_ops', '1월 전체 오상담', NULL, 'ops', 3.0, 'monthly', '2026-01-01', '2026-01-31'),
('202601_yongsan_attitude', '1월 용산 상담태도', '용산', 'attitude', 3.3, 'monthly', '2026-01-01', '2026-01-31'),
('202601_yongsan_ops', '1월 용산 오상담', '용산', 'ops', 3.9, 'monthly', '2026-01-01', '2026-01-31'),
('202601_gwangju_attitude', '1월 광주 상담태도', '광주', 'attitude', 2.7, 'monthly', '2026-01-01', '2026-01-31'),
('202601_gwangju_ops', '1월 광주 오상담', '광주', 'ops', 1.7, 'monthly', '2026-01-01', '2026-01-31');

-- ============================================================
-- QA(품질보증) 평가 테이블
-- 유선/채팅 통합 (채널별 고유 항목은 NULLABLE)
-- ============================================================

CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.qa_evaluations` (
  -- PK
  qa_eval_id STRING NOT NULL,              -- "{agent_id}_{month}_{round}"
  evaluation_date DATE NOT NULL,           -- 평가월 1일 (파티션 키)
  evaluation_month STRING NOT NULL,        -- "2026-01"
  round INT64 NOT NULL,                    -- 차시 1~5
  consultation_id STRING,

  -- 상담사 정보
  center STRING NOT NULL,                  -- 용산/광주
  team STRING,
  service STRING NOT NULL,
  channel STRING NOT NULL,                 -- 유선/채팅
  agent_name STRING NOT NULL,
  agent_id STRING,                         -- LDAP (agents 테이블 FK)
  tenure_months INT64,
  work_type STRING,                        -- 주간/야간

  -- 총점
  total_score FLOAT64 NOT NULL,            -- 0~100

  -- 공통 항목 (유선+채팅)
  greeting_score FLOAT64,                  -- 유선:인사예절(6) / 채팅:(끝)인사(3)
  response_expression FLOAT64,             -- 화답표현(5)
  inquiry_comprehension FLOAT64,           -- 문의내용파악(5)
  identity_check FLOAT64,                  -- 본인확인: 유선(5)/채팅(3)
  required_search FLOAT64,                 -- 필수탐색(5)
  business_knowledge FLOAT64,              -- 업무지식(15)
  promptness FLOAT64,                      -- 신속성(3)
  system_processing FLOAT64,               -- 전산처리(6)
  consultation_history FLOAT64,            -- 상담이력(5)
  empathy_care FLOAT64,                    -- 감성케어(17)
  language_expression FLOAT64,             -- 언어표현(5)
  listening_focus FLOAT64,                 -- 경청/집중태도(5)
  explanation_ability FLOAT64,             -- 설명능력: 유선(5)/채팅(10)
  perceived_satisfaction FLOAT64,          -- 체감만족: 유선(3)/채팅(5)
  praise_bonus FLOAT64,                    -- 칭찬접수(+10)

  -- 유선 전용 (채팅은 NULL)
  voice_performance FLOAT64,               -- 음성연출(8)
  speech_speed FLOAT64,                    -- 말속도/발음(2)
  honorific_error FLOAT64,                 -- 호칭오류(-1)

  -- 채팅 전용 (유선은 NULL)
  spelling FLOAT64,                        -- 맞춤법(5)
  close_request FLOAT64,                   -- 종료요청(3)
  copy_error FLOAT64,                      -- 복사오류(-1)
  operation_error FLOAT64,                 -- 조작오류(-1)

  -- 상담유형
  consult_type_depth1 STRING,
  consult_type_depth2 STRING,
  consult_type_depth3 STRING,
  consult_type_depth4 STRING,

  -- 피드백
  knowledge_feedback STRING,
  satisfaction_comment STRING,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY evaluation_date
CLUSTER BY center, channel, service;

-- ============================================================
-- 상담사별 월간 종합 요약 테이블
-- QA + QC + CSAT + 직무테스트 통합 스냅샷
-- ============================================================

CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.agent_monthly_summary` (
  summary_id STRING NOT NULL,              -- "{agent_id}_{month}"
  summary_month STRING NOT NULL,           -- "2026-01"
  summary_date DATE NOT NULL,              -- 파티션 키 (월 1일)

  agent_id STRING NOT NULL,
  agent_name STRING,
  center STRING NOT NULL,
  service STRING,
  channel STRING,
  work_type STRING,

  -- QA 지표
  qa_score FLOAT64,                        -- QA 평균 점수 (100점)
  qa_eval_count INT64,                     -- QA 평가 횟수

  -- QC 지표
  qc_attitude_rate FLOAT64,                -- 태도 오류율 (%)
  qc_ops_rate FLOAT64,                     -- 오상담 오류율 (%)
  qc_total_rate FLOAT64,                   -- 합계 오류율
  qc_eval_count INT64,

  -- CSAT 지표
  csat_avg_score FLOAT64,                  -- 평균 평점 (5점)
  csat_review_count INT64,

  -- 직무테스트
  knowledge_score FLOAT64,                 -- 업무지식 점수
  knowledge_test_count INT64,

  -- 종합 리스크
  composite_risk_score FLOAT64,            -- 가중 종합 점수
  risk_level STRING,                       -- low/medium/high/critical

  -- AI 코멘트
  ai_comment STRING,

  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY summary_date
CLUSTER BY center, agent_id;

-- ============================================================
-- 미흡상담사(집중관리) 주간 적발 이력 테이블
-- 2025년 7월~ 용산 미흡상담사 관리현황 Excel에서 추출
-- ============================================================

CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.weekly_underperformers` (
  -- 주차 식별
  week_label STRING NOT NULL,            -- "2025년 7월 1주차"
  week_year INT64 NOT NULL,              -- 2025
  week_month INT64 NOT NULL,             -- 7
  week_number INT64 NOT NULL,            -- 1

  -- 상담사 정보
  agent_id STRING NOT NULL,              -- 영문이름 (LDAP)
  agent_name STRING NOT NULL,            -- 한글이름
  center STRING NOT NULL,                -- 용산/광주
  service STRING,                        -- 버티컬 (Maas A / 유선 등)
  hire_date DATE,                        -- 입사일
  tenure_months FLOAT64,                 -- 근속개월

  -- 미흡 판정 원시값
  qa_knowledge_value STRING,             -- QA 업무지식 (Y/빈값)
  qc_attitude_value FLOAT64,             -- QC 상담태도 오류율 (소수)
  qc_ops_value FLOAT64,                  -- QC 오상담 오류율 (소수)
  csat_low_weekly_value STRING,          -- 상담평가 주단위 (Y/빈값)
  csat_low_monthly_count FLOAT64,        -- 상담평가 월 누적 건수

  -- 미흡 판정 플래그
  qa_knowledge_flagged BOOL DEFAULT FALSE,
  qc_attitude_flagged BOOL DEFAULT FALSE,
  qc_ops_flagged BOOL DEFAULT FALSE,
  csat_low_weekly_flagged BOOL DEFAULT FALSE,

  -- 종합
  flagged_count INT64,                   -- 적발 항목 수 (0~4)
  is_low_quality BOOL DEFAULT FALSE,     -- 저품질 상담사 여부 (W열)
  note STRING,                           -- 비고 (X열)

  -- 메타
  source_file STRING,
  source_sheet STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY center, agent_id;
