const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function verify() {
  // 1. artty.itx 평가 이력 확인
  const [rows] = await bq.query({
    query: `SELECT evaluation_date, service, channel
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE agent_id = 'artty.itx'
            ORDER BY evaluation_date`,
    location: "asia-northeast3"
  });

  console.log("=== artty.itx (김지애) 평가 이력 ===");
  var prev = "";
  rows.forEach(function(r) {
    var d = r.evaluation_date.value;
    var g = r.service + "/" + r.channel;
    if (g !== prev) {
      console.log(">>> 그룹 변경: " + prev + " -> " + g);
      prev = g;
    }
    console.log(d + " | " + r.service + " | " + r.channel);
  });
  console.log("총 " + rows.length + "건\n");

  // 2. 다른 상담사도 샘플 확인
  const agents = ["musky.itx", "white.itx"];
  for (const aid of agents) {
    const [r2] = await bq.query({
      query: `SELECT evaluation_date, service, channel
              FROM \`csopp-25f2.KMCC_QC.evaluations\`
              WHERE agent_id = '${aid}'
              ORDER BY evaluation_date`,
      location: "asia-northeast3"
    });
    console.log("=== " + aid + " ===");
    prev = "";
    r2.forEach(function(r) {
      var d = r.evaluation_date.value;
      var g = r.service + "/" + r.channel;
      if (g !== prev) {
        console.log(">>> 그룹 변경: " + prev + " -> " + g);
        prev = g;
      }
      console.log(d + " | " + r.service + " | " + r.channel);
    });
    console.log("총 " + r2.length + "건\n");
  }
}
verify().catch(console.error);
