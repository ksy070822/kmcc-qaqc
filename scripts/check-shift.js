const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function run() {
  // 1. HR shift_type 분포
  console.log("=== 1. HR shift_type 분포 ===");
  var [rows1] = await bq.query({
    query: `SELECT shift_type, COUNT(*) as cnt, COUNT(DISTINCT id) as agents
            FROM (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            )
            WHERE type = '상담사'
            GROUP BY shift_type ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  rows1.forEach(function(r) {
    console.log("  " + (r.shift_type || "(빈값)") + ": " + r.cnt + "행, " + r.agents + "명");
  });

  // 2. 심야 상담사의 group/position 분포
  console.log("\n=== 2. 심야 상담사의 HR group/position ===");
  var [rows2] = await bq.query({
    query: `SELECT \`group\`, position, COUNT(DISTINCT id) as agents, COUNT(*) as cnt
            FROM (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            )
            WHERE type = '상담사' AND shift_type = '심야'
            GROUP BY \`group\`, position ORDER BY cnt DESC LIMIT 20`,
    location: "asia-northeast3"
  });
  rows2.forEach(function(r) {
    console.log("  " + r.group + "/" + r.position + ": " + r.agents + "명, " + r.cnt + "행");
  });

  // 3. 현재 evaluation에서 심야 shift 상담사가 어떤 서비스/채널로 되어있는지
  console.log("\n=== 3. 심야 shift 상담사의 현재 evaluation 서비스/채널 ===");
  var [rows3] = await bq.query({
    query: `SELECT e.service, e.channel, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            JOIN (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'
            WHERE h.shift_type = '심야'
            GROUP BY e.service, e.channel ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  rows3.forEach(function(r) {
    console.log("  " + r.service + "/" + r.channel + ": " + r.cnt + "건");
  });

  // 4. 심야로 보정 시 영향 범위
  console.log("\n=== 4. 심야 보정 대상 (현재 service != '심야' && HR shift_type = '심야') ===");
  var [rows4] = await bq.query({
    query: `SELECT e.service as from_svc, e.channel as from_ch, h.position as hr_ch, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            JOIN (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'
            WHERE h.shift_type = '심야' AND e.service != '심야'
            GROUP BY e.service, e.channel, h.position ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  var total4 = 0;
  rows4.forEach(function(r) {
    console.log("  " + r.from_svc + "/" + r.from_ch + " → 심야/" + r.hr_ch + ": " + r.cnt + "건");
    total4 += r.cnt;
  });
  console.log("  합계: " + total4 + "건");

  // 5. 게시판/보드 채널 상담사 - 실제 HR shift_type은?
  console.log("\n=== 5. 게시판/보드 채널의 HR shift_type ===");
  var [rows5] = await bq.query({
    query: `SELECT h.shift_type, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            JOIN (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'
            WHERE e.channel = '게시판/보드'
            GROUP BY h.shift_type ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  rows5.forEach(function(r) {
    console.log("  " + (r.shift_type || "(빈값)") + ": " + r.cnt + "건");
  });

  // 6. 광주 퀵/유선 42,466건 - HR shift_type 분포
  console.log("\n=== 6. 광주 퀵/유선의 HR shift_type ===");
  var [rows6] = await bq.query({
    query: `SELECT h.shift_type, h.position, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            JOIN (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'
            WHERE e.center = '광주' AND e.service = '퀵' AND e.channel = '유선'
            GROUP BY h.shift_type, h.position ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  rows6.forEach(function(r) {
    console.log("  shift=" + (r.shift_type || "(빈값)") + ", hr_pos=" + r.position + ": " + r.cnt + "건");
  });
}

run().catch(console.error);
