const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function verify() {
  // queen.koc: H열 = "2025-04-01 / 택시,유선,야간 -> 택시,채팅,야간"
  // 변경전(~03/31): 택시/유선, 변경후(04/01~): 택시/채팅
  const [rows] = await bq.query({
    query: `SELECT evaluation_date, service, channel
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE agent_id = 'queen.koc'
            ORDER BY evaluation_date`,
    location: "asia-northeast3"
  });

  console.log("=== queen.koc (여지은) ===");
  console.log("H열: 2025-04-01 / 택시,유선,야간 -> 택시,채팅,야간");
  console.log("기대: ~03/31 = 택시/유선, 04/01~ = 택시/채팅\n");

  var prev = "";
  rows.forEach(function(r) {
    var d = r.evaluation_date.value;
    var g = r.service + "/" + r.channel;
    if (g !== prev) {
      console.log(">>> 변경: " + (prev || "(시작)") + " -> " + g);
      prev = g;
    }
    console.log("  " + d + " | " + r.service + " | " + r.channel);
  });

  // maxi.koc: H열 = "2025-05-01 / 택시,유선,야간 -> 택시,채팅,야간"
  const [rows2] = await bq.query({
    query: `SELECT evaluation_date, service, channel
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE agent_id = 'maxi.koc'
            ORDER BY evaluation_date`,
    location: "asia-northeast3"
  });

  console.log("\n=== maxi.koc (유주현) ===");
  console.log("H열: 2025-05-01 / 택시,유선,야간 -> 택시,채팅,야간");
  console.log("기대: ~04/30 = 택시/유선, 05/01~ = 택시/채팅\n");

  prev = "";
  rows2.forEach(function(r) {
    var d = r.evaluation_date.value;
    var g = r.service + "/" + r.channel;
    if (g !== prev) {
      console.log(">>> 변경: " + (prev || "(시작)") + " -> " + g);
      prev = g;
    }
    console.log("  " + d + " | " + r.service + " | " + r.channel);
  });
}
verify().catch(console.error);
