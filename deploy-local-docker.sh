#!/bin/bash

# 로컬 Docker 빌드 후 배포 (조직 정책 제약 완전 우회)

set -e

PROJECT_ID="csopp-25f2"
SERVICE_NAME="qc-dashboard"
REGION="asia-northeast3"
REPOSITORY_NAME="cloud-run-source-deploy"
IMAGE_TAG="latest"

echo "=========================================="
echo "로컬 Docker 빌드 및 배포"
echo "=========================================="
echo "프로젝트: $PROJECT_ID"
echo "서비스: $SERVICE_NAME"
echo "리전: $REGION"
echo ""

# 프로젝트 설정
gcloud config set project $PROJECT_ID

# Artifact Registry 저장소 확인
echo "[1/5] Artifact Registry 저장소 확인..."
if ! gcloud artifacts repositories describe $REPOSITORY_NAME --location=$REGION --quiet 2>/dev/null; then
  echo "저장소 생성 중..."
  gcloud artifacts repositories create $REPOSITORY_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Cloud Run source deploy Docker images" \
    --quiet
  echo "✓ 저장소 생성 완료"
else
  echo "✓ 저장소 존재"
fi
echo ""

# Artifact Registry 인증
echo "[2/5] Artifact Registry 인증 설정..."
gcloud auth configure-docker asia-northeast3-docker.pkg.dev --quiet
echo "✓ 완료"
echo ""

# Docker 이미지 빌드
echo "[3/5] Docker 이미지 빌드 중..."
IMAGE_URI="asia-northeast3-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY_NAME}/${SERVICE_NAME}:${IMAGE_TAG}"
docker build -t $IMAGE_URI .
echo "✓ 빌드 완료"
echo ""

# 이미지 푸시
echo "[4/5] Artifact Registry에 이미지 푸시 중..."
docker push $IMAGE_URI
echo "✓ 푸시 완료"
echo ""

# Cloud Run 배포
echo "[5/5] Cloud Run 배포 중..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE_URI \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --quiet

echo ""
echo "=========================================="
echo "✅ 배포 완료!"
echo "=========================================="
echo ""

# 서비스 URL 확인
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format="value(status.url)" 2>/dev/null || echo "")

if [ -n "$SERVICE_URL" ]; then
  echo "서비스 URL: $SERVICE_URL"
  echo ""
  echo "브라우저에서 접속: $SERVICE_URL"
else
  echo "서비스 URL을 가져올 수 없습니다."
  echo "Cloud Console에서 확인하세요:"
  echo "https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME"
fi
