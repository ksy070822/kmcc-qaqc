# 🚀 즉시 배포 가이드

## 현재 상황
- ✅ 코드 수정 완료 (로컬)
- ⚠️ Cloud Run 배포 필요 (프로덕션 반영)

## 배포 방법

### 방법 1: GitHub 푸시 후 자동 배포 (권장)

```bash
# 1. 변경사항 커밋
git add lib/bigquery.ts app/api/sync-sheets/route.ts lib/google-sheets.ts
git commit -m "fix: 대시보드 오류 수정 (hire_date, target_name, getDashboardStats)"

# 2. GitHub에 푸시
git push origin main
```

GitHub에 푸시하면 Cloud Build 트리거가 자동으로 배포를 시작합니다.

### 방법 2: Cloud Build 직접 실행 (조직 정책 제약 있을 수 있음)

```bash
# 프로젝트 설정
gcloud config set project csopp-25f2

# Cloud Build 제출 (서울 리전)
gcloud builds submit --config cloudbuild.yaml --region=asia-northeast3 .
```

### 방법 3: 로컬 Docker 빌드 (Docker 설치 필요)

```bash
# Docker 설치 후
./deploy-local-docker.sh
```

## 수정된 파일 목록

1. **lib/bigquery.ts**
   - `getDashboardStats`: 최근 30일 데이터 조회로 변경
   - `getAgents`: `hire_date` 사용 제거, `tenure_months` 0으로 설정
   - `getGoals`: 실제 테이블 스키마에 맞게 수정
   - `saveEvaluationsToBigQuery`: `tenure_group` 제거

2. **app/api/sync-sheets/route.ts** (신규)
   - Google Sheets 동기화 API

3. **lib/google-sheets.ts** (신규)
   - Google Sheets API 연동 함수

## 배포 후 확인

배포가 완료되면 다음 URL에서 확인:
- 서비스 URL: `https://qc-dashboard-wlof52lhea-du.a.run.app`

### 테스트
```bash
# 대시보드 데이터 확인
curl "https://qc-dashboard-wlof52lhea-du.a.run.app/api/data?type=dashboard"

# 상담사 목록 확인
curl "https://qc-dashboard-wlof52lhea-du.a.run.app/api/data?type=agents"
```

## 예상 결과

배포 후:
- ✅ 대시보드 값 정상 표시
- ✅ `hire_date` 오류 해결
- ✅ `target_name` 오류 해결
- ⚠️ 근속기간은 0으로 표시 (향후 Google Sheets에서 데이터 가져와서 저장 필요)
