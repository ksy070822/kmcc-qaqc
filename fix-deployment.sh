#!/bin/bash

# Cloud Run 배포 문제 해결 스크립트
# 이미지가 없을 때 사용

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 프로젝트 ID 확인
PROJECT_ID=${1:-"splyquizkm"}
SERVICE_NAME="qc-dashboard"
REGION="asia-northeast3"
REPOSITORY_NAME="cloud-run-source-deploy"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cloud Run 배포 문제 해결${NC}"
echo -e "${BLUE}========================================${NC}"
echo "프로젝트 ID: $PROJECT_ID"
echo "서비스 이름: $SERVICE_NAME"
echo "리전: $REGION"
echo ""

# 프로젝트 설정
echo -e "${YELLOW}[1/6] GCP 프로젝트 설정...${NC}"
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✓ 완료${NC}"
echo ""

# API 활성화
echo -e "${YELLOW}[2/6] 필요한 API 활성화 확인...${NC}"
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable run.googleapis.com --quiet
gcloud services enable artifactregistry.googleapis.com --quiet
gcloud services enable bigquery.googleapis.com --quiet
echo -e "${GREEN}✓ 완료${NC}"
echo ""

# Artifact Registry 저장소 확인/생성
echo -e "${YELLOW}[3/6] Artifact Registry 저장소 확인...${NC}"
if ! gcloud artifacts repositories describe $REPOSITORY_NAME --location=$REGION --quiet 2>/dev/null; then
  echo "저장소가 없습니다. 생성 중..."
  gcloud artifacts repositories create $REPOSITORY_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Cloud Run source deploy Docker images" \
    --quiet
  echo -e "${GREEN}✓ 저장소 생성 완료${NC}"
else
  echo -e "${GREEN}✓ 저장소 이미 존재${NC}"
fi
echo ""

# 기존 이미지 확인
echo -e "${YELLOW}[4/6] 기존 Docker 이미지 확인...${NC}"
IMAGE_URL="asia-northeast3-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/$SERVICE_NAME"
echo "이미지 경로: $IMAGE_URL"
echo ""

# Cloud Build 기본 리전 설정 (조직 정책 제약 해결)
echo -e "${YELLOW}[5/6] Cloud Build 리전 설정 및 빌드 시작 (서울 리전)...${NC}"
echo -e "${BLUE}조직 정책 제약을 피하기 위해 리전을 명시적으로 설정합니다...${NC}"

# gcloud 기본 리전 설정
gcloud config set builds/region $REGION

# Cloud Build로 빌드 및 배포 (리전 명시)
echo -e "${BLUE}이 작업은 몇 분이 걸릴 수 있습니다...${NC}"
gcloud builds submit \
  --config cloudbuild.yaml \
  --region=$REGION \
  --substitutions=_SERVICE_NAME=$SERVICE_NAME,_REGION=$REGION \
  --project=$PROJECT_ID \
  .
echo -e "${GREEN}✓ 빌드 및 배포 완료${NC}"
echo ""

# 배포 확인
echo -e "${YELLOW}[6/6] 배포 상태 확인...${NC}"
sleep 5
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format="value(status.url)" 2>/dev/null || echo "")

if [ -z "$SERVICE_URL" ]; then
  echo -e "${RED}⚠ 서비스를 찾을 수 없습니다.${NC}"
  echo "Cloud Console에서 배포 상태를 확인하세요:"
  echo "https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME"
  exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 배포 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}서비스 URL: ${SERVICE_URL}${NC}"
echo ""
echo -e "${YELLOW}다음 단계:${NC}"
echo "1. 서비스 테스트: curl $SERVICE_URL"
echo "2. 브라우저에서 접속: $SERVICE_URL"
echo "3. 로그 확인: gcloud run services logs read $SERVICE_NAME --region=$REGION --follow"
echo ""
