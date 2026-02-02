#!/bin/bash

# 빠른 배포 테스트 스크립트

echo "=========================================="
echo "배포 및 테스트 가이드"
echo "=========================================="
echo ""

echo "✅ 현재 상태:"
echo "  - 브랜치: $(git branch --show-current)"
echo "  - 최근 커밋: $(git log -1 --oneline)"
echo "  - GitHub 푸시: 완료"
echo ""

echo "📋 배포 확인:"
echo "  1. Cloud Build 빌드 상태:"
echo "     https://console.cloud.google.com/cloud-build/builds?project=csopp-25f2"
echo ""
echo "  2. Cloud Run 서비스:"
echo "     https://console.cloud.google.com/run?project=csopp-25f2"
echo ""

echo "🧪 테스트 방법:"
echo "  1. Cloud Console에서 서비스 URL 확인"
echo "  2. 브라우저에서 서비스 URL 열기"
echo "  3. 상단 카드 6개 데이터 확인"
echo "  4. 브라우저 콘솔(F12)에서 에러 확인"
echo ""

echo "🔍 확인 사항:"
echo "  ✅ 상단 카드에 데이터가 표시되는가?"
echo "  ✅ React 에러 #418이 없는가?"
echo "  ✅ 데이터 로드 오류가 없는가?"
echo ""
