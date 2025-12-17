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
} catch (error) {
  console.error('[Firebase] Initialization error:', error)
}

// Firestore 인스턴스 (커스텀 데이터베이스 ID 사용)
const DATABASE_ID = process.env.FIREBASE_DATABASE_ID || '(default)'
export const db = firebaseApp ? getFirestore(firebaseApp, DATABASE_ID) : null

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
  if (!db) {
    console.error('[Firebase] Firestore not initialized')
    return { success: false, error: 'Firestore not initialized', data: null }
  }

  try {
    // 상담사 수 조회
    const agentsSnapshot = await db.collection('agents').get()
    const agents = agentsSnapshot.docs.map(doc => doc.data())

    const yonsanAgents = agents.filter(a => a.center === '용산')
    const gwangjuAgents = agents.filter(a => a.center === '광주')

    // 오늘 날짜 또는 지정된 날짜의 평가 데이터
    const today = targetDate || new Date().toISOString().split('T')[0]
    const evaluationsSnapshot = await db.collection('evaluations')
      .where('date', '==', today)
      .get()

    const todayEvaluations = evaluationsSnapshot.docs.map(doc => doc.data())

    // 통계 계산
    const totalEvaluations = todayEvaluations.length

    // 오류율 계산
    let totalAttitudeErrors = 0
    let totalBusinessErrors = 0

    todayEvaluations.forEach((ev: any) => {
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

    todayEvaluations.forEach((ev: any) => {
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
        date: today,
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
