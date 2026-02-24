#!/bin/bash
# ===================================================
# KMCC QC Dashboard - 개발 환경 셋업 스크립트
# ===================================================
# 사용법: 프로젝트 루트에서 실행
#   chmod +x scripts/setup-dev.sh
#   ./scripts/setup-dev.sh
# ===================================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  KMCC QC Dashboard - 개발 환경 셋업${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PASS=0
FAIL=0

# --- 1. Node.js 확인 ---
echo -e "${YELLOW}[1/6] Node.js 확인...${NC}"
if command -v node &> /dev/null; then
    NODE_VER=$(node -v)
    NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo -e "  ${GREEN}OK${NC} Node.js $NODE_VER"
        ((PASS++))
    else
        echo -e "  ${RED}FAIL${NC} Node.js $NODE_VER (18 이상 필요)"
        echo "  설치: https://nodejs.org/ 에서 LTS 버전 다운로드"
        ((FAIL++))
    fi
else
    echo -e "  ${RED}FAIL${NC} Node.js가 설치되어 있지 않습니다"
    echo "  설치: https://nodejs.org/ 에서 LTS 버전 다운로드"
    ((FAIL++))
fi

# --- 2. npm 확인 ---
echo -e "${YELLOW}[2/6] npm 확인...${NC}"
if command -v npm &> /dev/null; then
    NPM_VER=$(npm -v)
    echo -e "  ${GREEN}OK${NC} npm $NPM_VER"
    ((PASS++))
else
    echo -e "  ${RED}FAIL${NC} npm이 없습니다 (Node.js 설치 시 함께 설치됩니다)"
    ((FAIL++))
fi

# --- 3. gcloud CLI 확인 ---
echo -e "${YELLOW}[3/6] Google Cloud CLI 확인...${NC}"
if command -v gcloud &> /dev/null; then
    GCLOUD_VER=$(gcloud version 2>/dev/null | head -1 | awk '{print $4}')
    echo -e "  ${GREEN}OK${NC} gcloud CLI $GCLOUD_VER"
    ((PASS++))

    # 로그인 상태 확인
    GCLOUD_ACCOUNT=$(gcloud config get-value account 2>/dev/null)
    if [ -n "$GCLOUD_ACCOUNT" ] && [ "$GCLOUD_ACCOUNT" != "(unset)" ]; then
        echo -e "  ${GREEN}OK${NC} 로그인됨: $GCLOUD_ACCOUNT"
    else
        echo -e "  ${YELLOW}WARNING${NC} gcloud 로그인이 필요합니다"
        echo "  실행: gcloud auth login"
    fi

    # 프로젝트 확인
    GCLOUD_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [ "$GCLOUD_PROJECT" = "csopp-25f2" ]; then
        echo -e "  ${GREEN}OK${NC} 프로젝트: $GCLOUD_PROJECT"
    else
        echo -e "  ${YELLOW}WARNING${NC} 프로젝트가 csopp-25f2가 아닙니다 (현재: $GCLOUD_PROJECT)"
        echo "  실행: gcloud config set project csopp-25f2"
    fi
else
    echo -e "  ${RED}FAIL${NC} gcloud CLI가 설치되어 있지 않습니다"
    echo "  설치: https://cloud.google.com/sdk/docs/install"
    ((FAIL++))
fi

# --- 4. ADC (Application Default Credentials) 확인 ---
echo -e "${YELLOW}[4/6] BigQuery 인증 (ADC) 확인...${NC}"
ADC_FILE="$HOME/.config/gcloud/application_default_credentials.json"
if [ -f "$ADC_FILE" ]; then
    echo -e "  ${GREEN}OK${NC} ADC 파일 존재"
    ((PASS++))
else
    echo -e "  ${YELLOW}WARNING${NC} ADC가 설정되어 있지 않습니다"
    echo "  실행: gcloud auth application-default login"
    echo "  (브라우저가 열리면 회사 계정으로 로그인하세요)"
fi

# --- 5. .env.local 확인 ---
echo -e "${YELLOW}[5/6] 환경변수 파일 확인...${NC}"
if [ -f ".env.local" ]; then
    echo -e "  ${GREEN}OK${NC} .env.local 파일 존재"
    ((PASS++))
else
    if [ -f ".env.template" ]; then
        echo -e "  ${YELLOW}INFO${NC} .env.template을 .env.local로 복사합니다..."
        cp .env.template .env.local
        echo -e "  ${GREEN}OK${NC} .env.local 생성 완료"
        echo -e "  ${YELLOW}TODO${NC} .env.local을 열어서 GOOGLE_SHEETS_ID 등을 채워주세요"
        echo "  (값은 메이에게 문의하세요)"
        ((PASS++))
    else
        echo -e "  ${RED}FAIL${NC} .env.template 파일이 없습니다"
        ((FAIL++))
    fi
fi

# --- 6. npm 패키지 설치 ---
echo -e "${YELLOW}[6/6] npm 패키지 설치...${NC}"
if [ -d "node_modules" ]; then
    echo -e "  ${GREEN}OK${NC} node_modules 존재 (이미 설치됨)"
    ((PASS++))
else
    if command -v npm &> /dev/null; then
        echo "  패키지 설치 중... (1-2분 소요)"
        npm install --silent 2>/dev/null
        if [ $? -eq 0 ]; then
            echo -e "  ${GREEN}OK${NC} 패키지 설치 완료"
            ((PASS++))
        else
            echo -e "  ${RED}FAIL${NC} npm install 실패"
            ((FAIL++))
        fi
    else
        echo -e "  ${RED}SKIP${NC} npm이 없어서 건너뜁니다"
    fi
fi

# --- 결과 요약 ---
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  셋업 결과${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "  ${GREEN}성공: ${PASS}개${NC}  ${RED}실패: ${FAIL}개${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}모든 준비가 완료되었습니다!${NC}"
    echo ""
    echo "다음 단계:"
    echo "  1. npm run dev        # 로컬 서버 시작 (http://localhost:3000)"
    echo "  2. 브라우저에서 확인"
    echo ""
else
    echo -e "${YELLOW}위의 FAIL 항목을 해결한 뒤 다시 실행하세요.${NC}"
    echo ""
fi
