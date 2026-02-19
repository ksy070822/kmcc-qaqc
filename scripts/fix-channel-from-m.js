const { google } = require("googleapis");
const { BigQuery } = require("@google-cloud/bigquery");

const SPREADSHEET_ID = "14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o";
const SHEETS = ["용산", "광주", "용산2025", "광주2025"];
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function run() {
  const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const sheetsApi = google.sheets({ version: "v4", auth });

  // 1. 각 시트에서 agent_id(E열) + consultation_id(L열) + M열(유선/채팅) 읽기
  // key: agent_id + "_" + consultation_id → channel
  var channelMap = {};
  var totalRows = 0;

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
      console.log("  행 수: " + rows.length);

      var count = 0;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var agentId = (row[eIdx] || "").trim().toLowerCase();
        var consultId = (row[lIdx] || "").trim();
        var channelVal = (row[mIdx] || "").trim();

        if (!agentId || !consultId || !channelVal) continue;

        // agent_id + consultation_id 조합 키
        var key = agentId + "|" + consultId;
        channelMap[key] = channelVal;
        count++;
      }
      console.log("  매핑: " + count + "건");
      totalRows += count;
    } catch (e) {
      console.log("  에러: " + e.message);
    }
  }

  console.log("\n총 매핑: " + totalRows + "건");

  // M열 값 분포
  var dist = {};
  Object.keys(channelMap).forEach(function(k) {
    var v = channelMap[k];
    dist[v] = (dist[v] || 0) + 1;
  });
  console.log("\nM열 값 분포:");
  Object.keys(dist).sort(function(a,b) { return dist[b] - dist[a]; }).forEach(function(k) {
    console.log("  " + k + ": " + dist[k] + "건");
  });

  // 2. BigQuery에서 전체 evaluations 조회 (agent_id, consultation_id, channel)
  var dryRun = !process.argv.includes("--execute");
  console.log("\nMode: " + (dryRun ? "DRY RUN" : "EXECUTE"));
  console.log("BigQuery 전체 조회 중...");

  var [bqRows] = await bq.query({
    query: "SELECT evaluation_id, agent_id, consultation_id, channel FROM `csopp-25f2.KMCC_QC.evaluations` WHERE consultation_id IS NOT NULL",
    location: "asia-northeast3"
  });
  console.log("BigQuery 레코드: " + bqRows.length + "건");

  // 3. 매칭 및 변경 대상 찾기
  var updates = []; // { evaluation_id, from, to }
  var corrections = {};
  var matched = 0;

  bqRows.forEach(function(r) {
    var key = (r.agent_id || "").toLowerCase() + "|" + (r.consultation_id || "");
    var newChannel = channelMap[key];
    if (newChannel) {
      matched++;
      if (r.channel !== newChannel) {
        updates.push({ id: r.evaluation_id, from: r.channel, to: newChannel });
        var ck = (r.channel || "(빈값)") + " -> " + newChannel;
        corrections[ck] = (corrections[ck] || 0) + 1;
      }
    }
  });

  console.log("매칭 성공: " + matched + "건");
  console.log("보정 대상: " + updates.length + "건");

  console.log("\n변경 내역:");
  Object.keys(corrections).sort(function(a,b) { return corrections[b] - corrections[a]; }).forEach(function(k) {
    console.log("  " + k + ": " + corrections[k] + "건");
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

      var q = "UPDATE `csopp-25f2.KMCC_QC.evaluations` SET channel = CASE evaluation_id " + cases + " END WHERE evaluation_id IN (" + ids + ")";
      var [job] = await bq.createQueryJob({ query: q, location: "asia-northeast3" });
      await job.getQueryResults();
      var meta = await job.getMetadata();
      totalAffected += parseInt(meta[0].statistics.query.numDmlAffectedRows || "0");

      if (b % 5000 === 0 && b > 0) console.log("  진행: " + b + "/" + updates.length);
    }
    console.log("UPDATE 완료: " + totalAffected + "건");

    // group 재정규화
    console.log("\ngroup 컬럼 재정규화...");
    var gq = "UPDATE `csopp-25f2.KMCC_QC.evaluations` SET `group` = CONCAT(service, ' ', channel) WHERE service != '' AND service IS NOT NULL AND channel != '' AND channel IS NOT NULL AND channel != 'unknown' AND `group` != CONCAT(service, ' ', channel)";
    var [gJob] = await bq.createQueryJob({ query: gq, location: "asia-northeast3" });
    await gJob.getQueryResults();
    var gMeta = await gJob.getMetadata();
    console.log("group 재정규화: " + gMeta[0].statistics.query.numDmlAffectedRows + "건");
  } else if (dryRun) {
    console.log("\n--execute 옵션으로 실행하면 실제 UPDATE됩니다.");
  }
}

run().catch(console.error);
