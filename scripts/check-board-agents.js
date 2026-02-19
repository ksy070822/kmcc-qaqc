const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function run() {
  // 1. evaluations 테이블 컬럼 확인
  console.log("=== 1. evaluations 컬럼 목록 ===");
  var [cols] = await bq.query({
    query: "SELECT column_name, data_type FROM `csopp-25f2.KMCC_QC.INFORMATION_SCHEMA.COLUMNS` WHERE table_name = 'evaluations' ORDER BY ordinal_position",
    location: "asia-northeast3"
  });
  cols.forEach(function(c) {
    console.log("  " + c.column_name + ": " + c.data_type);
  });

  // 2. 게시판/보드 상담사의 category_1depth 분포
  console.log("\n=== 2. 게시판/보드 channel의 category_1depth 분포 ===");
  var [rows2] = await bq.query({
    query: `SELECT service, category_1depth, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE channel = '게시판/보드'
            GROUP BY service, category_1depth
            ORDER BY cnt DESC
            LIMIT 30`,
    location: "asia-northeast3"
  });
  rows2.forEach(function(r) {
    console.log("  " + r.service + " | " + (r.category_1depth || "(빈값)") + ": " + r.cnt + "건");
  });

  // 3. 언더바 앞부분 (채널명) 추출
  console.log("\n=== 3. category_1depth 언더바 앞 (채널명) 분포 ===");
  var [rows3] = await bq.query({
    query: `SELECT service,
                   SPLIT(category_1depth, '_')[SAFE_OFFSET(0)] as channel_from_cat,
                   COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE channel = '게시판/보드'
            GROUP BY service, channel_from_cat
            ORDER BY cnt DESC`,
    location: "asia-northeast3"
  });
  rows3.forEach(function(r) {
    console.log("  " + r.service + " | channel=" + (r.channel_from_cat || "(빈값)") + ": " + r.cnt + "건");
  });

  // 4. category_1depth 전체 값 (언더바 뒤도 포함) - 서비스 추출 가능한지 확인
  console.log("\n=== 4. 게시판/보드의 category_1depth 전체 고유값 ===");
  var [rows4] = await bq.query({
    query: `SELECT DISTINCT category_1depth
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE channel = '게시판/보드'
            ORDER BY category_1depth`,
    location: "asia-northeast3"
  });
  rows4.forEach(function(r) {
    console.log("  " + (r.category_1depth || "(빈값)"));
  });

  // 5. consultation_id로 시트 M열 값 확인 가능한지
  console.log("\n=== 5. 게시판/보드의 consultation_id 샘플 ===");
  var [rows5] = await bq.query({
    query: `SELECT evaluation_id, agent_id, agent_name, evaluation_date, service, channel, category_1depth, consultation_id
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE channel = '게시판/보드'
            LIMIT 10`,
    location: "asia-northeast3"
  });
  rows5.forEach(function(r) {
    var d = r.evaluation_date ? r.evaluation_date.value : "";
    console.log("  " + r.agent_id + " | " + d + " | svc=" + r.service + " | cat1=" + (r.category_1depth || "") + " | consult=" + (r.consultation_id || ""));
  });
}

run().catch(console.error);
