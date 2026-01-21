// ============================================
// QC 관리 시스템 - Google Apps Script
// 용산/광주 센터 로우 데이터 동기화
// ============================================

// 설정값
const WEBAPP_URL = 'https://your-vercel-app.vercel.app/api/sync'; // 여기에 배포된 웹앱 URL 입력
const YONGSAN_SHEET = '용산LAW';
const GWANGJU_SHEET = '광주LAW';

// 평가 항목 16개 (컬럼 순서)
const EVAL_ITEMS = [
  '첫인사/끝인사 누락',
  '공감표현 누락',
  '사과표현 누락',
  '추가문의 누락',
  '불친절',
  '상담유형 오설정',
  '가이드 미준수',
  '본인확인 누락',
  '필수탐색 누락',
  '오안내',
  '전산 처리 누락',
  '전산 처리 미흡/정정',
  '전산 조작 미흡/오류',
  '콜/픽/트립ID 매핑누락&오기재',
  '플래그/키워드 누락&오기재',
  '상담이력 기재 미흡'
];

// 태도 항목 인덱스 (앞 5개)
const ATTITUDE_INDICES = [0, 1, 2, 3, 4];

// 업무 항목 인덱스 (뒤 11개)
const BUSINESS_INDICES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

/**
 * 메뉴 추가
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('QC 대시보드')
    .addItem('지금 동기화', 'syncData')
    .addItem('연결 테스트', 'testConnection')
    .addToUi();
}

/**
 * 데이터 동기화 - 로우 데이터를 웹앱으로 전송
 */
function syncData() {
  try {
    Logger.log('[v0] 동기화 시작...');
    
    // 용산 데이터 읽기
    const yonsanData = readSheetData(YONGSAN_SHEET, '용산');
    Logger.log(`[v0] 용산 데이터: ${yonsanData.length}건`);
    
    // 광주 데이터 읽기
    const gwangjuData = readSheetData(GWANGJU_SHEET, '광주');
    Logger.log(`[v0] 광주 데이터: ${gwangjuData.length}건`);
    
    // 웹앱으로 전송
    const payload = {
      timestamp: new Date().toISOString(),
      yonsan: yonsanData,
      gwangju: gwangjuData,
      totalRecords: yonsanData.length + gwangjuData.length
    };
    
    const response = sendToWebApp(payload);
    Logger.log('[v0] 동기화 완료: ' + response);
    
    SpreadsheetApp.getUi().alert('동기화 완료! ' + response);
  } catch (e) {
    Logger.log('[v0] 오류: ' + e.message);
    SpreadsheetApp.getUi().alert('오류: ' + e.message);
  }
}

/**
 * 시트에서 데이터 읽기
 */
function readSheetData(sheetName, center) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(sheetName + ' 시트를 찾을 수 없습니다.');
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const records = [];
  
  // 헤더 인덱스 찾기
  const nameIdx = headers.indexOf('이름');
  const idIdx = headers.indexOf('ID');
  const serviceIdx = headers.indexOf('서비스');
  const channelIdx = headers.indexOf('채널');
  const hireIdx = headers.indexOf('입사일');
  const evalDateIdx = headers.indexOf('평가일');
  const evalIdIdx = headers.indexOf('평가회차');
  
  // 데이터 행 순회 (헤더 제외)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // 빈 행 스킵
    if (!row[nameIdx]) continue;
    
    // 근속 기간 계산
    const hireDate = new Date(row[hireIdx]);
    const tenure = calculateTenure(hireDate);
    
    // 평가 항목 수집
    const evalItems = [];
    let attitudeErrors = 0;
    let businessErrors = 0;
    
    for (let j = 0; j < EVAL_ITEMS.length; j++) {
      const itemIdx = nameIdx + 5 + j; // 평가 항목은 기본정보 5개 이후
      const value = row[itemIdx] === 'Y' || row[itemIdx] === 1 ? 1 : 0;
      evalItems.push(value);
      
      if (ATTITUDE_INDICES.includes(j)) {
        attitudeErrors += value;
      }
      if (BUSINESS_INDICES.includes(j)) {
        businessErrors += value;
      }
    }
    
    records.push({
      center: center,
      name: row[nameIdx],
      id: row[idIdx],
      service: row[serviceIdx],
      channel: row[channelIdx],
      hireDate: row[hireIdx],
      tenure: tenure,
      evalDate: row[evalDateIdx],
      evalId: row[evalIdIdx],
      evaluationItems: evalItems,
      attitudeErrors: attitudeErrors,
      businessErrors: businessErrors,
      totalErrors: attitudeErrors + businessErrors,
      timestamp: new Date().toISOString()
    });
  }
  
  return records;
}

/**
 * 근속 기간 계산
 */
function calculateTenure(hireDate) {
  const today = new Date();
  const months = (today.getFullYear() - hireDate.getFullYear()) * 12 + 
                 (today.getMonth() - hireDate.getMonth());
  
  if (months < 3) return '3개월 미만';
  if (months < 6) return '3개월 이상';
  if (months < 12) return '6개월 이상';
  return '12개월 이상';
}

/**
 * 웹앱으로 데이터 전송
 */
function sendToWebApp(payload) {
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(WEBAPP_URL, options);
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 200) {
      return '성공: ' + result.recordsProcessed + '건 처리됨';
    } else {
      throw new Error(result.error || '서버 오류');
    }
  } catch (e) {
    throw new Error('웹앱 연결 실패: ' + e.message);
  }
}

/**
 * 연결 테스트
 */
function testConnection() {
  try {
    Logger.log('[v0] 연결 테스트 시작...');
    
    const testPayload = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Apps Script 연결 테스트'
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(WEBAPP_URL, options);
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 200) {
      SpreadsheetApp.getUi().alert('연결 성공!\n' + JSON.stringify(result, null, 2));
      Logger.log('[v0] 연결 성공: ' + JSON.stringify(result));
    } else {
      SpreadsheetApp.getUi().alert('연결 실패\n상태: ' + response.getResponseCode());
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert('오류: ' + e.message);
    Logger.log('[v0] 오류: ' + e.message);
  }
}

/**
 * 자동 동기화 (매일 밤 12시)
 */
function scheduleAutoSync() {
  // 트리거 생성 (Apps Script 에디터에서 수동으로 설정 권장)
  // 메뉴: 트리거 → 새 트리거 → syncData, 시간 기반, 날마다, 오전 12시~1시
}
