import { NextResponse } from 'next/server';
import { getBigQueryClient } from '@/lib/bigquery';

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

export async function GET() {
  try {
    const bigquery = getBigQueryClient();

    const [rows] = await bigquery.query({
      query: `
        SELECT 
          MAX(evaluation_date) as max_date,
          MIN(evaluation_date) as min_date,
          COUNT(*) as total,
          COUNT(DISTINCT evaluation_date) as unique_dates
        FROM \`${DATASET_ID}.evaluations\`
      `,
      location: 'asia-northeast3',
    });

    const r = rows[0];
    const maxDate = r?.max_date?.value ?? r?.max_date;
    const minDate = r?.min_date?.value ?? r?.min_date;
    const dateStr = maxDate ? (typeof maxDate === 'string' ? maxDate : String(maxDate)) : null;

    return NextResponse.json({
      success: true,
      data: {
        lastDataDate: dateStr,
        firstDataDate: minDate ? (typeof minDate === 'string' ? minDate : String(minDate)) : null,
        totalRows: Number(r?.total) || 0,
        uniqueDates: Number(r?.unique_dates) || 0,
      },
    });
  } catch (error) {
    console.error('[Debug] Latest date query error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
