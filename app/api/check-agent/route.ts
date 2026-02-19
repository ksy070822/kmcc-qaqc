import { NextRequest, NextResponse } from 'next/server';
import { checkAgentExists } from '@/lib/bigquery';
import { getCorsHeaders } from '@/lib/cors';

// CORS 헤더
const corsHeaders = getCorsHeaders();

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/check-agent?name=이영희&id=AGT101
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const agentName = searchParams.get('name') || undefined;
  const agentId = searchParams.get('id') || undefined;
  
  try {
    console.log('[API] Check agent request:', { agentName, agentId });
    
    const result = await checkAgentExists(agentName, agentId);
    
    if (!result.success) {
      console.error('[API] Check agent failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500, headers: corsHeaders }
      );
    }
    
    return NextResponse.json(
      { 
        success: true, 
        found: result.found,
        agents: result.agents,
        message: result.found 
          ? `찾은 상담사: ${result.agents?.length}명` 
          : '해당 상담사를 찾을 수 없습니다.'
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[API] Check agent error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
