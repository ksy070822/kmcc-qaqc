// Google Apps Script 템플릿 코드
// 이 코드를 Google 스프레드시트의 Apps Script에 복사하세요

export const appsScriptFullTemplate = `
/**
 * QC 품질관리 시스템 - Google Apps Script
 * 스프레드시트 데이터를 웹앱으로 전송합니다.
 */

// 웹앱 URL을 여기에 입력하세요
const WEBAPP_URL = "YOUR_VERCEL_APP_URL/api/sync";

// 동기화할 시트 이름
const SHEET_NAME = "QC Data";

/**
 * 데이터를 웹앱으로 전송
 */
function syncToWebApp() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      Logger.log("시트를 찾을 수 없습니다: " + SHEET_NAME);
      return;
    }

    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log("데이터가 없습니다.");
      return;
    }

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(data),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(WEBAPP_URL, options);
    const result = JSON.parse(response.getContentText());
    
    Logger.log("동기화 완료: " + JSON.stringify(result));
    
    // 동기화 로그 기록
    logSync(result);
    
    return result;
  } catch (error) {
    Logger.log("동기화 오류: " + error.toString());
    throw error;
  }
}

/**
 * 동기화 로그 기록
 */
function logSync(result) {
  const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sync Log");
  if (logSheet) {
    logSheet.appendRow([
      new Date(),
      result.success ? "성공" : "실패",
      result.message || "",
      result.summary ? result.summary.evaluations : 0,
    ]);
  }
}

/**
 * 웹앱에서 데이터 조회 (GET 요청용)
 */
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 트리거 설정 - 매 15분마다 동기화
 */
function createTimeTrigger() {
  // 기존 트리거 삭제
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "syncToWebApp") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 새 트리거 생성 (15분마다)
  ScriptApp.newTrigger("syncToWebApp")
    .timeBased()
    .everyMinutes(15)
    .create();
  
  Logger.log("트리거가 설정되었습니다.");
}

/**
 * 메뉴 추가
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("QC 품질관리")
    .addItem("지금 동기화", "syncToWebApp")
    .addItem("자동 동기화 설정", "createTimeTrigger")
    .addSeparator()
    .addItem("연결 테스트", "testConnection")
    .addToUi();
}

/**
 * 연결 테스트
 */
function testConnection() {
  try {
    const response = UrlFetchApp.fetch(WEBAPP_URL.replace("/sync", "/sync"), {
      method: "get",
      muteHttpExceptions: true,
    });
    
    const ui = SpreadsheetApp.getUi();
    if (response.getResponseCode() === 200) {
      ui.alert("연결 성공", "웹앱과 정상적으로 연결되었습니다.", ui.ButtonSet.OK);
    } else {
      ui.alert("연결 실패", "응답 코드: " + response.getResponseCode(), ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert("연결 오류", error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 스프레드시트 템플릿 헤더 (필수 컬럼)
 * 
 * | 날짜 | 센터 | 그룹 | 상담사ID | 상담사명 | 근속기간 | 총콜수 | 오류율 |
 * | 첫인사 | 끝인사 | 공감표현 | 사과표현 | 추가문의 | 불친절 |
 * | 상담유형 | 가이드 | 본인확인 | 필수탐색 | 오안내 | 전산처리 |
 * | 정보수정 | 후처리 | 이관 | 민원 | 기타 |
 */
`

export const spreadsheetTemplate = {
  headers: [
    "날짜",
    "센터",
    "그룹",
    "상담사ID",
    "상담사명",
    "근속기간",
    "총콜수",
    "오류율",
    // 상담태도 (5개)
    "첫인사/끝인사",
    "공감표현",
    "사과표현",
    "추가문의확인",
    "불친절",
    // 오상담/오처리 (11개)
    "상담유형선택",
    "가이드미준수",
    "본인확인누락",
    "필수탐색누락",
    "오안내",
    "전산처리오류",
    "고객정보수정누락",
    "후처리미비",
    "이관오류",
    "민원발생",
    "기타오류",
  ],
  sampleRow: [
    "2024-12-16",
    "용산",
    "1그룹",
    "AGT0001",
    "홍길동",
    "2~3년",
    "45",
    "2.2",
    "0",
    "0",
    "1",
    "0",
    "0",
    "0",
    "1",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
  ],
}
