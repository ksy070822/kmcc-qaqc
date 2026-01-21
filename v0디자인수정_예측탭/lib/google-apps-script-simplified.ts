// Google Apps Script에 복사할 실제 코드 (간단함)
export const appsScriptForYourSheets = `
/**
 * QC 품질관리 - Google Apps Script (간단화 버전)
 * 이 코드를 구글 시트 > 도구 > Apps Script에 붙여넣으세요
 */

// 웹앱 URL 설정 (Vercel에 배포 후 수정)
const WEBAPP_URL = "https://your-app.vercel.app/api/sync";

// 로우 데이터 시트 이름
const RAW_DATA_SHEETS = ["용산LAW", "광주LAW"];

/**
 * 메뉴 생성
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🔄 QC 대시보드")
    .addItem("지금 동기화", "syncRawData")
    .addItem("자동 동기화 설정 (15분마다)", "setupAutoSync")
    .addItem("연결 테스트", "testConnection")
    .addToUi();
}

/**
 * 1단계: 로우 데이터 시트 읽기
 */
function getRawData() {
  const allData = [];
  
  RAW_DATA_SHEETS.forEach(sheetName => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return;
    
    const data = sheet.getDataRange().getValues();
    allData.push({
      sheet: sheetName,
      headers: data[0],
      rows: data.slice(1)
    });
  });
  
  return allData;
}

/**
 * 2단계: 웹앱 API로 전송
 */
function syncRawData() {
  try {
    const rawData = getRawData();
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        timestamp: new Date().toISOString(),
        data: rawData
      }),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(WEBAPP_URL, options);
    const result = JSON.parse(response.getContentText());
    
    Logger.log("✅ 동기화 완료: " + JSON.stringify(result));
    
    const ui = SpreadsheetApp.getUi();
    ui.alert("동기화 완료", "\\n✅ 데이터가 대시보드에 반영되었습니다.\\n" + 
             "데이터: " + result.summary?.total + "건", ui.ButtonSet.OK);
    
    // 로그 기록
    appendLog("성공", result.summary?.total + "건");
    
  } catch (error) {
    Logger.log("❌ 오류: " + error);
    SpreadsheetApp.getUi().alert("동기화 실패", error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
    appendLog("실패", error.toString());
  }
}

/**
 * 연결 테스트
 */
function testConnection() {
  try {
    const response = UrlFetchApp.fetch(WEBAPP_URL, {
      method: "get",
      muteHttpExceptions: true,
    });
    
    const ui = SpreadsheetApp.getUi();
    if (response.getResponseCode() === 200) {
      ui.alert("✅ 연결 성공", "웹앱과 정상 연결되었습니다.\\n" +
               "URL: " + WEBAPP_URL, ui.ButtonSet.OK);
    } else {
      ui.alert("❌ 연결 실패", "상태 코드: " + response.getResponseCode(), ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert("❌ 오류", error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 자동 동기화 설정
 */
function setupAutoSync() {
  // 기존 트리거 삭제
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "syncRawData") {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // 15분마다 동기화
  ScriptApp.newTrigger("syncRawData")
    .timeBased()
    .everyMinutes(15)
    .create();
  
  SpreadsheetApp.getUi().alert("✅ 설정 완료", "15분마다 자동 동기화됩니다.", SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 동기화 로그 기록
 */
function appendLog(status, message) {
  let logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("📋 동기화 로그");
  
  if (!logSheet) {
    logSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("📋 동기화 로그");
    logSheet.appendRow(["시간", "상태", "메시지"]);
  }
  
  logSheet.appendRow([new Date(), status, message]);
}

/**
 * ===== 구글 시트 필수 구조 =====
 * 
 * 1. "용산LAW" 시트
 *    컬럼: 날짜, 센터, 그룹, 상담사ID, 상담사명, 채널, 근속기간, ... (16개 평가항목)
 * 
 * 2. "광주LAW" 시트
 *    동일한 구조
 * 
 * 3. 로그 시트는 자동 생성됨
 */
`
