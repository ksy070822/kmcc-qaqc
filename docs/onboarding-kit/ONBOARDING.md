# KMCC QC Dashboard - 온보딩 가이드

> 처음 이 프로젝트에 참여하는 동료를 위한 단계별 환경설정 가이드입니다.
> 막히는 부분이 있으면 메이에게 문의하세요.

---

## 목차

1. [사전 준비물](#1-사전-준비물)
2. [코드 받기 (Git Clone)](#2-코드-받기-git-clone)
3. [Google Cloud 인증](#3-google-cloud-인증)
4. [환경변수 설정](#4-환경변수-설정)
5. [패키지 설치 및 실행](#5-패키지-설치-및-실행)
6. [자동 셋업 스크립트](#6-자동-셋업-스크립트-선택사항)
7. [자주 묻는 질문](#7-자주-묻는-질문)

---

## 0. 터미널 여는 법 (처음이라면 여기부터!)

터미널은 컴퓨터에게 명령어를 입력하는 검은 화면입니다. 아래 중 하나를 사용하면 됩니다.

### 방법 1: Mac 터미널 (기본 앱)

1. **Cmd + Space** (Spotlight 검색) → "터미널" 입력 → Enter
2. 검은 화면이 뜨면 성공!

### 방법 2: VS Code 내장 터미널 (권장)

1. VS Code 실행 → 상단 메뉴 **Terminal** → **New Terminal**
2. 또는 단축키: **Ctrl + `** (백틱)
3. 하단에 터미널 창이 열립니다

### 방법 3: Cursor 내장 터미널

1. Cursor 실행 → 상단 메뉴 **Terminal** → **New Terminal**
2. 또는 단축키: **Ctrl + `** (백틱)
3. VS Code와 동일한 방식입니다

> 터미널이 열렸으면 아래 명령어를 **복사(Cmd+C) → 붙여넣기(Cmd+V) → Enter** 하면 됩니다.
> 한 줄씩 실행하세요.

---

## 1. 사전 준비물

| 도구 | 버전 | 설치 방법 |
|------|------|-----------|
| **Node.js** | 18 이상 | https://nodejs.org/ → LTS 버전 다운로드 |
| **Git** | 최신 | Mac: `xcode-select --install` / Windows: https://git-scm.com/ |
| **Google Cloud CLI** | 최신 | https://cloud.google.com/sdk/docs/install |
| **VS Code** (권장) | 최신 | https://code.visualstudio.com/ |

### 설치 확인

터미널에서 아래 명령어를 **한 줄씩** 실행하세요:

```bash
node -v      # v18.x.x 이상이면 OK
npm -v       # 9.x.x 이상이면 OK
git --version
gcloud --version
```

---

## 2. 코드 받기 (Git Clone)

```bash
# 원하는 폴더로 이동
cd ~/Desktop

# 코드 받기
git clone https://github.kakaocorp.com/csopp/komi.git

# 프로젝트 폴더로 이동
cd komi
```

> GitHub 접근 권한이 없다면 메이에게 GitHub 아이디를 알려주세요.
> Collaborator로 초대해 드립니다.

---

## 3. Google Cloud 인증

BigQuery 데이터에 접근하려면 GCP 인증이 필요합니다.

### 3-1. gcloud 로그인

```bash
# Google 계정으로 로그인 (브라우저가 열립니다)
gcloud auth login
```

### 3-2. 프로젝트 설정

```bash
gcloud config set project csopp-25f2
```

### 3-3. Application Default Credentials (ADC) 설정

```bash
# 이 명령어로 로컬에서 BigQuery에 접근할 수 있습니다
gcloud auth application-default login
```

브라우저가 열리면 **회사 Google 계정**으로 로그인하세요.

### 필요한 GCP 권한

메이가 아래 권한을 부여합니다. 본인이 직접 설정할 필요 없습니다.

| 권한 | 역할 | 용도 |
|------|------|------|
| BigQuery 데이터 뷰어 | `roles/bigquery.dataViewer` | 테이블 조회 |
| BigQuery 작업 사용자 | `roles/bigquery.jobUser` | 쿼리 실행 |
| BigQuery 데이터 편집자 | `roles/bigquery.dataEditor` | 뷰 생성, 데이터 수정 (필요 시) |

---

## 4. 환경변수 설정

```bash
# 템플릿을 복사해서 .env.local 파일 생성
cp .env.template .env.local
```

`.env.local` 파일을 열어서 아래 값을 채워주세요:

```
GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o
```

> 대부분의 값은 이미 채워져 있습니다.
> `GOOGLE_SHEETS_ID`는 메이에게 확인하세요.
> AI 기능(챗봇)을 쓰려면 `GOOGLE_AI_API_KEY`도 필요합니다.

**주의: `.env.local` 파일은 절대 Git에 커밋하지 마세요!**

---

## 5. 패키지 설치 및 실행

```bash
# 패키지 설치 (최초 1회, 1-2분 소요)
npm install

# 로컬 개발 서버 시작
npm run dev
```

브라우저에서 http://localhost:3000 접속하면 대시보드가 보입니다.

### 한 줄로 끝내기 (클론부터 서버 실행까지)

데스크탑에 클론하는 경우, 터미널에 아래 한 줄을 붙여넣으세요:

```bash
cd ~/Desktop && git clone https://github.kakaocorp.com/csopp/komi.git && cd komi && chmod +x scripts/setup-dev.sh && ./scripts/setup-dev.sh
```

셋업 완료 후 서버 실행:

```bash
cd ~/Desktop/komi && npm run dev
```

### VS Code / Cursor에서 실행하기

1. VS Code(또는 Cursor) 실행
2. **File** → **Open Folder** → `Desktop/komi` 폴더 선택
3. **Terminal** → **New Terminal** (또는 Ctrl + `)
4. 터미널에 입력:
   ```bash
   npm run dev
   ```
5. 브라우저에서 http://localhost:3000 접속

> 서버를 끄려면 터미널에서 **Ctrl + C**

### 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 로컬 개발 서버 (코드 수정 시 자동 반영) |
| `npm run build -- --webpack` | 프로덕션 빌드 (배포 전 테스트용) |
| `npm run lint` | 코드 문법 검사 |

---

## 6. 자동 셋업 스크립트 (선택사항)

위 과정이 복잡하다면, 한 번에 확인해주는 스크립트가 있습니다:

```bash
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh
```

이 스크립트가 Node.js, gcloud, ADC, .env.local, npm 패키지를 모두 확인하고
빠진 것이 있으면 알려줍니다.

---

## 7. 자주 묻는 질문

### Q. `npm run dev`를 했는데 에러가 나요

**BigQuery 연결 에러인 경우:**
```
Error: Could not load the default credentials
```
→ `gcloud auth application-default login`을 다시 실행하세요.

**포트 충돌인 경우:**
```
Port 3000 is already in use
```
→ 다른 터미널에서 이미 서버가 실행 중입니다. 종료하거나 다른 포트를 사용하세요:
```bash
npm run dev -- --port 3001
```

### Q. BigQuery 쿼리가 권한 오류로 실패해요

```
Access Denied: ... User does not have bigquery.jobs.create permission
```
→ 메이에게 GCP 권한 추가를 요청하세요. (BigQuery Job User 역할)

### Q. Git push가 안 돼요

```
remote: Permission to csopp/komi.git denied
```
→ 메이에게 GitHub Collaborator 초대를 요청하세요.

### Q. 코드를 수정했는데 다른 사람 코드와 충돌이 났어요

→ [GIT_WORKFLOW.md](./GIT_WORKFLOW.md)의 "충돌 해결" 섹션을 참고하세요.

---

## 다음 단계

환경 설정이 완료되었다면:

1. **[DOMAIN_GUIDE.md](./DOMAIN_GUIDE.md)** — 내가 담당하는 영역과 수정할 파일 확인
2. **[GIT_WORKFLOW.md](./GIT_WORKFLOW.md)** — 브랜치 만들기, 커밋, PR 올리는 방법
