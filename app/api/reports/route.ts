import { NextRequest, NextResponse } from 'next/server';
import { getReportData } from '@/lib/bigquery';
import { getCorsHeaders } from '@/lib/cors';

// CORS 헤더
const corsHeaders = getCorsHeaders();

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/reports/generate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, period, center, service, channel, startDate, endDate } = body;

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Report type is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await getReportData(
      type,
      period || '',
      {
        center,
        service,
        channel,
        startDate,
        endDate,
      }
    );

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to generate report' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          type,
          period,
          center: center || '전체',
          ...result.data,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[API] Reports error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate report',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
