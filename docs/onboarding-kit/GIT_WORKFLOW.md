# KMCC QC Dashboard - Git 워크플로우 가이드

> Git을 처음 사용하거나 익숙하지 않은 분을 위한 가이드입니다.
> 이 규칙만 지키면 서로 코드가 꼬이지 않습니다.

---

## 핵심 원칙 3가지

1. **main 브랜치에 직접 push 하지 않는다** (PR로만 머지)
2. **내 브랜치에서만 작업한다**
3. **작업 전에 항상 최신 코드를 받는다**

---

## 목차

1. [최초 설정 (1회만)](#1-최초-설정-1회만)
2. [매일 작업 시작할 때](#2-매일-작업-시작할-때)
3. [작업 내용 저장하기 (커밋)](#3-작업-내용-저장하기-커밋)
4. [코드 올리기 (Push)](#4-코드-올리기-push)
5. [PR(Pull Request) 만들기](#5-prpull-request-만들기)
6. [충돌이 났을 때](#6-충돌이-났을-때)
7. [자주 쓰는 명령어 모음](#7-자주-쓰는-명령어-모음)

---

## 1. 최초 설정 (1회만)

### 내 브랜치 만들기

```bash
# 프로젝트 폴더로 이동
cd ~/Desktop/kmcc-qaqc

# 최신 코드 받기
git pull origin main

# 내 브랜치 만들기 (아래에서 본인 브랜치를 선택)
git checkout -b feature/productivity-cop    # 콥
git checkout -b feature/sla-din             # 딘
git checkout -b feature/qa-rishal           # 리샬
git checkout -b feature/qc-may             # 메이
```

### Git 사용자 설정 (한 번만)

```bash
git config user.name "본인 이름"
git config user.email "본인@이메일.com"
```

---

## 2. 매일 작업 시작할 때

```bash
# 1) 내 브랜치로 이동 (이미 있으면)
git checkout feature/productivity-cop   # 본인 브랜치명

# 2) main의 최신 변경사항을 내 브랜치에 반영
git pull origin main
```

> 이 과정을 빼먹으면 나중에 충돌이 날 수 있습니다.
> **매일 작업 시작 전에 꼭 실행하세요.**

---

## 3. 작업 내용 저장하기 (커밋)

### 현재 상태 확인

```bash
git status
```

빨간색 파일 = 수정했지만 아직 저장 안 된 파일

### 파일 추가 + 커밋

```bash
# 특정 파일만 추가 (권장)
git add lib/bigquery-sla.ts
git add components/qc/sla-dashboard/index.tsx

# 커밋 (변경 내용을 설명하는 메시지)
git commit -m "SLA 대시보드 기본 구조 생성"
```

### 커밋 메시지 작성 팁

```
좋은 예:
  "SLA 응답률 차트 추가"
  "QA 점수 계산 기준 75점으로 변경"
  "생산성 BigQuery 쿼리 작성"

나쁜 예:
  "수정"
  "작업중"
  "ㅇㅇ"
```

---

## 4. 코드 올리기 (Push)

```bash
# 내 브랜치를 원격에 올리기
git push origin feature/sla-din   # 본인 브랜치명
```

처음 push할 때는:
```bash
git push -u origin feature/sla-din
```

---

## 5. PR(Pull Request) 만들기

코드를 main에 합치고 싶을 때 PR을 만듭니다.

### GitHub 웹에서 만들기

1. https://github.com/ksy070822/kmcc-qaqc 접속
2. 상단에 "Compare & pull request" 노란 버튼 클릭
3. 제목과 설명 작성:
   ```
   제목: SLA 대시보드 v1 추가

   설명:
   - SLA 응답률, 서비스레벨, 평균대기시간 차트 추가
   - BigQuery sla_metrics 테이블 연동
   - 서비스별 필터 기능
   ```
4. "Create pull request" 클릭
5. 메이가 확인 후 승인하면 main에 합쳐집니다

### CLI에서 만들기 (gh 설치 시)

```bash
gh pr create --title "SLA 대시보드 v1 추가" --body "변경 내용 설명"
```

---

## 6. 충돌이 났을 때

`git pull origin main` 할 때 이런 메시지가 나올 수 있습니다:

```
CONFLICT (content): Merge conflict in lib/constants.ts
```

### 해결 방법

1. 충돌 파일을 열면 이런 표시가 있습니다:
```
<<<<<<< HEAD
내가 수정한 내용
=======
다른 사람이 수정한 내용
>>>>>>> origin/main
```

2. 둘 다 필요하면 합치고, `<<<<<<<`, `=======`, `>>>>>>>` 표시를 삭제합니다.

3. 저장 후 커밋:
```bash
git add 충돌파일명
git commit -m "merge conflict 해결: constants.ts"
```

### 충돌 예방법

- **내 도메인 파일만 수정한다** (가장 중요!)
- `lib/constants.ts`, `lib/types.ts` 같은 공통 파일은 메이에게 요청
- 매일 `git pull origin main`으로 최신 상태 유지

### 모르겠으면

충돌이 복잡하면 억지로 해결하지 말고 메이에게 연락하세요.
```bash
# 충돌 상태를 취소하고 원래대로 돌아가기
git merge --abort
```

---

## 7. 자주 쓰는 명령어 모음

### 매일 루틴

```bash
# 아침: 시작
git checkout feature/내브랜치
git pull origin main

# 작업 후: 저장
git add 파일명
git commit -m "변경 설명"
git push origin feature/내브랜치
```

### 상태 확인

```bash
git status              # 현재 수정된 파일 보기
git log --oneline -5    # 최근 커밋 5개 보기
git branch              # 현재 브랜치 확인 (* 표시)
git diff                # 수정 내용 미리보기
```

### 실수했을 때

```bash
# 아직 커밋 안 한 수정을 되돌리기 (특정 파일)
git checkout -- 파일명

# 마지막 커밋 메시지 수정
git commit --amend -m "새 메시지"

# push 전에 마지막 커밋 취소 (수정 내용은 유지)
git reset --soft HEAD~1
```

---

## VS Code 사용자를 위한 팁

VS Code의 왼쪽 "Source Control" 패널(분기 아이콘)에서 GUI로 모든 Git 작업을 할 수 있습니다:

1. **변경된 파일 보기**: Source Control 패널에 자동 표시
2. **스테이징**: 파일 옆 `+` 버튼
3. **커밋**: 상단 메시지 입력 후 체크 버튼
4. **Push**: 하단 상태바의 동기화 버튼 (화살표)

---

## 전체 흐름 요약

```
[내 브랜치에서 작업]
     ↓
git add + git commit (저장)
     ↓
git push (원격에 올리기)
     ↓
GitHub에서 PR 만들기
     ↓
메이가 리뷰 후 승인
     ↓
main에 머지 → Cloud Run 자동 배포
```
