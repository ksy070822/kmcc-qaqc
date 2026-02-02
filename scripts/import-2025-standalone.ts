
import { readYonsan2025Gwangju2025Sheets, parseSheetRowsToEvaluations2025 } from "@/lib/google-sheets";
import { getBigQueryClient } from "@/lib/bigquery";

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o';

/**
 * 근속기간 그룹 계산
 */
function getTenureGroup(tenureMonths: number): string {
    if (tenureMonths < 3) return "신입";
    if (tenureMonths < 6) return "초급";
    if (tenureMonths < 12) return "중급";
    if (tenureMonths < 24) return "고급";
    return "시니어";
}

async function runImport2025() {
    console.log("[Import 2025 Standalone] ===== 용산2025/광주2025 1회 적재 시작 =====");

    // Google Sheets에서 데이터 읽기
    console.log(`[Import 2025 Standalone] Spreadsheet ID: ${SPREADSHEET_ID}`);
    const sheetsResult = await readYonsan2025Gwangju2025Sheets(SPREADSHEET_ID);

    if (!sheetsResult.success) {
        console.error(`[Import 2025 Standalone] 오류: ${sheetsResult.error}`);
        process.exit(1);
    }

    if (!sheetsResult.yonsan || !sheetsResult.gwangju) {
        console.error("[Import 2025 Standalone] 오류: 시트 데이터를 읽을 수 없습니다.");
        process.exit(1);
    }

    console.log('[Import 2025 Standalone] 용산2025: ' + sheetsResult.yonsan.length + '행, 광주2025: ' + sheetsResult.gwangju.length + '행');

    const yonsanHeaders = sheetsResult.yonsan[0] || [];
    const yonsanRows = sheetsResult.yonsan.slice(1);
    const gwangjuHeaders = sheetsResult.gwangju[0] || [];
    const gwangjuRows = sheetsResult.gwangju.slice(1);

    // 데이터 파싱
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
    console.log(`[Import 2025 Standalone] 파싱 완료: 용산 ${yonsanEvaluations.length}건, 광주 ${gwangjuEvaluations.length}건`);

    const evaluationIds = allEvaluations.map(e => e.evaluationId);

    if (evaluationIds.length === 0) {
        console.log('[Import 2025 Standalone] 처리할 데이터가 없습니다.');
        return;
    }

    // BigQuery에서 기존 evaluation_id 조회 (중복 방지)
    const bigquery = getBigQueryClient();
    let existingIds = new Set<string>();

    try {
        const CHUNK_SIZE = 2000;
        for (let i = 0; i < evaluationIds.length; i += CHUNK_SIZE) {
            const chunk = evaluationIds.slice(i, i + CHUNK_SIZE);
            const idsList = chunk.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

            if (!idsList) continue;

            const query = `
                SELECT DISTINCT evaluation_id
                FROM \`${DATASET_ID}.evaluations\`
                WHERE evaluation_id IN (${idsList})
             `;

            const [rows] = await bigquery.query({
                query,
                location: 'asia-northeast3',
            });

            rows.forEach((row: any) => existingIds.add(row.evaluation_id));
        }

        console.log('[Import 2025 Standalone] 기존 데이터: ' + existingIds.size + '건');

    } catch (error) {
        console.warn('[Import 2025 Standalone] 기존 데이터 조회 실패, 전체 저장 시도:', error);
    }

    // 중복 제거 (새로운 데이터만 필터링)
    const newEvaluations = allEvaluations.filter(
        (e) => !existingIds.has(e.evaluationId)
    );

    console.log('[Import 2025 Standalone] 새 데이터: ' + newEvaluations.length + '건 (전체: ' + allEvaluations.length + '건)');

    if (newEvaluations.length === 0) {
        console.log('[Import 2025 Standalone] 새로운 데이터가 없습니다.');
        return;
    }

    // BigQuery 형식으로 변환
    const bigqueryRows = newEvaluations.map((evalData) => {
        const groupValue = `${evalData.service || ''} ${evalData.channel || ''}`.trim();

        return {
            evaluation_id: evalData.evaluationId,
            evaluation_date: evalData.date,
            center: evalData.center,
            agent_id: evalData.agentId,
            agent_name: evalData.agentName,
            service: evalData.service || '',
            channel: evalData.channel || 'unknown',
            group: groupValue || 'unknown',

            consultation_id: evalData.consultId || null,
            consultation_datetime: null, // No time info in this logic
            evaluation_round: null,

            // hire_date, tenure_months, tenure_group OMITTED based on prev findings

            greeting_error: false,
            empathy_error: false,
            apology_error: false,
            additional_inquiry_error: false,
            unkind_error: false,

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

            attitude_error_count: evalData.attitudeErrors,
            business_error_count: evalData.businessErrors,
            total_error_count: evalData.totalErrors,

            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    });

    // BigQuery에 저장
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table('evaluations');

    const BATCH_SIZE = 500;
    let savedCount = 0;

    for (let i = 0; i < bigqueryRows.length; i += BATCH_SIZE) {
        const batch = bigqueryRows.slice(i, i + BATCH_SIZE);
        try {
            await table.insert(batch);
            savedCount += batch.length;
            console.log('[Import 2025 Standalone] 저장 진행: ' + savedCount + '/' + bigqueryRows.length + '건');
        } catch (e: any) {
            console.error('[Import 2025 Standalone] 배치 저장 실패:', e);
            if (e.errors) {
                console.error(JSON.stringify(e.errors, null, 2));
            }
        }
    }

    console.log('[Import 2025 Standalone] ===== 동기화 완료: ' + savedCount + '건 저장 =====');
}

runImport2025().catch((error) => {
    console.error('[Import 2025 Standalone] 치명적 오류:', error);
    process.exit(1);
});
