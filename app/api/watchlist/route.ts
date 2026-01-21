import { NextRequest, NextResponse } from 'next/server';
import { getWatchList } from '@/lib/bigquery';

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/watchlist?center=용산&channel=유선&tenure=3개월%20이상&month=2026-01
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const center = searchParams.get('center') || undefined;
  const channel = searchParams.get('channel') || undefined;
  const tenure = searchParams.get('tenure') || undefined;
  const month = searchParams.get('month') || undefined;
  
  try {
    console.log('[API] WatchList request:', { center, channel, tenure, month });
    
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

// POST /api/watchlist - 액션 플랜 등록 (향후 구현)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: BigQuery watch_list 테이블에 액션 플랜 저장
    console.log('[API] Action plan registration:', body);
    
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
