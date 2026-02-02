import { NextResponse } from 'next/server';

/**
 * 서버 연결 확인용 헬스체크
 * GET /api/health → 서버가 떠 있으면 200 OK
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: '서버 연결됨',
    timestamp: new Date().toISOString(),
  });
}
