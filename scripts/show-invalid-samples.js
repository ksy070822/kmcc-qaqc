const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

function fmtDate(v) {
  if (!v) return "(null)";
  if (v.value) return v.value;
  return String(v);
}

async function run() {
  // 무효 서비스별 샘플 조회
  var services = ["지금여기", "심사", "기타", "파트너가이드", "Staff"];

  for (var si = 0; si < services.length; si++) {
    var svc = services[si];
    console.log("\n=== " + svc + " 샘플 ===");

    var [rows] = await bq.query({
      query: "SELECT evaluation_id, agent_id, agent_name, evaluation_date, service, channel, consultation_id, consult_type_depth1_1, consult_type_depth1_2, center FROM `csopp-25f2.KMCC_QC.evaluations` WHERE service = '" + svc + "' ORDER BY evaluation_date DESC LIMIT 10",
      location: "asia-northeast3"
    });

    rows.forEach(function(r) {
      console.log("  " + r.agent_id + " (" + (r.agent_name || "") + ") | " + fmtDate(r.evaluation_date) + " | center=" + (r.center || "") + " | ch=" + r.channel);
      console.log("    consult_id=" + (r.consultation_id || "(빈)") + " | d1_1=" + (r.consult_type_depth1_1 || "(빈)") + " | d1_2=" + (r.consult_type_depth1_2 || "(빈)"));
    });

    // HR 매칭 확인
    var [hrRows] = await bq.query({
      query: "SELECT DISTINCT e.agent_id, e.agent_name, h.group_val, h.position, h.shift_type FROM `csopp-25f2.KMCC_QC.evaluations` e LEFT JOIN (SELECT id, date, `group` as group_val, position, shift_type FROM `csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot` WHERE type = '상담사' UNION ALL SELECT id, date, `group` as group_val, position, shift_type FROM `csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot` WHERE type = '상담사') h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date WHERE e.service = '" + svc + "' LIMIT 10",
      location: "asia-northeast3"
    });

    if (hrRows.length > 0) {
      console.log("  [HR 매칭]");
      hrRows.forEach(function(r) {
        console.log("    " + r.agent_id + " → HR group=" + (r.group_val || "(없음)") + ", position=" + (r.position || "(없음)") + ", shift=" + (r.shift_type || "(없음)"));
      });
    } else {
      console.log("  [HR 매칭 없음]");
    }
  }

  // 전체 요약
  console.log("\n=== 전체 무효 서비스 요약 ===");
  var [summary] = await bq.query({
    query: "SELECT service, channel, center, COUNT(*) as cnt FROM `csopp-25f2.KMCC_QC.evaluations` WHERE service NOT IN ('택시', '대리', '퀵', '바이크/마스', '주차/카오너', '화물', '심야') GROUP BY service, channel, center ORDER BY service, cnt DESC",
    location: "asia-northeast3"
  });
  summary.forEach(function(r) {
    console.log("  " + (r.center || "") + " | " + r.service + " / " + r.channel + ": " + r.cnt + "건");
  });
}

run().catch(console.error);
