-- ============================================================
-- 가짜 데이터 삭제 스크립트
-- 프로젝트: csopp-25f2
-- 데이터셋: KMCC_QC
-- 
-- "AGT"로 시작하는 가짜 상담사 ID를 가진 모든 데이터 삭제
-- ============================================================

-- 1. 먼저 삭제될 데이터 확인 (실행 전 확인용)
-- evaluations 테이블에서 가짜 데이터 확인
SELECT 
  agent_id,
  agent_name,
  center,
  service,
  channel,
  COUNT(*) as evaluation_count,
  MIN(evaluation_date) as first_date,
  MAX(evaluation_date) as last_date
FROM `csopp-25f2.KMCC_QC.evaluations`
WHERE agent_id LIKE 'AGT%'
GROUP BY agent_id, agent_name, center, service, channel
ORDER BY evaluation_count DESC;

-- agents 테이블에서 가짜 데이터 확인
SELECT 
  agent_id,
  agent_name,
  center,
  service,
  channel,
  total_evaluations
FROM `csopp-25f2.KMCC_QC.agents`
WHERE agent_id LIKE 'AGT%'
ORDER BY agent_id;

-- watch_list 테이블에서 가짜 데이터 확인
SELECT 
  watch_id,
  agent_id,
  agent_name,
  center,
  service,
  channel,
  created_date
FROM `csopp-25f2.KMCC_QC.watch_list`
WHERE agent_id LIKE 'AGT%'
ORDER BY created_date DESC;

-- ============================================================
-- 2. 실제 삭제 실행 (주의: 실행 전 위 쿼리로 확인 필수!)
-- ============================================================

-- evaluations 테이블에서 가짜 데이터 삭제
DELETE FROM `csopp-25f2.KMCC_QC.evaluations`
WHERE agent_id LIKE 'AGT%';

-- agents 테이블에서 가짜 데이터 삭제
DELETE FROM `csopp-25f2.KMCC_QC.agents`
WHERE agent_id LIKE 'AGT%';

-- watch_list 테이블에서 가짜 데이터 삭제
DELETE FROM `csopp-25f2.KMCC_QC.watch_list`
WHERE agent_id LIKE 'AGT%';

-- ============================================================
-- 3. 삭제 후 확인
-- ============================================================

-- evaluations 테이블에 가짜 데이터가 남아있는지 확인
SELECT COUNT(*) as remaining_fake_evaluations
FROM `csopp-25f2.KMCC_QC.evaluations`
WHERE agent_id LIKE 'AGT%';

-- agents 테이블에 가짜 데이터가 남아있는지 확인
SELECT COUNT(*) as remaining_fake_agents
FROM `csopp-25f2.KMCC_QC.agents`
WHERE agent_id LIKE 'AGT%';

-- watch_list 테이블에 가짜 데이터가 남아있는지 확인
SELECT COUNT(*) as remaining_fake_watchlist
FROM `csopp-25f2.KMCC_QC.watch_list`
WHERE agent_id LIKE 'AGT%';
