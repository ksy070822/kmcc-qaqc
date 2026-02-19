const { google } = require("googleapis");
const { BigQuery } = require("@google-cloud/bigquery");

const SPREADSHEET_ID = "14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o";
const SHEETS = ["용산", "광주", "용산2025", "광주2025"];
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function run() {
  var dryRun = !process.argv.includes("--execute");
  console.log("Mode: " + (dryRun ? "DRY RUN" : "EXECUTE"));

  var auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  var sheetsApi = google.sheets({ version: "v4", auth });

  // 1. 시트 M열 매핑
  var channelMap = {};
  for (var si = 0; si < SHEETS.length; si++) {
    var sheetName = SHEETS[si];
    try {
      var hRes = await sheetsApi.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName + "!A1:Z1" });
      var headers = hRes.data.values ? hRes.data.values[0] : [];
      var mIdx = headers.indexOf("유선/채팅");
      var eIdx = headers.indexOf("ID");
      var lIdx = headers.indexOf("상담ID");
      if (mIdx === -1) continue;

      var res = await sheetsApi.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName + "!A2:Z" });
      var rows = res.data.values || [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var agentId = (row[eIdx] || "").trim().toLowerCase();
        var consultId = (row[lIdx] || "").trim();
        var channelVal = (row[mIdx] || "").trim();
        if (agentId && consultId && channelVal) {
          channelMap[agentId + "|" + consultId] = channelVal;
        }
      }
    } catch (e) {
      console.log("[" + sheetName + "] 에러: " + e.message);
    }
  }
  console.log("시트 M열 매핑: " + Object.keys(channelMap).length + "건\n");

  // 2. BigQuery 게시판/보드 조회
  var [bqRows] = await bq.query({
    query: "SELECT evaluation_id, agent_id, consultation_id, channel, service FROM `csopp-25f2.KMCC_QC.evaluations` WHERE channel = '게시판/보드'",
    location: "asia-northeast3"
  });
  console.log("게시판/보드: " + bqRows.length + "건");

  // 3. 채널 결정: M열 우선, 없으면 consultation_id CN 여부
  var updates = [];
  var stats = { m_match: 0, cn_voice: 0, cn_chat: 0 };

  bqRows.forEach(function(r) {
    var key = (r.agent_id || "").toLowerCase() + "|" + (r.consultation_id || "");
    var newChannel = channelMap[key];

    if (newChannel) {
      stats.m_match++;
    } else {
      // CN으로 시작하면 유선, 아니면 채팅
      var cid = (r.consultation_id || "").trim();
      if (cid.toUpperCase().startsWith("CN")) {
        newChannel = "유선";
        stats.cn_voice++;
      } else {
        newChannel = "채팅";
        stats.cn_chat++;
      }
    }

    updates.push({ id: r.evaluation_id, to: newChannel, service: r.service });
  });

  console.log("  M열 매칭: " + stats.m_match + "건");
  console.log("  CN→유선: " + stats.cn_voice + "건");
  console.log("  숫자→채팅: " + stats.cn_chat + "건");

  // 변경 분포
  var dist = {};
  updates.forEach(function(u) {
    var k = u.service + ": 게시판/보드 → " + u.to;
    dist[k] = (dist[k] || 0) + 1;
  });
  console.log("\n변경 분포:");
  Object.keys(dist).sort(function(a, b) { return dist[b] - dist[a]; }).forEach(function(k) {
    console.log("  " + k + ": " + dist[k] + "건");
  });

  // 4. 실행
  if (!dryRun && updates.length > 0) {
    console.log("\nBigQuery UPDATE 실행 중...");
    var BATCH = 500;
    var totalAffected = 0;

    for (var b = 0; b < updates.length; b += BATCH) {
      var batch = updates.slice(b, b + BATCH);
      var cases = batch.map(function(u) {
        return "WHEN '" + u.id.replace(/'/g, "\\'") + "' THEN '" + u.to + "'";
      }).join(" ");
      var ids = batch.map(function(u) {
        return "'" + u.id.replace(/'/g, "\\'") + "'";
      }).join(",");

      var q = "UPDATE `csopp-25f2.KMCC_QC.evaluations` SET channel = CASE evaluation_id " + cases + " END, `group` = CONCAT(service, ' ', CASE evaluation_id " + cases + " END) WHERE evaluation_id IN (" + ids + ")";
      var [job] = await bq.createQueryJob({ query: q, location: "asia-northeast3" });
      await job.getQueryResults();
      var meta = await job.getMetadata();
      totalAffected += parseInt(meta[0].statistics.query.numDmlAffectedRows || "0");

      if (b % 2000 === 0 && b > 0) console.log("  진행: " + b + "/" + updates.length);
    }
    console.log("UPDATE 완료: " + totalAffected + "건");

    // 검증
    var [v] = await bq.query({
      query: "SELECT channel, COUNT(*) as cnt FROM `csopp-25f2.KMCC_QC.evaluations` WHERE channel = '게시판/보드'",
      location: "asia-northeast3"
    });
    console.log("남은 게시판/보드: " + (v.length > 0 ? v[0].cnt : 0) + "건");

    // 최종 그룹 분포
    console.log("\n=== 최종 그룹 분포 ===");
    var [g] = await bq.query({
      query: "SELECT center, service, channel, COUNT(*) as cnt FROM `csopp-25f2.KMCC_QC.evaluations` GROUP BY center, service, channel ORDER BY center, cnt DESC",
      location: "asia-northeast3"
    });
    g.forEach(function(r) {
      console.log("  " + r.center + " | " + (r.service || "(빈)") + " / " + (r.channel || "(빈)") + ": " + r.cnt + "건");
    });
  } else if (dryRun) {
    console.log("\n--execute 로 실행하면 실제 UPDATE됩니다.");
  }
}

run().catch(console.error);
