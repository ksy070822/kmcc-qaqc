import { NextRequest, NextResponse } from 'next/server';
import { callGemini } from '@/lib/vertex-ai';
import { createPredictionAnalysisPrompt, PredictionAnalysisInput } from '@/lib/ai-prompts';
import { checkCostProtection, logAIRequest } from '@/lib/ai-cost-protection';
import { getCorsHeaders } from '@/lib/cors';

const corsHeaders = getCorsHeaders();

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/ai/predictions
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let prompt: string | null = null;

  try {
    const body: PredictionAnalysisInput = await request.json();
    const { predictions, centerSummary } = body;

    if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
      return NextResponse.json(
        { success: false, error: '예측 데이터가 필요합니다.' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!centerSummary || Object.keys(centerSummary).length === 0) {
      return NextResponse.json(
        { success: false, error: '센터 요약 데이터가 필요합니다.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // 프롬프트 생성
    prompt = createPredictionAnalysisPrompt(body);

    const systemInstruction = `당신은 카카오모빌리티 고객센터 QC 품질관리 예측 분석 전문가입니다.
예측 데이터를 기반으로 추이 분석, 월말 전망, 액션플랜을 제공합니다.
마크다운 형식으로 명확하고 간결하게 작성해주세요.`;

    // 비용 보호 체크
    const costCheck = checkCostProtection('prediction-analysis', prompt, undefined, ip);
    if (!costCheck.allowed) {
      console.warn('[AI Predictions] Request blocked by cost protection:', {
        reason: costCheck.reason,
        ip,
      });
      return NextResponse.json(
        { success: false, error: costCheck.reason || '요청이 차단되었습니다.' },
        { status: 429, headers: corsHeaders }
      );
    }

    // Gemini AI 호출
    console.log('[AI Predictions] Generating analysis, prompt length:', prompt.length);
    const aiResponse = await callGemini(prompt, systemInstruction);

    // 요청 로깅
    const duration = Date.now() - startTime;
    logAIRequest(prompt, aiResponse.length, duration, undefined, ip);

    return NextResponse.json(
      { success: true, analysis: aiResponse },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[AI Predictions] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'AI 분석 생성 중 오류가 발생했습니다.',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
