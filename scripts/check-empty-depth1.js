const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

function fmtDate(v) {
  if (!v) return "(null)";
  if (v.value) return v.value;
  return String(v);
}

async function run() {
  // 1. 빈값인 레코드의 다른 depth 컬럼도 확인
  console.log("=== 1. consult_type_depth1_1 빈값 레코드의 다른 컬럼 ===");
  var [rows1] = await bq.query({
    query: `SELECT agent_id, agent_name, evaluation_date, service, channel,
                   consult_type_depth1_1, consult_type_depth1_2, consult_type_depth1_3, consult_type_depth1_4,
                   consult_type_depth2_1, consultation_id
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE channel = '게시판/보드'
              AND (consult_type_depth1_1 IS NULL OR consult_type_depth1_1 = '')
            ORDER BY evaluation_date DESC
            LIMIT 15`,
    location: "asia-northeast3"
  });
  rows1.forEach(function(r) {
    console.log("  " + r.agent_id + " (" + r.agent_name + ") " + fmtDate(r.evaluation_date) + " | svc=" + r.service);
    console.log("    d1_1=" + (r.consult_type_depth1_1 || "(빈)") + " d1_2=" + (r.consult_type_depth1_2 || "(빈)") + " d1_3=" + (r.consult_type_depth1_3 || "(빈)") + " d1_4=" + (r.consult_type_depth1_4 || "(빈)"));
    console.log("    d2_1=" + (r.consult_type_depth2_1 || "(빈)") + " consult_id=" + (r.consultation_id || "(빈)"));
  });

  // 2. 빈값 vs 유값 날짜 분포
  console.log("\n=== 2. 빈값 날짜 분포 ===");
  var [rows2] = await bq.query({
    query: `SELECT
              FORMAT_DATE('%Y-%m', evaluation_date) as month,
              COUNTIF(consult_type_depth1_1 IS NULL OR consult_type_depth1_1 = '') as empty_cnt,
              COUNTIF(consult_type_depth1_1 IS NOT NULL AND consult_type_depth1_1 != '') as filled_cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE channel = '게시판/보드'
            GROUP BY month ORDER BY month`,
    location: "asia-northeast3"
  });
  rows2.forEach(function(r) {
    console.log("  " + r.month + " | 빈값=" + r.empty_cnt + ", 유값=" + r.filled_cnt);
  });

  // 3. 빈값 상담사 목록
  console.log("\n=== 3. 빈값 상담사별 건수 ===");
  var [rows3] = await bq.query({
    query: `SELECT agent_id, agent_name, service, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE channel = '게시판/보드'
              AND (consult_type_depth1_1 IS NULL OR consult_type_depth1_1 = '')
            GROUP BY agent_id, agent_name, service
            ORDER BY cnt DESC
            LIMIT 20`,
    location: "asia-northeast3"
  });
  rows3.forEach(function(r) {
    console.log("  " + r.agent_id + " (" + r.agent_name + ") svc=" + r.service + ": " + r.cnt + "건");
  });

  // 4. 같은 상담사가 유값도 갖고 있는지
  console.log("\n=== 4. 빈값 상담사가 유값도 있는지 ===");
  var [rows4] = await bq.query({
    query: `WITH empty_agents AS (
              SELECT DISTINCT agent_id
              FROM \`csopp-25f2.KMCC_QC.evaluations\`
              WHERE channel = '게시판/보드'
                AND (consult_type_depth1_1 IS NULL OR consult_type_depth1_1 = '')
            )
            SELECT e.agent_id, e.agent_name,
                   COUNTIF(e.consult_type_depth1_1 IS NULL OR e.consult_type_depth1_1 = '') as empty,
                   COUNTIF(e.consult_type_depth1_1 IS NOT NULL AND e.consult_type_depth1_1 != '') as filled,
                   STRING_AGG(DISTINCT e.consult_type_depth1_1, ', ') as filled_values
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            JOIN empty_agents ea ON e.agent_id = ea.agent_id
            WHERE e.channel = '게시판/보드'
            GROUP BY e.agent_id, e.agent_name
            ORDER BY empty DESC
            LIMIT 15`,
    location: "asia-northeast3"
  });
  rows4.forEach(function(r) {
    console.log("  " + r.agent_id + " (" + r.agent_name + ") 빈=" + r.empty + ", 유=" + r.filled + " | " + (r.filled_values || "없음"));
  });
}

run().catch(console.error);
