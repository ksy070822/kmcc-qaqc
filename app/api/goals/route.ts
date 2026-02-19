import { NextRequest, NextResponse } from 'next/server';
import { getGoals, getGoalCurrentRate, saveGoalToBigQuery } from '@/lib/bigquery';
import { getCorsHeaders } from '@/lib/cors';

// CORS 헤더
const corsHeaders = getCorsHeaders();

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/goals?center=용산&periodType=monthly&isActive=true
// GET /api/goals?goalId=xxx&action=currentRate - 목표별 현재 실적 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const action = searchParams.get('action');

  // 현재 실적 조회
  if (action === 'currentRate') {
    const goalId = searchParams.get('goalId');
    const goalType = searchParams.get('goalType') as 'attitude' | 'ops' | 'total';
    const center = searchParams.get('center') || null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!goalId || !goalType || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'goalId, goalType, startDate, endDate are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    try {
      const result = await getGoalCurrentRate(goalId, goalType, center, startDate, endDate);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500, headers: corsHeaders }
        );
      }

      return NextResponse.json(
        { success: true, data: result.data },
        { headers: corsHeaders }
      );
    } catch (error) {
      console.error('[API] Goal current rate error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // 목표 목록 조회
  const center = searchParams.get('center') || undefined;
  const periodType = searchParams.get('periodType') || undefined;
  const isActiveStr = searchParams.get('isActive');
  const isActive = isActiveStr ? isActiveStr === 'true' : undefined;
  const currentMonthStr = searchParams.get('currentMonth');
  const currentMonth = currentMonthStr ? currentMonthStr === 'true' : undefined;

  try {
    console.log('[API] Goals request:', { center, periodType, isActive, currentMonth });

    const result = await getGoals({
      center,
      periodType,
      isActive,
      currentMonth,
    });

    if (!result.success) {
      console.error('[API] Goals fetch failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[API] Goals error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST /api/goals - 새 목표 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[API] Goal creation:', body);

    // 필수 필드 검증
    if (!body.name || !body.type || body.targetRate === undefined || !body.periodStart || !body.periodEnd) {
      console.error('[API] Missing required fields:', {
        hasName: !!body.name,
        hasType: !!body.type,
        hasTargetRate: body.targetRate !== undefined,
        hasPeriodStart: !!body.periodStart,
        hasPeriodEnd: !!body.periodEnd,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, type, targetRate, periodStart, periodEnd'
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 날짜 형식 검증 및 정규화
    let periodStart = String(body.periodStart || '').trim();
    let periodEnd = String(body.periodEnd || '').trim();

    // 빈 문자열 체크
    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        {
          success: false,
          error: `날짜가 비어있습니다. 시작일: "${periodStart}", 종료일: "${periodEnd}"`
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // ISO 형식에서 날짜만 추출
    if (periodStart.includes('T')) {
      periodStart = periodStart.split('T')[0];
    }
    if (periodEnd.includes('T')) {
      periodEnd = periodEnd.split('T')[0];
    }

    // 날짜 형식 검증 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(periodStart) || !dateRegex.test(periodEnd)) {
      return NextResponse.json(
        {
          success: false,
          error: `날짜 형식이 올바르지 않습니다. 시작일: "${periodStart}", 종료일: "${periodEnd}"`
        },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[API] Goal creation normalized dates:', { periodStart, periodEnd });

    // BigQuery에 저장
    const result = await saveGoalToBigQuery({
      name: body.name,
      center: body.center || null,
      service: body.service || null,
      channel: body.channel || null,
      type: body.type,
      targetRate: Number(body.targetRate),
      periodType: body.periodType || 'monthly',
      periodStart: periodStart,
      periodEnd: periodEnd,
      isActive: body.isActive !== undefined ? body.isActive : true,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Goal created successfully',
        data: result.data
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[API] Goals POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PUT /api/goals - 목표 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[API] Goal update request body:', body);

    // 필수 필드 검증
    if (!body.id || !body.name || !body.type || body.targetRate === undefined || !body.periodStart || !body.periodEnd) {
      console.error('[API] Missing required fields:', {
        hasId: !!body.id,
        hasName: !!body.name,
        hasType: !!body.type,
        hasTargetRate: body.targetRate !== undefined,
        hasPeriodStart: !!body.periodStart,
        hasPeriodEnd: !!body.periodEnd,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: id, name, type, targetRate, periodStart, periodEnd'
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 날짜 형식 검증 및 정규화
    let periodStart = String(body.periodStart || '').trim();
    let periodEnd = String(body.periodEnd || '').trim();

    // 빈 문자열 체크
    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        {
          success: false,
          error: `날짜가 비어있습니다. 시작일: "${periodStart}", 종료일: "${periodEnd}"`
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // ISO 형식에서 날짜만 추출
    if (periodStart.includes('T')) {
      periodStart = periodStart.split('T')[0];
    }
    if (periodEnd.includes('T')) {
      periodEnd = periodEnd.split('T')[0];
    }

    // 날짜 형식 검증 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(periodStart) || !dateRegex.test(periodEnd)) {
      return NextResponse.json(
        {
          success: false,
          error: `날짜 형식이 올바르지 않습니다. 시작일: "${periodStart}", 종료일: "${periodEnd}"`
        },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[API] Goal update normalized dates:', { periodStart, periodEnd });
    console.log('[API] Goal update - calling saveGoalToBigQuery with:', {
      id: body.id,
      name: body.name,
      center: body.center || null,
      type: body.type,
      targetRate: Number(body.targetRate),
      periodType: body.periodType || 'monthly',
      periodStart: periodStart,
      periodEnd: periodEnd,
      periodStartType: typeof periodStart,
      periodEndType: typeof periodEnd,
      periodStartLength: periodStart?.length,
      periodEndLength: periodEnd?.length,
    });

    // BigQuery에 저장 (수정)
    const result = await saveGoalToBigQuery({
      id: body.id,
      name: body.name,
      center: body.center || null,
      service: body.service || null,
      channel: body.channel || null,
      type: body.type,
      targetRate: Number(body.targetRate),
      periodType: body.periodType || 'monthly',
      periodStart: periodStart,
      periodEnd: periodEnd,
      isActive: body.isActive !== undefined ? body.isActive : true,
    });

    console.log('[API] Goal update result:', { success: result.success, error: result.error, data: result.data });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Goal updated successfully',
        data: result.data
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[API] Goals PUT error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
