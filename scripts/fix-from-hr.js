const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

function fmtDate(v) {
  if (!v) return "(null)";
  if (v.value) return v.value;
  return String(v);
}

async function run() {
  var dryRun = !process.argv.includes("--execute");
  console.log("Mode: " + (dryRun ? "DRY RUN (분석만)" : "EXECUTE (실제 UPDATE)"));

  // 1. 전체 불일치 상세 분석
  console.log("\n=== 1. 불일치 상세 분석 ===");
  var [rows1] = await bq.query({
    query: `SELECT
              COUNT(*) as total,
              COUNTIF(h.position IS NOT NULL) as hr_matched,
              COUNTIF(h.position IS NOT NULL AND e.channel != h.position) as channel_diff,
              COUNTIF(h.position IS NOT NULL AND e.service != h.group) as service_diff,
              COUNTIF(h.position IS NOT NULL AND (e.channel != h.position OR e.service != h.group)) as any_diff
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            LEFT JOIN (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'`,
    location: "asia-northeast3"
  });
  var r = rows1[0];
  console.log("  전체 evaluation: " + r.total + "건");
  console.log("  HR 매칭: " + r.hr_matched + "건");
  console.log("  채널 불일치: " + r.channel_diff + "건");
  console.log("  서비스 불일치: " + r.service_diff + "건");
  console.log("  보정 대상 (채널 또는 서비스): " + r.any_diff + "건");

  // 2. 채널 변경 내역 분포
  console.log("\n=== 2. 채널 변경 분포 (현재 → HR) ===");
  var [rows2] = await bq.query({
    query: `SELECT e.channel as eval_ch, h.position as hr_ch, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            JOIN (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'
            WHERE e.channel != h.position
            GROUP BY e.channel, h.position
            ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  rows2.forEach(function(r) {
    console.log("  " + (r.eval_ch || "(빈값)") + " → " + r.hr_ch + ": " + r.cnt + "건");
  });

  // 3. 서비스 변경 내역 분포
  console.log("\n=== 3. 서비스 변경 분포 (현재 → HR) ===");
  var [rows3] = await bq.query({
    query: `SELECT e.service as eval_svc, h.group as hr_svc, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            JOIN (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'
            WHERE e.service != h.group
            GROUP BY e.service, h.group
            ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  rows3.forEach(function(r) {
    console.log("  " + (r.eval_svc || "(빈값)") + " → " + r.hr_svc + ": " + r.cnt + "건");
  });

  // 4. HR 매칭 실패 원인 분석
  console.log("\n=== 4. HR 매칭 실패 분석 ===");
  var [rows4] = await bq.query({
    query: `SELECT e.center, e.service, e.channel, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\` e
            LEFT JOIN (
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
              UNION ALL
              SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
            ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'
            WHERE h.id IS NULL
            GROUP BY e.center, e.service, e.channel
            ORDER BY cnt DESC
            LIMIT 20`,
    location: "asia-northeast3"
  });
  console.log("  HR 매칭 안 되는 레코드 (상위 20):");
  rows4.forEach(function(r) {
    console.log("  " + r.center + " / " + (r.service || "(빈값)") + " / " + (r.channel || "(빈값)") + ": " + r.cnt + "건");
  });

  // 5. 실행
  if (!dryRun) {
    console.log("\n=== 5. BigQuery UPDATE 실행 ===");

    // channel + service + group 동시 보정
    console.log("채널/서비스/그룹 보정 중...");
    var [job] = await bq.createQueryJob({
      query: `UPDATE \`csopp-25f2.KMCC_QC.evaluations\` e
              SET e.channel = h.position,
                  e.service = h.group,
                  e.\`group\` = CONCAT(h.group, ' ', h.position)
              FROM (
                SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
                UNION ALL
                SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
              ) h
              WHERE LOWER(TRIM(h.id)) = e.agent_id
                AND h.date = e.evaluation_date
                AND h.type = '상담사'
                AND (e.channel != h.position OR e.service != h.group)`,
      location: "asia-northeast3"
    });
    await job.getQueryResults();
    var meta = await job.getMetadata();
    var affected = meta[0].statistics.query.numDmlAffectedRows;
    console.log("UPDATE 완료: " + affected + "건 보정됨");

    // 검증
    console.log("\n=== 6. 보정 후 검증 ===");
    var [v1] = await bq.query({
      query: `SELECT
                COUNT(*) as total,
                COUNTIF(h.position IS NOT NULL AND e.channel = h.position) as channel_match,
                COUNTIF(h.position IS NOT NULL AND e.channel != h.position) as channel_mismatch,
                COUNTIF(h.position IS NOT NULL AND e.service = h.group) as service_match,
                COUNTIF(h.position IS NOT NULL AND e.service != h.group) as service_mismatch
              FROM \`csopp-25f2.KMCC_QC.evaluations\` e
              LEFT JOIN (
                SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot\`
                UNION ALL
                SELECT * FROM \`csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot\`
              ) h ON LOWER(TRIM(h.id)) = e.agent_id AND h.date = e.evaluation_date AND h.type = '상담사'`,
      location: "asia-northeast3"
    });
    var v = v1[0];
    console.log("  채널 일치: " + v.channel_match + "건");
    console.log("  채널 불일치: " + v.channel_mismatch + "건");
    console.log("  서비스 일치: " + v.service_match + "건");
    console.log("  서비스 불일치: " + v.service_mismatch + "건");

    // 보정 후 그룹 분포
    console.log("\n=== 7. 보정 후 그룹 분포 ===");
    var [v2] = await bq.query({
      query: "SELECT `group`, COUNT(*) as cnt FROM `csopp-25f2.KMCC_QC.evaluations` GROUP BY `group` ORDER BY cnt DESC",
      location: "asia-northeast3"
    });
    v2.forEach(function(r) {
      console.log("  " + (r.group || "(빈값)") + ": " + r.cnt + "건");
    });
  } else {
    console.log("\n--execute 옵션으로 실행하면 실제 UPDATE됩니다.");
    console.log("예: node scripts/fix-from-hr.js --execute");
  }
}

run().catch(console.error);
