import { NextResponse } from 'next/server';
import { getProgress, getLastResults } from '@/lib/sync-progress';
import { getBigQueryClient } from '@/lib/bigquery';

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

/**
 * 동기화 진행 상태 확인 API
 * GET /api/debug/sync-progress
 */
export async function GET() {
  try {
    const progress = getProgress();
    const lastResults = getLastResults();

    // BigQuery 최신 날짜
    let lastDataDate: string | null = null;
    let totalRows = 0;
    try {
      const bigquery = getBigQueryClient();
      const [rows] = await bigquery.query({
        query: `SELECT MAX(evaluation_date) as max_date, COUNT(*) as total FROM \`${DATASET_ID}.evaluations\``,
        location: 'asia-northeast3',
      });
      const r = rows[0];
      const maxDate = r?.max_date?.value ?? r?.max_date;
      lastDataDate = maxDate ? String(maxDate) : null;
      totalRows = Number(r?.total) || 0;
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      data: {
        progress: {
          inProgress: progress.inProgress,
          type: progress.type,
          message: progress.message,
          currentStep: progress.currentStep,
          startedAt: progress.startedAt,
          processed: progress.processed,
          total: progress.total,
        },
        lastResults: {
          sync: lastResults.sync,
          import2025: lastResults.import2025,
        },
        bigquery: {
          lastDataDate,
          totalRows,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
