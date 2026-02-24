import { NextResponse } from "next/server"
import { getBigQueryClient } from "@/lib/bigquery"
import { readQASheetData } from "@/lib/qa-sheets"
import { getCorsHeaders } from "@/lib/cors"
import type { QAEvaluation } from "@/lib/types"

const corsHeaders = getCorsHeaders()
const BATCH_SIZE = 500 // BigQuery streaming insert 배치 크기

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

function evalToRow(e: QAEvaluation) {
  return {
    qa_eval_id: e.qaEvalId,
    evaluation_date: e.evaluationDate,
    evaluation_month: e.evaluationMonth,
    round: e.round,
    consultation_id: e.consultationId || null,
    center: e.center,
    team: e.team || null,
    service: e.service,
    channel: e.channel,
    agent_name: e.agentName,
    agent_id: e.agentId || null,
    tenure_months: e.tenureMonths || null,
    work_type: e.workType || null,
    total_score: e.totalScore,
    greeting_score: e.greetingScore ?? null,
    response_expression: e.responseExpression ?? null,
    inquiry_comprehension: e.inquiryComprehension ?? null,
    identity_check: e.identityCheck ?? null,
    required_search: e.requiredSearch ?? null,
    business_knowledge: e.businessKnowledge ?? null,
    promptness: e.promptness ?? null,
    system_processing: e.systemProcessing ?? null,
    consultation_history: e.consultationHistory ?? null,
    empathy_care: e.empathyCare ?? null,
    language_expression: e.languageExpression ?? null,
    listening_focus: e.listeningFocus ?? null,
    explanation_ability: e.explanationAbility ?? null,
    perceived_satisfaction: e.perceivedSatisfaction ?? null,
    praise_bonus: e.praiseBonus ?? null,
    voice_performance: e.voicePerformance ?? null,
    speech_speed: e.speechSpeed ?? null,
    honorific_error: e.honorificError ?? null,
    spelling: e.spelling ?? null,
    close_request: e.closeRequest ?? null,
    copy_error: e.copyError ?? null,
    operation_error: e.operationError ?? null,
    consult_type_depth1: e.consultTypeDepth1 || null,
    consult_type_depth2: e.consultTypeDepth2 || null,
    consult_type_depth3: e.consultTypeDepth3 || null,
    consult_type_depth4: e.consultTypeDepth4 || null,
    knowledge_feedback: e.knowledgeFeedback || null,
    satisfaction_comment: e.satisfactionComment || null,
  }
}

/**
 * QA 평가 데이터 임포트
 * Google Sheets에서 읽어와 BigQuery qa_evaluations 테이블에 저장
 * 중복 방지: 기존 데이터 전체 qa_eval_id 조회 후 Set으로 필터
 * 대용량 처리: 500건씩 배치 insert
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { spreadsheetId, voiceSheetName, chatSheetName, center } = body

    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, error: "spreadsheetId required" },
        { status: 400, headers: corsHeaders }
      )
    }

    const bq = getBigQueryClient()
    const allEvals: QAEvaluation[] = []

    // 유선 시트 파싱
    if (voiceSheetName) {
      console.log(`[API] Reading voice sheet: ${voiceSheetName}`)
      const voiceEvals = await readQASheetData(spreadsheetId, voiceSheetName, center || '용산', '유선')
      console.log(`[API] Voice parsed: ${voiceEvals.length} rows`)
      allEvals.push(...voiceEvals)
    }
    // 채팅 시트 파싱
    if (chatSheetName) {
      console.log(`[API] Reading chat sheet: ${chatSheetName}`)
      const chatEvals = await readQASheetData(spreadsheetId, chatSheetName, center || '용산', '채팅')
      console.log(`[API] Chat parsed: ${chatEvals.length} rows`)
      allEvals.push(...chatEvals)
    }

    if (allEvals.length === 0) {
      return NextResponse.json(
        { success: true, data: { total: 0, inserted: 0, skipped: 0 } },
        { headers: corsHeaders }
      )
    }

    // 기존 ID 전체 조회 (IN절 대신 전체 스캔 - 대용량 안전)
    const [existingRows] = await bq.query({
      query: `SELECT qa_eval_id FROM \`csopp-25f2.KMCC_QC.qa_evaluations\``,
      location: 'asia-northeast3',
    })
    const existingIds = new Set((existingRows as any[]).map(r => r.qa_eval_id))
    console.log(`[API] Existing rows in BQ: ${existingIds.size}`)

    // 신규분만 필터 + 파싱 내 중복 제거
    const seenIds = new Set<string>()
    const newEvals = allEvals.filter(e => {
      if (existingIds.has(e.qaEvalId) || seenIds.has(e.qaEvalId)) return false
      seenIds.add(e.qaEvalId)
      return true
    })

    console.log(`[API] New evals to insert: ${newEvals.length} (skipping ${allEvals.length - newEvals.length} duplicates)`)

    // 배치 insert (500건씩)
    let insertedCount = 0
    const table = bq.dataset('KMCC_QC').table('qa_evaluations')

    for (let i = 0; i < newEvals.length; i += BATCH_SIZE) {
      const batch = newEvals.slice(i, i + BATCH_SIZE)
      const rows = batch.map(evalToRow)
      try {
        await table.insert(rows)
        insertedCount += batch.length
        console.log(`[API] Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${batch.length} rows (total: ${insertedCount})`)
      } catch (batchError: any) {
        // BigQuery insert는 부분 실패 가능 - insertErrors 처리
        if (batchError.name === 'PartialFailureError' && batchError.errors) {
          const failedCount = batchError.errors.length
          const successCount = batch.length - failedCount
          insertedCount += successCount
          console.error(`[API] Batch partial failure: ${successCount} ok, ${failedCount} failed`)
          // 첫 번째 에러만 로깅
          if (batchError.errors[0]?.errors) {
            console.error(`[API] First error:`, JSON.stringify(batchError.errors[0].errors[0]))
          }
        } else {
          throw batchError
        }
      }
    }

    console.log(`[API] QA import complete: total=${allEvals.length}, inserted=${insertedCount}, skipped=${allEvals.length - newEvals.length}`)

    return NextResponse.json({
      success: true,
      data: {
        total: allEvals.length,
        inserted: insertedCount,
        skipped: allEvals.length - newEvals.length,
        existingInBQ: existingIds.size,
      }
    }, { headers: corsHeaders })
  } catch (error) {
    console.error("[API] QA import error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: corsHeaders }
    )
  }
}
