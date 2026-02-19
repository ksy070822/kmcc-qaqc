const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function run() {
  // 1. 서비스 불일치 분포
  console.log("=== 서비스 불일치 345건 상세 ===");
  var [rows1] = await bq.query({
    query: `SELECT e.service as eval_svc, h.group as hr_svc, e.channel as eval_ch, h.position as hr_pos, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            JOIN (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'
            WHERE e.service != h.group
            GROUP BY e.service, h.group, e.channel, h.position
            ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  rows1.forEach(function(r) {
    console.log("  eval: " + r.eval_svc + "/" + r.eval_ch + " → HR: " + r.hr_svc + "/" + r.hr_pos + " : " + r.cnt + "건");
  });

  // 2. 상담사별 샘플
  console.log("\n=== 상담사별 샘플 ===");
  var [rows2] = await bq.query({
    query: `SELECT e.agent_id, e.agent_name, e.center, e.evaluation_date, e.service, e.channel, h.group as hr_svc, h.position as hr_pos
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            JOIN (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'
            WHERE e.service != h.group
            ORDER BY e.agent_id, e.evaluation_date
            LIMIT 30`,
    location: "asia-northeast3"
  });
  rows2.forEach(function(r) {
    var d = r.evaluation_date ? r.evaluation_date.value : "";
    console.log("  " + r.agent_id + " (" + r.agent_name + ") " + r.center + " " + d + " | eval: " + r.service + "/" + r.channel + " → HR: " + r.hr_svc + "/" + r.hr_pos);
  });
}

run().catch(console.error);
