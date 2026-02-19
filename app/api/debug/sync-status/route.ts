import { NextResponse } from 'next/server';
import { readYonsanGwangjuSheets } from '@/lib/google-sheets';
import { getBigQueryClient } from '@/lib/bigquery';

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o';
const EVAL_TABLE = '`' + DATASET_ID + '.evaluations`';

/**
 * 동기화 상태 진단 API
 * - Google Sheets 읽기 테스트
 * - BigQuery 마지막 데이터 날짜
 * - Cloud Scheduler 확인 안내
 */
export async function GET() {
  const checks: Record<string, { success: boolean; message?: string; detail?: any }> = {};
  let overallSuccess = true;

  // 1. BigQuery 마지막 데이터 날짜
  try {
    const bigquery = getBigQueryClient();
    const [rows] = await bigquery.query({
      query: `SELECT MAX(evaluation_date) as max_date, COUNT(*) as total FROM ${EVAL_TABLE}`,
      location: 'asia-northeast3',
    });
    const r = rows[0];
    const maxDate = r?.max_date?.value ?? r?.max_date;
    checks.bigquery = {
      success: true,
      message: `BigQuery 접근 성공`,
      detail: {
        lastDataDate: maxDate ? String(maxDate) : null,
        totalRows: Number(r?.total) || 0,
      },
    };
  } catch (e) {
    overallSuccess = false;
    checks.bigquery = {
      success: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }

  // 2. Google Sheets 읽기 테스트
  try {
    const sheetsResult = await readYonsanGwangjuSheets(SPREADSHEET_ID);
    if (!sheetsResult.success) {
      overallSuccess = false;
      checks.googleSheets = { success: false, message: sheetsResult.error };
    } else {
      const yCount = sheetsResult.yonsan?.length ?? 0;
      const gCount = sheetsResult.gwangju?.length ?? 0;
      const yDates = extractLatestDateFromSheet(sheetsResult.yonsan);
      const gDates = extractLatestDateFromSheet(sheetsResult.gwangju);
      checks.googleSheets = {
        success: true,
        message: 'Google Sheets 접근 성공',
        detail: {
          yonsanRows: yCount,
          gwangjuRows: gCount,
          yonsanLatestDate: yDates,
          gwangjuLatestDate: gDates,
        },
      };
    }
  } catch (e) {
    overallSuccess = false;
    checks.googleSheets = {
      success: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }

  // Cloud Scheduler 확인 안내 (API에서 직접 확인 불가)
  checks.cloudScheduler = {
    success: true,
    message: 'Cloud Scheduler는 API에서 직접 확인 불가. 아래 명령으로 확인하세요.',
    detail: {
      commands: [
        'gcloud scheduler jobs list --location=asia-northeast3 --project=csopp-25f2',
        'gcloud scheduler jobs describe sync-sheets-daily --location=asia-northeast3',
        'gcloud scheduler jobs run sync-sheets-daily --location=asia-northeast3  # 수동 실행',
      ],
    },
  };

  return NextResponse.json({
    success: overallSuccess,
    checks,
    recommendations: buildRecommendations(checks),
    manualSyncUrl: '/api/sync-sheets',
    docs: 'SYNC_FAILURE_ANALYSIS.md',
  });
}

function extractLatestDateFromSheet(rows: any[][] | undefined): string | null {
  if (!rows || rows.length < 2) return null;
  const headers = rows[0] || [];
  const dateCol = headers.findIndex(
    (h: any) => /평가일|날짜|date|evaluation_date/i.test(String(h || ''))
  );
  if (dateCol < 0) return null;
  let latest: string | null = null;
  for (let i = 1; i < rows.length; i++) {
    const v = rows[i]?.[dateCol]?.toString().trim();
    if (v) {
      const normalized = normalizeDateForCompare(v);
      if (normalized && (!latest || normalized > latest)) latest = normalized;
    }
  }
  return latest;
}

function normalizeDateForCompare(s: string): string | null {
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${String(parseInt(mo, 10)).padStart(2, '0')}-${String(parseInt(d, 10)).padStart(2, '0')}`;
}

function buildRecommendations(checks: Record<string, any>): string[] {
  const recs: string[] = [];
  if (!checks.bigquery?.success) {
    recs.push('BigQuery 인증/권한 확인: GOOGLE_APPLICATION_CREDENTIALS 또는 BIGQUERY_CREDENTIALS');
  }
  if (!checks.googleSheets?.success) {
    recs.push('Google Sheets: 서비스 계정을 스프레드시트 공유 대상에 추가하세요.');
  }
  const bqDate = checks.bigquery?.detail?.lastDataDate;
  const yDate = checks.googleSheets?.detail?.yonsanLatestDate;
  const gDate = checks.googleSheets?.detail?.gwangjuLatestDate;
  const sheetDate = [yDate, gDate].filter(Boolean).sort().pop() || null;
  if (bqDate && sheetDate && sheetDate > bqDate) {
    recs.push(`Sheets 최신(${sheetDate}) > BQ 최신(${bqDate}). 수동 sync 또는 Cloud Scheduler 확인 필요.`);
  }
  if (recs.length === 0 && checks.bigquery?.success && checks.googleSheets?.success) {
    recs.push('Sheets/BQ 모두 정상. Cloud Scheduler 작업 존재 여부를 gcloud로 확인하세요.');
  }
  return recs;
}
