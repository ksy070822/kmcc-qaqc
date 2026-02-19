const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function run() {
  // 1. 게시판/보드 상담사의 consult_type_depth1_1 분포
  console.log("=== 1. 게시판/보드 channel의 consult_type_depth1_1 분포 ===");
  var [rows1] = await bq.query({
    query: `SELECT service, consult_type_depth1_1, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE channel = '게시판/보드'
            GROUP BY service, consult_type_depth1_1
            ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  rows1.forEach(function(r) {
    console.log("  " + r.service + " | " + (r.consult_type_depth1_1 || "(빈값)") + ": " + r.cnt + "건");
  });

  // 2. 언더바 앞 (채널명) 추출
  console.log("\n=== 2. 언더바 앞 (채널명) 분포 ===");
  var [rows2] = await bq.query({
    query: `SELECT service,
                   SPLIT(consult_type_depth1_1, '_')[SAFE_OFFSET(0)] as ch_prefix,
                   COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE channel = '게시판/보드'
            GROUP BY service, ch_prefix
            ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  rows2.forEach(function(r) {
    console.log("  " + r.service + " | prefix=" + (r.ch_prefix || "(빈값)") + ": " + r.cnt + "건");
  });

  // 3. 언더바 뒤 (서비스명?) 추출
  console.log("\n=== 3. 언더바 뒤 (서비스명) 분포 ===");
  var [rows3] = await bq.query({
    query: `SELECT service,
                   SPLIT(consult_type_depth1_1, '_')[SAFE_OFFSET(0)] as ch_prefix,
                   SPLIT(consult_type_depth1_1, '_')[SAFE_OFFSET(1)] as svc_part,
                   COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE channel = '게시판/보드'
            GROUP BY service, ch_prefix, svc_part
            ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  rows3.forEach(function(r) {
    console.log("  현재svc=" + r.service + " | " + (r.ch_prefix || "") + " / " + (r.svc_part || "(빈값)") + ": " + r.cnt + "건");
  });

  // 4. 전체 consult_type_depth1_1 고유값 (게시판/보드만)
  console.log("\n=== 4. consult_type_depth1_1 고유값 (게시판/보드) ===");
  var [rows4] = await bq.query({
    query: `SELECT DISTINCT consult_type_depth1_1
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE channel = '게시판/보드'
            ORDER BY consult_type_depth1_1`,
    location: "asia-northeast3"
  });
  rows4.forEach(function(r) {
    console.log("  " + (r.consult_type_depth1_1 || "(빈값)"));
  });
}

run().catch(console.error);
