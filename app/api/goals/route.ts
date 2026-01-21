import { NextRequest, NextResponse } from 'next/server';
import { getGoals } from '@/lib/bigquery';

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/goals?center=용산&periodType=monthly&isActive=true
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const center = searchParams.get('center') || undefined;
  const periodType = searchParams.get('periodType') || undefined;
  const isActiveStr = searchParams.get('isActive');
  const isActive = isActiveStr ? isActiveStr === 'true' : undefined;
  
  try {
    console.log('[API] Goals request:', { center, periodType, isActive });
    
    const result = await getGoals({
      center,
      periodType,
      isActive,
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

// POST /api/goals - 새 목표 등록 (향후 구현)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: BigQuery targets 테이블에 목표 저장
    console.log('[API] Goal creation:', body);
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Goal created successfully',
        data: body 
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

// PUT /api/goals - 목표 수정 (향후 구현)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: BigQuery targets 테이블에서 목표 수정
    console.log('[API] Goal update:', body);
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Goal updated successfully',
        data: body 
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
