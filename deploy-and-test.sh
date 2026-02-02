#!/bin/bash

# 배포 및 테스트 스크립트
# 사용법: ./deploy-and-test.sh

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ID="csopp-25f2"
REGION="asia-northeast3"
SERVICE_NAME="qc-dashboard"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}배포 및 테스트${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 현재 Git 상태 확인
echo -e "${YELLOW}1. 현재 Git 상태 확인...${NC}"
cd /Users/may.08/Desktop/kmcc-qc-dashbord
CURRENT_BRANCH=$(git branch --show-current)
LAST_COMMIT=$(git log -1 --oneline)
echo -e "${GREEN}현재 브랜치: ${CURRENT_BRANCH}${NC}"
echo -e "${GREEN}최근 커밋: ${LAST_COMMIT}${NC}"
echo ""

# 2. GitHub에 푸시 확인
echo -e "${YELLOW}2. GitHub 푸시 상태 확인...${NC}"
LOCAL_COMMITS=$(git rev-list HEAD --not origin/main --count 2>/dev/null || echo "0")
if [ "$LOCAL_COMMITS" -gt 0 ]; then
    echo -e "${YELLOW}⚠ 로컬에 푸시되지 않은 커밋이 ${LOCAL_COMMITS}개 있습니다${NC}"
    echo -e "${YELLOW}GitHub에 푸시하시겠습니까? (y/n)${NC}"
    read -p "> " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push origin main
        echo -e "${GREEN}✓ 푸시 완료${NC}"
    fi
else
    echo -e "${GREEN}✓ 모든 커밋이 GitHub에 푸시되어 있습니다${NC}"
fi
echo ""

# 3. Cloud Build 빌드 상태 확인
echo -e "${YELLOW}3. Cloud Build 빌드 상태 확인...${NC}"
echo "빌드 상태 확인: https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
echo ""

# 4. Cloud Run 서비스 URL 확인
echo -e "${YELLOW}4. Cloud Run 서비스 URL 확인...${NC}"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format="value(status.url)" 2>/dev/null || echo "")

if [ -n "$SERVICE_URL" ] && [ "$SERVICE_URL" != "" ]; then
    echo -e "${GREEN}✓ 서비스 URL: ${SERVICE_URL}${NC}"
else
    echo -e "${YELLOW}⚠ 서비스 URL을 자동으로 찾을 수 없습니다${NC}"
    echo -e "${YELLOW}Cloud Console에서 서비스 URL을 확인하거나 직접 입력하세요:${NC}"
    echo "  https://console.cloud.google.com/run?project=$PROJECT_ID"
    echo ""
    read -p "서비스 URL을 입력하세요 (또는 Enter로 건너뛰기): " SERVICE_URL
    if [ -z "$SERVICE_URL" ]; then
        echo -e "${YELLOW}서비스 URL이 없어 API 테스트를 건너뜁니다${NC}"
        SKIP_API_TEST=true
    fi
fi
echo ""

# 5. API 테스트
if [ "$SKIP_API_TEST" = "true" ]; then
    echo -e "${YELLOW}5. API 테스트 건너뜀 (서비스 URL 없음)${NC}"
    echo ""
else
    echo -e "${YELLOW}5. API 엔드포인트 테스트...${NC}"

# Dashboard API 테스트
echo -n "  - Dashboard API: "
API_URL="${SERVICE_URL}/api/data?type=dashboard"
HTTP_CODE=$(curl -s -o /tmp/dashboard_response.json -w "%{http_code}" --max-time 10 "$API_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ 응답 코드: $HTTP_CODE${NC}"
    
    # API 응답 내용 확인
    if [ -f /tmp/dashboard_response.json ]; then
        if grep -q '"success":true' /tmp/dashboard_response.json; then
            echo -e "    ${GREEN}✓ API 응답 성공${NC}"
            
            # 데이터 필드 확인
            echo -n "    - 데이터 필드 확인: "
            if grep -q '"totalAgentsYongsan"' /tmp/dashboard_response.json && \
               grep -q '"totalAgentsGwangju"' /tmp/dashboard_response.json && \
               grep -q '"totalEvaluations"' /tmp/dashboard_response.json; then
                echo -e "${GREEN}✓ 필수 필드 존재${NC}"
                
                # 실제 데이터 값 확인
                TOTAL_AGENTS=$(grep -o '"totalAgentsYongsan":[0-9]*' /tmp/dashboard_response.json | grep -o '[0-9]*' || echo "0")
                TOTAL_EVALS=$(grep -o '"totalEvaluations":[0-9]*' /tmp/dashboard_response.json | grep -o '[0-9]*' || echo "0")
                echo "      총 상담사 (용산): $TOTAL_AGENTS"
                echo "      평가건수: $TOTAL_EVALS"
            else
                echo -e "${YELLOW}⚠ 필수 필드 없음${NC}"
            fi
        else
            echo -e "    ${YELLOW}⚠ API 응답 실패${NC}"
            echo "    응답 내용:"
            head -5 /tmp/dashboard_response.json | sed 's/^/      /'
        fi
    fi
else
    echo -e "${RED}✗ 응답 코드: $HTTP_CODE${NC}"
fi

# Centers API 테스트
echo -n "  - Centers API: "
CENTERS_URL="${SERVICE_URL}/api/data?type=centers"
CENTERS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$CENTERS_URL" 2>/dev/null || echo "000")
if [ "$CENTERS_CODE" = "200" ]; then
    echo -e "${GREEN}✓ 응답 코드: $CENTERS_CODE${NC}"
else
    echo -e "${RED}✗ 응답 코드: $CENTERS_CODE${NC}"
fi

# Trend API 테스트
echo -n "  - Trend API: "
TREND_URL="${SERVICE_URL}/api/data?type=trend"
TREND_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$TREND_URL" 2>/dev/null || echo "000")
if [ "$TREND_CODE" = "200" ]; then
    echo -e "${GREEN}✓ 응답 코드: $TREND_CODE${NC}"
else
    echo -e "${RED}✗ 응답 코드: $TREND_CODE${NC}"
fi
echo ""
fi

# 6. 브라우저 테스트 안내
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}테스트 결과 요약${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}서비스 URL:${NC}"
echo "  $SERVICE_URL"
echo ""
echo -e "${GREEN}브라우저에서 테스트:${NC}"
echo "  1. 위 URL을 브라우저에서 열기"
echo "  2. 대시보드가 정상적으로 로드되는지 확인"
echo "  3. 상단 카드 6개에 데이터가 표시되는지 확인:"
echo "     - 총 상담사"
echo "     - 전일 평가건수"
echo "     - 유의상담사"
echo "     - 상담태도 오류율"
echo "     - 오상담/오처리 오류율"
echo "     - 전체 오류율"
echo "  4. 브라우저 개발자 도구(F12) → Console 탭에서 에러 확인"
echo "     - React 에러 #418이 없는지 확인"
echo "     - 데이터 로드 오류가 없는지 확인"
echo ""
echo -e "${GREEN}빌드 상태:${NC}"
echo "  https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
echo ""
echo -e "${GREEN}서비스 로그:${NC}"
echo "  https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/logs?project=$PROJECT_ID"
echo ""

# 임시 파일 정리
rm -f /tmp/dashboard_response.json
