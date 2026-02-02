#!/bin/bash
# 동기화 상태 진단 스크립트
# 사용법: ./scripts/diagnose-sync.sh [BASE_URL]
# BASE_URL 기본값: http://localhost:3000 (로컬) 또는 배포 URL

BASE_URL="${1:-http://localhost:3000}"
echo "📋 동기화 상태 진단: $BASE_URL"
echo ""

echo "1. Sync Status API..."
curl -s "$BASE_URL/api/debug/sync-status" | jq '.' 2>/dev/null || curl -s "$BASE_URL/api/debug/sync-status"
echo ""
echo ""

echo "2. 마지막 데이터 날짜..."
curl -s "$BASE_URL/api/debug/latest-date" | jq '.' 2>/dev/null || curl -s "$BASE_URL/api/debug/latest-date"
echo ""
echo ""

echo "3. 수동 동기화 실행 (테스트)..."
echo "   curl -X POST $BASE_URL/api/sync-sheets -H 'Content-Type: application/json'"
echo ""
