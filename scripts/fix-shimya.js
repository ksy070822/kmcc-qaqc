const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function run() {
  // 심야 shift 상담사 → service='심야', channel은 HR position 유지, group 재설정
  console.log("심야 shift 보정 실행...");
  var [job] = await bq.createQueryJob({
    query: `UPDATE \`csopp-25f2.KMCC_QC.evaluations\` e
            SET e.service = '심야',
                e.\`group\` = CONCAT('심야', ' ', h.position)
            FROM (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h
            WHERE LOWER(TRIM(h.id)) = e.agent_id
              AND h.date = e.evaluation_date
              AND h.type = '상담사'
              AND h.shift_type = '심야'
              AND e.service != '심야'`,
    location: "asia-northeast3"
  });
  await job.getQueryResults();
  var meta = await job.getMetadata();
  console.log("UPDATE 완료: " + meta[0].statistics.query.numDmlAffectedRows + "건");

  // 검증
  console.log("\n=== 보정 후 심야 분포 ===");
  var [rows] = await bq.query({
    query: "SELECT service, channel, `group`, COUNT(*) as cnt FROM `csopp-25f2.KMCC_QC.evaluations` WHERE service = '심야' GROUP BY service, channel, `group` ORDER BY cnt DESC",
    location: "asia-northeast3"
  });
  rows.forEach(function(r) {
    console.log("  " + r.service + " / " + r.channel + " / group=" + r.group + ": " + r.cnt + "건");
  });

  // 전체 그룹 분포
  console.log("\n=== 전체 그룹 분포 ===");
  var [rows2] = await bq.query({
    query: "SELECT center, service, channel, COUNT(*) as cnt FROM `csopp-25f2.KMCC_QC.evaluations` GROUP BY center, service, channel ORDER BY center, cnt DESC",
    location: "asia-northeast3"
  });
  rows2.forEach(function(r) {
    console.log("  " + r.center + " | " + (r.service || "(빈값)") + " / " + (r.channel || "(빈값)") + ": " + r.cnt + "건");
  });
}

run().catch(console.error);
