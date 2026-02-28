/**
 * Vertex AI / Google AI 래퍼
 *
 * 이 모듈은 두 가지 모드를 지원합니다:
 * 1. 로컬 개발 모드 (USE_VERTEX_AI=false 또는 미설정):
 *    - Google AI API 사용 (@google/generative-ai)
 *    - GOOGLE_AI_API_KEY 환경 변수 필요
 *
 * 2. 프로덕션 모드 (USE_VERTEX_AI=true):
 *    - Vertex AI API 사용 (@google-cloud/vertexai)
 *    - 서비스 어카운트 인증 (Application Default Credentials)
 *    - GCP_PROJECT_ID, GCP_LOCATION 환경 변수 필요
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Vertex AI 클라이언트 타입 (동적 import)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import type from @google-cloud/vertexai
interface GenerativeModelLike {
  generateContent: (prompt: string) => Promise<{ response: { text: () => string } }>;
  generateContentStream: (prompt: string) => Promise<{ stream: AsyncIterable<{ text: () => string }> }>;
}
type VertexAIClient = { getGenerativeModel: (config: Record<string, unknown>) => GenerativeModelLike } | null;

// 싱글톤 인스턴스
let googleAIClient: GoogleGenerativeAI | null = null;
let vertexAIClient: VertexAIClient | null = null;

const USE_VERTEX_AI = process.env.USE_VERTEX_AI === 'true';

/**
 * Google AI 클라이언트 초기화 (로컬 개발 모드)
 */
function initializeGoogleAI(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GOOGLE_AI_API_KEY 환경 변수가 설정되지 않았습니다. ' +
      '.env.local 파일에 GOOGLE_AI_API_KEY를 설정해주세요.'
    );
  }

  if (!apiKey.startsWith('AIza')) {
    console.warn(
      '[Vertex AI] API 키 형식이 예상과 다릅니다. ' +
      'Google AI Studio에서 발급한 API 키인지 확인해주세요.'
    );
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Vertex AI 클라이언트 초기화 (프로덕션 모드)
 */
async function initializeVertexAI(): Promise<VertexAIClient> {
  try {
    // 동적으로 Vertex AI 라이브러리 import
    const { VertexAI } = await import('@google-cloud/vertexai');

    const projectId = process.env.VERTEX_AI_PROJECT_ID || process.env.GCP_PROJECT_ID;
    const location = process.env.VERTEX_AI_LOCATION || process.env.GCP_LOCATION || 'asia-northeast3';

    if (!projectId) {
      throw new Error(
        'VERTEX_AI_PROJECT_ID 환경 변수가 설정되지 않았습니다. ' +
        '프로덕션 환경에서는 VERTEX_AI_PROJECT_ID를 설정해주세요.'
      );
    }

    console.log(`[Vertex AI] Initializing with project: ${projectId}, location: ${location}`);

    // Application Default Credentials를 사용하여 인증
    // Cloud Run에서는 자동으로 서비스 어카운트 인증이 됨
    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    return vertexAI as unknown as VertexAIClient;
  } catch (error) {
    console.error('[Vertex AI] Failed to initialize Vertex AI:', error);
    throw new Error(
      'Vertex AI 초기화 실패: @google-cloud/vertexai 라이브러리가 설치되어 있는지 확인하세요.'
    );
  }
}

/**
 * 사용할 모드에 따라 적절한 클라이언트 가져오기
 */
function getClient() {
  if (USE_VERTEX_AI) {
    if (!vertexAIClient) {
      throw new Error('Vertex AI 클라이언트가 초기화되지 않았습니다.');
    }
    return vertexAIClient;
  } else {
    if (!googleAIClient) {
      googleAIClient = initializeGoogleAI();
    }
    return googleAIClient;
  }
}

/**
 * Gemini 모델 호출 (비스트리밍)
 * @param prompt 사용자 프롬프트
 * @param systemInstruction 시스템 지시사항 (선택)
 * @returns AI 응답 텍스트
 */
export async function callGemini(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  try {
    const modelName = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';

    if (USE_VERTEX_AI) {
      return await callGeminiVertexAI(prompt, systemInstruction, modelName);
    } else {
      return await callGeminiGoogle(prompt, systemInstruction, modelName);
    }
  } catch (error) {
    console.error('[Vertex AI] Error calling Gemini:', error);

    if (error instanceof Error) {
      // API 키 오류 처리
      if (
        error.message.includes('API_KEY') ||
        error.message.includes('401') ||
        error.message.includes('Unauthorized')
      ) {
        throw new Error(
          'API 인증 오류: 인증 정보가 유효하지 않습니다. ' +
          '환경 변수를 확인해주세요.'
        );
      }
      // 할당량 오류 처리
      if (
        error.message.includes('429') ||
        error.message.includes('quota') ||
        error.message.includes('rate limit')
      ) {
        throw new Error(
          'API 할당량 초과: 잠시 후 다시 시도해주세요.'
        );
      }
      throw new Error(error.message);
    }

    throw new Error('Gemini API 호출 실패');
  }
}

/**
 * Google AI API를 사용한 Gemini 호출
 */
async function callGeminiGoogle(
  prompt: string,
  systemInstruction: string | undefined,
  modelName: string
): Promise<string> {
  const genAI = getClient() as GoogleGenerativeAI;
  const finalModelName = modelName === 'gemini-2.0-flash-exp' ? 'gemini-2.5-flash' : modelName;

  console.log('[Google AI] Calling model:', finalModelName);

  const fullPrompt = systemInstruction
    ? `${systemInstruction}\n\n${prompt}`
    : prompt;

  const model = genAI.getGenerativeModel({ model: finalModelName });
  const result = await model.generateContent(fullPrompt);
  const response = await result.response;

  return response.text();
}

/**
 * Vertex AI API를 사용한 Gemini 호출
 */
async function callGeminiVertexAI(
  prompt: string,
  systemInstruction: string | undefined,
  modelName: string
): Promise<string> {
  if (!vertexAIClient) {
    vertexAIClient = await initializeVertexAI();
  }

  const finalModelName = modelName === 'gemini-2.0-flash-exp' ? 'gemini-2.5-flash' : modelName;

  console.log('[Vertex AI] Calling model:', finalModelName);

  const fullPrompt = systemInstruction
    ? `${systemInstruction}\n\n${prompt}`
    : prompt;

  if (!vertexAIClient) {
    throw new Error('Vertex AI 클라이언트가 초기화되지 않았습니다.');
  }

  const generativeModel = vertexAIClient.getGenerativeModel({
    model: finalModelName,
  });

  const result = await generativeModel.generateContent(fullPrompt);
  const response = await result.response;

  return response.text();
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
    const modelName = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';

    if (USE_VERTEX_AI) {
      yield* callGeminiStreamVertexAI(prompt, systemInstruction, modelName);
    } else {
      yield* callGeminiStreamGoogle(prompt, systemInstruction, modelName);
    }
  } catch (error) {
    console.error('[Vertex AI] Error calling Gemini stream:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('API_KEY') ||
        error.message.includes('401') ||
        error.message.includes('Unauthorized')
      ) {
        throw new Error('API 인증 오류: 인증 정보가 유효하지 않습니다.');
      }
      if (
        error.message.includes('429') ||
        error.message.includes('quota') ||
        error.message.includes('rate limit')
      ) {
        throw new Error('API 할당량 초과: 잠시 후 다시 시도해주세요.');
      }
      throw new Error(error.message);
    }

    throw new Error('Gemini API 스트리밍 호출 실패');
  }
}

/**
 * Google AI API를 사용한 스트리밍 호출
 */
async function* callGeminiStreamGoogle(
  prompt: string,
  systemInstruction: string | undefined,
  modelName: string
): AsyncGenerator<string, void, unknown> {
  const genAI = getClient() as GoogleGenerativeAI;
  const finalModelName = modelName === 'gemini-2.0-flash-exp' ? 'gemini-2.5-flash' : modelName;

  console.log('[Google AI] Streaming model:', finalModelName);

  const fullPrompt = systemInstruction
    ? `${systemInstruction}\n\n${prompt}`
    : prompt;

  const model = genAI.getGenerativeModel({ model: finalModelName });
  const result = await model.generateContentStream(fullPrompt);

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      yield chunkText;
    }
  }
}

/**
 * Vertex AI API를 사용한 스트리밍 호출
 */
async function* callGeminiStreamVertexAI(
  prompt: string,
  systemInstruction: string | undefined,
  modelName: string
): AsyncGenerator<string, void, unknown> {
  if (!vertexAIClient) {
    vertexAIClient = await initializeVertexAI();
  }

  const finalModelName = modelName === 'gemini-2.0-flash-exp' ? 'gemini-2.5-flash' : modelName;

  console.log('[Vertex AI] Streaming model:', finalModelName);

  const fullPrompt = systemInstruction
    ? `${systemInstruction}\n\n${prompt}`
    : prompt;

  if (!vertexAIClient) {
    throw new Error('Vertex AI 클라이언트가 초기화되지 않았습니다.');
  }

  const generativeModel = vertexAIClient.getGenerativeModel({
    model: finalModelName,
  });

  const result = await generativeModel.generateContentStream(fullPrompt);

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      yield chunkText;
    }
  }
}

export default {
  callGemini,
  callGeminiStream,
};
