const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

function fmtDate(v) {
  if (!v) return "(null)";
  if (v.value) return v.value;
  if (typeof v === "string") return v;
  return String(v);
}

async function run() {
  // 1. ggualle.itx 상세 히스토리 (그룹/포지션 변경 + 날짜 컬럼들)
  console.log("=== 1. ggualle.itx HR 상세 ===");
  var [rows1] = await bq.query({
    query: "SELECT date, name, id, `group`, position, shift_type, change_date, hire_date, training_start_date, resign_date, type, attendance FROM `csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot` WHERE LOWER(TRIM(id)) = 'ggualle.itx' ORDER BY date LIMIT 5",
    location: "asia-northeast3"
  });
  rows1.forEach(function(r) {
    console.log("  date=" + fmtDate(r.date) + " | group=" + r.group + " | pos=" + r.position + " | shift=" + r.shift_type);
    console.log("    change_date=" + fmtDate(r.change_date) + " | hire=" + fmtDate(r.hire_date) + " | train=" + fmtDate(r.training_start_date) + " | resign=" + fmtDate(r.resign_date));
    console.log("    type=" + r.type + " | attendance=" + r.attendance);
  });

  // 2. change_date 샘플 (DATE 타입이므로 TRIM 대신 IS NOT NULL만)
  console.log("\n=== 2. change_date 샘플 (용산) ===");
  var [rows2] = await bq.query({
    query: "SELECT DISTINCT id, name, change_date, `group`, position FROM `csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot` WHERE change_date IS NOT NULL LIMIT 20",
    location: "asia-northeast3"
  });
  rows2.forEach(function(r) {
    console.log("  " + r.id + " | " + r.name + " | change=" + fmtDate(r.change_date) + " | " + r.group + "/" + r.position);
  });

  // 3. 입사일/투입일/퇴사일 샘플
  console.log("\n=== 3. 입사일/투입일/퇴사일 샘플 (용산) ===");
  var [rows3] = await bq.query({
    query: "SELECT DISTINCT id, name, hire_date, training_start_date, resign_date, `group`, position FROM `csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot` WHERE type = '상담사' AND hire_date IS NOT NULL LIMIT 15",
    location: "asia-northeast3"
  });
  rows3.forEach(function(r) {
    console.log("  " + r.id + " | " + r.name + " | hire=" + fmtDate(r.hire_date) + " | train=" + fmtDate(r.training_start_date) + " | resign=" + fmtDate(r.resign_date) + " | " + r.group + "/" + r.position);
  });

  // 4. 날짜 범위
  console.log("\n=== 4. 스냅샷 날짜 범위 ===");
  var [rows4] = await bq.query({
    query: "SELECT 'Yongsan' as center, MIN(date) as min_date, MAX(date) as max_date, COUNT(DISTINCT date) as date_count FROM `csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot` UNION ALL SELECT 'Gwangju', MIN(date), MAX(date), COUNT(DISTINCT date) FROM `csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot`",
    location: "asia-northeast3"
  });
  rows4.forEach(function(r) {
    console.log("  " + r.center + ": " + fmtDate(r.min_date) + " ~ " + fmtDate(r.max_date) + " (" + r.date_count + "일)");
  });

  // 5. 컬럼 타입 확인
  console.log("\n=== 5. 컬럼 타입 확인 (Yongsan_Snapshot) ===");
  var [rows5] = await bq.query({
    query: "SELECT column_name, data_type FROM `csopp-25f2.kMCC_HR.INFORMATION_SCHEMA.COLUMNS` WHERE table_name = 'HR_Yongsan_Snapshot' ORDER BY ordinal_position",
    location: "asia-northeast3"
  });
  rows5.forEach(function(r) {
    console.log("  " + r.column_name + ": " + r.data_type);
  });

  // 6. evaluation과 HR 조인 가능성 테스트 (ggualle.itx, 샘플 5건)
  console.log("\n=== 6. evaluation ↔ HR 조인 테스트 (ggualle.itx) ===");
  var [rows6] = await bq.query({
    query: `SELECT e.evaluation_date, e.service, e.channel, e.center,
                   h.group as hr_group, h.position as hr_position, h.shift_type as hr_shift
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            LEFT JOIN \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\` h
              ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date
            WHERE e.agent_id = 'ggualle.itx'
            ORDER BY e.evaluation_date
            LIMIT 10`,
    location: "asia-northeast3"
  });
  rows6.forEach(function(r) {
    console.log("  " + fmtDate(r.evaluation_date) + " | eval: " + r.service + "/" + r.channel + " | HR: " + (r.hr_group || "(null)") + "/" + (r.hr_position || "(null)") + " shift=" + (r.hr_shift || ""));
  });

  // 7. 전체 evaluation vs HR 불일치 건수
  console.log("\n=== 7. evaluation channel vs HR position 불일치 통계 ===");
  var [rows7] = await bq.query({
    query: `SELECT
              COUNT(*) as total,
              COUNTIF(h.position IS NOT NULL) as hr_matched,
              COUNTIF(h.position IS NOT NULL AND e.channel = h.position) as channel_match,
              COUNTIF(h.position IS NOT NULL AND e.channel != h.position) as channel_mismatch
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            LEFT JOIN (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'`,
    location: "asia-northeast3"
  });
  rows7.forEach(function(r) {
    console.log("  전체: " + r.total + "건");
    console.log("  HR 매칭: " + r.hr_matched + "건");
    console.log("  채널 일치: " + r.channel_match + "건");
    console.log("  채널 불일치: " + r.channel_mismatch + "건");
  });
}

run().catch(console.error);
