
import { readYonsanGwangjuSheets, parseSheetRowsToEvaluations } from "@/lib/google-sheets";
import { getBigQueryClient } from "@/lib/bigquery";
import type { BigQuery } from '@google-cloud/bigquery';

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';
// Default to the ID found in the route.ts file if env var is missing
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o';

/**
 * 근속기간 그룹 계산
 */
function getTenureGroup(tenureMonths: number): string {
  if (tenureMonths < 3) return '3개월 미만';
  if (tenureMonths < 6) return '3개월 이상';
  if (tenureMonths < 12) return '6개월 이상';
  return '12개월 이상';
}

async function runSync() {
    console.log("[Sync Standalone] ===== Google Sheets 동기화 시작 =====");
    
    // Google Sheets에서 데이터 읽기
    console.log(`[Sync Standalone] Spreadsheet ID: ${SPREADSHEET_ID}`);
    const sheetsResult = await readYonsanGwangjuSheets(SPREADSHEET_ID);
    
    if (!sheetsResult.success) {
      console.error(`[Sync Standalone] 오류: ${sheetsResult.error}`);
      process.exit(1);
    }

    if (!sheetsResult.yonsan || !sheetsResult.gwangju) {
      console.error("[Sync Standalone] 오류: 시트 데이터를 읽을 수 없습니다.");
      process.exit(1);
    }

    console.log('[Sync Standalone] 용산 시트: ' + sheetsResult.yonsan.length + '행, 광주 시트: ' + sheetsResult.gwangju.length + '행');

    // 헤더와 데이터 분리
    const yonsanHeaders = sheetsResult.yonsan[0] || [];
    const yonsanRows = sheetsResult.yonsan.slice(1);
    
    const gwangjuHeaders = sheetsResult.gwangju[0] || [];
    const gwangjuRows = sheetsResult.gwangju.slice(1);

    // 데이터 파싱
    const yonsanEvaluations = parseSheetRowsToEvaluations(yonsanHeaders, yonsanRows, '용산');
    const gwangjuEvaluations = parseSheetRowsToEvaluations(gwangjuHeaders, gwangjuRows, '광주');

    console.log('[Sync Standalone] 파싱 완료: 용산 ' + yonsanEvaluations.length + '건, 광주 ' + gwangjuEvaluations.length + '건');

    const allEvaluations = [...yonsanEvaluations, ...gwangjuEvaluations];
    const evaluationIds = allEvaluations.map(e => e.evaluationId);

    if (evaluationIds.length === 0) {
        console.log('[Sync Standalone] 처리할 데이터가 없습니다.');
        return;
    }

    // BigQuery에서 기존 evaluation_id 조회 (중복 방지)
    const bigquery = getBigQueryClient();
    let existingIds = new Set<string>();

    try {
        // BigQuery는 UNNEST에 배열을 직접 전달할 수 없으므로, IN 절 사용 - 배치로 나누어 처리 권장하지만 여기서는 간단히 함
        // ID가 너무 많으면 쿼리가 실패할 수 있으므로 주의 필요.
        // 하지만 여기서는 기존 로직을 따름.
        
        // ID가 너무 많을 경우를 대비해 쿼리를 나누거나 해서 조회해야 하지만, 
        // 일단 기존 로직과 동일하게 구현. (기존 로직도 전체를 한번에 쿼리함)
        
        // 하지만 파라미터가 너무 많으면 에러가 날 수 있으므로, 기존 데이터 전체 ID를 가져와서 메모리에서 비교하는 방식이 나을 수도 있음.
        // 또는 배치를 돌면서 체크.
        
        // 여기서는 간단하게 최근 데이터만 체크하는게 아니라 전체 중복체크를 해야하므로...
        // 쿼리 길이 제한을 고려하여, 이미 존재하는지 확인할 ID들을 청크로 나누어 조회
        
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

        console.log('[Sync Standalone] 기존 데이터: ' + existingIds.size + '건');

    } catch (error) {
        console.warn('[Sync Standalone] 기존 데이터 조회 실패, 전체 저장 시도:', error);
    }

    // 중복 제거 (새로운 데이터만 필터링)
    const newEvaluations = allEvaluations.filter(
      (e) => !existingIds.has(e.evaluationId)
    );

    console.log('[Sync Standalone] 새 데이터: ' + newEvaluations.length + '건 (전체: ' + allEvaluations.length + '건)');

    if (newEvaluations.length === 0) {
        console.log('[Sync Standalone] 새로운 데이터가 없습니다.');
        return;
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
        // 상담태도 오류 항목
        greeting_error: evalData.greetingError || false,
        empathy_error: evalData.empathyError || false,
        apology_error: evalData.apologyError || false,
        additional_inquiry_error: evalData.additionalInquiryError || false,
        unkind_error: evalData.unkindError || false,
        // 오상담/오처리 오류 항목
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
        // 집계 필드
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

    const BATCH_SIZE = 500; // API 제한 고려하여 약간 줄임
    let savedCount = 0;

    for (let i = 0; i < bigqueryRows.length; i += BATCH_SIZE) {
      const batch = bigqueryRows.slice(i, i + BATCH_SIZE);
      try {
        await table.insert(batch);
        savedCount += batch.length;
        console.log('[Sync Standalone] 저장 진행: ' + savedCount + '/' + bigqueryRows.length + '건');
      } catch (e: any) {
          console.error('[Sync Standalone] 배치 저장 실패:', e);
          if (e.errors) {
              console.error(JSON.stringify(e.errors, null, 2));
          }
      }
    }

    console.log('[Sync Standalone] ===== 동기화 완료: ' + savedCount + '건 저장 =====');
}

runSync().catch((error) => {
  console.error('[Sync Standalone] 치명적 오류:', error);
  process.exit(1);
});
