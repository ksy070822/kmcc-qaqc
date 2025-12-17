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

// Firestore 인스턴스
export const db = firebaseApp ? getFirestore(firebaseApp) : null

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
