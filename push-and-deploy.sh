#!/bin/bash

# GitHub 푸시 스크립트 (자동 배포)
# GitHub에 푸시하면 Cloud Build 트리거가 자동으로 배포를 시작합니다.
# 사용법: ./push-and-deploy.sh

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GitHub 푸시 (자동 배포)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}이 스크립트는 GitHub에 푸시합니다.${NC}"
echo -e "${YELLOW}푸시 후 Cloud Build 트리거가 자동으로 배포를 시작합니다.${NC}"
echo ""

# 현재 상태 확인
echo -e "${YELLOW}1. 현재 Git 상태 확인...${NC}"
git status
echo ""

# 원격 변경사항 가져오기
echo -e "${YELLOW}2. 원격 저장소에서 변경사항 가져오기...${NC}"

# 병합 전략 설정 (diverged 브랜치 처리)
if ! git config pull.rebase > /dev/null 2>&1; then
    echo -e "${YELLOW}병합 전략 설정 중...${NC}"
    git config pull.rebase false || echo -e "${YELLOW}⚠ 전역 설정 사용${NC}"
fi

if git pull origin main --no-edit; then
    echo -e "${GREEN}✓ 원격 변경사항 병합 완료${NC}"
else
    echo -e "${RED}⚠ 원격 변경사항 가져오기 실패${NC}"
    echo -e "${YELLOW}다음 명령어를 수동으로 실행하세요:${NC}"
    echo "  git pull origin main --no-rebase --no-edit"
    echo ""
    read -p "계속 진행하시겠습니까? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo ""

# GitHub에 푸시
echo -e "${YELLOW}3. GitHub에 푸시...${NC}"
if git push origin main; then
    echo -e "${GREEN}✓ GitHub 푸시 완료${NC}"
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ 푸시 완료!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Cloud Build 트리거가 자동으로 배포를 시작합니다.${NC}"
    echo ""
    echo -e "${BLUE}빌드 상태 확인:${NC}"
    echo "  https://console.cloud.google.com/cloud-build/builds?project=csopp-25f2"
    echo ""
    echo -e "${BLUE}Cloud Run 서비스 확인:${NC}"
    echo "  https://console.cloud.google.com/run?project=csopp-25f2"
    echo ""
else
    echo -e "${RED}✗ GitHub 푸시 실패${NC}"
    echo -e "${YELLOW}네트워크 연결을 확인하고 다시 시도하세요.${NC}"
    exit 1
fi
