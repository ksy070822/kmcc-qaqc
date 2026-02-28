/**
 * Google Sheets와 BigQuery 데이터 비교 스크립트
 * 
 * 현재 BigQuery에 저장된 데이터와 Google Sheets의 데이터를 비교하여
 * 누락된 데이터나 불일치를 확인합니다.
 * 
 * 실행 방법:
 * npx tsx scripts/compare-sheets-bigquery.ts
 */

import { readYonsanGwangjuSheets, parseSheetRowsToEvaluations } from '../lib/google-sheets'
import { getBigQueryClient } from '../lib/bigquery'

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o'
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC'

async function compareData() {
  try {
    console.log('📊 Google Sheets와 BigQuery 데이터 비교 시작...\n')

    // 1. Google Sheets에서 데이터 읽기
    console.log('1. Google Sheets에서 데이터 읽는 중...')
    const sheetsResult = await readYonsanGwangjuSheets(SPREADSHEET_ID)
    
    if (!sheetsResult.success || !sheetsResult.yonsan || !sheetsResult.gwangju) {
      console.error('❌ Google Sheets 데이터 읽기 실패:', sheetsResult.error)
      return
    }

    const yonsanHeaders = sheetsResult.yonsan[0] || []
    const yonsanRows = sheetsResult.yonsan.slice(1)
    const gwangjuHeaders = sheetsResult.gwangju[0] || []
    const gwangjuRows = sheetsResult.gwangju.slice(1)

    const yonsanEvaluations = parseSheetRowsToEvaluations(yonsanHeaders, yonsanRows, '용산')
    const gwangjuEvaluations = parseSheetRowsToEvaluations(gwangjuHeaders, gwangjuRows, '광주')
    const allSheetEvaluations = [...yonsanEvaluations, ...gwangjuEvaluations]

    console.log(`   ✅ 용산: ${yonsanEvaluations.length}건`)
    console.log(`   ✅ 광주: ${gwangjuEvaluations.length}건`)
    console.log(`   ✅ 총: ${allSheetEvaluations.length}건\n`)

    // 2. BigQuery에서 데이터 읽기
    console.log('2. BigQuery에서 데이터 읽는 중...')
    const bigquery = getBigQueryClient()
    
    const query = `
      SELECT 
        evaluation_id,
        evaluation_date,
        center,
        agent_id,
        agent_name,
        consult_id,
        attitude_error_count,
        business_error_count,
        total_error_count
      FROM \`${DATASET_ID}.evaluations\`
      ORDER BY evaluation_date DESC, center, agent_id
    `

    const [bigqueryRows] = await bigquery.query({
      query,
      location: 'asia-northeast3',
    })

    console.log(`   ✅ BigQuery: ${bigqueryRows.length}건\n`)

    // 3. 데이터 비교
    console.log('3. 데이터 비교 중...\n')

    // BigQuery의 evaluation_id 집합
    const bigqueryIds = new Set(bigqueryRows.map((row: any) => row.evaluation_id))
    
    // Google Sheets의 evaluation_id 집합
    const sheetIds = new Set(allSheetEvaluations.map(e => e.evaluationId))

    // BigQuery에 없지만 Sheets에 있는 데이터 (누락된 데이터)
    const missingInBigQuery = allSheetEvaluations.filter(
      e => !bigqueryIds.has(e.evaluationId)
    )

    // Sheets에 없지만 BigQuery에 있는 데이터 (삭제된 데이터 또는 다른 소스)
    const missingInSheets = bigqueryRows.filter(
      (row: any) => !sheetIds.has(row.evaluation_id)
    )

    // 4. 결과 출력
    console.log('='.repeat(60))
    console.log('📈 비교 결과')
    console.log('='.repeat(60))
    console.log(`Google Sheets 총 건수: ${allSheetEvaluations.length}건`)
    console.log(`BigQuery 총 건수: ${bigqueryRows.length}건`)
    console.log(`일치하는 데이터: ${allSheetEvaluations.length - missingInBigQuery.length}건\n`)

    if (missingInBigQuery.length > 0) {
      console.log(`⚠️  BigQuery에 누락된 데이터: ${missingInBigQuery.length}건`)
      console.log('\n   상위 10개:')
      missingInBigQuery.slice(0, 10).forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.agentName} (${e.agentId}) - ${e.date} - ${e.center}`)
      })
      if (missingInBigQuery.length > 10) {
        console.log(`   ... 외 ${missingInBigQuery.length - 10}건`)
      }
    } else {
      console.log('✅ BigQuery에 누락된 데이터 없음')
    }

    console.log()

    if (missingInSheets.length > 0) {
      console.log(`ℹ️  Sheets에 없지만 BigQuery에 있는 데이터: ${missingInSheets.length}건`)
      console.log('   (이전에 동기화된 데이터이거나 다른 소스에서 온 데이터일 수 있음)')
      console.log('\n   상위 10개:')
      missingInSheets.slice(0, 10).forEach((row: any, i: number) => {
        console.log(`   ${i + 1}. ${row.agent_name} (${row.agent_id}) - ${row.evaluation_date} - ${row.center}`)
      })
      if (missingInSheets.length > 10) {
        console.log(`   ... 외 ${missingInSheets.length - 10}건`)
      }
    } else {
      console.log('✅ Sheets와 BigQuery 데이터 일치')
    }

    // 5. 날짜별 통계
    console.log('\n' + '='.repeat(60))
    console.log('📅 날짜별 통계')
    console.log('='.repeat(60))

    // Sheets 날짜별 집계
    const sheetsByDate = new Map<string, number>()
    allSheetEvaluations.forEach(e => {
      const dateStr = String(e.date)
      const count = sheetsByDate.get(dateStr) || 0
      sheetsByDate.set(dateStr, count + 1)
    })

    // BigQuery 날짜별 집계
    const bigqueryByDate = new Map<string, number>()
    bigqueryRows.forEach((row: any) => {
      const date = row.evaluation_date?.value || row.evaluation_date
      const count = bigqueryByDate.get(date) || 0
      bigqueryByDate.set(date, count + 1)
    })

    // 모든 날짜 수집
    const allDates = new Set([
      ...Array.from(sheetsByDate.keys()),
      ...Array.from(bigqueryByDate.keys())
    ])
    const sortedDates = Array.from(allDates).sort().reverse().slice(0, 10)

    console.log('\n최근 10일 데이터:')
    sortedDates.forEach(date => {
      const sheetsCount = sheetsByDate.get(date) || 0
      const bigqueryCount = bigqueryByDate.get(date) || 0
      const diff = sheetsCount - bigqueryCount
      const status = diff === 0 ? '✅' : diff > 0 ? '⚠️' : 'ℹ️'
      console.log(`   ${status} ${date}: Sheets ${sheetsCount}건, BigQuery ${bigqueryCount}건 (차이: ${diff > 0 ? '+' : ''}${diff})`)
    })

    console.log('\n✅ 비교 완료')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  compareData()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ 비교 실패:', error)
      process.exit(1)
    })
}

export { compareData }
