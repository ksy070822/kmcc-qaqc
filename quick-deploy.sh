#!/bin/bash

# 빠른 배포 스크립트 (트리거 사용)

set -e

PROJECT_ID="csopp-25f2"
REGION="asia-northeast3"
TRIGGER_ID="1e181f74-8136-46b8-a028-d5e6f3271c0e"

echo "=========================================="
echo "빠른 배포 (트리거 사용)"
echo "=========================================="
echo "프로젝트: $PROJECT_ID"
echo "리전: $REGION"
echo ""

# 프로젝트 설정
gcloud config set project $PROJECT_ID > /dev/null 2>&1

# 트리거 수동 실행
echo "트리거 실행 중..."
BUILD_INFO=$(gcloud builds triggers run $TRIGGER_ID --region=$REGION --branch=main 2>&1)

# 빌드 ID 추출
BUILD_ID=$(echo "$BUILD_INFO" | grep -oP 'id: \K[^\s]+' || echo "")

if [ -z "$BUILD_ID" ]; then
  BUILD_ID=$(echo "$BUILD_INFO" | grep -oP 'builds/\K[^?]+' | head -1 || echo "")
fi

if [ -z "$BUILD_ID" ]; then
  echo "❌ 빌드 ID를 찾을 수 없습니다."
  echo ""
  echo "출력:"
  echo "$BUILD_INFO"
  exit 1
fi

echo "✅ 빌드 시작됨"
echo "빌드 ID: $BUILD_ID"
echo ""

# 빌드 로그 URL
LOG_URL=$(echo "$BUILD_INFO" | grep -oP 'logUrl: \K[^\s]+' || echo "")
if [ -n "$LOG_URL" ]; then
  echo "빌드 로그: $LOG_URL"
fi

echo ""
echo "빌드 진행 상황 확인:"
echo "  ./monitor-build.sh $BUILD_ID"
echo ""
echo "또는 Cloud Console에서 확인:"
echo "  https://console.cloud.google.com/cloud-build/builds/$BUILD_ID?project=$PROJECT_ID"
echo ""

# 간단한 상태 확인 (10초 후)
echo "10초 후 상태 확인 중..."
sleep 10

STATUS=$(gcloud builds describe $BUILD_ID --region=$REGION --format="value(status)" 2>/dev/null || echo "UNKNOWN")
echo "현재 상태: $STATUS"

if [ "$STATUS" = "SUCCESS" ]; then
  echo ""
  echo "✅ 빌드 완료!"
  SERVICE_URL=$(gcloud run services describe qc-dashboard --region=$REGION --format="value(status.url)" 2>/dev/null || echo "")
  if [ -n "$SERVICE_URL" ]; then
    echo "서비스 URL: $SERVICE_URL"
  fi
elif [ "$STATUS" = "WORKING" ] || [ "$STATUS" = "QUEUED" ]; then
  echo ""
  echo "⏳ 빌드 진행 중... 완료까지 몇 분이 걸릴 수 있습니다."
  echo "상태 확인: ./monitor-build.sh $BUILD_ID"
fi
