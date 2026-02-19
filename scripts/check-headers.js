const { readSheetData } = require("../lib/google-sheets");

const SPREADSHEET_ID = "14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o";

async function run() {
  // 용산 시트 헤더 + 샘플 2행
  const data = await readSheetData(SPREADSHEET_ID, "용산!A1:Z3");
  console.log("=== 용산 헤더 (A~Z) ===");
  if (data && data[0]) {
    data[0].forEach(function(v, i) {
      console.log("col " + i + " (" + String.fromCharCode(65 + i) + "): " + v);
    });
  }
  // 샘플 데이터 2행
  if (data && data[1]) {
    console.log("\n=== 2행 샘플 ===");
    data[1].forEach(function(v, i) {
      console.log("col " + i + " (" + String.fromCharCode(65 + i) + "): " + v);
    });
  }

  // 광주도 확인
  const data2 = await readSheetData(SPREADSHEET_ID, "광주!A1:Z3");
  console.log("\n=== 광주 헤더 (A~Z) ===");
  if (data2 && data2[0]) {
    data2[0].forEach(function(v, i) {
      console.log("col " + i + " (" + String.fromCharCode(65 + i) + "): " + v);
    });
  }
}
run().catch(console.error);
