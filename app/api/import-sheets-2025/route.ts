import { type NextRequest, NextResponse } from "next/server";
import {
  readYonsan2025Gwangju2025Sheets,
  parseSheetRowsToEvaluations2025,
} from "@/lib/google-sheets";
import { getBigQueryClient } from "@/lib/bigquery";
import { startSync, updateProgress, finishSync } from "@/lib/sync-progress";
import { getCorsHeaders } from "@/lib/cors";

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || "KMCC_QC";
const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_ID || "14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o";
const EVAL_TABLE = '`' + DATASET_ID + '.evaluations`';

const corsHeaders = getCorsHeaders();

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * 용산2025, 광주2025 시트 1회 적재 API
 * - 정기 동기화(용산/광주)와 분리된 1회용 임포트
 */
export async function POST(request: NextRequest) {
  startSync('import2025');
  try {
    console.log("[Import 2025] ===== 용산2025/광주2025 1회 적재 시작 =====");
    updateProgress('용산2025/광주2025 시트 읽기');

    const sheetsResult = await readYonsan2025Gwangju2025Sheets(SPREADSHEET_ID);

    if (!sheetsResult.success) {
      finishSync('import2025', false, { error: sheetsResult.error });
      return NextResponse.json(
        { success: false, error: sheetsResult.error },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!sheetsResult.yonsan || !sheetsResult.gwangju) {
      finishSync('import2025', false, { error: "시트 데이터를 읽을 수 없습니다." });
      return NextResponse.json(
        { success: false, error: "시트 데이터를 읽을 수 없습니다." },
        { status: 500, headers: corsHeaders }
      );
    }

    const yonsanHeaders = sheetsResult.yonsan[0] || [];
    const yonsanRows = sheetsResult.yonsan.slice(1);
    const gwangjuHeaders = sheetsResult.gwangju[0] || [];
    const gwangjuRows = sheetsResult.gwangju.slice(1);

    // 용산2025: 채널 있음, 광주2025: 채널 없음
    const yonsanEvaluations = parseSheetRowsToEvaluations2025(
      yonsanHeaders,
      yonsanRows,
      "용산",
      true
    );
    const gwangjuEvaluations = parseSheetRowsToEvaluations2025(
      gwangjuHeaders,
      gwangjuRows,
      "광주",
      false
    );

    const allEvaluations = [...yonsanEvaluations, ...gwangjuEvaluations];
    console.log(
      `[Import 2025] 파싱 완료: 용산 ${yonsanEvaluations.length}건, 광주 ${gwangjuEvaluations.length}건`
    );

    const bigquery = getBigQueryClient();
    const evaluationIds = allEvaluations.map((e) => e.evaluationId);

    let existingIds = new Set<string>();
    if (evaluationIds.length > 0) {
      try {
        const idsList = evaluationIds
          .map((id) => `'${String(id).replace(/'/g, "''")}'`)
          .join(",");
        const [rows] = await bigquery.query({
          query: `
            SELECT DISTINCT evaluation_id
            FROM ${EVAL_TABLE}
            WHERE evaluation_id IN (${idsList})
          `,
          location: "asia-northeast3",
        });
        existingIds = new Set(rows.map((row: any) => row.evaluation_id));
      } catch (e) {
        console.warn("[Import 2025] 기존 ID 조회 실패, 전체 저장 시도:", e);
      }
    }

    const newEvaluations = allEvaluations.filter(
      (e) => !existingIds.has(String(e.evaluationId))
    );

    if (newEvaluations.length === 0) {
      finishSync('import2025', true, { saved: 0, total: allEvaluations.length, existing: existingIds.size });
      return NextResponse.json(
        {
          success: true,
          message: "새로운 데이터가 없습니다. (모두 이미 적재됨)",
          summary: {
            total: allEvaluations.length,
            existing: existingIds.size,
            new: 0,
            saved: 0,
          },
        },
        { headers: corsHeaders }
      );
    }

    const bigqueryRows = newEvaluations.map((evalData) => {
      // Group construction (service + channel) needed for required 'group' field
      const groupValue = `${evalData.service || ''} ${evalData.channel || ''}`.trim();

      return {
        evaluation_id: evalData.evaluationId,
        evaluation_date: evalData.date,
        consultation_datetime: null,
        consultation_id: evalData.consultId || null,
        evaluation_round: null,
        center: evalData.center,
        service: evalData.service || "",
        channel: evalData.channel || "unknown",
        group: groupValue || 'unknown',
        agent_id: evalData.agentId,
        agent_name: evalData.agentName,
        greeting_error: evalData.greetingError || false,
        empathy_error: evalData.empathyError || false,
        apology_error: evalData.apologyError || false,
        additional_inquiry_error: evalData.additionalInquiryError || false,
        unkind_error: evalData.unkindError || false,
        consult_type_error: evalData.consultTypeError || false,
        guide_error: evalData.guideError || false,
        identity_check_error: evalData.identityCheckError || false,
        required_search_error: evalData.requiredSearchError || false,
        wrong_guide_error: evalData.wrongGuideError || false,
        process_missing_error: evalData.processMissingError || false,
        process_incomplete_error: evalData.processIncompleteError || false,
        system_error: evalData.systemError || false,
        id_mapping_error: evalData.idMappingError || false,
        flag_keyword_error: evalData.flagKeywordError || false,
        history_error: evalData.historyError || false,
        attitude_error_count: evalData.attitudeErrors,
        business_error_count: evalData.businessErrors,
        total_error_count: evalData.totalErrors,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    updateProgress('BigQuery 저장', 0, bigqueryRows.length);
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table("evaluations");

    const BATCH_SIZE = 10000;
    let savedCount = 0;

    for (let i = 0; i < bigqueryRows.length; i += BATCH_SIZE) {
      const batch = bigqueryRows.slice(i, i + BATCH_SIZE);
      await table.insert(batch);
      savedCount += batch.length;
      updateProgress('BigQuery 저장', savedCount, bigqueryRows.length);
      console.log(
        `[Import 2025] 저장 진행: ${savedCount}/${bigqueryRows.length}건`
      );
    }

    finishSync('import2025', true, { saved: savedCount, total: allEvaluations.length, existing: existingIds.size });
    console.log(
      `[Import 2025] ===== 1회 적재 완료: ${savedCount}건 저장 =====`
    );

    return NextResponse.json(
      {
        success: true,
        message: `용산2025/광주2025 데이터 ${savedCount}건 적재 완료`,
        summary: {
          total: allEvaluations.length,
          existing: existingIds.size,
          new: newEvaluations.length,
          saved: savedCount,
        },
        timestamp: new Date().toISOString(),
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[Import 2025] 적재 오류:", error);
    finishSync('import2025', false, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        success: false,
        error: "적재 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

function getTenureGroup(tenureMonths: number): string {
  if (tenureMonths < 3) return "신입";
  if (tenureMonths < 6) return "초급";
  if (tenureMonths < 12) return "중급";
  if (tenureMonths < 24) return "고급";
  return "시니어";
}
