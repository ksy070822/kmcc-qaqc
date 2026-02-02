#!/bin/bash

# 배포 상태 확인 스크립트

PROJECT_ID=${1:-"csopp-25f2"}
SERVICE_NAME="qc-dashboard"
REGION="asia-northeast3"
REPOSITORY_NAME="cloud-run-source-deploy"

echo "=========================================="
echo "배포 상태 확인"
echo "=========================================="
echo "프로젝트 ID: $PROJECT_ID"
echo "서비스 이름: $SERVICE_NAME"
echo "리전: $REGION"
echo ""

# 프로젝트 설정
gcloud config set project $PROJECT_ID > /dev/null 2>&1

# 1. Artifact Registry 저장소 확인
echo "[1] Artifact Registry 저장소 확인..."
if gcloud artifacts repositories describe $REPOSITORY_NAME --location=$REGION --quiet 2>/dev/null; then
  echo "✓ 저장소 존재: $REPOSITORY_NAME"
else
  echo "✗ 저장소 없음: $REPOSITORY_NAME"
fi
echo ""

# 2. Docker 이미지 확인
echo "[2] Docker 이미지 확인..."
IMAGE_URL="asia-northeast3-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/$SERVICE_NAME"
IMAGES=$(gcloud artifacts docker images list $IMAGE_URL --include-tags --format="value(tags)" 2>/dev/null | head -5)
if [ -n "$IMAGES" ]; then
  echo "✓ 이미지 발견:"
  echo "$IMAGES" | while read tag; do
    echo "  - $tag"
  done
else
  echo "✗ 이미지 없음"
fi
echo ""

# 3. 최근 빌드 상태 확인
echo "[3] 최근 Cloud Build 상태 확인..."
LATEST_BUILD=$(gcloud builds list --region=$REGION --limit=1 --format="value(id,status)" 2>/dev/null)
if [ -n "$LATEST_BUILD" ]; then
  BUILD_ID=$(echo $LATEST_BUILD | cut -d' ' -f1)
  BUILD_STATUS=$(echo $LATEST_BUILD | cut -d' ' -f2)
  echo "최근 빌드 ID: $BUILD_ID"
  echo "상태: $BUILD_STATUS"
else
  echo "✗ 빌드 기록 없음"
fi
echo ""

# 4. Cloud Run 서비스 상태 확인
echo "[4] Cloud Run 서비스 상태 확인..."
SERVICE_STATUS=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.conditions[0].status)" 2>/dev/null)
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" 2>/dev/null)

if [ -n "$SERVICE_STATUS" ]; then
  if [ "$SERVICE_STATUS" = "True" ]; then
    echo "✓ 서비스 정상 실행 중"
    echo "URL: $SERVICE_URL"
  else
    echo "✗ 서비스 오류"
    echo "상태: $SERVICE_STATUS"
  fi
else
  echo "✗ 서비스 없음"
fi
echo ""

# 5. 최근 로그 확인
if [ -n "$SERVICE_URL" ]; then
  echo "[5] 최근 서비스 로그 (마지막 5줄)..."
  gcloud run services logs read $SERVICE_NAME --region=$REGION --limit=5 2>/dev/null | tail -5 || echo "로그 없음"
fi

echo ""
echo "=========================================="
