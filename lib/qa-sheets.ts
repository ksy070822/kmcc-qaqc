import { readSheetData } from './google-sheets'
import type { QAEvaluation } from './types'
import { SERVICE_NORMALIZE_MAP } from './constants'

// QA 시트 헤더 → QAEvaluation 필드 매핑
// 실제 시트 헤더에 줄바꿈(\n)이 포함되어 있으므로, 정규화 후 매칭
// 유선/채팅 시트 공용 (동일 필드명은 한 번만 선언)
const QA_HEADER_MAP: Record<string, string> = {
  // 상담사 정보
  '업체명': 'center',
  '팀명': 'team',
  '서비스': 'service',
  '이름': 'agentName',
  '영문이름': 'agentId',
  '근속개월': 'tenureMonths',
  '근속개월2': '_tenureMonths2',  // 무시용
  '근무시간': '_workHours',       // 무시용
  '투입일': '_hireDate',          // 무시용
  '근무타입': 'workType',
  '평가월': 'evaluationMonth',
  '차시': 'round',
  '상담 ID': 'consultationId',    // 유선 (공백 있음)
  '상담ID': 'consultationId',     // 채팅 (공백 없음)
  '총점': 'totalScore',
  // 공통 항목 (정규화 후 매칭)
  '인사예절': 'greetingScore',                        // 유선
  '(끝)인사말': 'greetingScore',                      // 채팅
  '화답표현': 'responseExpression',
  '문의내용파악도': 'inquiryComprehension',            // 유선
  '문의내용 파악': 'inquiryComprehension',             // 채팅
  '본인확인': 'identityCheck',
  '필수탐색': 'requiredSearch',
  '업무지식': 'businessKnowledge',
  '신속성': 'promptness',
  '전산처리': 'systemProcessing',
  '상담이력': 'consultationHistory',
  '감성케어 (공감/호응/사과/양해)': 'empathyCare',     // 정규화 후
  '감성케어': 'empathyCare',                           // 폴백
  '언어표현': 'languageExpression',
  '경청/집중 태도': 'listeningFocus',                  // 유선 (정규화 후)
  '경청/집중태도': 'listeningFocus',                   // 채팅
  '설명능력': 'explanationAbility',
  '체감만족': 'perceivedSatisfaction',
  '(칭찬 접수) +10': 'praiseBonus',                    // 유선 (정규화 후)
  '칭찬접수': 'praiseBonus',                           // 채팅
  // 유선 전용
  '음성연출': 'voicePerformance',
  '말속도 및 발음': 'speechSpeed',                     // 실제 헤더
  '말속도/발음': 'speechSpeed',                        // 폴백
  '(호칭오류) -1': 'honorificError',                   // 정규화 후
  '호칭오류': 'honorificError',                        // 폴백
  // 채팅 전용
  '맞춤법': 'spelling',
  '종료요청': 'closeRequest',
  '복사오류': 'copyError',
  '조작오류': 'operationError',
  // 상담유형
  '1Depth': 'consultTypeDepth1',
  '2Depth': 'consultTypeDepth2',
  '3Depth': 'consultTypeDepth3',
  '4Depth': 'consultTypeDepth4',
  '1depth': 'consultTypeDepth1',
  '2depth': 'consultTypeDepth2',
  '3depth': 'consultTypeDepth3',
  '4depth': 'consultTypeDepth4',
  // 피드백 (정규화 후)
  '업무지식 피드백': 'knowledgeFeedback',
  '업무지식피드백': 'knowledgeFeedback',
  '체감만족 코멘트': 'satisfactionComment',
  '체감만족코멘트': 'satisfactionComment',
}

// 업체명 → 센터 변환
const CENTER_MAP: Record<string, '용산' | '광주'> = {
  'KMCC용산': '용산',
  'KMCC 용산': '용산',
  '용산': '용산',
  'KMCC광주': '광주',
  'KMCC 광주': '광주',
  '광주': '광주',
}

// 평가월 정규화: 다양한 형식 → "YYYY-MM"
// "25년02월" → "2025-02", "2026년 1월" → "2026-01", "2025-02" → "2025-02"
function normalizeMonth(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()
  // "25년02월" 패턴 (2자리 연도 + 0패딩 월)
  const m1 = s.match(/^(\d{2})년\s*(\d{1,2})월$/)
  if (m1) return `20${m1[1]}-${m1[2].padStart(2, '0')}`
  // "2025년02월" or "2026년 1월" 패턴 (4자리 연도 + 선택적 공백 + 월)
  const m2 = s.match(/^(\d{4})년\s*(\d{1,2})월$/)
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}`
  // "2025-02" 이미 정규화된 형식
  if (/^\d{4}-\d{2}$/.test(s)) return s
  // "2025-2" 패딩 없는 형식
  const m3 = s.match(/^(\d{4})-(\d{1,2})$/)
  if (m3) return `${m3[1]}-${m3[2].padStart(2, '0')}`
  return s
}

// 차시 정규화: "1차" → 1, "2차" → 2, "1" → 1
function normalizeRound(raw: string): number {
  if (!raw) return 1
  const m = raw.match(/(\d+)/)
  return m ? parseInt(m[1]) : 1
}

// Row가 헤더 반복행(배점 기준행)인지 판별
// 실제 데이터의 row2: ["업체명","평가월","팀명","서비스","이름",...,"100","6","5",...]
function isHeaderRepeatRow(row: string[], headers: string[]): boolean {
  if (!row || row.length < 5) return true
  // 첫 5개 셀이 헤더와 동일한 텍스트면 헤더 반복행
  let matchCount = 0
  for (let i = 0; i < Math.min(5, row.length, headers.length); i++) {
    const rv = (row[i] || '').replace(/\s+/g, ' ').trim()
    const hv = (headers[i] || '').replace(/\s+/g, ' ').trim()
    if (rv === hv) matchCount++
  }
  return matchCount >= 3 // 5개 중 3개 이상 일치하면 헤더 반복
}

export function parseQASheetRows(
  headers: string[],
  rows: string[][],
  defaultCenter: '용산' | '광주',
  defaultChannel: '유선' | '채팅' = '유선'
): QAEvaluation[] {
  // 헤더 정규화 (줄바꿈·다중공백 → 단일공백, 양쪽 trim)
  const normalizedHeaders = headers.map(h => h.replace(/\s+/g, ' ').trim())

  // 헤더 인덱스 매핑 (첫 번째 매칭만 사용)
  const headerIndex: Record<string, number> = {}
  normalizedHeaders.forEach((h, i) => {
    const mapped = QA_HEADER_MAP[h]
    if (mapped && !(mapped in headerIndex)) headerIndex[mapped] = i
  })

  const evaluations: QAEvaluation[] = []
  let skippedRows = 0

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]
    if (!row || row.length < 5) continue

    // 헤더 반복행 스킵 (row2가 배점 기준 + 헤더 텍스트 반복)
    if (ri === 0 && isHeaderRepeatRow(row, headers)) {
      skippedRows++
      continue
    }

    const getValue = (field: string): string => {
      const idx = headerIndex[field]
      return idx !== undefined ? (row[idx] || '').trim() : ''
    }
    const getNumber = (field: string): number | undefined => {
      const v = getValue(field)
      if (!v) return undefined
      const n = parseFloat(v)
      return isNaN(n) ? undefined : n
    }

    const agentName = getValue('agentName')
    const agentId = getValue('agentId')  // 영문이름
    const rawMonth = getValue('evaluationMonth')
    const month = normalizeMonth(rawMonth)  // "25년02월" → "2025-02"
    const roundStr = getValue('round')
    const round = normalizeRound(roundStr)  // "1차" → 1
    const totalScore = getNumber('totalScore')

    // 총점 없거나 이름 없으면 스킵
    if ((totalScore === undefined || totalScore === null) && !agentName) continue
    if (totalScore === undefined || totalScore === null) { skippedRows++; continue }

    // 센터 결정: 업체명 필드 → CENTER_MAP → defaultCenter
    const rawCenter = getValue('center')
    const center = CENTER_MAP[rawCenter] || defaultCenter

    const rawService = getValue('service')
    const service = SERVICE_NORMALIZE_MAP[rawService] || rawService
    const channel = defaultChannel  // 시트별로 결정 (유선시트/채팅시트)

    // qaEvalId: 고유키 (agentId or agentName + month + round)
    const idBase = agentId || agentName
    const qaEvalId = `${idBase}_${month}_${round}`

    evaluations.push({
      qaEvalId,
      evaluationDate: month ? `${month}-01` : '',
      evaluationMonth: month,
      round,
      consultationId: getValue('consultationId') || undefined,
      center,
      team: getValue('team') || undefined,
      service,
      channel,
      agentName,
      agentId: agentId || undefined,
      tenureMonths: getNumber('tenureMonths'),
      workType: getValue('workType') || undefined,
      totalScore,
      // 공통
      greetingScore: getNumber('greetingScore'),
      responseExpression: getNumber('responseExpression'),
      inquiryComprehension: getNumber('inquiryComprehension'),
      identityCheck: getNumber('identityCheck'),
      requiredSearch: getNumber('requiredSearch'),
      businessKnowledge: getNumber('businessKnowledge'),
      promptness: getNumber('promptness'),
      systemProcessing: getNumber('systemProcessing'),
      consultationHistory: getNumber('consultationHistory'),
      empathyCare: getNumber('empathyCare'),
      languageExpression: getNumber('languageExpression'),
      listeningFocus: getNumber('listeningFocus'),
      explanationAbility: getNumber('explanationAbility'),
      perceivedSatisfaction: getNumber('perceivedSatisfaction'),
      praiseBonus: getNumber('praiseBonus'),
      // 유선 전용
      voicePerformance: channel === '유선' ? getNumber('voicePerformance') : undefined,
      speechSpeed: channel === '유선' ? getNumber('speechSpeed') : undefined,
      honorificError: channel === '유선' ? getNumber('honorificError') : undefined,
      // 채팅 전용
      spelling: channel === '채팅' ? getNumber('spelling') : undefined,
      closeRequest: channel === '채팅' ? getNumber('closeRequest') : undefined,
      copyError: channel === '채팅' ? getNumber('copyError') : undefined,
      operationError: channel === '채팅' ? getNumber('operationError') : undefined,
      // 상담유형
      consultTypeDepth1: getValue('consultTypeDepth1') || undefined,
      consultTypeDepth2: getValue('consultTypeDepth2') || undefined,
      consultTypeDepth3: getValue('consultTypeDepth3') || undefined,
      consultTypeDepth4: getValue('consultTypeDepth4') || undefined,
      // 피드백
      knowledgeFeedback: getValue('knowledgeFeedback') || undefined,
      satisfactionComment: getValue('satisfactionComment') || undefined,
    })
  }

  console.log(`[QA Parser] parsed=${evaluations.length}, skipped=${skippedRows}, channel=${defaultChannel}`)
  return evaluations
}

// 스프레드시트에서 QA 데이터 읽기
export async function readQASheetData(
  spreadsheetId: string,
  sheetName: string,
  defaultCenter: '용산' | '광주',
  defaultChannel: '유선' | '채팅' = '유선'
): Promise<QAEvaluation[]> {
  const result = await readSheetData(spreadsheetId, `${sheetName}!A1:AZ`)
  if (!result.success || !result.data || result.data.length < 2) return []

  const headers = result.data[0] as string[]
  const rows = result.data.slice(1) as string[][]

  return parseQASheetRows(headers, rows, defaultCenter, defaultChannel)
}
