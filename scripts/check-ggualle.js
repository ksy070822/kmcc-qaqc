const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function run() {
  // ggualle.itx 전체 평가 이력
  const [rows] = await bq.query({
    query: `SELECT evaluation_date, service, channel
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE agent_id = 'ggualle.itx'
            ORDER BY evaluation_date`,
    location: "asia-northeast3"
  });

  console.log("=== ggualle.itx (윤영석) 전체 이력 ===");
  console.log("H열: 2025-09-01 / 바이크/마스,채팅,야간 -> 바이크/마스,게시판/보드,야간");
  console.log("기대: ~08/31 = 바이크/마스 채팅, 09/01~ = 바이크/마스 게시판/보드\n");

  var prev = "";
  var counts = {};
  rows.forEach(function(r) {
    var d = r.evaluation_date.value;
    var g = r.service + "/" + r.channel;
    if (!counts[g]) counts[g] = { before: 0, after: 0 };
    if (d < "2025-09-01") {
      counts[g].before++;
    } else {
      counts[g].after++;
    }
    if (g !== prev) {
      console.log(">>> 변경: " + (prev || "(시작)") + " -> " + g + " (at " + d + ")");
      prev = g;
    }
  });

  console.log("\n=== 날짜 기준 집계 ===");
  Object.keys(counts).forEach(function(k) {
    console.log(k + ": ~08/31=" + counts[k].before + "건, 09/01~=" + counts[k].after + "건");
  });
  console.log("\n총 " + rows.length + "건");
}
run().catch(console.error);
