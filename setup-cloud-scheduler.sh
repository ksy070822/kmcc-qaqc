#!/bin/bash
# =====================================================
# KMCC QC 대시보드 - Cloud Scheduler 설정 스크립트
# 매일 오후 8시(KST) Google Sheets → BigQuery 자동 동기화
# =====================================================

set -e

# 프로젝트 설정
PROJECT_ID="csopp-25f2"
REGION="asia-northeast3"
SERVICE_NAME="qc-dashboard"

# Cloud Run 서비스 URL 자동 감지
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --project=${PROJECT_ID} \
  --region=${REGION} \
  --format='value(status.url)' 2>/dev/null)

if [ -z "$SERVICE_URL" ]; then
  echo "⚠️  Cloud Run 서비스 URL을 찾을 수 없습니다."
  echo "   수동으로 입력하세요:"
  read -p "   SERVICE_URL: " SERVICE_URL
fi

echo "============================================"
echo "  KMCC QC 대시보드 Cloud Scheduler 설정"
echo "============================================"
echo "  Project: ${PROJECT_ID}"
echo "  Region:  ${REGION}"
echo "  Service: ${SERVICE_URL}"
echo "============================================"

# 1. 서비스 계정 생성 (이미 있으면 스킵)
SA_NAME="scheduler-invoker"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo ""
echo "1️⃣  서비스 계정 확인/생성..."
gcloud iam service-accounts describe ${SA_EMAIL} --project=${PROJECT_ID} 2>/dev/null || \
  gcloud iam service-accounts create ${SA_NAME} \
    --project=${PROJECT_ID} \
    --display-name="Cloud Scheduler Invoker"

# 2. Cloud Run 호출 권한 부여
echo ""
echo "2️⃣  Cloud Run 호출 권한 부여..."
gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
  --project=${PROJECT_ID} \
  --region=${REGION} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker"

# 3. Cloud Scheduler 작업 생성 - 일일 동기화 (매일 20:00 KST)
echo ""
echo "3️⃣  Cloud Scheduler 작업 생성 (매일 20:00 KST)..."
gcloud scheduler jobs create http kmcc-qc-daily-sync \
  --project=${PROJECT_ID} \
  --location=${REGION} \
  --schedule="0 20 * * *" \
  --time-zone="Asia/Seoul" \
  --uri="${SERVICE_URL}/api/sync-sheets" \
  --http-method=POST \
  --oidc-service-account-email=${SA_EMAIL} \
  --oidc-token-audience=${SERVICE_URL} \
  --attempt-deadline="300s" \
  --max-retry-attempts=3 \
  --min-backoff-duration="30s" \
  --description="KMCC QC 대시보드 - 매일 20시 Google Sheets → BigQuery 동기화" \
  2>/dev/null || \
gcloud scheduler jobs update http kmcc-qc-daily-sync \
  --project=${PROJECT_ID} \
  --location=${REGION} \
  --schedule="0 20 * * *" \
  --time-zone="Asia/Seoul" \
  --uri="${SERVICE_URL}/api/sync-sheets" \
  --http-method=POST \
  --oidc-service-account-email=${SA_EMAIL} \
  --oidc-token-audience=${SERVICE_URL} \
  --attempt-deadline="300s" \
  --max-retry-attempts=3 \
  --min-backoff-duration="30s" \
  --description="KMCC QC 대시보드 - 매일 20시 Google Sheets → BigQuery 동기화"

echo ""
echo "✅ Cloud Scheduler 설정 완료!"
echo ""
echo "📋 설정 요약:"
echo "   - 작업명: kmcc-qc-daily-sync"
echo "   - 스케줄: 매일 20:00 (Asia/Seoul)"
echo "   - 엔드포인트: ${SERVICE_URL}/api/sync-sheets"
echo "   - 재시도: 최대 3회 (30초 간격)"
echo "   - 타임아웃: 5분"
echo ""
echo "🔧 수동 실행 테스트:"
echo "   gcloud scheduler jobs run kmcc-qc-daily-sync --project=${PROJECT_ID} --location=${REGION}"
echo ""
echo "📊 로그 확인:"
echo "   gcloud scheduler jobs describe kmcc-qc-daily-sync --project=${PROJECT_ID} --location=${REGION}"
