#!/bin/bash

# Cloud Build 트리거 설정 스크립트 (GitHub 자동 배포)
# 사용법: ./setup-github-trigger.sh

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ID="csopp-25f2"
REGION="asia-northeast3"
TRIGGER_NAME="qc-dashboard-auto-deploy"
REPO_OWNER="may070822"
REPO_NAME="kmcc-qc-dashbord"
BRANCH_PATTERN="^main$"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cloud Build 트리거 설정${NC}"
echo -e "${BLUE}(GitHub 자동 배포)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "프로젝트: $PROJECT_ID"
echo "리전: $REGION"
echo "트리거 이름: $TRIGGER_NAME"
echo "저장소: $REPO_OWNER/$REPO_NAME"
echo ""

# 프로젝트 설정
echo -e "${YELLOW}1. GCP 프로젝트 설정...${NC}"
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✓ 프로젝트 설정 완료${NC}"
echo ""

# 기존 트리거 확인
echo -e "${YELLOW}2. 기존 트리거 확인...${NC}"
EXISTING_TRIGGER=$(gcloud builds triggers list --region=$REGION --filter="name:$TRIGGER_NAME" --format="value(id)" 2>/dev/null | head -1)

if [ -n "$EXISTING_TRIGGER" ]; then
  echo -e "${GREEN}기존 트리거 발견: $EXISTING_TRIGGER${NC}"
  echo -e "${YELLOW}트리거 업데이트 중...${NC}"
  
  gcloud builds triggers update $EXISTING_TRIGGER \
    --region=$REGION \
    --name=$TRIGGER_NAME \
    --repo-name=$REPO_NAME \
    --repo-owner=$REPO_OWNER \
    --branch-pattern=$BRANCH_PATTERN \
    --build-config=cloudbuild.yaml \
    --substitutions=_SERVICE_NAME=qc-dashboard,_REGION=$REGION \
    --quiet
  
  echo -e "${GREEN}✓ 트리거 업데이트 완료${NC}"
else
  echo -e "${YELLOW}새 트리거 생성 중...${NC}"
  
  # GitHub 연결 확인
  CONNECTIONS=$(gcloud builds connections list --region=$REGION --format="value(name)" 2>/dev/null | head -1)
  
  if [ -z "$CONNECTIONS" ]; then
    echo -e "${RED}⚠ GitHub 연결이 없습니다.${NC}"
    echo ""
    echo -e "${YELLOW}다음 중 하나의 방법으로 GitHub 연결을 설정하세요:${NC}"
    echo ""
    echo -e "${BLUE}방법 1: Cloud Console에서 설정 (권장)${NC}"
    echo "1. https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID 접속"
    echo "2. '트리거 만들기' 클릭"
    echo "3. '소스' 섹션에서 '연결' 버튼 클릭"
    echo "4. GitHub 인증 및 저장소 선택"
    echo ""
    echo -e "${BLUE}방법 2: gcloud CLI로 연결${NC}"
    echo "gcloud builds connections create github \\"
    echo "  --region=$REGION"
    echo ""
    exit 1
  fi
  
  # 트리거 생성
  gcloud builds triggers create github \
    --name=$TRIGGER_NAME \
    --region=$REGION \
    --repo-name=$REPO_NAME \
    --repo-owner=$REPO_OWNER \
    --branch-pattern=$BRANCH_PATTERN \
    --build-config=cloudbuild.yaml \
    --substitutions=_SERVICE_NAME=qc-dashboard,_REGION=$REGION \
    --quiet
  
  echo -e "${GREEN}✓ 트리거 생성 완료${NC}"
fi

echo ""
echo -e "${YELLOW}3. 트리거 정보 확인...${NC}"
gcloud builds triggers list --region=$REGION --filter="name:$TRIGGER_NAME" --format="table(name,github.owner,github.name,branchPattern,region)" 2>/dev/null || \
gcloud builds triggers describe $TRIGGER_NAME --region=$REGION --format="yaml(name,github,branchPattern,region,substitutions)" 2>/dev/null

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 트리거 설정 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}이제 GitHub에 푸시하면 자동으로 배포됩니다:${NC}"
echo "  git push origin main"
echo ""
echo -e "${YELLOW}빌드 상태 확인:${NC}"
echo "  https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
