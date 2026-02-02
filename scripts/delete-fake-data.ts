/**
 * 가짜 데이터 삭제 스크립트
 * 
 * "AGT"로 시작하는 가짜 상담사 ID를 가진 모든 데이터를 삭제합니다.
 * 
 * 실행 방법:
 * 1. 먼저 check-fake-data.ts를 실행하여 삭제될 데이터를 확인
 * 2. 확인 후 이 스크립트를 실행
 * 
 * 주의: 이 스크립트는 데이터를 영구적으로 삭제합니다!
 */

import { getBigQueryClient } from '../lib/bigquery'

const PROJECT_ID = 'csopp-25f2'
const DATASET_ID = 'KMCC_QC'

async function deleteFakeData() {
  try {
    const bigquery = getBigQueryClient()
    
    console.log('🔍 가짜 데이터 삭제 시작...')
    console.log('⚠️  주의: 이 작업은 되돌릴 수 없습니다!\n')
    
    // 1. evaluations 테이블에서 가짜 데이터 삭제
    console.log('1. evaluations 테이블에서 가짜 데이터 삭제 중...')
    const deleteEvaluationsQuery = `
      DELETE FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id LIKE 'AGT%'
    `
    
    const [evaluationsResult] = await bigquery.query({
      query: deleteEvaluationsQuery,
      location: 'asia-northeast3',
    })
    
    console.log(`   ✓ evaluations 테이블에서 삭제 완료`)
    
    // 2. agents 테이블에서 가짜 데이터 삭제
    console.log('2. agents 테이블에서 가짜 데이터 삭제 중...')
    const deleteAgentsQuery = `
      DELETE FROM \`${DATASET_ID}.agents\`
      WHERE agent_id LIKE 'AGT%'
    `
    
    const [agentsResult] = await bigquery.query({
      query: deleteAgentsQuery,
      location: 'asia-northeast3',
    })
    
    console.log(`   ✓ agents 테이블에서 삭제 완료`)
    
    // 3. watch_list 테이블에서 가짜 데이터 삭제
    console.log('3. watch_list 테이블에서 가짜 데이터 삭제 중...')
    const deleteWatchListQuery = `
      DELETE FROM \`${DATASET_ID}.watch_list\`
      WHERE agent_id LIKE 'AGT%'
    `
    
    const [watchListResult] = await bigquery.query({
      query: deleteWatchListQuery,
      location: 'asia-northeast3',
    })
    
    console.log(`   ✓ watch_list 테이블에서 삭제 완료`)
    
    // 4. 삭제 후 확인
    console.log('\n4. 삭제 후 확인 중...')
    
    const checkEvaluationsQuery = `
      SELECT COUNT(*) as count
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id LIKE 'AGT%'
    `
    
    const checkAgentsQuery = `
      SELECT COUNT(*) as count
      FROM \`${DATASET_ID}.agents\`
      WHERE agent_id LIKE 'AGT%'
    `
    
    const checkWatchListQuery = `
      SELECT COUNT(*) as count
      FROM \`${DATASET_ID}.watch_list\`
      WHERE agent_id LIKE 'AGT%'
    `
    
    const [evaluationsCheck] = await bigquery.query({
      query: checkEvaluationsQuery,
      location: 'asia-northeast3',
    })
    
    const [agentsCheck] = await bigquery.query({
      query: checkAgentsQuery,
      location: 'asia-northeast3',
    })
    
    const [watchListCheck] = await bigquery.query({
      query: checkWatchListQuery,
      location: 'asia-northeast3',
    })
    
    const remainingEvaluations = Number(evaluationsCheck[0]?.count) || 0
    const remainingAgents = Number(agentsCheck[0]?.count) || 0
    const remainingWatchList = Number(watchListCheck[0]?.count) || 0
    
    console.log(`\n✅ 삭제 완료!`)
    console.log(`   - evaluations 테이블: ${remainingEvaluations}개 남음`)
    console.log(`   - agents 테이블: ${remainingAgents}개 남음`)
    console.log(`   - watch_list 테이블: ${remainingWatchList}개 남음`)
    
    if (remainingEvaluations === 0 && remainingAgents === 0 && remainingWatchList === 0) {
      console.log('\n🎉 모든 가짜 데이터가 성공적으로 삭제되었습니다!')
    } else {
      console.log('\n⚠️  일부 가짜 데이터가 남아있을 수 있습니다. 확인이 필요합니다.')
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error)
    throw error
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  deleteFakeData()
    .then(() => {
      console.log('\n✅ 스크립트 실행 완료')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error)
      process.exit(1)
    })
}

export { deleteFakeData }
