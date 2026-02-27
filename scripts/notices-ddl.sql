-- 공지사항 테이블 DDL (BigQuery)
-- 프로젝트: csopp-25f2 / 데이터셋: KMCC_QC
-- BigQuery는 DEFAULT 미지원 → INSERT 시 값 명시 필요

-- 1) 공지사항 마스터
CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.notices` (
  notice_id STRING NOT NULL,
  title STRING NOT NULL,
  content STRING,
  notice_type STRING NOT NULL,          -- 'announcement' | 'education'
  center_scope STRING NOT NULL,         -- '용산' | '광주' | 'all'
  priority INT64 NOT NULL,              -- 0=일반, 1=중요, 2=긴급
  is_pinned BOOL NOT NULL,
  created_by STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,
  is_deleted BOOL NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY center_scope, notice_type;

-- 1-b) 타게팅 컬럼 추가
ALTER TABLE `csopp-25f2.KMCC_QC.notices`
  ADD COLUMN IF NOT EXISTS service_scope STRING,
  ADD COLUMN IF NOT EXISTS channel_scope STRING,
  ADD COLUMN IF NOT EXISTS shift_scope STRING,
  ADD COLUMN IF NOT EXISTS target_type STRING,
  ADD COLUMN IF NOT EXISTS target_agent_ids STRING;

-- 2) 공지사항 읽음 기록
CREATE TABLE IF NOT EXISTS `csopp-25f2.KMCC_QC.notice_reads` (
  read_id STRING NOT NULL,              -- '{noticeId}_{userId}'
  notice_id STRING NOT NULL,
  user_id STRING NOT NULL,
  read_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(read_at)
CLUSTER BY user_id;
