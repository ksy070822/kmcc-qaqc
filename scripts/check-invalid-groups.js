const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function run() {
  // 유효한 서비스/채널 조합
  var validGroups = {
    "용산": [
      "택시/유선", "택시/채팅",
      "대리/유선", "대리/채팅",
      "퀵/유선", "퀵/채팅"
    ],
    "광주": [
      "택시/유선", "택시/채팅",
      "대리/유선", "대리/채팅",
      "바이크/마스/유선", "바이크/마스/채팅",
      "주차/카오너/유선", "주차/카오너/채팅",
      "화물/유선", "화물/채팅",
      "퀵/채팅"
    ]
  };

  // 1. 현재 전체 분포
  console.log("=== 현재 center/service/channel 분포 ===");
  var [rows] = await bq.query({
    query: `SELECT center, service, channel, COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            GROUP BY center, service, channel
            ORDER BY center, cnt DESC`,
    location: "asia-northeast3"
  });

  var invalidCount = 0;
  var invalidRows = [];
  rows.forEach(function(r) {
    var key = r.service + "/" + r.channel;
    var centerValid = validGroups[r.center];
    var isValid = centerValid && centerValid.indexOf(key) >= 0;
    var mark = isValid ? "  OK" : "  ** INVALID **";
    console.log("  " + r.center + " | " + (r.service || "(빈값)") + " / " + (r.channel || "(빈값)") + ": " + r.cnt + "건" + mark);
    if (!isValid) {
      invalidCount += r.cnt;
      invalidRows.push({ center: r.center, service: r.service, channel: r.channel, cnt: r.cnt });
    }
  });

  console.log("\n유효: " + (353680 - invalidCount) + "건");
  console.log("무효: " + invalidCount + "건");

  // 2. 무효 데이터 상담사 샘플
  console.log("\n=== 무효 그룹 상담사 샘플 ===");
  for (var i = 0; i < Math.min(invalidRows.length, 10); i++) {
    var inv = invalidRows[i];
    var svcCond = inv.service ? "e.service = '" + inv.service + "'" : "(e.service IS NULL OR e.service = '')";
    var chCond = inv.channel ? "e.channel = '" + inv.channel + "'" : "(e.channel IS NULL OR e.channel = '')";

    var [sample] = await bq.query({
      query: "SELECT DISTINCT e.agent_id, e.agent_name, e.center FROM `csopp-25f2.KMCC_QC.evaluations` e WHERE e.center = '" + inv.center + "' AND " + svcCond + " AND " + chCond + " LIMIT 5",
      location: "asia-northeast3"
    });
    console.log("\n" + inv.center + " / " + (inv.service || "(빈값)") + " / " + (inv.channel || "(빈값)") + " (" + inv.cnt + "건):");
    sample.forEach(function(s) {
      console.log("  " + s.agent_id + " (" + s.agent_name + ")");
    });
  }
}

run().catch(console.error);
