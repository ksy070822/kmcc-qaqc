#!/bin/bash
# 용산/광주 정기 동기화 + 용산2025/광주2025 1회 적재 (어제까지 데이터 쌓기)
# 사용법: ./scripts/run-sync-all.sh [BASE_URL]
# BASE_URL 기본: http://localhost:3000

BASE_URL="${1:-http://localhost:3000}"

echo "📋 데이터 동기화 (어제까지)"
echo "   대상: $BASE_URL"
echo ""

echo "1. 용산2025/광주2025 1회 적재..."
curl -s -X POST "$BASE_URL/api/import-sheets-2025" -H "Content-Type: application/json" | jq '.' 2>/dev/null || curl -s -X POST "$BASE_URL/api/import-sheets-2025" -H "Content-Type: application/json"
echo ""
echo ""

echo "2. 용산/광주 정기 동기화..."
curl -s -X POST "$BASE_URL/api/sync-sheets" -H "Content-Type: application/json" | jq '.' 2>/dev/null || curl -s -X POST "$BASE_URL/api/sync-sheets" -H "Content-Type: application/json"
echo ""
echo ""

echo "3. 진행 상태 확인 (동기화 중에 다른 터미널에서 실행):"
echo "   curl -s $BASE_URL/api/debug/sync-progress | jq ."
echo ""

echo "4. 최신 평가일 확인..."
curl -s "$BASE_URL/api/debug/latest-date" | jq '.' 2>/dev/null || curl -s "$BASE_URL/api/debug/latest-date"
echo ""
echo "✅ 완료"
