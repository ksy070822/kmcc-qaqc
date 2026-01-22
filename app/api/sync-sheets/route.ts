import { type NextRequest, NextResponse } from "next/server";
import { readYonsanGwangjuSheets, parseSheetRowsToEvaluations } from "@/lib/google-sheets";
import { getBigQueryClient } from "@/lib/bigquery";

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o';

// CORS 헤더
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Google Sheets에서 데이터를 읽어와 BigQuery에 저장
 * 증분 업데이트: 이미 존재하는 evaluation_id는 스킵
 */
export async function POST(request: NextRequest) {
  try {
    console.log("[Sync Sheets] ===== Google Sheets 동기화 시작 =====");

    // Google Sheets에서 데이터 읽기
    const sheetsResult = await readYonsanGwangjuSheets(SPREADSHEET_ID);
    
    if (!sheetsResult.success) {
      return NextResponse.json(
        { success: false, error: sheetsResult.error },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!sheetsResult.yonsan || !sheetsResult.gwangju) {
      return NextResponse.json(
        { success: false, error: "시트 데이터를 읽을 수 없습니다." },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('[Sync Sheets] 용산 시트: ' + sheetsResult.yonsan.length + '행, 광주 시트: ' + sheetsResult.gwangju.length + '행');

    // 헤더와 데이터 분리
    const yonsanHeaders = sheetsResult.yonsan[0] || [];
    const yonsanRows = sheetsResult.yonsan.slice(1);
    
    const gwangjuHeaders = sheetsResult.gwangju[0] || [];
    const gwangjuRows = sheetsResult.gwangju.slice(1);

    // 데이터 파싱
    const yonsanEvaluations = parseSheetRowsToEvaluations(yonsanHeaders, yonsanRows, '용산');
    const gwangjuEvaluations = parseSheetRowsToEvaluations(gwangjuHeaders, gwangjuRows, '광주');

    console.log('[Sync Sheets] 파싱 완료: 용산 ' + yonsanEvaluations.length + '건, 광주 ' + gwangjuEvaluations.length + '건');

    // BigQuery에서 기존 evaluation_id 조회 (중복 방지)
    const bigquery = getBigQueryClient();
    const existingIdsQuery = `
      SELECT DISTINCT evaluation_id
      FROM \`${DATASET_ID}.evaluations\`
      WHERE evaluation_id IN UNNEST(@evaluation_ids)
    `;

    const allEvaluations = [...yonsanEvaluations, ...gwangjuEvaluations];
    const evaluationIds = allEvaluations.map(e => e.evaluationId);

    let existingIds = new Set<string>();
    if (evaluationIds.length > 0) {
      try {
        // BigQuery는 UNNEST에 배열을 직접 전달할 수 없으므로, IN 절 사용
        const idsList = evaluationIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
        const query = `
          SELECT DISTINCT evaluation_id
          FROM \`${DATASET_ID}.evaluations\`
          WHERE evaluation_id IN (${idsList})
        `;

        const [rows] = await bigquery.query({
          query,
          location: 'asia-northeast3',
        });

        existingIds = new Set(rows.map((row: any) => row.evaluation_id));
        console.log('[Sync Sheets] 기존 데이터: ' + existingIds.size + '건');
      } catch (error) {
        console.warn('[Sync Sheets] 기존 데이터 조회 실패, 전체 저장 시도:', error);
      }
    }

    // 중복 제거 (새로운 데이터만 필터링)
    const newEvaluations = allEvaluations.filter(
      (e) => !existingIds.has(e.evaluationId)
    );

    console.log('[Sync Sheets] 새 데이터: ' + newEvaluations.length + '건 (전체: ' + allEvaluations.length + '건)');

    if (newEvaluations.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "새로운 데이터가 없습니다.",
          summary: {
            total: allEvaluations.length,
            existing: existingIds.size,
            new: 0,
          },
        },
        { headers: corsHeaders }
      );
    }

    // BigQuery 형식으로 변환
    const bigqueryRows = newEvaluations.map((evalData) => {
      // consult_date 계산 (상담일시가 있으면 사용)
      let consultDate: string | null = null;
      if (evalData.rawRow) {
        // 상담일시 컬럼 찾기
        const consultDateIdx = evalData.rawRow.findIndex((cell: any) => {
          const str = cell?.toString().toLowerCase() || '';
          return str.includes('상담일시') || str.includes('consult_date');
        });
        if (consultDateIdx >= 0 && evalData.rawRow[consultDateIdx + 1]) {
          consultDate = evalData.rawRow[consultDateIdx + 1]?.toString().trim() || null;
        }
      }

      return {
        evaluation_id: evalData.evaluationId,
        evaluation_date: evalData.date,
        consult_date: consultDate,
        consult_id: evalData.consultId || null,
        evaluation_round: null,
        center: evalData.center,
        service: evalData.service || '',
        channel: evalData.channel || 'unknown',
        agent_id: evalData.agentId,
        agent_name: evalData.agentName,
        hire_date: evalData.hireDate || null,
        tenure_months: evalData.tenureMonths || null,
        tenure_group: evalData.tenureMonths
          ? getTenureGroup(evalData.tenureMonths)
          : null,
        // 상담태도 오류 항목 (개별 필드)
        greeting_error: false, // TODO: 개별 항목 파싱 필요
        empathy_error: false,
        apology_error: false,
        additional_inquiry_error: false,
        unkind_error: false,
        // 오상담/오처리 오류 항목
        consult_type_error: false,
        guide_error: false,
        identity_check_error: false,
        required_search_error: false,
        wrong_guide_error: false,
        process_missing_error: false,
        process_incomplete_error: false,
        system_error: false,
        id_mapping_error: false,
        flag_keyword_error: false,
        history_error: false,
        // 집계 필드
        attitude_error_count: evalData.attitudeErrors,
        ops_error_count: evalData.businessErrors,
        total_error_count: evalData.totalErrors,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // BigQuery에 저장
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table('evaluations');

    const BATCH_SIZE = 10000;
    let savedCount = 0;

    for (let i = 0; i < bigqueryRows.length; i += BATCH_SIZE) {
      const batch = bigqueryRows.slice(i, i + BATCH_SIZE);
      await table.insert(batch);
      savedCount += batch.length;
      console.log('[Sync Sheets] 저장 진행: ' + savedCount + '/' + bigqueryRows.length + '건');
    }

    console.log('[Sync Sheets] ===== 동기화 완료: ' + savedCount + '건 저장 =====');

    return NextResponse.json(
      {
        success: true,
        message: savedCount + "건의 데이터가 동기화되었습니다.",
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
    console.error("[Sync Sheets] 동기화 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "동기화 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET 요청: 동기화 상태 확인
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ready",
      spreadsheetId: SPREADSHEET_ID,
      message: "Google Sheets 동기화 API가 정상 작동 중입니다.",
    },
    { headers: corsHeaders }
  );
}

/**
 * 근속기간 그룹 계산
 */
function getTenureGroup(tenureMonths: number): string {
  if (tenureMonths < 3) return '신입';
  if (tenureMonths < 6) return '초급';
  if (tenureMonths < 12) return '중급';
  if (tenureMonths < 24) return '고급';
  return '시니어';
}
