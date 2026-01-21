import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Firebase Admin SDK 초기화
function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0]
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    console.error('[Firebase] Missing environment variables:', {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
    })
    throw new Error('Firebase configuration is incomplete. Check environment variables.')
  }

  // Private key의 \n을 실제 줄바꿈으로 변환
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n')

  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey: formattedPrivateKey,
  }

  return initializeApp({
    credential: cert(serviceAccount),
  })
}

// Firebase 앱 초기화
let firebaseApp: ReturnType<typeof initializeApp> | null = null

try {
  firebaseApp = initializeFirebaseAdmin()
  console.log('[Firebase] Firebase Admin initialized successfully')
} catch (error) {
  console.error('[Firebase] Initialization error:', error)
  console.error('[Firebase] Error details:', error instanceof Error ? error.stack : String(error))
}

// Firestore 인스턴스 (커스텀 데이터베이스 ID 사용)
const DATABASE_ID = process.env.FIREBASE_DATABASE_ID || '(default)'
export const db = firebaseApp ? getFirestore(firebaseApp, DATABASE_ID) : null

if (!db) {
  console.error('[Firebase] Firestore instance is null. Check Firebase initialization.')
  console.error('[Firebase] Environment variables check:', {
    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    databaseId: DATABASE_ID,
  })
}

// 데이터 저장 함수
export async function saveEvaluationsToFirestore(evaluations: any[], agents: any[]) {
  if (!db) {
    console.error('[Firebase] Firestore not initialized')
    return { success: false, error: 'Firestore not initialized' }
  }

  try {
    const batch = db.batch()
    let operationCount = 0
    const MAX_BATCH_SIZE = 500 // Firestore batch limit

    // 평가 데이터 저장
    for (const evaluation of evaluations) {
      if (operationCount >= MAX_BATCH_SIZE) {
        await batch.commit()
        operationCount = 0
      }

      const docId = `${evaluation.agentId}_${evaluation.date}_${Date.now()}`
      const docRef = db.collection('evaluations').doc(docId)
      batch.set(docRef, {
        ...evaluation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      operationCount++
    }

    // 상담사 데이터 저장/업데이트
    for (const agent of agents) {
      if (operationCount >= MAX_BATCH_SIZE) {
        await batch.commit()
        operationCount = 0
      }

      const docRef = db.collection('agents').doc(agent.id)
      batch.set(docRef, {
        ...agent,
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      operationCount++
    }

    if (operationCount > 0) {
      await batch.commit()
    }

    console.log(`[Firebase] Saved ${evaluations.length} evaluations, ${agents.length} agents`)
    return { success: true, evaluations: evaluations.length, agents: agents.length }
  } catch (error) {
    console.error('[Firebase] Save error:', error)
    return { success: false, error: String(error) }
  }
}

// 대량 데이터 저장 함수 (배치 처리)
export async function saveBatchToFirestore(evaluations: any[], agents: any[], batchNumber: number) {
  if (!db) {
    console.error('[Firebase] Firestore not initialized')
    return { success: false, error: 'Firestore not initialized' }
  }

  try {
    const CHUNK_SIZE = 400 // 안전하게 400개씩 처리
    let savedCount = 0

    // 평가 데이터를 청크로 나누어 저장
    for (let i = 0; i < evaluations.length; i += CHUNK_SIZE) {
      const chunk = evaluations.slice(i, i + CHUNK_SIZE)
      const batch = db.batch()

      for (const evaluation of chunk) {
        const docId = `${evaluation.agentId}_${evaluation.date}_${batchNumber}_${i + savedCount}`
        const docRef = db.collection('evaluations').doc(docId)
        batch.set(docRef, {
          ...evaluation,
          batchNumber,
          createdAt: new Date().toISOString(),
        })
        savedCount++
      }

      await batch.commit()
    }

    // 상담사 데이터 저장
    if (agents.length > 0) {
      const agentBatch = db.batch()
      for (const agent of agents) {
        const docRef = db.collection('agents').doc(agent.id)
        agentBatch.set(docRef, {
          ...agent,
          updatedAt: new Date().toISOString(),
        }, { merge: true })
      }
      await agentBatch.commit()
    }

    console.log(`[Firebase] Batch ${batchNumber}: Saved ${savedCount} evaluations, ${agents.length} agents`)
    return { success: true, savedCount, agents: agents.length }
  } catch (error) {
    console.error(`[Firebase] Batch ${batchNumber} error:`, error)
    return { success: false, error: String(error) }
  }
}

// ============================================
// 데이터 읽기 함수들
// ============================================

// 모든 상담사 조회
export async function getAgents() {
  if (!db) {
    console.error('[Firebase] Firestore not initialized')
    return { success: false, error: 'Firestore not initialized', data: [] }
  }

  try {
    const snapshot = await db.collection('agents').get()
    const agents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return { success: true, data: agents }
  } catch (error) {
    console.error('[Firebase] Get agents error:', error)
    return { success: false, error: String(error), data: [] }
  }
}

// 평가 데이터 조회 (날짜 범위)
export async function getEvaluations(startDate?: string, endDate?: string, limit = 10000) {
  if (!db) {
    console.error('[Firebase] Firestore not initialized')
    return { success: false, error: 'Firestore not initialized', data: [] }
  }

  try {
    let query: FirebaseFirestore.Query = db.collection('evaluations')

    if (startDate) {
      query = query.where('date', '>=', startDate)
    }
    if (endDate) {
      query = query.where('date', '<=', endDate)
    }

    query = query.limit(limit)

    const snapshot = await query.get()
    const evaluations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return { success: true, data: evaluations }
  } catch (error) {
    console.error('[Firebase] Get evaluations error:', error)
    return { success: false, error: String(error), data: [] }
  }
}

// 대시보드 통계 데이터 조회
export async function getDashboardStats(targetDate?: string) {
  console.log(`[Firebase] getDashboardStats called with targetDate: ${targetDate || 'undefined'}`)
  
  if (!db) {
    console.error('[Firebase] Firestore not initialized - db is null')
    console.error('[Firebase] Environment check:', {
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY ? '***' : false,
    })
    return { success: false, error: 'Firestore not initialized', data: null }
  }

  console.log('[Firebase] Firestore initialized, starting query...')

  try {
    // 변수 초기화 (스코프 문제 방지)
    let dateEvaluations: any[] = []
    // 상담사 수 조회
    const agentsSnapshot = await db.collection('agents').get()
    const agents = agentsSnapshot.docs.map(doc => doc.data())

    const yonsanAgents = agents.filter(a => a.center === '용산')
    const gwangjuAgents = agents.filter(a => a.center === '광주')

    // 전일(어제) 날짜 또는 지정된 날짜의 평가 데이터
    // 날짜 형식 통일: YYYY-MM-DD
    // targetDate가 없으면 어제 날짜 사용 (전일 평가건수 표시용)
    let queryDate = targetDate
    if (!queryDate) {
      // 한국 시간대(KST) 기준으로 어제 날짜 계산
      const now = new Date()
      // UTC 시간을 한국 시간으로 변환 (UTC+9)
      const kstOffset = 9 * 60 * 60 * 1000 // 9시간을 밀리초로
      const kstTime = new Date(now.getTime() + kstOffset)
      
      // 어제 날짜 계산
      const yesterday = new Date(kstTime)
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      
      // YYYY-MM-DD 형식으로 변환
      const year = yesterday.getUTCFullYear()
      const month = String(yesterday.getUTCMonth() + 1).padStart(2, '0')
      const day = String(yesterday.getUTCDate()).padStart(2, '0')
      queryDate = `${year}-${month}-${day}`
      console.log(`[Firebase] 어제 날짜 계산: ${queryDate} (KST 기준)`)
    }
    
    // 날짜 형식이 다를 수 있으므로 정규화
    if (!/^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
      try {
        const dateObj = new Date(queryDate)
        if (!isNaN(dateObj.getTime())) {
          const year = dateObj.getFullYear()
          const month = String(dateObj.getMonth() + 1).padStart(2, '0')
          const day = String(dateObj.getDate()).padStart(2, '0')
          queryDate = `${year}-${month}-${day}`
        }
      } catch (e) {
        console.error('[Firebase] 날짜 형식 오류:', queryDate)
      }
    }
    
    console.log(`[Firebase] 조회 날짜: ${queryDate} (targetDate: ${targetDate || '없음'})`)
    console.log(`[Firebase] 현재 시간: ${new Date().toISOString()}`)
    
    // 날짜 필드로 조회 (정확한 일치)
    let evaluationsSnapshot = await db.collection('evaluations')
      .where('date', '==', queryDate)
      .get()
    
    // 데이터가 없으면 샘플 데이터를 확인하여 날짜 형식 파악
    if (evaluationsSnapshot.empty) {
      console.log(`[Firebase] 정확한 일치(${queryDate})로 데이터를 찾지 못했습니다. 샘플 데이터 확인 중...`)
      
      // 최근 평가 데이터 샘플 확인
      const sampleSnapshot = await db.collection('evaluations')
        .limit(10)
        .get()
      
      if (!sampleSnapshot.empty) {
        const sampleDates = sampleSnapshot.docs.map(doc => {
          const data = doc.data()
          return { date: data.date, type: typeof data.date, fullData: data }
        })
        console.log(`[Firebase] 샘플 날짜 형식들:`, sampleDates)
        
        // 샘플에서 날짜 형식 확인 후 필터링
        const allEvaluations = await db.collection('evaluations').get()
        
        // 날짜 형식 정규화 함수: "2025. 12. 19", "2025.12.19", "2025-12-19" 등을 "2025-12-19"로 변환
        const normalizeDate = (dateStr: string): string | null => {
          if (!dateStr) return null
          
          // 이미 YYYY-MM-DD 형식
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr
          }
          
          // "2025. 12. 19" 또는 "2025.12.19" 형식 처리
          const dotMatch = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/)
          if (dotMatch) {
            const year = dotMatch[1]
            const month = String(parseInt(dotMatch[2], 10)).padStart(2, '0')
            const day = String(parseInt(dotMatch[3], 10)).padStart(2, '0')
            return `${year}-${month}-${day}`
          }
          
          // "2025/12/19" 형식 처리
          const slashMatch = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)
          if (slashMatch) {
            const year = slashMatch[1]
            const month = String(parseInt(slashMatch[2], 10)).padStart(2, '0')
            const day = String(parseInt(slashMatch[3], 10)).padStart(2, '0')
            return `${year}-${month}-${day}`
          }
          
          // Date 객체인 경우
          try {
            const dateObj = new Date(dateStr)
            if (!isNaN(dateObj.getTime())) {
              const year = dateObj.getFullYear()
              const month = String(dateObj.getMonth() + 1).padStart(2, '0')
              const day = String(dateObj.getDate()).padStart(2, '0')
              return `${year}-${month}-${day}`
            }
          } catch (e) {
            // Date 파싱 실패
          }
          
          return null
        }
        
        dateEvaluations = allEvaluations.docs
          .map(doc => doc.data())
          .filter((data: any) => {
            const dateStr = String(data.date || '')
            const normalizedDate = normalizeDate(dateStr)
            
            // 정규화된 날짜와 조회 날짜 비교
            if (normalizedDate === queryDate) {
              return true
            }
            
            // 원본 문자열에서 직접 비교 (혹시 모를 경우)
            if (dateStr === queryDate) return true
            if (dateStr.startsWith(queryDate)) return true
            
            // "2025. 12. 19" 형식에서 날짜 추출하여 비교
            const dotMatch = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/)
            if (dotMatch) {
              const year = dotMatch[1]
              const month = String(parseInt(dotMatch[2], 10)).padStart(2, '0')
              const day = String(parseInt(dotMatch[3], 10)).padStart(2, '0')
              const formattedDate = `${year}-${month}-${day}`
              if (formattedDate === queryDate) return true
            }
            
            return false
          })
        
        console.log(`[Firebase] 필터링 후 ${dateEvaluations.length}건 발견`)
      } else {
        console.log(`[Firebase] 평가 데이터가 없습니다.`)
        dateEvaluations = []
      }
    } else {

      dateEvaluations = evaluationsSnapshot.docs.map(doc => {
        const data = doc.data()
        // 디버깅: 날짜 필드 확인
        if (data.date !== queryDate) {
          console.warn(`[Firebase] 날짜 불일치: 조회=${queryDate}, 저장=${data.date}`)
        }
        return data
      })
    }
    
    console.log(`[Firebase] ${queryDate} 날짜의 평가 데이터: ${dateEvaluations.length}건`)
    const yonsanCount = dateEvaluations.filter((e: any) => e.center === '용산').length
    const gwangjuCount = dateEvaluations.filter((e: any) => e.center === '광주').length
    console.log(`[Firebase] 센터별 분포: 용산 ${yonsanCount}건, 광주 ${gwangjuCount}건`)
    
    // 데이터가 없으면 최근 날짜 확인
    if (dateEvaluations.length === 0) {
      console.log(`[Firebase] ${queryDate} 날짜에 데이터가 없습니다. 최근 평가 데이터 확인 중...`)
      const recentSnapshot = await db.collection('evaluations')
        .orderBy('date', 'desc')
        .limit(5)
        .get()
      
      const recentDates = recentSnapshot.docs.map(doc => doc.data().date).filter(Boolean)
      const uniqueDates = [...new Set(recentDates)]
      console.log(`[Firebase] 최근 평가 날짜들: ${uniqueDates.join(', ')}`)
    }

    // 통계 계산
    const totalEvaluations = dateEvaluations.length

    // 오류율 계산
    let totalAttitudeErrors = 0
    let totalBusinessErrors = 0

    dateEvaluations.forEach((ev: any) => {
      totalAttitudeErrors += ev.attitudeErrors || 0
      totalBusinessErrors += ev.businessErrors || 0
    })

    const attitudeErrorRate = totalEvaluations > 0
      ? Number((totalAttitudeErrors / totalEvaluations * 100).toFixed(2))
      : 0
    const businessErrorRate = totalEvaluations > 0
      ? Number((totalBusinessErrors / totalEvaluations * 100).toFixed(2))
      : 0
    const overallErrorRate = Number((attitudeErrorRate + businessErrorRate).toFixed(2))

    // 유의 상담사 (오류율 높은 상담사)
    const agentErrorCounts: Record<string, { attitude: number, business: number, total: number, center: string }> = {}

    dateEvaluations.forEach((ev: any) => {
      const agentId = ev.agentId
      if (!agentErrorCounts[agentId]) {
        agentErrorCounts[agentId] = { attitude: 0, business: 0, total: 0, center: ev.center || '' }
      }
      agentErrorCounts[agentId].attitude += ev.attitudeErrors || 0
      agentErrorCounts[agentId].business += ev.businessErrors || 0
      agentErrorCounts[agentId].total += (ev.attitudeErrors || 0) + (ev.businessErrors || 0)
    })

    // 오류가 3건 이상인 상담사를 유의 상담사로
    const watchlistAgents = Object.entries(agentErrorCounts)
      .filter(([_, counts]) => counts.total >= 3)

    const watchlistYongsan = watchlistAgents.filter(([_, c]) => c.center === '용산').length
    const watchlistGwangju = watchlistAgents.filter(([_, c]) => c.center === '광주').length

    return {
      success: true,
      data: {
        totalAgentsYongsan: yonsanAgents.length,
        totalAgentsGwangju: gwangjuAgents.length,
        totalEvaluations,
        watchlistYongsan,
        watchlistGwangju,
        attitudeErrorRate,
        businessErrorRate,
        overallErrorRate,
        date: queryDate,
      }
    }
  } catch (error) {
    console.error('[Firebase] Get dashboard stats error:', error)
    return { success: false, error: String(error), data: null }
  }
}

// 센터별 통계
export async function getCenterStats(startDate?: string, endDate?: string) {
  if (!db) {
    return { success: false, error: 'Firestore not initialized', data: [] }
  }

  try {
    let query: FirebaseFirestore.Query = db.collection('evaluations')

    if (startDate) {
      query = query.where('date', '>=', startDate)
    }
    if (endDate) {
      query = query.where('date', '<=', endDate)
    }

    const snapshot = await query.get()
    const evaluations = snapshot.docs.map(doc => doc.data())

    // 센터별 그룹화
    const centerStats: Record<string, {
      evaluations: number,
      attitudeErrors: number,
      businessErrors: number,
      services: Record<string, { evaluations: number, errors: number }>
    }> = {
      '용산': { evaluations: 0, attitudeErrors: 0, businessErrors: 0, services: {} },
      '광주': { evaluations: 0, attitudeErrors: 0, businessErrors: 0, services: {} },
    }

    evaluations.forEach((ev: any) => {
      const center = ev.center || '용산'
      const service = ev.service || '기타'

      if (!centerStats[center]) {
        centerStats[center] = { evaluations: 0, attitudeErrors: 0, businessErrors: 0, services: {} }
      }

      centerStats[center].evaluations++
      centerStats[center].attitudeErrors += ev.attitudeErrors || 0
      centerStats[center].businessErrors += ev.businessErrors || 0

      if (!centerStats[center].services[service]) {
        centerStats[center].services[service] = { evaluations: 0, errors: 0 }
      }
      centerStats[center].services[service].evaluations++
      centerStats[center].services[service].errors += (ev.attitudeErrors || 0) + (ev.businessErrors || 0)
    })

    const result = Object.entries(centerStats).map(([name, stats]) => ({
      name,
      evaluations: stats.evaluations,
      errorRate: stats.evaluations > 0
        ? Number(((stats.attitudeErrors + stats.businessErrors) / stats.evaluations * 100).toFixed(2))
        : 0,
      attitudeErrorRate: stats.evaluations > 0
        ? Number((stats.attitudeErrors / stats.evaluations * 100).toFixed(2))
        : 0,
      businessErrorRate: stats.evaluations > 0
        ? Number((stats.businessErrors / stats.evaluations * 100).toFixed(2))
        : 0,
      services: Object.entries(stats.services).map(([serviceName, svcStats]) => ({
        name: serviceName,
        evaluations: svcStats.evaluations,
        errorRate: svcStats.evaluations > 0
          ? Number((svcStats.errors / svcStats.evaluations * 100).toFixed(2))
          : 0,
      }))
    }))

    return { success: true, data: result }
  } catch (error) {
    console.error('[Firebase] Get center stats error:', error)
    return { success: false, error: String(error), data: [] }
  }
}

// 일별 트렌드 데이터
export async function getDailyTrend(days = 14) {
  if (!db) {
    return { success: false, error: 'Firestore not initialized', data: [] }
  }

  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    const snapshot = await db.collection('evaluations')
      .where('date', '>=', startDateStr)
      .where('date', '<=', endDateStr)
      .get()

    const evaluations = snapshot.docs.map(doc => doc.data())

    // 날짜별 그룹화
    const dailyStats: Record<string, {
      yonsan: { count: number, errors: number },
      gwangju: { count: number, errors: number }
    }> = {}

    evaluations.forEach((ev: any) => {
      const date = ev.date
      const center = ev.center || '용산'

      if (!dailyStats[date]) {
        dailyStats[date] = {
          yonsan: { count: 0, errors: 0 },
          gwangju: { count: 0, errors: 0 }
        }
      }

      const key = center === '용산' ? 'yonsan' : 'gwangju'
      dailyStats[date][key].count++
      dailyStats[date][key].errors += (ev.attitudeErrors || 0) + (ev.businessErrors || 0)
    })

    // 결과 변환
    const result = Object.entries(dailyStats)
      .map(([date, stats]) => ({
        date,
        yongsan: stats.yonsan.count > 0
          ? Number((stats.yonsan.errors / stats.yonsan.count * 100).toFixed(2))
          : 0,
        gwangju: stats.gwangju.count > 0
          ? Number((stats.gwangju.errors / stats.gwangju.count * 100).toFixed(2))
          : 0,
        overall: (stats.yonsan.count + stats.gwangju.count) > 0
          ? Number(((stats.yonsan.errors + stats.gwangju.errors) / (stats.yonsan.count + stats.gwangju.count) * 100).toFixed(2))
          : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return { success: true, data: result }
  } catch (error) {
    console.error('[Firebase] Get daily trend error:', error)
    return { success: false, error: String(error), data: [] }
  }
}

// Firebase 데이터 전체 삭제 (재초기화용)
export async function deleteAllFirestoreData() {
  if (!db) {
    console.error('[Firebase] Firestore not initialized')
    return { success: false, error: 'Firestore not initialized' }
  }

  try {
    console.log('[Firebase] 전체 데이터 삭제 시작...')
    
    // evaluations 컬렉션 삭제
    const evaluationsSnapshot = await db.collection('evaluations').get()
    let evalCount = 0
    const evalBatches: FirebaseFirestore.WriteBatch[] = []
    let currentBatch = db.batch()
    let batchOpCount = 0
    
    evaluationsSnapshot.docs.forEach((doc) => {
      currentBatch.delete(doc.ref)
      batchOpCount++
      evalCount++
      
      // Firestore 배치 제한 (500개)
      if (batchOpCount >= 500) {
        evalBatches.push(currentBatch)
        currentBatch = db.batch()
        batchOpCount = 0
      }
    })
    
    if (batchOpCount > 0) {
      evalBatches.push(currentBatch)
    }
    
    // 모든 배치 커밋
    for (const batch of evalBatches) {
      await batch.commit()
    }
    console.log(`[Firebase] evaluations ${evalCount}건 삭제 완료`)

    // agents 컬렉션 삭제
    const agentsSnapshot = await db.collection('agents').get()
    let agentCount = 0
    const agentBatches: FirebaseFirestore.WriteBatch[] = []
    currentBatch = db.batch()
    batchOpCount = 0
    
    agentsSnapshot.docs.forEach((doc) => {
      currentBatch.delete(doc.ref)
      batchOpCount++
      agentCount++
      
      if (batchOpCount >= 500) {
        agentBatches.push(currentBatch)
        currentBatch = db.batch()
        batchOpCount = 0
      }
    })
    
    if (batchOpCount > 0) {
      agentBatches.push(currentBatch)
    }
    
    for (const batch of agentBatches) {
      await batch.commit()
    }
    console.log(`[Firebase] agents ${agentCount}건 삭제 완료`)

    console.log('[Firebase] 전체 데이터 삭제 완료')
    return { 
      success: true, 
      deleted: {
        evaluations: evalCount,
        agents: agentCount
      }
    }
  } catch (error) {
    console.error('[Firebase] Delete all data error:', error)
    return { success: false, error: String(error) }
  }
}
