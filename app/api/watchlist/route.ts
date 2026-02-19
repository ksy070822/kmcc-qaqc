import { NextRequest, NextResponse } from 'next/server';
import { getWatchList, saveActionPlan } from '@/lib/bigquery';
import { getCorsHeaders } from '@/lib/cors';

// CORS 헤더
const corsHeaders = getCorsHeaders();

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/watchlist?center=용산&channel=유선&tenure=3개월%20이상&month=2026-01
// GET /api/watchlist?action=count (집중관리 대상 수만 반환)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const action = searchParams.get('action');
  const center = searchParams.get('center') || undefined;
  const channel = searchParams.get('channel') || undefined;
  const tenure = searchParams.get('tenure') || undefined;
  const month = searchParams.get('month') || undefined;

  try {
    console.log('[API] WatchList request:', { action, center, channel, tenure, month });

    const result = await getWatchList({
      center,
      channel,
      tenure,
      month,
    });

    if (!result.success) {
      console.error('[API] WatchList fetch failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500, headers: corsHeaders }
      );
    }

    // action=count: 집중관리 대상 수만 반환
    if (action === 'count') {
      const count = Array.isArray(result.data) ? result.data.length : 0;
      return NextResponse.json(
        { success: true, count },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[API] WatchList error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST /api/watchlist - 액션 플랜 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 필수 필드 검증
    const requiredFields = ['id', 'agentId', 'agentName', 'center', 'group', 'issue', 'plan', 'status', 'targetDate'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      console.error('[API] Missing required fields:', missingFields);
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[API] Action plan registration:', body);

    // BigQuery에 액션 플랜 저장
    const result = await saveActionPlan({
      id: body.id,
      agentId: body.agentId,
      agentName: body.agentName,
      center: body.center,
      group: body.group,
      issue: body.issue,
      plan: body.plan,
      status: body.status,
      targetDate: body.targetDate,
    });

    if (!result.success) {
      console.error('[API] Failed to save action plan:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to save action plan'
        },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Action plan registered successfully',
        data: body
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[API] WatchList POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
