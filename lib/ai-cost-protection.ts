/**
 * AI API 비용 보호 모듈
 * Vertex AI/Google AI API 호출 시 비용 폭증을 방지하는 안전장치
 */

// 최대 프롬프트 길이 (토큰 수 대신 문자 수로 근사치 계산)
const MAX_PROMPT_LENGTH = 50000; // 약 12,500 토큰 (한글 기준)
const MAX_MESSAGE_LENGTH = 5000; // 사용자 메시지 최대 길이

// Rate limiting 설정
const RATE_LIMIT_WINDOW_MS = 60000; // 1분
const MAX_REQUESTS_PER_WINDOW = 10; // 1분당 최대 10회 요청
const MAX_REQUESTS_PER_HOUR = 100; // 1시간당 최대 100회 요청

// 요청 추적 (메모리 기반, 프로덕션에서는 Redis 등 사용 권장)
interface RequestRecord {
  timestamp: number;
  userId?: string;
  ip?: string;
}

const requestHistory: RequestRecord[] = [];

/**
 * Rate limiting 체크
 * @param userId 사용자 ID (선택)
 * @param ip IP 주소 (선택)
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(userId?: string, ip?: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  
  // 오래된 기록 제거 (1시간 이상)
  const oneHourAgo = now - 3600000;
  const recentHistory = requestHistory.filter(r => r.timestamp > oneHourAgo);
  requestHistory.length = 0;
  requestHistory.push(...recentHistory);
  
  // 1분 윈도우 내 요청 수 확인
  const oneMinuteAgo = now - RATE_LIMIT_WINDOW_MS;
  const requestsInLastMinute = recentHistory.filter(r => r.timestamp > oneMinuteAgo).length;
  
  if (requestsInLastMinute >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      reason: `1분당 최대 ${MAX_REQUESTS_PER_WINDOW}회 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.`
    };
  }
  
  // 1시간 윈도우 내 요청 수 확인
  const requestsInLastHour = recentHistory.length;
  if (requestsInLastHour >= MAX_REQUESTS_PER_HOUR) {
    return {
      allowed: false,
      reason: `1시간당 최대 ${MAX_REQUESTS_PER_HOUR}회 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.`
    };
  }
  
  // 요청 기록 추가
  requestHistory.push({ timestamp: now, userId, ip });
  
  return { allowed: true };
}

/**
 * 프롬프트 길이 검증
 * @param prompt 프롬프트 텍스트
 * @returns true if valid, false if too long
 */
export function validatePromptLength(prompt: string): { valid: boolean; reason?: string } {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      reason: `프롬프트가 너무 깁니다 (최대 ${MAX_PROMPT_LENGTH.toLocaleString()}자). 프롬프트를 단축해주세요.`
    };
  }
  
  return { valid: true };
}

/**
 * 사용자 메시지 길이 검증
 * @param message 사용자 메시지
 * @returns true if valid, false if too long
 */
export function validateMessageLength(message: string): { valid: boolean; reason?: string } {
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      reason: `메시지가 너무 깁니다 (최대 ${MAX_MESSAGE_LENGTH.toLocaleString()}자). 메시지를 단축해주세요.`
    };
  }
  
  return { valid: true };
}

/**
 * 프롬프트 비용 추정 (근사치)
 * @param prompt 프롬프트 텍스트
 * @returns 예상 토큰 수 및 비용 정보
 */
export function estimateCost(prompt: string): {
  estimatedTokens: number;
  estimatedCostKRW: number;
  warning?: string;
} {
  // 한글 기준으로 대략적인 토큰 수 계산 (1 토큰 ≈ 4자)
  const estimatedTokens = Math.ceil(prompt.length / 4);
  
  // Gemini 2.0 Flash 가격 (2025년 기준, 실제 가격 확인 필요)
  // Input: $0.075 per 1M tokens, Output: $0.30 per 1M tokens
  // 평균적으로 input/output 비율 3:1 가정
  const inputCostPerToken = 0.075 / 1000000; // USD
  const outputCostPerToken = 0.30 / 1000000; // USD
  const avgCostPerToken = (inputCostPerToken * 3 + outputCostPerToken * 1) / 4;
  
  // USD to KRW (약 1,300원 가정)
  const krwPerUsd = 1300;
  const estimatedCostUSD = estimatedTokens * avgCostPerToken;
  const estimatedCostKRW = estimatedCostUSD * krwPerUsd;
  
  let warning: string | undefined;
  if (estimatedCostKRW > 100) {
    warning = '이 요청의 예상 비용이 높습니다. 프롬프트를 단축하는 것을 권장합니다.';
  }
  
  return {
    estimatedTokens,
    estimatedCostKRW,
    warning,
  };
}

/**
 * 비용 보호 체크 (모든 검증 통합)
 * @param message 사용자 메시지
 * @param prompt 생성된 프롬프트
 * @param userId 사용자 ID (선택)
 * @param ip IP 주소 (선택)
 * @returns 검증 결과
 */
export function checkCostProtection(
  message: string,
  prompt: string,
  userId?: string,
  ip?: string
): { allowed: boolean; reason?: string; costEstimate?: { estimatedTokens: number; estimatedCostKRW: number } } {
  // 1. 메시지 길이 검증
  const messageCheck = validateMessageLength(message);
  if (!messageCheck.valid) {
    return { allowed: false, reason: messageCheck.reason };
  }
  
  // 2. 프롬프트 길이 검증
  const promptCheck = validatePromptLength(prompt);
  if (!promptCheck.valid) {
    return { allowed: false, reason: promptCheck.reason };
  }
  
  // 3. Rate limiting 검증
  const rateLimitCheck = checkRateLimit(userId, ip);
  if (!rateLimitCheck.allowed) {
    return { allowed: false, reason: rateLimitCheck.reason };
  }
  
  // 4. 비용 추정
  const costEstimate = estimateCost(prompt);
  
  // 5. 비용 경고 (너무 비싼 요청은 차단하지 않지만 경고)
  if (costEstimate.estimatedCostKRW > 500) {
    console.warn('[AI Cost Protection] High cost request detected:', {
      estimatedTokens: costEstimate.estimatedTokens,
      estimatedCostKRW: costEstimate.estimatedCostKRW,
      promptLength: prompt.length,
      userId,
      ip,
    });
    
    // 매우 비싼 요청은 차단 (1,000원 이상)
    if (costEstimate.estimatedCostKRW > 1000) {
      return {
        allowed: false,
        reason: `예상 비용이 너무 높습니다 (약 ${Math.round(costEstimate.estimatedCostKRW)}원). 프롬프트를 단축해주세요.`,
        costEstimate,
      };
    }
  }
  
  return {
    allowed: true,
    costEstimate,
  };
}

/**
 * 요청 로깅 (비용 모니터링용)
 */
export function logAIRequest(
  prompt: string,
  responseLength: number,
  duration: number,
  userId?: string,
  ip?: string
): void {
  const costEstimate = estimateCost(prompt);
  const responseTokens = Math.ceil(responseLength / 4);
  const totalTokens = costEstimate.estimatedTokens + responseTokens;
  
  console.log('[AI Request Log]', {
    timestamp: new Date().toISOString(),
    promptLength: prompt.length,
    responseLength,
    estimatedTokens: totalTokens,
    estimatedCostKRW: costEstimate.estimatedCostKRW,
    durationMs: duration,
    userId,
    ip,
  });
  
  // 프로덕션에서는 여기에 모니터링 시스템으로 전송
  // 예: Cloud Monitoring, BigQuery, 등
}
