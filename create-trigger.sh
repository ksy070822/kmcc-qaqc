#!/bin/bash

# Cloud Build 트리거 생성 스크립트

set -e

PROJECT_ID="csopp-25f2"
REGION="asia-northeast3"
TRIGGER_NAME="qc-dashboard-auto-deploy"
REPO_OWNER="may070822"
REPO_NAME="kmcc-qc-dashbord"
BRANCH_PATTERN="^main$"

echo "=========================================="
echo "Cloud Build 트리거 생성"
echo "=========================================="
echo "프로젝트: $PROJECT_ID"
echo "리전: $REGION"
echo "트리거 이름: $TRIGGER_NAME"
echo "저장소: $REPO_OWNER/$REPO_NAME"
echo ""

# 프로젝트 설정
gcloud config set project $PROJECT_ID

# 기존 트리거 확인
echo "[1/3] 기존 트리거 확인..."
EXISTING_TRIGGER=$(gcloud builds triggers list --region=$REGION --filter="name:$TRIGGER_NAME" --format="value(id)" 2>/dev/null | head -1)

if [ -n "$EXISTING_TRIGGER" ]; then
  echo "기존 트리거 발견: $EXISTING_TRIGGER"
  echo "트리거 업데이트 중..."
  
  gcloud builds triggers update $EXISTING_TRIGGER \
    --region=$REGION \
    --name=$TRIGGER_NAME \
    --repo-name=$REPO_NAME \
    --repo-owner=$REPO_OWNER \
    --branch-pattern=$BRANCH_PATTERN \
    --build-config=cloudbuild.yaml \
    --substitutions=_SERVICE_NAME=qc-dashboard,_REGION=$REGION \
    --quiet
  
  echo "✓ 트리거 업데이트 완료"
else
  echo "[2/3] 새 트리거 생성 중..."
  
  # GitHub 연결 확인
  CONNECTIONS=$(gcloud builds connections list --region=$REGION --format="value(name)" 2>/dev/null | head -1)
  
  if [ -z "$CONNECTIONS" ]; then
    echo "GitHub 연결이 없습니다. 먼저 연결을 생성해야 합니다."
    echo ""
    echo "다음 명령어로 GitHub 연결을 생성하세요:"
    echo "gcloud builds connections create github \\"
    echo "  --region=$REGION \\"
    echo "  --authorizer-token-source=GITHUB_TOKEN"
    echo ""
    echo "또는 Cloud Console에서 수동으로 연결하세요:"
    echo "https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
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
  
  echo "✓ 트리거 생성 완료"
fi

echo ""
echo "[3/3] 트리거 테스트..."
echo "트리거를 테스트하려면 GitHub에 푸시하세요:"
echo "  git push may main"
echo ""

# 트리거 정보 출력
echo "=========================================="
echo "트리거 정보"
echo "=========================================="
gcloud builds triggers describe $TRIGGER_NAME --region=$REGION --format="yaml(name,github,branchPattern,region,substitutions)" 2>/dev/null || \
gcloud builds triggers list --region=$REGION --filter="name:$TRIGGER_NAME" --format="table(name,github.owner,github.name,branchPattern,region)"

echo ""
echo "✅ 완료!"
