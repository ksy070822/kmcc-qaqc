#!/bin/bash

# Cloud Build 진행 상황 모니터링 스크립트

PROJECT_ID=${1:-"splyquizkm"}
REGION="asia-northeast3"
BUILD_ID=${2:-""}

echo "=========================================="
echo "Cloud Build 모니터링"
echo "=========================================="
echo "프로젝트 ID: $PROJECT_ID"
echo "리전: $REGION"
echo ""

if [ -z "$BUILD_ID" ]; then
  echo "최근 빌드 확인 중..."
  BUILD_ID=$(gcloud builds list --region=$REGION --limit=1 --format="value(id)" 2>/dev/null)
fi

if [ -z "$BUILD_ID" ]; then
  echo "✗ 빌드를 찾을 수 없습니다."
  exit 1
fi

echo "빌드 ID: $BUILD_ID"
echo ""

# 빌드 상태 확인
while true; do
  STATUS=$(gcloud builds describe $BUILD_ID --region=$REGION --format="value(status)" 2>/dev/null)
  
  case $STATUS in
    WORKING)
      echo -n "⏳ 빌드 진행 중... "
      # 진행률 표시 (간단한 애니메이션)
      for i in {1..3}; do
        echo -n "."
        sleep 1
      done
      echo ""
      ;;
    SUCCESS)
      echo "✅ 빌드 성공!"
      echo ""
      echo "빌드 로그:"
      gcloud builds log $BUILD_ID --region=$REGION 2>/dev/null | tail -20
      break
      ;;
    FAILURE|CANCELLED|TIMEOUT|INTERNAL_ERROR)
      echo "❌ 빌드 실패: $STATUS"
      echo ""
      echo "에러 로그:"
      gcloud builds log $BUILD_ID --region=$REGION 2>/dev/null | tail -50
      break
      ;;
    QUEUED)
      echo "⏸️  빌드 대기 중..."
      sleep 5
      ;;
    *)
      echo "상태: $STATUS"
      sleep 5
      ;;
  esac
  
  # 5초마다 상태 확인
  sleep 5
done

echo ""
echo "=========================================="
