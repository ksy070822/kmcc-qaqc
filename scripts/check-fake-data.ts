/**
 * 가짜 데이터 확인 스크립트
 * 
 * "AGT"로 시작하는 가짜 상담사 ID를 가진 데이터를 확인합니다.
 * 
 * 실행 방법:
 * npx ts-node scripts/check-fake-data.ts
 */

import { getBigQueryClient } from '../lib/bigquery'

const PROJECT_ID = 'csopp-25f2'
const DATASET_ID = 'KMCC_QC'

async function checkFakeData() {
  try {
    const bigquery = getBigQueryClient()
    
    console.log('🔍 가짜 데이터 확인 중...\n')
    
    // 1. evaluations 테이블에서 가짜 데이터 확인
    console.log('1. evaluations 테이블 확인 중...')
    const evaluationsQuery = `
      SELECT 
        agent_id,
        agent_name,
        center,
        service,
        channel,
        COUNT(*) as evaluation_count,
        MIN(evaluation_date) as first_date,
        MAX(evaluation_date) as last_date
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id LIKE 'AGT%'
      GROUP BY agent_id, agent_name, center, service, channel
      ORDER BY evaluation_count DESC
      LIMIT 20
    `
    
    const [evaluationsRows] = await bigquery.query({
      query: evaluationsQuery,
      location: 'asia-northeast3',
    })
    
    console.log(`   발견된 가짜 상담사 수: ${evaluationsRows.length}개`)
    if (evaluationsRows.length > 0) {
      const totalEvaluations = evaluationsRows.reduce((sum: number, row: any) => sum + Number(row.evaluation_count), 0)
      console.log(`   총 평가 건수: ${totalEvaluations}건`)
      console.log('\n   상위 10개:')
      evaluationsRows.slice(0, 10).forEach((row: any, index: number) => {
        console.log(`   ${index + 1}. ${row.agent_id} / ${row.agent_name} (${row.center} ${row.service}/${row.channel}) - ${row.evaluation_count}건`)
      })
    }
    
    // 2. agents 테이블에서 가짜 데이터 확인
    console.log('\n2. agents 테이블 확인 중...')
    const agentsQuery = `
      SELECT 
        agent_id,
        agent_name,
        center,
        service,
        channel,
        total_evaluations
      FROM \`${DATASET_ID}.agents\`
      WHERE agent_id LIKE 'AGT%'
      ORDER BY agent_id
      LIMIT 20
    `
    
    const [agentsRows] = await bigquery.query({
      query: agentsQuery,
      location: 'asia-northeast3',
    })
    
    console.log(`   발견된 가짜 상담사 수: ${agentsRows.length}개`)
    if (agentsRows.length > 0) {
      console.log('\n   상위 10개:')
      agentsRows.slice(0, 10).forEach((row: any, index: number) => {
        console.log(`   ${index + 1}. ${row.agent_id} / ${row.agent_name} (${row.center} ${row.service}/${row.channel})`)
      })
    }
    
    // 3. watch_list 테이블에서 가짜 데이터 확인
    console.log('\n3. watch_list 테이블 확인 중...')
    const watchListQuery = `
      SELECT 
        watch_id,
        agent_id,
        agent_name,
        center,
        service,
        channel,
        created_date
      FROM \`${DATASET_ID}.watch_list\`
      WHERE agent_id LIKE 'AGT%'
      ORDER BY created_date DESC
      LIMIT 20
    `
    
    const [watchListRows] = await bigquery.query({
      query: watchListQuery,
      location: 'asia-northeast3',
    })
    
    console.log(`   발견된 가짜 상담사 수: ${watchListRows.length}개`)
    if (watchListRows.length > 0) {
      console.log('\n   상위 10개:')
      watchListRows.slice(0, 10).forEach((row: any, index: number) => {
        console.log(`   ${index + 1}. ${row.agent_id} / ${row.agent_name} (${row.center} ${row.service}/${row.channel}) - ${row.created_date}`)
      })
    }
    
    // 4. 요약
    console.log('\n📊 요약:')
    console.log(`   - evaluations 테이블: ${evaluationsRows.length}개 가짜 상담사`)
    console.log(`   - agents 테이블: ${agentsRows.length}개 가짜 상담사`)
    console.log(`   - watch_list 테이블: ${watchListRows.length}개 가짜 상담사`)
    
    if (evaluationsRows.length > 0 || agentsRows.length > 0 || watchListRows.length > 0) {
      console.log('\n⚠️  가짜 데이터가 발견되었습니다!')
      console.log('   삭제하려면: npx ts-node scripts/delete-fake-data.ts')
    } else {
      console.log('\n✅ 가짜 데이터가 없습니다!')
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  checkFakeData()
    .then(() => {
      console.log('\n✅ 확인 완료')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ 확인 실패:', error)
      process.exit(1)
    })
}

export { checkFakeData }
