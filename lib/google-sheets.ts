import { google } from 'googleapis';
import { SERVICE_NORMALIZE_MAP, INVALID_SERVICE_NAMES } from './constants';

/**
 * Google Sheets API 클라이언트 초기화
 * BigQuery와 동일한 인증 소스 사용: BIGQUERY_CREDENTIALS > GOOGLE_APPLICATION_CREDENTIALS > ADC
 */
function getSheetsClient() {
  // BigQuery와 동일한 credentials 사용 (Sheets/BQ 모두 접근 가능한 계정으로 통일)
  if (process.env.BIGQUERY_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      return google.sheets({ version: 'v4', auth });
    } catch (e) {
      console.warn('[Google Sheets] BIGQUERY_CREDENTIALS 파싱 실패, ADC 사용:', e);
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const auth = new google.auth.GoogleAuth({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return google.sheets({ version: 'v4', auth });
  }

  // Application Default Credentials (Cloud Run 기본 SA 등)
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Google Sheets에서 데이터 읽기
 * @param spreadsheetId 스프레드시트 ID
 * @param range 시트 이름과 범위 (예: "용산!A1:Z1000")
 */
export async function readSheetData(
  spreadsheetId: string,
  range: string
): Promise<{ success: boolean; data?: string[][]; error?: string }> {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return { success: true, data: [] };
    }

    return { success: true, data: rows };
  } catch (error) {
    console.error('[Google Sheets] readSheetData error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Google Sheets의 용산/광주 시트 데이터 읽기
 * @param spreadsheetId 스프레드시트 ID
 */
export async function readYonsanGwangjuSheets(
  spreadsheetId: string
): Promise<{
  success: boolean;
  yonsan?: string[][];
  gwangju?: string[][];
  error?: string;
}> {
  try {
    // 용산 시트 읽기
    const yonsanResult = await readSheetData(spreadsheetId, '용산!A:AZ');
    if (!yonsanResult.success) {
      return { success: false, error: `용산 시트 읽기 실패: ${yonsanResult.error}` };
    }

    // 광주 시트 읽기
    const gwangjuResult = await readSheetData(spreadsheetId, '광주!A:AZ');
    if (!gwangjuResult.success) {
      return { success: false, error: `광주 시트 읽기 실패: ${gwangjuResult.error}` };
    }

    return {
      success: true,
      yonsan: yonsanResult.data || [],
      gwangju: gwangjuResult.data || [],
    };
  } catch (error) {
    console.error('[Google Sheets] readYonsanGwangjuSheets error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Google Sheets 행 데이터를 평가 데이터 형식으로 변환
 * @param headers 헤더 행
 * @param rows 데이터 행들
 * @param center 센터 이름 (용산 또는 광주)
 */
export function parseSheetRowsToEvaluations(
  headers: string[],
  rows: string[][],
  center: string
): Record<string, unknown>[] {
  const evaluations: Record<string, unknown>[] = [];

  // 헤더 인덱스 매핑 (줄바꿈·공백 정규화)
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const normalized = h.trim().toLowerCase().replace(/\s+/g, ' ');
    headerMap[normalized] = i;
  });

  // 컬럼명 매핑 (다양한 형식 지원)
  const getColumnIndex = (possibleNames: string[]): number | null => {
    for (const name of possibleNames) {
      const normalized = name.toLowerCase().trim();
      if (headerMap[normalized] !== undefined) {
        return headerMap[normalized];
      }
    }
    return null;
  };

  rows.forEach((row, rowIndex) => {
    try {
      // 필수 필드 추출
      const nameIdx = getColumnIndex(['이름', '상담사명', 'name']);
      const idIdx = getColumnIndex(['id', '상담사id', '사번']);
      const evalDateIdx = getColumnIndex(['평가일', '날짜', 'date', 'evaluation_date']);
      const consultIdIdx = getColumnIndex(['상담id', 'consult_id', 'consultid']);
      const serviceIdx = getColumnIndex(['서비스', 'service']);
      const serviceGroupIdx = getColumnIndex(['서비스 그룹', '서비스그룹']);
      const depth1Idx = getColumnIndex(['상담유형 1depth', '상담유형1', '상담유형', 'consult_type']);
      // 상담유형 수정 전 (상담사 원래 설정) 1~4뎁스
      const origDepth1Idx = getColumnIndex(['상담유형-수정 전 1depth', '상담유형 수정 전 1depth', '수정 전 1depth', '상담유형 1depth', '상담유형1', '상담유형']);
      const origDepth2Idx = getColumnIndex(['상담유형-수정 전 2depth', '상담유형 수정 전 2depth', '수정 전 2depth', '상담유형 2depth', '상담유형2']);
      const origDepth3Idx = getColumnIndex(['상담유형-수정 전 3depth', '상담유형 수정 전 3depth', '수정 전 3depth', '상담유형 3depth', '상담유형3']);
      const origDepth4Idx = getColumnIndex(['상담유형-수정 전 4depth', '상담유형 수정 전 4depth', '수정 전 4depth', '상담유형 4depth', '상담유형4']);
      // 상담유형 수정 후 (QC 검수자 정정) 1~4뎁스
      const corrDepth1Idx = getColumnIndex(['상담유형-수정 후 1depth', '상담유형 수정 후 1depth', '수정 후 1depth']);
      const corrDepth2Idx = getColumnIndex(['상담유형-수정 후 2depth', '상담유형 수정 후 2depth', '수정 후 2depth']);
      const corrDepth3Idx = getColumnIndex(['상담유형-수정 후 3depth', '상담유형 수정 후 3depth', '수정 후 3depth']);
      const corrDepth4Idx = getColumnIndex(['상담유형-수정 후 4depth', '상담유형 수정 후 4depth', '수정 후 4depth']);
      const channelTypeIdx = getColumnIndex(['유선/채팅', '유선채팅']); // 실제 채널
      const channelIdx = channelTypeIdx ?? getColumnIndex(['채널', 'channel']); // 폴백
      const hireDateIdx = getColumnIndex(['입사일', 'hire_date', 'hiredate']);
      const tenureIdx = getColumnIndex(['근속개월', 'tenure', 'tenure_months']);

      if (!nameIdx || !idIdx || !evalDateIdx) {
        console.warn(`[Google Sheets] Row ${rowIndex + 1}: 필수 필드 누락`);
        return;
      }

      const agentName = row[nameIdx]?.toString().trim() || '';
      const agentId = row[idIdx]?.toString().trim() || '';
      const evalDateStr = row[evalDateIdx]?.toString().trim() || '';

      if (!agentName || !agentId || !evalDateStr) {
        console.warn(`[Google Sheets] Row ${rowIndex + 1}: 필수 값 누락`);
        return;
      }

      // 날짜 정규화 (YYYY-MM-DD 형식)
      const normalizedDate = normalizeDate(evalDateStr);
      if (!normalizedDate) {
        console.warn(`[Google Sheets] Row ${rowIndex + 1}: 날짜 형식 오류: ${evalDateStr}`);
        return;
      }

      // 상담 ID (중복 방지용)
      const consultId = consultIdIdx !== null ? row[consultIdIdx]?.toString().trim() : '';
      
      // 채널: "유선/채팅" 컬럼 우선 사용
      const channel = channelIdx !== null ? row[channelIdx]?.toString().trim() : '';

      // 서비스 결정 우선순위:
      // 1) 상담유형 1depth → 언더바 앞 추출 (예: "택시_승객" → "택시")
      // 2) 서비스 그룹 (주차/카오너, 바이크/마스 교차매핑)
      // 3) 서비스 컬럼 직접 사용
      let service = '';

      // 1차: 1depth에서 서비스 추출
      if (depth1Idx !== null) {
        const depth1 = row[depth1Idx]?.toString().trim() || '';
        if (depth1) {
          const beforeUnderscore = depth1.split('_')[0].trim();
          const normalized1 = SERVICE_NORMALIZE_MAP[beforeUnderscore] || beforeUnderscore;
          if (normalized1 && !INVALID_SERVICE_NAMES.includes(normalized1)) {
            service = normalized1;
          }
        }
      }

      // 2차: 서비스 그룹 (주차/카오너, 바이크/마스 등)
      if (!service && serviceGroupIdx !== null) {
        const svcGroup = row[serviceGroupIdx]?.toString().trim() || '';
        if (svcGroup) {
          const normalizedGroup = SERVICE_NORMALIZE_MAP[svcGroup] || svcGroup;
          if (normalizedGroup && !INVALID_SERVICE_NAMES.includes(normalizedGroup)) {
            service = normalizedGroup;
          }
        }
      }

      // 3차: 서비스 컬럼
      if (!service && serviceIdx !== null) {
        service = row[serviceIdx]?.toString().trim() || '';
      }

      // 서비스명 정규화
      service = SERVICE_NORMALIZE_MAP[service] || service;

      // 입사일 및 근속개월
      const hireDate = hireDateIdx !== null ? row[hireDateIdx]?.toString().trim() : '';
      const tenureMonths = tenureIdx !== null ? parseInt(row[tenureIdx]?.toString() || '0', 10) : 0;

      // 오류 항목 추출 (집계)
      const attitudeErrors = calculateAttitudeErrors(row, headerMap);
      const businessErrors = calculateBusinessErrors(row, headerMap);
      const totalErrors = attitudeErrors + businessErrors;

      // 개별 오류 항목 추출
      const errorDetails = extractIndividualErrors(row, headerMap);

      // 상담유형 뎁스 추출 (수정 전/후)
      const consultTypeOrigDepth1 = origDepth1Idx !== null ? row[origDepth1Idx]?.toString().trim() || null : null;
      const consultTypeOrigDepth2 = origDepth2Idx !== null ? row[origDepth2Idx]?.toString().trim() || null : null;
      const consultTypeOrigDepth3 = origDepth3Idx !== null ? row[origDepth3Idx]?.toString().trim() || null : null;
      const consultTypeOrigDepth4 = origDepth4Idx !== null ? row[origDepth4Idx]?.toString().trim() || null : null;
      const consultTypeCorrectedDepth1 = corrDepth1Idx !== null ? row[corrDepth1Idx]?.toString().trim() || null : null;
      const consultTypeCorrectedDepth2 = corrDepth2Idx !== null ? row[corrDepth2Idx]?.toString().trim() || null : null;
      const consultTypeCorrectedDepth3 = corrDepth3Idx !== null ? row[corrDepth3Idx]?.toString().trim() || null : null;
      const consultTypeCorrectedDepth4 = corrDepth4Idx !== null ? row[corrDepth4Idx]?.toString().trim() || null : null;

      // 고유 ID 생성 (중복 방지)
      const evaluationId = consultId
        ? `${agentId}_${normalizedDate}_${consultId}`
        : `${agentId}_${normalizedDate}_${rowIndex}`;

      evaluations.push({
        evaluationId,
        date: normalizedDate,
        agentId,
        agentName,
        center,
        service,
        channel,
        consultId,
        hireDate,
        tenureMonths,
        attitudeErrors,
        businessErrors,
        totalErrors,
        ...errorDetails, // 개별 오류 항목 포함
        // 상담유형 뎁스 (수정 전/후)
        consultTypeOrigDepth1,
        consultTypeOrigDepth2,
        consultTypeOrigDepth3,
        consultTypeOrigDepth4,
        consultTypeCorrectedDepth1,
        consultTypeCorrectedDepth2,
        consultTypeCorrectedDepth3,
        consultTypeCorrectedDepth4,
        rawRow: row, // 디버깅용
      });
    } catch (error) {
      console.error(`[Google Sheets] Row ${rowIndex + 1} 파싱 오류:`, error);
    }
  });

  return evaluations;
}

/**
 * 날짜 문자열 정규화 (YYYY-MM-DD)
 */
function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // 이미 YYYY-MM-DD 형식
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // "2025. 10. 2" 또는 "2025.10.2" 형식
  const dotMatch = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (dotMatch) {
    const year = dotMatch[1];
    const month = String(parseInt(dotMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(dotMatch[3], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // "2025/10/2" 형식
  const slashMatch = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    const year = slashMatch[1];
    const month = String(parseInt(slashMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(slashMatch[3], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Date 객체로 파싱 시도
  try {
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Date 파싱 실패
  }

  return null;
}

/**
 * 개별 오류 항목 추출
 */
function extractIndividualErrors(row: string[], headerMap: Record<string, number>): Record<string, boolean> {
  const checkError = (possibleNames: string[]): boolean => {
    for (const name of possibleNames) {
      const normalized = name.toLowerCase().trim();
      let idx = headerMap[normalized];

      // 부분 매칭 시도
      if (idx === undefined) {
        for (const [key, value] of Object.entries(headerMap)) {
          if (key.includes(normalized) || normalized.includes(key)) {
            idx = value;
            break;
          }
        }
      }

      if (idx !== undefined) {
        const value = row[idx]?.toString().toUpperCase().trim();
        if (value === 'Y' || value === 'TRUE' || value === '1' || value === '예') {
          return true;
        }
      }
    }
    return false;
  };

  return {
    // 상담태도 오류
    greetingError: checkError(['첫인사/끝인사 누락', '첫인사끝인사누락', 'greeting_error']),
    empathyError: checkError(['공감표현 누락', '공감표현누락', 'empathy_error']),
    apologyError: checkError(['사과표현 누락', '사과표현누락', 'apology_error']),
    additionalInquiryError: checkError(['추가문의 누락', '추가문의누락', 'additional_inquiry_error']),
    unkindError: checkError(['불친절', 'unkind_error']),
    // 오상담/오처리 오류
    consultTypeError: checkError(['상담유형 오설정', '상담유형오설정', 'consult_type_error']),
    guideError: checkError(['가이드 미준수', '가이드미준수', 'guide_error']),
    identityCheckError: checkError(['본인확인 누락', '본인확인누락', 'identity_check_error']),
    requiredSearchError: checkError(['필수탐색 누락', '필수탐색누락', 'required_search_error']),
    wrongGuideError: checkError(['오안내', 'wrong_guide_error']),
    processMissingError: checkError(['전산 처리 누락', '전산처리누락', 'process_missing_error']),
    processIncompleteError: checkError(['전산 처리 미흡/정정', '전산처리미흡정정', 'process_incomplete_error']),
    systemError: checkError(['전산 조작 미흡/오류', '전산조작미흡오류', 'system_error']),
    idMappingError: checkError(['콜/픽/트립id 매핑누락&오기재', '콜픽트립id매핑누락오기재', 'id_mapping_error']),
    flagKeywordError: checkError(['플래그/키워드 누락&오기재', '플래그키워드누락오기재', 'flag_keyword_error']),
    historyError: checkError(['상담이력 기재 미흡', '상담이력기재미흡', 'history_error']),
  };
}

/**
 * 상담태도 오류 건수 계산
 */
function calculateAttitudeErrors(row: string[], headerMap: Record<string, number>): number {
  const attitudeColumns = [
    '첫인사/끝인사 누락',
    '공감표현 누락',
    '사과표현 누락',
    '추가문의 누락',
    '불친절',
  ];

  let count = 0;
  attitudeColumns.forEach((col) => {
    const idx = headerMap[col.toLowerCase().trim()];
    if (idx !== undefined) {
      const value = row[idx]?.toString().toUpperCase().trim();
      if (value === 'Y' || value === 'TRUE' || value === '1' || value === '예') {
        count++;
      }
    }
  });

  return count;
}

/**
 * 오상담/오처리 오류 건수 계산
 */
function calculateBusinessErrors(row: string[], headerMap: Record<string, number>): number {
  const businessColumns = [
    '상담유형 오설정',
    '가이드 미준수',
    '본인확인 누락',
    '필수탐색 누락',
    '오안내',
    '전산 처리 누락',
    '전산 처리 미흡/정정',
    '전산 조작 미흡/오류',
    '콜/픽/트립id 매핑누락&오기재',
    '플래그/키워드 누락&오기재',
    '상담이력 기재 미흡',
  ];

  let count = 0;
  businessColumns.forEach((col) => {
    const normalized = col.toLowerCase().trim();
    // 정확한 매칭 시도
    let idx = headerMap[normalized];
    
    // 부분 매칭 시도
    if (idx === undefined) {
      for (const [key, value] of Object.entries(headerMap)) {
        if (key.includes(normalized) || normalized.includes(key)) {
          idx = value;
          break;
        }
      }
    }

    if (idx !== undefined) {
      const value = row[idx]?.toString().toUpperCase().trim();
      if (value === 'Y' || value === 'TRUE' || value === '1' || value === '예') {
        count++;
      }
    }
  });

  return count;
}

/**
 * 용산2025 / 광주2025 시트 읽기 (1회 적재용)
 */
export async function readYonsan2025Gwangju2025Sheets(
  spreadsheetId: string
): Promise<{
  success: boolean;
  yonsan?: string[][];
  gwangju?: string[][];
  error?: string;
}> {
  try {
    const yonsanResult = await readSheetData(spreadsheetId, '용산2025!A:BZ');
    if (!yonsanResult.success) {
      return { success: false, error: `용산2025 시트 읽기 실패: ${yonsanResult.error}` };
    }

    const gwangjuResult = await readSheetData(spreadsheetId, '광주2025!A:BZ');
    if (!gwangjuResult.success) {
      return { success: false, error: `광주2025 시트 읽기 실패: ${gwangjuResult.error}` };
    }

    return {
      success: true,
      yonsan: yonsanResult.data || [],
      gwangju: gwangjuResult.data || [],
    };
  } catch (error) {
    console.error('[Google Sheets] readYonsan2025Gwangju2025Sheets error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 용산2025/광주2025 시트 파싱 (태도오류, 오상담/오처리 오류 컬럼 사용, 추가문의 누락(채팅) 지원)
 */
export function parseSheetRowsToEvaluations2025(
  headers: string[],
  rows: string[][],
  center: string,
  hasChannel: boolean
): Record<string, unknown>[] {
  const evaluations: Record<string, unknown>[] = [];
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const normalized = String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
    headerMap[normalized] = i;
  });

  const getIdx = (names: string[]): number | null => {
    for (const n of names) {
      const key = n.toLowerCase().trim().replace(/\s+/g, ' ');
      if (headerMap[key] !== undefined) return headerMap[key];
      for (const k of Object.keys(headerMap)) {
        if (k.includes(key) || key.includes(k)) return headerMap[k];
      }
    }
    return null;
  };

  rows.forEach((row, rowIndex) => {
    try {
      const nameIdx = getIdx(['이름', '상담사명']);
      const idIdx = getIdx(['id', '상담사id']);
      const evalDateIdx = getIdx(['평가일', '날짜']);
      const consultIdIdx = getIdx(['상담id', 'consultid']);
      const serviceIdx = getIdx(['서비스']);
      const channelIdx = hasChannel ? getIdx(['채널', '유선/채팅']) : null;
      const hireDateIdx = getIdx(['입사일']);
      const tenureIdx = getIdx(['근속개월']);

      if (nameIdx === null || idIdx === null || evalDateIdx === null) return;

      const agentName = row[nameIdx]?.toString().trim() || '';
      const agentId = row[idIdx]?.toString().trim() || '';
      const evalDateStr = row[evalDateIdx]?.toString().trim() || '';

      if (!agentName || !agentId || !evalDateStr) return;

      const normalizedDate = normalizeDate(evalDateStr);
      if (!normalizedDate) return;

      const consultId = consultIdIdx !== null ? row[consultIdIdx]?.toString().trim() : '';
      const service = serviceIdx !== null ? row[serviceIdx]?.toString().trim() : '';
      const channel = hasChannel && channelIdx !== null ? row[channelIdx]?.toString().trim() : 'unknown';
      const hireDate = hireDateIdx !== null ? row[hireDateIdx]?.toString().trim() : '';
      const tenureMonths = tenureIdx !== null ? parseInt(row[tenureIdx]?.toString() || '0', 10) : 0;

      // 태도오류, 오상담/오처리 오류 컬럼 우선 사용
      let attitudeErrors = 0;
      let businessErrors = 0;
      const tagdoIdx = getIdx(['태도오류']);
      const osangIdx = getIdx(['오상담/오처리 오류']);
      if (tagdoIdx !== null && osangIdx !== null) {
        const t = parseInt(row[tagdoIdx]?.toString() || '0', 10);
        const o = parseInt(row[osangIdx]?.toString() || '0', 10);
        if (!isNaN(t) && !isNaN(o)) {
          attitudeErrors = t;
          businessErrors = o;
        }
      }
      if (attitudeErrors === 0 && businessErrors === 0) {
        attitudeErrors = calculateAttitudeErrors2025(row, headerMap);
        businessErrors = calculateBusinessErrors(row, headerMap);
      }

      const totalErrors = attitudeErrors + businessErrors;
      const evaluationId = consultId
        ? `${agentId}_${normalizedDate}_${consultId}`
        : `${agentId}_${normalizedDate}_${rowIndex}`;

      // 개별 오류 항목 추출
      const errorDetails = extractIndividualErrors(row, headerMap);

      evaluations.push({
        evaluationId,
        date: normalizedDate,
        agentId,
        agentName,
        center,
        service,
        channel: channel || 'unknown',
        consultId,
        hireDate,
        tenureMonths,
        attitudeErrors,
        businessErrors,
        totalErrors,
        ...errorDetails,
        rawRow: row,
      });
    } catch (e) {
      console.warn(`[Google Sheets] Row ${rowIndex + 1} parse error:`, e);
    }
  });

  return evaluations;
}

function calculateAttitudeErrors2025(row: string[], headerMap: Record<string, number>): number {
  const cols = [
    '첫인사/끝인사 누락',
    '공감표현 누락',
    '사과표현 누락',
    '추가문의 누락',
    '추가문의 누락(채팅)',
    '불친절',
  ];
  let count = 0;
  cols.forEach((col) => {
    const key = col.toLowerCase().trim().replace(/\s+/g, ' ');
    let idx = headerMap[key];
    if (idx === undefined) {
      for (const [k] of Object.entries(headerMap)) {
        if (k.includes('추가문의') || k.includes(key)) {
          idx = headerMap[k];
          break;
        }
      }
    }
    if (idx !== undefined) {
      const v = row[idx]?.toString().toUpperCase().trim();
      if (v === 'Y' || v === 'TRUE' || v === '1' || v === '예') count++;
    }
  });
  return count;
}
