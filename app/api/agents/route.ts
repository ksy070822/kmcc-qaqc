import { NextRequest, NextResponse } from 'next/server';
import { getAgents } from '@/lib/bigquery';

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/agents?center=용산&service=택시&channel=유선&tenure=3개월%20이상&month=2026-01
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const center = searchParams.get('center') || undefined;
  const service = searchParams.get('service') || undefined;
  const channel = searchParams.get('channel') || undefined;
  const tenure = searchParams.get('tenure') || undefined;
  const month = searchParams.get('month') || undefined;
  
  try {
    console.log('[API] Agents request:', { center, service, channel, tenure, month });
    
    const result = await getAgents({
      center,
      service,
      channel,
      tenure,
      month,
    });
    
    if (!result.success) {
      console.error('[API] Agents fetch failed:', result.error);
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
    console.error('[API] Agents error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
