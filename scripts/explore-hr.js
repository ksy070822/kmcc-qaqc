const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "csopp-25f2" });

async function run() {
  // 1. ggualle.itx HR 일별 스냅샷 히스토리 (그룹/포지션 변경 추적)
  console.log("=== 1. ggualle.itx HR 스냅샷 히스토리 ===");
  var [rows1] = await bq.query({
    query: "SELECT date, name, id, `group`, position, shift_type, change_date, hire_date, training_start_date, resign_date, type, attendance FROM `csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot` WHERE LOWER(TRIM(id)) = 'ggualle.itx' ORDER BY date",
    location: "asia-northeast3"
  });
  console.log("총 " + rows1.length + "행");

  // 그룹/포지션 변경 시점만 출력
  var prev = "";
  rows1.forEach(function(r) {
    var d = r.date ? r.date.value : "(null)";
    var g = (r.group || "") + "/" + (r.position || "");
    if (g !== prev) {
      console.log(">>> 변경: " + d + " | " + (r.group || "") + " | " + (r.position || "") + " | shift=" + (r.shift_type || "") + " | change_date=" + (r.change_date || "") + " | hire=" + (r.hire_date || ""));
      prev = g;
    }
  });
  if (rows1.length > 0) {
    var last = rows1[rows1.length - 1];
    console.log("마지막: " + (last.date ? last.date.value : "") + " | " + last.group + " | " + last.position);
  }

  // 2. 전체 position(채널) 값 분포
  console.log("\n=== 2. position(채널) 값 분포 ===");
  var [rows2] = await bq.query({
    query: "SELECT position, COUNT(*) as cnt FROM (SELECT position FROM `csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot` UNION ALL SELECT position FROM `csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot`) GROUP BY position ORDER BY cnt DESC",
    location: "asia-northeast3"
  });
  rows2.forEach(function(r) {
    console.log("  " + (r.position || "(빈값)") + ": " + r.cnt + "행");
  });

  // 3. 전체 group(서비스) 값 분포
  console.log("\n=== 3. group(서비스) 값 분포 ===");
  var [rows3] = await bq.query({
    query: "SELECT `group`, COUNT(*) as cnt FROM (SELECT `group` FROM `csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot` UNION ALL SELECT `group` FROM `csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot`) GROUP BY `group` ORDER BY cnt DESC",
    location: "asia-northeast3"
  });
  rows3.forEach(function(r) {
    console.log("  " + (r.group || "(빈값)") + ": " + r.cnt + "행");
  });

  // 4. type 값 분포
  console.log("\n=== 4. type 값 분포 ===");
  var [rows4] = await bq.query({
    query: "SELECT type, COUNT(*) as cnt FROM (SELECT type FROM `csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot` UNION ALL SELECT type FROM `csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot`) GROUP BY type ORDER BY cnt DESC",
    location: "asia-northeast3"
  });
  rows4.forEach(function(r) {
    console.log("  " + (r.type || "(빈값)") + ": " + r.cnt + "행");
  });

  // 5. change_date 샘플 (비어있지 않은 것)
  console.log("\n=== 5. change_date 샘플 ===");
  var [rows5] = await bq.query({
    query: "SELECT DISTINCT id, name, change_date, `group`, position FROM `csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot` WHERE change_date IS NOT NULL AND TRIM(change_date) != '' LIMIT 20",
    location: "asia-northeast3"
  });
  rows5.forEach(function(r) {
    console.log("  " + r.id + " | " + r.name + " | change=" + r.change_date + " | " + r.group + "/" + r.position);
  });

  // 6. 날짜 범위
  console.log("\n=== 6. 스냅샷 날짜 범위 ===");
  var [rows6] = await bq.query({
    query: "SELECT 'Yongsan' as center, MIN(date) as min_date, MAX(date) as max_date, COUNT(DISTINCT date) as date_count FROM `csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot` UNION ALL SELECT 'Gwangju', MIN(date), MAX(date), COUNT(DISTINCT date) FROM `csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot`",
    location: "asia-northeast3"
  });
  rows6.forEach(function(r) {
    console.log("  " + r.center + ": " + (r.min_date ? r.min_date.value : "") + " ~ " + (r.max_date ? r.max_date.value : "") + " (" + r.date_count + "일)");
  });

  // 7. 상담사 수 (type=상담사)
  console.log("\n=== 7. 상담사 수 (type=상담사) ===");
  var [rows7] = await bq.query({
    query: "SELECT 'Yongsan' as center, COUNT(DISTINCT id) as agent_count FROM `csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot` WHERE type = '상담사' UNION ALL SELECT 'Gwangju', COUNT(DISTINCT id) FROM `csopp-25f2.kMCC_HR.HR_Gwangju_Snapshot` WHERE type = '상담사'",
    location: "asia-northeast3"
  });
  rows7.forEach(function(r) {
    console.log("  " + r.center + ": " + r.agent_count + "명");
  });

  // 8. hire_date, training_start_date, resign_date 샘플
  console.log("\n=== 8. 입사일/투입일/퇴사일 샘플 ===");
  var [rows8] = await bq.query({
    query: "SELECT DISTINCT id, name, hire_date, training_start_date, resign_date, `group`, position FROM `csopp-25f2.kMCC_HR.HR_Yongsan_Snapshot` WHERE type = '상담사' AND hire_date IS NOT NULL AND TRIM(hire_date) != '' LIMIT 15",
    location: "asia-northeast3"
  });
  rows8.forEach(function(r) {
    console.log("  " + r.id + " | " + r.name + " | hire=" + (r.hire_date || "") + " | train=" + (r.training_start_date || "") + " | resign=" + (r.resign_date || "") + " | " + r.group + "/" + r.position);
  });
}

run().catch(console.error);
