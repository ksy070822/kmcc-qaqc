#!/bin/bash

# QC Dashboard Cloud Run 배포 스크립트
# 사용법: ./deploy.sh [PROJECT_ID]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 프로젝트 ID 확인
if [ -z "$1" ]; then
  echo -e "${YELLOW}프로젝트 ID를 입력하세요:${NC}"
  read -p "GCP Project ID: " PROJECT_ID
else
  PROJECT_ID=$1
fi

if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}오류: 프로젝트 ID가 필요합니다.${NC}"
  echo "사용법: ./deploy.sh [PROJECT_ID]"
  exit 1
fi

echo -e "${GREEN}🚀 QC Dashboard 배포 시작${NC}"
echo "프로젝트 ID: $PROJECT_ID"
echo ""

# 프로젝트 설정
echo -e "${YELLOW}1. GCP 프로젝트 설정...${NC}"
gcloud config set project $PROJECT_ID

# API 활성화 확인
echo -e "${YELLOW}2. 필요한 API 활성화 확인...${NC}"
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable run.googleapis.com --quiet
gcloud services enable artifactregistry.googleapis.com --quiet
gcloud services enable bigquery.googleapis.com --quiet

# Artifact Registry 저장소 확인/생성
echo -e "${YELLOW}3. Artifact Registry 저장소 확인...${NC}"
REPOSITORY_NAME="cloud-run-source-deploy"
if ! gcloud artifacts repositories describe $REPOSITORY_NAME --location=asia-northeast3 --quiet 2>/dev/null; then
  echo "저장소가 없습니다. 생성 중..."
  gcloud artifacts repositories create $REPOSITORY_NAME \
    --repository-format=docker \
    --location=asia-northeast3 \
    --description="Cloud Run source deploy Docker images" \
    --quiet
  echo -e "${GREEN}✓ 저장소 생성 완료${NC}"
else
  echo -e "${GREEN}✓ 저장소 이미 존재${NC}"
fi

# Cloud Build 제출 (서울 리전 명시)
echo -e "${YELLOW}4. Cloud Build로 빌드 및 배포 시작 (서울 리전)...${NC}"
gcloud builds submit --config cloudbuild.yaml --region=asia-northeast3 .

# 배포 완료 확인
echo -e "${YELLOW}6. 배포 상태 확인...${NC}"
SERVICE_URL=$(gcloud run services describe qc-dashboard \
  --region=asia-northeast3 \
  --format="value(status.url)" 2>/dev/null || echo "")

if [ -z "$SERVICE_URL" ]; then
  echo -e "${RED}⚠ 배포가 완료되지 않았거나 서비스를 찾을 수 없습니다.${NC}"
  echo "Cloud Console에서 배포 상태를 확인하세요."
  exit 1
fi

echo ""
echo -e "${GREEN}✅ 배포 완료!${NC}"
echo -e "${GREEN}서비스 URL: ${SERVICE_URL}${NC}"
echo ""
echo -e "${YELLOW}다음 단계:${NC}"
echo "1. BigQuery 권한 설정: CLOUD_RUN_DEPLOY.md 참조"
echo "2. 서비스 테스트: $SERVICE_URL"
echo "3. GitHub 트리거 설정 (자동 배포): CLOUD_RUN_DEPLOY.md 참조"
