#!/bin/bash

# 압축파일 적용 및 배포 스크립트
# 사용법: ./apply-and-deploy.sh [압축파일경로]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/Users/may.08/Desktop/kmcc-qc-dashbord"
TEMP_DIR="/tmp/kmcc-qc-dashbord-extract"

# 압축파일 경로 확인
if [ -z "$1" ]; then
  echo -e "${YELLOW}압축파일 경로를 입력하세요:${NC}"
  echo "예: /Users/may.08/Downloads/kmcc-qc-dashbord-fixed.tar.gz"
  read -p "압축파일 경로: " ARCHIVE_PATH
else
  ARCHIVE_PATH="$1"
fi

if [ ! -f "$ARCHIVE_PATH" ]; then
  echo -e "${RED}오류: 압축파일을 찾을 수 없습니다: $ARCHIVE_PATH${NC}"
  echo ""
  echo -e "${YELLOW}압축파일을 다음 위치 중 하나에 저장하세요:${NC}"
  echo "  - /Users/may.08/Desktop/kmcc-qc-dashbord-fixed.tar.gz"
  echo "  - /Users/may.08/Downloads/kmcc-qc-dashbord-fixed.tar.gz"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}압축파일 적용 및 배포${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "압축파일: $ARCHIVE_PATH"
echo "프로젝트 디렉토리: $PROJECT_DIR"
echo ""

# 1. 백업 생성
echo -e "${YELLOW}1. 현재 상태 백업...${NC}"
cd "$PROJECT_DIR"
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "/tmp/$BACKUP_FILE" . 2>/dev/null || true
echo -e "${GREEN}✓ 백업 생성: /tmp/$BACKUP_FILE${NC}"
echo ""

# 2. 압축 해제
echo -e "${YELLOW}2. 압축파일 해제...${NC}"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
tar -xzf "$ARCHIVE_PATH" -C "$TEMP_DIR" 2>/dev/null || {
  echo -e "${RED}✗ 압축 해제 실패${NC}"
  exit 1
}
echo -e "${GREEN}✓ 압축 해제 완료${NC}"
echo ""

# 3. 변경사항 확인
echo -e "${YELLOW}3. 변경사항 확인...${NC}"
EXTRACTED_DIR=$(find "$TEMP_DIR" -maxdepth 2 -type d -name "kmcc-qc-dashbord*" | head -1)
if [ -z "$EXTRACTED_DIR" ]; then
  EXTRACTED_DIR="$TEMP_DIR"
fi

echo "추출된 디렉토리: $EXTRACTED_DIR"
echo ""

# 수정된 파일 목록 확인
MODIFIED_FILES=$(find "$EXTRACTED_DIR" -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | head -10)
if [ -n "$MODIFIED_FILES" ]; then
  echo -e "${GREEN}수정된 파일 목록:${NC}"
  echo "$MODIFIED_FILES" | while read file; do
    echo "  - $(basename "$file")"
  done
else
  echo -e "${YELLOW}⚠ 수정된 파일을 찾을 수 없습니다${NC}"
fi
echo ""

# 4. 변경사항 적용
echo -e "${YELLOW}4. 변경사항 적용...${NC}"
read -p "변경사항을 적용하시겠습니까? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}취소되었습니다${NC}"
  exit 0
fi

# 주요 파일 복사
echo "파일 복사 중..."
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.next' \
  "$EXTRACTED_DIR/" "$PROJECT_DIR/" 2>/dev/null || {
  echo -e "${YELLOW}⚠ rsync 실패, cp로 재시도...${NC}"
  cp -r "$EXTRACTED_DIR"/* "$PROJECT_DIR/" 2>/dev/null || true
}

echo -e "${GREEN}✓ 변경사항 적용 완료${NC}"
echo ""

# 5. 변경사항 확인
echo -e "${YELLOW}5. Git 상태 확인...${NC}"
cd "$PROJECT_DIR"
git status --short | head -10
echo ""

# 6. 커밋 및 푸시
echo -e "${YELLOW}6. GitHub에 푸시...${NC}"
read -p "커밋 메시지를 입력하세요 (기본: Apply changes from archive): " COMMIT_MSG
COMMIT_MSG=${COMMIT_MSG:-"Apply changes from archive"}

git add -A
git commit -m "$COMMIT_MSG" || {
  echo -e "${YELLOW}⚠ 변경사항이 없거나 이미 커밋되어 있습니다${NC}"
}

git push origin main || {
  echo -e "${RED}✗ 푸시 실패${NC}"
  echo "수동으로 푸시하세요: git push origin main"
  exit 1
}

echo -e "${GREEN}✓ GitHub 푸시 완료${NC}"
echo ""

# 7. 배포 상태 확인
echo -e "${YELLOW}7. 배포 상태 확인...${NC}"
echo "Cloud Build가 자동으로 배포를 시작합니다."
echo ""
echo -e "${GREEN}배포 상태 확인:${NC}"
echo "  https://console.cloud.google.com/cloud-build/builds?project=csopp-25f2"
echo ""

# 8. 서비스 URL 확인
SERVICE_URL=$(gcloud run services describe qc-dashboard \
  --region=asia-northeast3 \
  --format="value(status.url)" 2>/dev/null || echo "")

if [ -n "$SERVICE_URL" ]; then
  echo -e "${GREEN}서비스 URL:${NC}"
  echo "  $SERVICE_URL"
  echo ""
  echo -e "${YELLOW}배포 완료 후 (약 5-10분) 다음 URL에서 테스트하세요:${NC}"
  echo "  $SERVICE_URL"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}다음 단계:${NC}"
echo "1. Cloud Build 빌드 완료 대기 (5-10분)"
echo "2. 서비스 URL에서 테스트"
echo "3. 상단 카드 6개 데이터 확인"
echo "4. 브라우저 콘솔에서 에러 확인"
