#!/bin/bash

# Cloud Scheduler 설정 스크립트
# Google Sheets 데이터를 매일 저녁 8시에 자동으로 BigQuery에 동기화

set -e

# 프로젝트 설정
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-csopp-25f2}"
REGION="${GOOGLE_CLOUD_REGION:-asia-northeast3}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-qc-dashboard}"

# Cloud Run 서비스 URL (자동 감지 또는 수동 설정)
if [ -z "$SERVICE_URL" ]; then
  echo "🔍 Cloud Run 서비스 URL 자동 감지 중..."
  SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --format="value(status.url)" 2>/dev/null || echo "")
  
  if [ -z "$SERVICE_URL" ]; then
    echo "❌ Cloud Run 서비스 URL을 찾을 수 없습니다."
    echo "   SERVICE_URL 환경 변수를 직접 설정하거나 Cloud Run 서비스를 배포하세요."
    exit 1
  fi
fi

echo "📋 설정 정보:"
echo "   프로젝트: $PROJECT_ID"
echo "   리전: $REGION"
echo "   서비스: $SERVICE_NAME"
echo "   URL: $SERVICE_URL"
echo ""

# Cloud Scheduler API 활성화
echo "🔧 Cloud Scheduler API 활성화 중..."
gcloud services enable cloudscheduler.googleapis.com --project=$PROJECT_ID --quiet

# 기존 작업이 있으면 삭제
JOB_NAME="sync-sheets-daily"
EXISTING_JOB=$(gcloud scheduler jobs list \
  --location=$REGION \
  --filter="name:$JOB_NAME" \
  --format="value(name)" \
  --project=$PROJECT_ID 2>/dev/null || echo "")

if [ -n "$EXISTING_JOB" ]; then
  echo "⚠️  기존 작업 발견: $JOB_NAME"
  read -p "   기존 작업을 삭제하고 새로 만들까요? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  기존 작업 삭제 중..."
    gcloud scheduler jobs delete $JOB_NAME \
      --location=$REGION \
      --project=$PROJECT_ID \
      --quiet
  else
    echo "❌ 작업을 취소했습니다."
    exit 1
  fi
fi

# Cloud Scheduler 작업 생성
# 스케줄: 0 20 * * * = 매일 20:00 (Asia/Seoul) = 저녁 8시 KST
echo "🚀 Cloud Scheduler 작업 생성 중..."
echo "   스케줄: 매일 저녁 8시 KST (0 20 * * * Asia/Seoul)"
echo "   엔드포인트: $SERVICE_URL/api/sync-sheets"

gcloud scheduler jobs create http $JOB_NAME \
  --location=$REGION \
  --schedule="0 20 * * *" \
  --uri="$SERVICE_URL/api/sync-sheets" \
  --http-method=POST \
  --time-zone="Asia/Seoul" \
  --description="매일 저녁 8시 Google Sheets 데이터를 BigQuery에 동기화" \
  --headers="Content-Type=application/json" \
  --oidc-service-account-email="$PROJECT_ID@appspot.gserviceaccount.com" \
  --project=$PROJECT_ID

# Cloud Scheduler 서비스 계정에 Cloud Run Invoker 역할 부여
echo "🔐 권한 설정 중..."
SERVICE_ACCOUNT="$PROJECT_ID@appspot.gserviceaccount.com"

gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/run.invoker" \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet || echo "⚠️  권한 설정 실패 (이미 설정되어 있을 수 있습니다)"

echo ""
echo "✅ Cloud Scheduler 작업이 생성되었습니다!"
echo ""
echo "📊 작업 확인:"
echo "   gcloud scheduler jobs describe $JOB_NAME --location=$REGION"
echo ""
echo "🧪 수동 실행 (테스트):"
echo "   gcloud scheduler jobs run $JOB_NAME --location=$REGION"
echo ""
echo "📝 작업 목록:"
echo "   gcloud scheduler jobs list --location=$REGION"
echo ""
