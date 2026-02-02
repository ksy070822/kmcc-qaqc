#!/bin/bash

# 빠른 배포 스크립트 (조직 정책 제약 해결)

set -e

PROJECT_ID="csopp-25f2"
SERVICE_NAME="qc-dashboard"
REGION="asia-northeast3"

echo "=========================================="
echo "빠른 배포 시작"
echo "=========================================="
echo "프로젝트: $PROJECT_ID"
echo "서비스: $SERVICE_NAME"
echo "리전: $REGION"
echo ""

# 프로젝트 설정
gcloud config set project $PROJECT_ID

# Cloud Build 리전 설정 (조직 정책 제약 해결)
echo "[1/3] Cloud Build 리전 설정..."
gcloud config set builds/region $REGION
echo "✓ 완료"
echo ""

# Artifact Registry 저장소 확인
echo "[2/3] Artifact Registry 저장소 확인..."
if ! gcloud artifacts repositories describe cloud-run-source-deploy --location=$REGION --quiet 2>/dev/null; then
  echo "저장소 생성 중..."
  gcloud artifacts repositories create cloud-run-source-deploy \
    --repository-format=docker \
    --location=$REGION \
    --description="Cloud Run source deploy Docker images" \
    --quiet
  echo "✓ 저장소 생성 완료"
else
  echo "✓ 저장소 존재"
fi
echo ""

# 빌드 및 배포
echo "[3/3] 빌드 및 배포 시작..."
echo "⏳ 이 작업은 5-10분이 걸릴 수 있습니다..."
gcloud builds submit \
  --config cloudbuild.yaml \
  --region=$REGION \
  --substitutions=_SERVICE_NAME=$SERVICE_NAME,_REGION=$REGION \
  --project=$PROJECT_ID \
  .

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
