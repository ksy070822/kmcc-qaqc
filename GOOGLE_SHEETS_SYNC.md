# Google Sheets → BigQuery 자동 동기화 가이드

Google Sheets의 용산/광주 시트 데이터를 BigQuery에 자동으로 동기화하는 시스템입니다.

## 📋 개요

- **소스**: Google Sheets (스프레드시트 ID: `14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o`)
- **대상**: BigQuery `KMCC_QC.evaluations` 테이블
- **스케줄**: 매일 저녁 8시 (KST) 자동 실행
- **증분 업데이트**: 중복 데이터 자동 제거

## 🔧 환경 변수 설정

### 로컬 개발 환경

`.env.local` 파일에 다음 환경 변수를 추가:

```bash
# Google Sheets
GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o

# BigQuery
BIGQUERY_PROJECT_ID=splyquizkm
BIGQUERY_DATASET_ID=KMCC_QC
BIGQUERY_CREDENTIALS={"type":"service_account",...}

# Google Sheets API 인증
# Google Cloud 서비스 계정이 Google Sheets에 접근할 수 있도록 설정 필요
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json
```

### Cloud Run 배포 환경

Cloud Run 서비스에 다음 환경 변수를 설정:

```bash
gcloud run services update qc-dashboard \
  --set-env-vars="GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o,BIGQUERY_PROJECT_ID=splyquizkm,BIGQUERY_DATASET_ID=KMCC_QC" \
  --set-env-vars="BIGQUERY_CREDENTIALS=$(cat service-account-key.json | jq -c)" \
  --region=asia-northeast3
```

## 🔐 Google Sheets API 권한 설정

Google Sheets에 접근하려면 서비스 계정에 권한이 필요합니다:

1. **서비스 계정 이메일 확인**
   ```bash
   # 서비스 계정 JSON 파일에서 client_email 확인
   cat service-account-key.json | jq .client_email
   ```

2. **Google Sheets 공유 설정**
   - Google Sheets 문서 열기
   - "공유" 버튼 클릭
   - 서비스 계정 이메일 추가 (읽기 권한)
   - 또는 "링크가 있는 모든 사용자"에게 읽기 권한 부여

## 🚀 사용 방법

### 1. 수동 동기화 (테스트)

```bash
# API 엔드포인트 직접 호출
curl -X POST https://qc-dashboard-wlof52lhea-du.a.run.app/api/sync-sheets \
  -H "Content-Type: application/json"
```

또는 로컬에서:

```bash
# 개발 서버 실행
npm run dev

# 다른 터미널에서
curl -X POST http://localhost:3000/api/sync-sheets \
  -H "Content-Type: application/json"
```

### 2. 데이터 비교 (BigQuery vs Google Sheets)

```bash
npx tsx scripts/compare-sheets-bigquery.ts
```

이 스크립트는:
- Google Sheets의 데이터와 BigQuery의 데이터를 비교
- 누락된 데이터 확인
- 날짜별 통계 제공

### 3. 자동 동기화 설정 (Cloud Scheduler)

```bash
# Cloud Scheduler 설정 스크립트 실행
./scripts/setup-cloud-scheduler.sh
```

또는 수동 설정:

```bash
gcloud scheduler jobs create http sync-sheets-daily \
  --location=asia-northeast3 \
  --schedule="0 11 * * *" \
  --uri="https://qc-dashboard-wlof52lhea-du.a.run.app/api/sync-sheets" \
  --http-method=POST \
  --time-zone="Asia/Seoul" \
  --description="매일 저녁 8시 Google Sheets 데이터를 BigQuery에 동기화" \
  --headers="Content-Type=application/json" \
  --oidc-service-account-email="splyquizkm@appspot.gserviceaccount.com"
```

자세한 내용은 `cloud-scheduler-setup.md` 참조

## 📊 데이터 구조

### Google Sheets 컬럼 구조

시트에는 다음 컬럼들이 포함됩니다:
- NO, 서비스, 채널, 이름, ID, 입사일, 근속개월
- 평가회차, 평가일, 상담일시, 상담ID
- 유선/채팅, 1뎁스~4뎁스, 1뎁스(수정)~4뎁스(수정)
- 상담태도 오류 항목 (첫인사/끝인사 누락, 공감표현 누락, 등)
- 오상담/오처리 오류 항목 (상담유형 오설정, 가이드 미준수, 등)
- 항목별 오류 건, Comment, AI 평가 여부, 등

### BigQuery 테이블 구조

`evaluations` 테이블에 다음 필드로 저장됩니다:
- `evaluation_id`: 고유 ID (중복 방지용)
- `evaluation_date`: 평가일
- `center`: 센터 (용산/광주)
- `service`: 서비스
- `channel`: 채널 (유선/채팅)
- `agent_id`, `agent_name`: 상담사 정보
- `attitude_error_count`: 상담태도 오류 건수
- `business_error_count`: 오상담/오처리 오류 건수
- `total_error_count`: 전체 오류 건수

## 🔄 증분 업데이트 로직

1. **중복 방지**: `evaluation_id`를 기반으로 중복 체크
   - `evaluation_id` = `${agentId}_${date}_${consultId}`
   - 상담ID가 없으면 `${agentId}_${date}_${rowIndex}` 사용

2. **자동 필터링**: BigQuery에 이미 존재하는 `evaluation_id`는 스킵

3. **배치 처리**: 10,000건씩 나누어 저장 (BigQuery 제한)

## 📝 로그 확인

### Cloud Run 로그
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=qc-dashboard" \
  --limit=50 \
  --format=json | jq '.[] | select(.jsonPayload.message | contains("Sync Sheets"))'
```

### Cloud Scheduler 실행 이력
```bash
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=sync-sheets-daily" \
  --limit=20
```

## 🐛 문제 해결

### 1. "Permission denied" 오류
- Google Sheets 공유 설정 확인
- 서비스 계정 이메일이 공유 목록에 있는지 확인

### 2. "API not enabled" 오류
```bash
gcloud services enable sheets.googleapis.com
```

### 3. 데이터가 동기화되지 않음
- `compare-sheets-bigquery.ts` 스크립트로 데이터 비교
- API 엔드포인트 직접 호출하여 테스트
- Cloud Run 로그 확인

### 4. 중복 데이터 발생
- `evaluation_id` 생성 로직 확인
- BigQuery에서 중복 체크 쿼리 실행:
  ```sql
  SELECT evaluation_id, COUNT(*) as count
  FROM `KMCC_QC.evaluations`
  GROUP BY evaluation_id
  HAVING count > 1
  ```

## 📚 관련 파일

- `lib/google-sheets.ts`: Google Sheets API 연동
- `app/api/sync-sheets/route.ts`: 동기화 API 엔드포인트
- `scripts/compare-sheets-bq.ts`: 데이터 비교 스크립트
- `scripts/setup-cloud-scheduler.sh`: Cloud Scheduler 설정 스크립트
- `cloud-scheduler-setup.md`: Cloud Scheduler 상세 가이드

## ✅ 체크리스트

- [ ] Google Sheets 공유 설정 완료
- [ ] 환경 변수 설정 완료
- [ ] Google Sheets API 활성화 완료
- [ ] 수동 동기화 테스트 완료
- [ ] 데이터 비교 스크립트 실행 완료
- [ ] Cloud Scheduler 설정 완료
- [ ] 자동 동기화 테스트 완료
