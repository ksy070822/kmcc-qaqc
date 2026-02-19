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

  // 1. 시트에서 agent_id + consultation_id → M열(유선/채팅) 매핑
  var channelMap = {};
  var totalMapped = 0;

  for (var si = 0; si < SHEETS.length; si++) {
    var sheetName = SHEETS[si];
    console.log("[" + sheetName + "] 읽는 중...");

    try {
      var hRes = await sheetsApi.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName + "!A1:Z1"
      });
      var headers = hRes.data.values ? hRes.data.values[0] : [];

      var mIdx = headers.indexOf("유선/채팅");
      var eIdx = headers.indexOf("ID");
      var lIdx = headers.indexOf("상담ID");

      if (mIdx === -1) {
        console.log("  유선/채팅 열 없음, skip");
        continue;
      }
      console.log("  유선/채팅=" + mIdx + ", ID=" + eIdx + ", 상담ID=" + lIdx);

      var res = await sheetsApi.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName + "!A2:Z"
      });
      var rows = res.data.values || [];

      var count = 0;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var agentId = (row[eIdx] || "").trim().toLowerCase();
        var consultId = (row[lIdx] || "").trim();
        var channelVal = (row[mIdx] || "").trim();

        if (!agentId || !consultId || !channelVal) continue;

        var key = agentId + "|" + consultId;
        channelMap[key] = channelVal;
        count++;
      }
      console.log("  매핑: " + count + "건");
      totalMapped += count;
    } catch (e) {
      console.log("  에러: " + e.message);
    }
  }

  console.log("\n총 시트 매핑: " + totalMapped + "건");

  // 2. BigQuery에서 게시판/보드 레코드 조회
  console.log("\nBigQuery 게시판/보드 조회 중...");
  var [bqRows] = await bq.query({
    query: "SELECT evaluation_id, agent_id, consultation_id, channel, service FROM `csopp-25f2.KMCC_QC.evaluations` WHERE channel = '게시판/보드'",
    location: "asia-northeast3"
  });
  console.log("게시판/보드 레코드: " + bqRows.length + "건");

  // 3. 매칭
  var updates = [];
  var corrections = {};
  var matched = 0;
  var unmatched = 0;

  bqRows.forEach(function(r) {
    var key = (r.agent_id || "").toLowerCase() + "|" + (r.consultation_id || "");
    var newChannel = channelMap[key];
    if (newChannel) {
      matched++;
      updates.push({ id: r.evaluation_id, to: newChannel, service: r.service });
      var ck = r.service + ": 게시판/보드 -> " + newChannel;
      corrections[ck] = (corrections[ck] || 0) + 1;
    } else {
      unmatched++;
    }
  });

  console.log("M열 매칭: " + matched + "건");
  console.log("M열 미매칭: " + unmatched + "건");

  console.log("\n변경 내역:");
  Object.keys(corrections).sort(function(a, b) { return corrections[b] - corrections[a]; }).forEach(function(k) {
    console.log("  " + k + ": " + corrections[k] + "건");
  });

  // 4. 미매칭 상담사 분포
  if (unmatched > 0) {
    console.log("\n미매칭 상담사 분포:");
    var unmatchedAgents = {};
    bqRows.forEach(function(r) {
      var key = (r.agent_id || "").toLowerCase() + "|" + (r.consultation_id || "");
      if (!channelMap[key]) {
        var ak = r.agent_id + " (" + r.service + ")";
        unmatchedAgents[ak] = (unmatchedAgents[ak] || 0) + 1;
      }
    });
    Object.keys(unmatchedAgents).sort(function(a, b) { return unmatchedAgents[b] - unmatchedAgents[a]; }).forEach(function(k) {
      console.log("  " + k + ": " + unmatchedAgents[k] + "건");
    });
  }

  // 5. 실행
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

      if (b % 5000 === 0 && b > 0) console.log("  진행: " + b + "/" + updates.length);
    }
    console.log("UPDATE 완료: " + totalAffected + "건");

    // 검증
    console.log("\n=== 보정 후 검증 ===");
    var [v] = await bq.query({
      query: "SELECT channel, COUNT(*) as cnt FROM `csopp-25f2.KMCC_QC.evaluations` WHERE channel = '게시판/보드' GROUP BY channel",
      location: "asia-northeast3"
    });
    if (v.length === 0) {
      console.log("게시판/보드 0건 - 전부 보정 완료!");
    } else {
      v.forEach(function(r) { console.log("  남은 게시판/보드: " + r.cnt + "건"); });
    }
  } else if (dryRun) {
    console.log("\n--execute 로 실행하면 실제 UPDATE됩니다.");
  }
}

run().catch(console.error);
