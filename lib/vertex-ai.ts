// @google/generative-ai 패키지 사용 (Google AI Studio API 키 방식)
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Google AI 클라이언트 초기화
 * 
 * 인증 방법:
 * GOOGLE_AI_API_KEY 환경 변수에 API 키 설정
 */
function initializeGoogleAI(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY 환경 변수가 설정되지 않았습니다. .env.local 파일에 GOOGLE_AI_API_KEY를 설정해주세요.');
  }
  
  // API 키 형식 기본 검증 (AIza로 시작하는지 확인)
  if (!apiKey.startsWith('AIza')) {
    console.warn('[Google AI] API 키 형식이 예상과 다릅니다. Google AI Studio에서 발급한 API 키인지 확인해주세요.');
  }
  
  return new GoogleGenerativeAI(apiKey);
}

// Google AI 클라이언트 싱글톤
let googleAIClient: GoogleGenerativeAI | null = null;

function getGoogleAIClient(): GoogleGenerativeAI {
  if (!googleAIClient) {
    googleAIClient = initializeGoogleAI();
  }
  return googleAIClient;
}

/**
 * Gemini 모델 호출
 * @param prompt 사용자 프롬프트
 * @param systemInstruction 시스템 지시사항 (선택)
 * @returns AI 응답 텍스트
 */
export async function callGemini(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  try {
    const genAI = getGoogleAIClient();
    // 모델: 2.5/3 시리즈 권장. gemini-2.0-flash-exp는 404 발생 → 2.5-flash로 대체
    const envModel = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';
    const modelName = envModel === 'gemini-2.0-flash-exp' ? 'gemini-2.5-flash' : envModel;
    
    console.log('[Google AI] Calling model:', modelName, envModel !== modelName ? `(env had: ${envModel})` : '');
    
    // 시스템 지시사항이 있으면 프롬프트에 포함
    const fullPrompt = systemInstruction 
      ? `${systemInstruction}\n\n${prompt}`
      : prompt;
    
    const model = genAI.getGenerativeModel({ model: modelName });
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    
    return text;
  } catch (error) {
    console.error('[Google AI] Error calling Gemini:', error);
    
    // 오류 처리
    if (error instanceof Error) {
      // API 키 오류 처리
      if (error.message.includes('API_KEY') || error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error(
          `Google AI API 키 오류: API 키가 유효하지 않거나 만료되었습니다. ` +
          `환경 변수 GOOGLE_AI_API_KEY를 확인해주세요. ` +
          `원본 에러: ${error.message}`
        );
      }
      // 할당량 오류 처리
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('rate limit')) {
        throw new Error(
          `Google AI API 할당량 초과: API 사용량이 한도를 초과했습니다. 잠시 후 다시 시도해주세요. ` +
          `원본 에러: ${error.message}`
        );
      }
      throw new Error(error.message);
    }
    
    throw new Error('Failed to call Gemini API');
  }
}

/**
 * 스트리밍 방식으로 Gemini 모델 호출
 * @param prompt 사용자 프롬프트
 * @param systemInstruction 시스템 지시사항 (선택)
 * @returns 스트림 이터레이터
 */
export async function* callGeminiStream(
  prompt: string,
  systemInstruction?: string
): AsyncGenerator<string, void, unknown> {
  try {
    const genAI = getGoogleAIClient();
    const envModel = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';
    const modelName = envModel === 'gemini-2.0-flash-exp' ? 'gemini-2.5-flash' : envModel;
    
    console.log('[Google AI] Streaming model:', modelName, envModel !== modelName ? `(env had: ${envModel})` : '');
    
    // 시스템 지시사항이 있으면 프롬프트에 포함
    const fullPrompt = systemInstruction 
      ? `${systemInstruction}\n\n${prompt}`
      : prompt;
    
    const model = genAI.getGenerativeModel({ model: modelName });
    
    const result = await model.generateContentStream(fullPrompt);
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        yield chunkText;
      }
    }
  } catch (error) {
    console.error('[Google AI] Error calling Gemini stream:', error);
    
    // 오류 처리
    if (error instanceof Error) {
      // API 키 오류 처리
      if (error.message.includes('API_KEY') || error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error(
          `Google AI API 키 오류: API 키가 유효하지 않거나 만료되었습니다. ` +
          `환경 변수 GOOGLE_AI_API_KEY를 확인해주세요. ` +
          `원본 에러: ${error.message}`
        );
      }
      // 할당량 오류 처리
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('rate limit')) {
        throw new Error(
          `Google AI API 할당량 초과: API 사용량이 한도를 초과했습니다. 잠시 후 다시 시도해주세요. ` +
          `원본 에러: ${error.message}`
        );
      }
      throw new Error(error.message);
    }
    
    throw new Error('Failed to call Gemini API');
  }
}

// 하위 호환성을 위한 함수 (사용하지 않음)
function getVertexAIClient(): never {
  throw new Error('Vertex AI는 더 이상 사용되지 않습니다. Google AI API를 사용하세요.');
}

export default {
  callGemini,
  callGeminiStream,
  getVertexAIClient,
};
