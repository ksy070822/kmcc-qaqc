# Cloud Scheduler 설정 가이드

Google Sheets 데이터를 매일 저녁 8시에 자동으로 BigQuery에 동기화하는 Cloud Scheduler 설정 방법입니다.

## 📋 사전 준비

1. **Cloud Scheduler API 활성화**
```bash
gcloud services enable cloudscheduler.googleapis.com
```

2. **서비스 계정 권한 확인**
   - Cloud Scheduler가 Cloud Run 서비스를 호출할 수 있도록 권한이 필요합니다.
   - Cloud Run 서비스에 `cloudscheduler.serviceAgent` 역할이 있어야 합니다.

## 🚀 Cloud Scheduler 작업 생성

### 방법 1: gcloud CLI 사용

```bash
# 프로젝트 설정
export PROJECT_ID="splyquizkm"
export REGION="asia-northeast3"
export SERVICE_NAME="qc-dashboard"
export SERVICE_URL="https://qc-dashboard-wlof52lhea-du.a.run.app"

# Cloud Scheduler 작업 생성 (매일 저녁 8시 KST = 오전 11시 UTC)
gcloud scheduler jobs create http sync-sheets-daily \
  --location=${REGION} \
  --schedule="0 11 * * *" \
  --uri="${SERVICE_URL}/api/sync-sheets" \
  --http-method=POST \
  --time-zone="Asia/Seoul" \
  --description="매일 저녁 8시 Google Sheets 데이터를 BigQuery에 동기화" \
  --headers="Content-Type=application/json" \
  --oidc-service-account-email="${PROJECT_ID}@appspot.gserviceaccount.com"
```

### 방법 2: GCP 콘솔 사용

1. [Cloud Scheduler 콘솔](https://console.cloud.google.com/cloudscheduler) 접속
2. "작업 만들기" 클릭
3. 다음 정보 입력:
   - **이름**: `sync-sheets-daily`
   - **설명**: `매일 저녁 8시 Google Sheets 데이터를 BigQuery에 동기화`
   - **지역**: `asia-northeast3`
   - **빈도**: `0 11 * * *` (매일 오전 11시 UTC = 저녁 8시 KST)
   - **타임존**: `Asia/Seoul`
   - **대상 유형**: `HTTP`
   - **URL**: `https://qc-dashboard-wlof52lhea-du.a.run.app/api/sync-sheets`
   - **HTTP 메서드**: `POST`
   - **헤더**: `Content-Type: application/json`
   - **인증**: `OIDC 토큰 추가` (서비스 계정 선택)

## ⚙️ 환경 변수 설정

Cloud Run 서비스에 다음 환경 변수가 설정되어 있어야 합니다:

```bash
GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o
BIGQUERY_PROJECT_ID=splyquizkm
BIGQUERY_DATASET_ID=KMCC_QC
BIGQUERY_CREDENTIALS={서비스 계정 JSON}
```

## 🔍 작업 확인

### 작업 목록 확인
```bash
gcloud scheduler jobs list --location=asia-northeast3
```

### 작업 상세 정보 확인
```bash
gcloud scheduler jobs describe sync-sheets-daily --location=asia-northeast3
```

### 수동 실행 (테스트)
```bash
gcloud scheduler jobs run sync-sheets-daily --location=asia-northeast3
```

### 실행 이력 확인
```bash
# Cloud Scheduler 실행 로그 확인
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=sync-sheets-daily" --limit=10

# Cloud Run 실행 로그 확인
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=qc-dashboard" --limit=10
```

## 📝 스케줄 표현식 (Cron)

- `0 11 * * *`: 매일 오전 11시 UTC (저녁 8시 KST)
- `0 20 * * *`: 매일 오후 8시 UTC (다음날 오전 5시 KST)
- `0 */6 * * *`: 6시간마다
- `0 0 * * 1`: 매주 월요일 자정

## 🔐 인증 설정

Cloud Scheduler가 Cloud Run 서비스를 호출할 때 인증이 필요합니다:

1. **OIDC 토큰 사용 (권장)**
   - Cloud Scheduler가 자동으로 OIDC 토큰을 생성하여 요청에 포함
   - Cloud Run 서비스에서 토큰 검증 필요

2. **서비스 계정 설정**
```bash
# Cloud Scheduler 서비스 계정에 Cloud Run Invoker 역할 부여
gcloud run services add-iam-policy-binding qc-dashboard \
  --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region=asia-northeast3
```

## 🐛 문제 해결

### 403 Forbidden 오류
- Cloud Scheduler 서비스 계정에 Cloud Run Invoker 역할이 있는지 확인
- Cloud Run 서비스가 인증 없이 접근 가능한지 확인 (또는 OIDC 토큰 검증 구현)

### 500 Internal Server Error
- Cloud Run 로그 확인: `gcloud logging read "resource.type=cloud_run_revision"`
- 환경 변수 설정 확인
- Google Sheets API 권한 확인

### 스케줄이 실행되지 않음
- Cloud Scheduler 작업 상태 확인
- 작업이 일시정지(paused) 상태인지 확인
- 타임존 설정 확인

## 📊 모니터링

### Cloud Monitoring에서 알림 설정
1. [Cloud Monitoring 콘솔](https://console.cloud.google.com/monitoring) 접속
2. "알림 정책" > "정책 만들기"
3. 조건 설정:
   - 리소스 유형: `Cloud Scheduler Job`
   - 메트릭: `Job execution failed`
   - 임계값: `> 0`

## 🔄 업데이트

작업 설정 변경:
```bash
gcloud scheduler jobs update http sync-sheets-daily \
  --location=asia-northeast3 \
  --schedule="0 11 * * *" \
  --uri="${SERVICE_URL}/api/sync-sheets"
```

작업 삭제:
```bash
gcloud scheduler jobs delete sync-sheets-daily --location=asia-northeast3
```
