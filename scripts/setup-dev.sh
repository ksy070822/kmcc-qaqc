#!/bin/bash
# ===================================================
# KMCC QC Dashboard - 개발 환경 자동 설치 스크립트
# ===================================================
# 사용법: 프로젝트 루트에서 실행
#   chmod +x scripts/setup-dev.sh
#   ./scripts/setup-dev.sh
#
# 없는 도구는 자동으로 설치합니다 (Mac 전용)
# ===================================================

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  KMCC QC Dashboard - 개발 환경 셋업${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Mac 확인
if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${RED}이 스크립트는 Mac 전용입니다.${NC}"
    echo "Windows는 ONBOARDING.md를 참고해서 수동 설치하세요."
    exit 1
fi

ask_install() {
    local tool_name=$1
    echo ""
    read -p "  $tool_name을(를) 설치할까요? (Y/n): " answer
    answer=${answer:-Y}
    if [[ "$answer" =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

# ===================================================
# 1. Homebrew (패키지 관리자)
# ===================================================
echo -e "${YELLOW}[1/7] Homebrew 확인...${NC}"
if command -v brew &> /dev/null; then
    echo -e "  ${GREEN}OK${NC} Homebrew $(brew --version | head -1 | awk '{print $2}')"
else
    echo -e "  ${YELLOW}없음${NC} Homebrew가 설치되어 있지 않습니다"
    echo "  Homebrew는 Mac용 패키지 관리자입니다. 다른 도구 설치에 필요합니다."
    if ask_install "Homebrew"; then
        echo "  설치 중... (비밀번호를 묻습니다)"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        # Apple Silicon Mac 경로 추가
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
        echo -e "  ${GREEN}OK${NC} Homebrew 설치 완료"
    else
        echo -e "  ${YELLOW}건너뜀${NC}"
    fi
fi

# ===================================================
# 2. Git
# ===================================================
echo -e "${YELLOW}[2/7] Git 확인...${NC}"
if command -v git &> /dev/null; then
    echo -e "  ${GREEN}OK${NC} Git $(git --version | awk '{print $3}')"
else
    echo -e "  ${YELLOW}없음${NC} Git이 설치되어 있지 않습니다"
    if ask_install "Git (Xcode Command Line Tools)"; then
        xcode-select --install 2>/dev/null
        echo "  팝업 창에서 '설치'를 눌러주세요. 설치 후 이 스크립트를 다시 실행하세요."
        exit 0
    fi
fi

# ===================================================
# 3. Node.js
# ===================================================
echo -e "${YELLOW}[3/7] Node.js 확인...${NC}"
NEED_NODE=false
if command -v node &> /dev/null; then
    NODE_VER=$(node -v)
    NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo -e "  ${GREEN}OK${NC} Node.js $NODE_VER"
    else
        echo -e "  ${YELLOW}업그레이드 필요${NC} Node.js $NODE_VER → 18 이상 필요"
        NEED_NODE=true
    fi
else
    echo -e "  ${YELLOW}없음${NC} Node.js가 설치되어 있지 않습니다"
    NEED_NODE=true
fi

if [ "$NEED_NODE" = true ]; then
    if ask_install "Node.js 22 LTS"; then
        if command -v brew &> /dev/null; then
            echo "  Homebrew로 설치 중..."
            brew install node@22
            brew link --overwrite node@22 2>/dev/null
            echo -e "  ${GREEN}OK${NC} Node.js $(node -v) 설치 완료"
        else
            echo -e "  ${RED}Homebrew가 없어서 자동 설치가 불가합니다${NC}"
            echo "  https://nodejs.org/ 에서 직접 다운로드하세요"
        fi
    fi
fi

# ===================================================
# 4. Google Cloud CLI
# ===================================================
echo -e "${YELLOW}[4/7] Google Cloud CLI 확인...${NC}"
if command -v gcloud &> /dev/null; then
    GCLOUD_VER=$(gcloud version 2>/dev/null | head -1 | awk '{print $4}')
    echo -e "  ${GREEN}OK${NC} gcloud CLI $GCLOUD_VER"
else
    echo -e "  ${YELLOW}없음${NC} gcloud CLI가 설치되어 있지 않습니다"
    echo "  BigQuery 데이터에 접근하려면 필요합니다."
    if ask_install "Google Cloud CLI"; then
        if command -v brew &> /dev/null; then
            echo "  Homebrew로 설치 중... (1-2분 소요)"
            brew install --cask google-cloud-sdk
            # 쉘 경로 추가
            if [[ -f "$(brew --prefix)/share/google-cloud-sdk/path.bash.inc" ]]; then
                source "$(brew --prefix)/share/google-cloud-sdk/path.bash.inc"
            fi
            echo -e "  ${GREEN}OK${NC} gcloud CLI 설치 완료"
        else
            echo -e "  ${RED}Homebrew가 없어서 자동 설치가 불가합니다${NC}"
            echo "  https://cloud.google.com/sdk/docs/install 에서 직접 다운로드하세요"
        fi
    fi
fi

# ===================================================
# 5. gcloud 로그인 + ADC 인증
# ===================================================
echo -e "${YELLOW}[5/7] GCP 인증 확인...${NC}"
if command -v gcloud &> /dev/null; then
    # 로그인 확인
    GCLOUD_ACCOUNT=$(gcloud config get-value account 2>/dev/null)
    if [ -n "$GCLOUD_ACCOUNT" ] && [ "$GCLOUD_ACCOUNT" != "(unset)" ]; then
        echo -e "  ${GREEN}OK${NC} 로그인됨: $GCLOUD_ACCOUNT"
    else
        echo -e "  ${YELLOW}로그인 필요${NC}"
        read -p "  지금 gcloud 로그인을 할까요? (Y/n): " answer
        answer=${answer:-Y}
        if [[ "$answer" =~ ^[Yy]$ ]]; then
            gcloud auth login
            echo -e "  ${GREEN}OK${NC} 로그인 완료"
        fi
    fi

    # 프로젝트 설정
    GCLOUD_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [ "$GCLOUD_PROJECT" = "csopp-25f2" ]; then
        echo -e "  ${GREEN}OK${NC} 프로젝트: csopp-25f2"
    else
        echo "  프로젝트를 csopp-25f2로 설정합니다..."
        gcloud config set project csopp-25f2
        echo -e "  ${GREEN}OK${NC} 프로젝트 설정 완료"
    fi

    # ADC 확인
    ADC_FILE="$HOME/.config/gcloud/application_default_credentials.json"
    if [ -f "$ADC_FILE" ]; then
        echo -e "  ${GREEN}OK${NC} ADC 인증 완료"
    else
        echo -e "  ${YELLOW}ADC 인증 필요${NC} (BigQuery 접근용)"
        read -p "  지금 ADC 인증을 할까요? (Y/n): " answer
        answer=${answer:-Y}
        if [[ "$answer" =~ ^[Yy]$ ]]; then
            gcloud auth application-default login
            echo -e "  ${GREEN}OK${NC} ADC 인증 완료"
        fi
    fi
else
    echo -e "  ${YELLOW}건너뜀${NC} gcloud CLI가 없어서 인증을 진행할 수 없습니다"
fi

# ===================================================
# 6. 환경변수 파일
# ===================================================
echo -e "${YELLOW}[6/7] 환경변수 파일 확인...${NC}"
if [ -f ".env.local" ]; then
    echo -e "  ${GREEN}OK${NC} .env.local 파일 존재"
else
    if [ -f ".env.template" ]; then
        echo "  .env.template → .env.local 복사 중..."
        cp .env.template .env.local
        echo -e "  ${GREEN}OK${NC} .env.local 생성 완료"
        echo -e "  ${YELLOW}TODO${NC} .env.local을 열어서 GOOGLE_SHEETS_ID를 채워주세요"
        echo "  (값은 메이에게 문의)"
    else
        echo -e "  ${RED}FAIL${NC} .env.template 파일이 없습니다"
    fi
fi

# ===================================================
# 7. npm 패키지 설치
# ===================================================
echo -e "${YELLOW}[7/7] npm 패키지 설치...${NC}"
if [ -d "node_modules" ]; then
    echo -e "  ${GREEN}OK${NC} node_modules 존재 (이미 설치됨)"
else
    if command -v npm &> /dev/null; then
        echo "  패키지 설치 중... (1-2분 소요)"
        npm install 2>&1 | tail -3
        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            echo -e "  ${GREEN}OK${NC} 패키지 설치 완료"
        else
            echo -e "  ${RED}FAIL${NC} npm install 실패. 위의 에러 메시지를 확인하세요."
        fi
    else
        echo -e "  ${YELLOW}건너뜀${NC} npm이 없습니다. Node.js를 먼저 설치하세요."
    fi
fi

# ===================================================
# 결과 요약
# ===================================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  셋업 완료!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 최종 상태 확인
ALL_OK=true
command -v node &> /dev/null || ALL_OK=false
command -v npm &> /dev/null || ALL_OK=false
command -v gcloud &> /dev/null || ALL_OK=false
[ -f ".env.local" ] || ALL_OK=false
[ -d "node_modules" ] || ALL_OK=false

if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}모든 준비가 완료되었습니다!${NC}"
    echo ""
    echo "  다음 명령어로 대시보드를 실행하세요:"
    echo ""
    echo -e "  ${BLUE}npm run dev${NC}"
    echo ""
    echo "  브라우저에서 http://localhost:3000 접속"
    echo ""
else
    echo -e "${YELLOW}일부 항목이 설치되지 않았습니다.${NC}"
    echo "  스크립트를 다시 실행하거나, ONBOARDING.md를 참고하세요."
    echo ""
fi
