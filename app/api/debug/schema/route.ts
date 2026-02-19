import { NextRequest, NextResponse } from 'next/server';
import { getBigQueryClient } from '@/lib/bigquery';

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';
const TARGETS_TABLE = '`' + DATASET_ID + '.targets`';

export async function GET(request: NextRequest) {
  try {
    const bigquery = getBigQueryClient();
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table('targets');
    
    const [tableExists] = await table.exists();
    if (!tableExists) {
      return NextResponse.json({
        success: false,
        error: 'targets 테이블이 존재하지 않습니다.',
      }, { status: 404 });
    }
    
    // 테이블 스키마 확인
    const [metadata] = await table.getMetadata();
    const schema = metadata.schema?.fields || [];
    const columnNames = schema.map((field: any) => field.name);
    const columnDetails = schema.map((field: any) => ({
      name: field.name,
      type: field.type,
      mode: field.mode,
    }));
    
    // 실제 데이터 샘플 조회 (최대 5개)
    let sampleData: any[] = [];
    try {
      const [rows] = await bigquery.query({
        query: `SELECT * FROM ${TARGETS_TABLE} LIMIT 5`,
        location: 'asia-northeast3',
      });
      sampleData = rows;
    } catch (error) {
      console.error('[Debug] Sample data query error:', error);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        tableExists,
        columnNames,
        columnDetails,
        sampleData,
        detectedSchema: {
          hasTargetName: columnNames.includes('target_name'),
          hasTargetType: columnNames.includes('target_type'),
          hasTargetRate: columnNames.includes('target_rate'),
          hasPeriodStart: columnNames.includes('period_start'),
          hasAttitudeRate: columnNames.includes('target_attitude_error_rate'),
          hasBusinessRate: columnNames.includes('target_business_error_rate'),
          hasOverallRate: columnNames.includes('target_overall_error_rate'),
          hasStartDate: columnNames.includes('start_date'),
          hasEndDate: columnNames.includes('end_date'),
          hasPeriodType: columnNames.includes('period_type'),
          hasService: columnNames.includes('service'),
          hasChannel: columnNames.includes('channel'),
          hasGroup: columnNames.includes('group'),
        },
      },
    });
  } catch (error) {
    console.error('[Debug] Schema check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
