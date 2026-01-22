#!/bin/bash

# GCP Budget Alert 설정 스크립트
# AI API 비용 모니터링을 위한 예산 알림 설정

set -e

PROJECT_ID="splyquizkm"
BILLING_ACCOUNT_ID="" # 실제 Billing Account ID로 변경 필요

echo "=========================================="
echo "GCP Budget Alert 설정"
echo "=========================================="
echo "프로젝트: $PROJECT_ID"
echo ""

if [ -z "$BILLING_ACCOUNT_ID" ]; then
  echo "⚠️ Billing Account ID를 먼저 확인하세요:"
  echo "   gcloud billing accounts list"
  echo ""
  echo "그 다음 이 스크립트의 BILLING_ACCOUNT_ID 변수를 수정하세요."
  exit 1
fi

# 프로젝트 설정
gcloud config set project $PROJECT_ID

# 예산 생성 (월 10만원 한도)
echo "[1/2] 예산 생성 중..."
gcloud billing budgets create \
  --billing-account=$BILLING_ACCOUNT_ID \
  --display-name="QC Dashboard Monthly Budget" \
  --budget-amount=100000 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100 \
  --projects=$PROJECT_ID \
  --filter="projects.id=$PROJECT_ID" \
  --notifications-rule=pubsub-topic=projects/$PROJECT_ID/topics/budget-alerts \
  --notifications-rule=monitoring-notification-channels=projects/$PROJECT_ID/notificationChannels/CHANNEL_ID

echo ""
echo "[2/2] 예산 정보 확인..."
gcloud billing budgets list --billing-account=$BILLING_ACCOUNT_ID

echo ""
echo "✅ 예산 알림 설정 완료!"
echo ""
echo "알림 설정:"
echo "- 50% 도달 시 알림"
echo "- 90% 도달 시 알림"
echo "- 100% 도달 시 알림"
echo ""
echo "예산 확인:"
echo "  https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID"
