/**
 * CORS 헤더 유틸리티
 * 모든 API 라우트에서 일관된 CORS 정책을 적용
 */

/**
 * CORS 헤더 생성
 * @param allowedOrigin 허용할 origin (기본값: * 또는 환경 변수)
 * @returns CORS 헤더 객체
 */
export function getCorsHeaders(allowedOrigin?: string) {
  // 환경 변수에서 허용할 origin 가져오기
  const origin = allowedOrigin || process.env.CORS_ALLOWED_ORIGIN || '*';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24시간
  };
}

/**
 * 요청의 origin을 검증하고 적절한 CORS 헤더 반환
 * @param requestOrigin 요청의 origin
 * @param allowedOrigins 허용할 origins 리스트
 * @returns CORS 헤더 객체
 */
export function validateAndGetCorsHeaders(
  requestOrigin?: string,
  allowedOrigins?: string[]
) {
  // 환경 변수에서 허용 목록 가져오기
  const defaultAllowed = allowedOrigins || [
    process.env.CORS_ALLOWED_ORIGIN || '*',
  ];

  // origin 검증
  let allowedOrigin = '*';
  if (requestOrigin && defaultAllowed.length > 0 && defaultAllowed[0] !== '*') {
    if (defaultAllowed.includes(requestOrigin)) {
      allowedOrigin = requestOrigin;
    }
  } else if (defaultAllowed[0] !== '*') {
    allowedOrigin = defaultAllowed[0];
  }

  return getCorsHeaders(allowedOrigin);
}
