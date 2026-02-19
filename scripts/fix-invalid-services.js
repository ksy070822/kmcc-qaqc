const { google } = require("googleapis");
const { BigQuery } = require("@google-cloud/bigquery");

const SPREADSHEET_ID = "14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o";
const SHEETS = ["용산", "광주", "용산2025", "광주2025"];
const bq = new BigQuery({ projectId: "csopp-25f2" });

// 유효 서비스 목록
var VALID_SERVICES = ["택시", "대리", "퀵", "바이크/마스", "주차/카오너", "화물", "심야"];

// consult_type_depth1_1 언더바 앞 → 서비스 매핑
var SERVICE_MAP = {
  "택시": "택시",
  "대리": "대리",
  "퀵": "퀵",
  "배송": "퀵",
  "바이크": "바이크/마스",
  "항공": "바이크/마스",
  "렌터카": "바이크/마스",
  "기차": "바이크/마스",
  "펫": "바이크/마스",
  "셔틀": "바이크/마스",
  "광역콜버스": "바이크/마스",
  "버스대절": "바이크/마스",
  "괌택시예약": "바이크/마스",
  "해외차량호출": "바이크/마스",
  "주차": "주차/카오너",
  "세차": "주차/카오너",
  "내비": "주차/카오너",
  "보험": "주차/카오너",
  "전기차충전": "주차/카오너",
  "발레": "주차/카오너",
  "픽커": "주차/카오너",
  "자동차검사": "주차/카오너",
  "화물": "화물",
  "카카오T": null  // 공통 → HR 기준 유지
};

async function run() {
  var dryRun = !process.argv.includes("--execute");
  console.log("Mode: " + (dryRun ? "DRY RUN" : "EXECUTE"));

  // 1. 무효 서비스 현황 + consult_type_depth1_1 분포
  console.log("\n=== 1. 무효 서비스의 consult_type_depth1_1 분포 ===");
  var [rows1] = await bq.query({
    query: `SELECT service, channel,
                   SPLIT(consult_type_depth1_1, '_')[SAFE_OFFSET(0)] as svc_prefix,
                   COUNT(*) as cnt
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE service NOT IN ('택시', '대리', '퀵', '바이크/마스', '주차/카오너', '화물', '심야')
            GROUP BY service, channel, svc_prefix
            ORDER BY service, cnt DESC`,
    location: "asia-northeast3"
  });
  rows1.forEach(function(r) {
    console.log("  " + r.service + "/" + r.channel + " | depth1=" + (r.svc_prefix || "(빈)") + ": " + r.cnt + "건");
  });

  // 2. 시트에서 서비스 정보 확인 (C열=서비스, D열=채널 등 확인)
  console.log("\n=== 2. 시트 헤더 재확인 ===");
  var auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  var sheetsApi = google.sheets({ version: "v4", auth });

  var hRes = await sheetsApi.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "광주!A1:Z1" });
  var headers = hRes.data.values ? hRes.data.values[0] : [];
  headers.forEach(function(h, i) {
    console.log("  col " + i + " (" + String.fromCharCode(65 + i) + "): " + h);
  });

  // 3. 시트에서 무효서비스 상담사들의 서비스/채널 값 확인
  // agent_id + consultation_id → 시트의 서비스 컬럼
  var svcIdx = headers.indexOf("서비스");
  var chIdx = headers.indexOf("유선/채팅");
  var idIdx = headers.indexOf("ID");
  var consultIdx = headers.indexOf("상담ID");
  console.log("  서비스=" + svcIdx + ", 유선/채팅=" + chIdx + ", ID=" + idIdx + ", 상담ID=" + consultIdx);

  // 서비스 매핑 빌드
  var svcMap = {};
  for (var si = 0; si < SHEETS.length; si++) {
    var sheetName = SHEETS[si];
    try {
      var hr = await sheetsApi.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName + "!A1:Z1" });
      var hd = hr.data.values ? hr.data.values[0] : [];
      var sI = hd.indexOf("서비스");
      var eI = hd.indexOf("ID");
      var lI = hd.indexOf("상담ID");
      if (sI === -1 || eI === -1 || lI === -1) { console.log("  [" + sheetName + "] 서비스 열 없음"); continue; }

      var res = await sheetsApi.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName + "!A2:Z" });
      var rows = res.data.values || [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var agentId = (row[eI] || "").trim().toLowerCase();
        var consultId = (row[lI] || "").trim();
        var svcVal = (row[sI] || "").trim();
        if (agentId && consultId && svcVal) {
          svcMap[agentId + "|" + consultId] = svcVal;
        }
      }
    } catch (e) {}
  }
  console.log("\n시트 서비스 매핑: " + Object.keys(svcMap).length + "건");

  // 4. BigQuery 무효 서비스 레코드
  var [bqRows] = await bq.query({
    query: `SELECT evaluation_id, agent_id, consultation_id, service, channel,
                   consult_type_depth1_1
            FROM \`csopp-25f2.KMCC_QC.evaluations\`
            WHERE service NOT IN ('택시', '대리', '퀵', '바이크/마스', '주차/카오너', '화물', '심야')`,
    location: "asia-northeast3"
  });
  console.log("무효 서비스 레코드: " + bqRows.length + "건");

  // 5. 서비스 결정: 시트 서비스 → depth1 매핑 → HR 유지
  var updates = [];
  var stats = { sheet: 0, depth1: 0, unchanged: 0 };
  var dist = {};

  bqRows.forEach(function(r) {
    var key = (r.agent_id || "").toLowerCase() + "|" + (r.consultation_id || "");
    var newService = null;

    // 방법 1: 시트 서비스 컬럼
    var sheetSvc = svcMap[key];
    if (sheetSvc && VALID_SERVICES.indexOf(sheetSvc) >= 0) {
      newService = sheetSvc;
      stats.sheet++;
    }

    // 방법 2: consult_type_depth1_1 파싱
    if (!newService && r.consult_type_depth1_1) {
      var prefix = r.consult_type_depth1_1.split("_")[0];
      var mapped = SERVICE_MAP[prefix];
      if (mapped) {
        newService = mapped;
        stats.depth1++;
      }
    }

    if (newService) {
      updates.push({ id: r.evaluation_id, fromSvc: r.service, toSvc: newService, channel: r.channel });
      var k = r.service + " → " + newService + " " + r.channel;
      dist[k] = (dist[k] || 0) + 1;
    } else {
      stats.unchanged++;
    }
  });

  console.log("\n  시트 매칭: " + stats.sheet + "건");
  console.log("  depth1 매핑: " + stats.depth1 + "건");
  console.log("  미결정: " + stats.unchanged + "건");

  console.log("\n변경 분포:");
  Object.keys(dist).sort(function(a, b) { return dist[b] - dist[a]; }).forEach(function(k) {
    console.log("  " + k + ": " + dist[k] + "건");
  });

  // 미결정 상세
  if (stats.unchanged > 0) {
    console.log("\n미결정 상세:");
    var unchg = {};
    bqRows.forEach(function(r) {
      var key = (r.agent_id || "").toLowerCase() + "|" + (r.consultation_id || "");
      var sheetSvc = svcMap[key];
      var prefix = r.consult_type_depth1_1 ? r.consult_type_depth1_1.split("_")[0] : "";
      var mapped = prefix ? SERVICE_MAP[prefix] : null;
      if (!sheetSvc && !mapped) {
        // actually check if sheetSvc exists but not in valid, or no data at all
        var uk = r.service + "/" + r.channel + " | depth1=" + (r.consult_type_depth1_1 || "(빈)") + " | sheet=" + (sheetSvc || "(없음)");
        unchg[uk] = (unchg[uk] || 0) + 1;
      }
    });
    Object.keys(unchg).sort(function(a, b) { return unchg[b] - unchg[a]; }).forEach(function(k) {
      console.log("  " + k + ": " + unchg[k] + "건");
    });
  }

  // 6. 실행
  if (!dryRun && updates.length > 0) {
    console.log("\nBigQuery UPDATE 실행 중...");
    var BATCH = 500;
    var totalAffected = 0;

    for (var b = 0; b < updates.length; b += BATCH) {
      var batch = updates.slice(b, b + BATCH);
      var cases = batch.map(function(u) {
        return "WHEN '" + u.id.replace(/'/g, "\\'") + "' THEN '" + u.toSvc + "'";
      }).join(" ");
      var ids = batch.map(function(u) {
        return "'" + u.id.replace(/'/g, "\\'") + "'";
      }).join(",");

      var q = "UPDATE `csopp-25f2.KMCC_QC.evaluations` SET service = CASE evaluation_id " + cases + " END, `group` = CONCAT(CASE evaluation_id " + cases + " END, ' ', channel) WHERE evaluation_id IN (" + ids + ")";
      var [job] = await bq.createQueryJob({ query: q, location: "asia-northeast3" });
      await job.getQueryResults();
      var meta = await job.getMetadata();
      totalAffected += parseInt(meta[0].statistics.query.numDmlAffectedRows || "0");
    }
    console.log("UPDATE 완료: " + totalAffected + "건");

    // 최종 검증
    console.log("\n=== 최종 그룹 분포 ===");
    var [g] = await bq.query({
      query: "SELECT center, service, channel, COUNT(*) as cnt FROM `csopp-25f2.KMCC_QC.evaluations` GROUP BY center, service, channel ORDER BY center, cnt DESC",
      location: "asia-northeast3"
    });
    g.forEach(function(r) {
      console.log("  " + r.center + " | " + (r.service || "(빈)") + " / " + (r.channel || "(빈)") + ": " + r.cnt + "건");
    });
  } else if (dryRun) {
    console.log("\n--execute 로 실행합니다.");
  }
}

run().catch(console.error);
