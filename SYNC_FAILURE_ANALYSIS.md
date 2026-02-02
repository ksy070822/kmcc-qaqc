# Google Sheets → BigQuery 동기화 실패 원인 분석 및 해결 가이드

## 현상
- **목표**: 어제까지 데이터 적재, 매일 저녁 8시 당일 데이터 업데이트
- **현실**: BigQuery 마지막 데이터 날짜 2026-01-21에서 멈춤 (1/22~ 이후 미반영)

---

## 원인별 체크리스트

### 1. Cloud Scheduler 작업 미생성/미실행
**증상**: 스케줄이 아예 동작하지 않음

**확인**:
```bash
# 작업 존재 여부
gcloud scheduler jobs list --location=asia-northeast3 --project=csopp-25f2

# 작업 상세 (일시정지 여부)
gcloud scheduler jobs describe sync-sheets-daily --location=asia-northeast3 --project=csopp-25f2
```

**해결**: `./scripts/setup-cloud-scheduler.sh` 실행

---

### 2. Cloud Scheduler → Cloud Run 403 Forbidden
**증상**: Scheduler가 API 호출 시 403 반환

**원인**: 
- Cloud Run이 `--allow-unauthenticated`로 배포되었으면 해당 없음 (cloudbuild.yaml에 설정됨)
- 인증 필요 배포인 경우: `csopp-25f2@appspot.gserviceaccount.com`에 `roles/run.invoker` 필요

**해결**:
```bash
gcloud run services add-iam-policy-binding qc-dashboard \
  --member="serviceAccount:csopp-25f2@appspot.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region=asia-northeast3 \
  --project=csopp-25f2
```

---

### 3. Google Sheets API 권한 부족
**증상**: Sync API 호출 시 "Permission denied" / "The caller does not have permission"

**원인**: 
- Cloud Run이 사용하는 서비스 계정이 Google Sheets에 접근 불가
- 스프레드시트가 해당 서비스 계정과 공유되지 않음

**서비스 계정 확인**:
```bash
# Cloud Run 서비스 계정 (기본값)
gcloud run services describe qc-dashboard --region=asia-northeast3 --format="value(spec.template.spec.serviceAccountName)"
# 비어있으면 기본 Compute Engine SA 사용: PROJECT_NUMBER-compute@developer.gserviceaccount.com
```

**해결**:
1. [Google Sheets](https://docs.google.com/spreadsheets/d/14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o) 열기
2. 공유 → 서비스 계정 이메일 추가 (또는 사용 중인 SA 이메일)
3. "보기 권한" 이상 부여

---

### 4. BigQuery 권한 부족
**증상**: Sheets 읽기는 성공, BigQuery insert 시 권한 오류

**해결**: 서비스 계정에 BigQuery 데이터 편집자/사용자 역할 부여
```bash
# 프로젝트 번호 확인
gcloud projects describe csopp-25f2 --format="value(projectNumber)"
```

---

### 5. 환경 변수 미설정 (Cloud Run)
**필수 환경 변수**:
- `GOOGLE_SHEETS_ID`: 스프레드시트 ID
- `BIGQUERY_PROJECT_ID`, `BIGQUERY_DATASET_ID`
- `GOOGLE_APPLICATION_CREDENTIALS` 또는 `BIGQUERY_CREDENTIALS`: 서비스 계정 JSON

Cloud Run에 설정:
```bash
gcloud run services update qc-dashboard \
  --region=asia-northeast3 \
  --set-env-vars="GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o,BIGQUERY_PROJECT_ID=csopp-25f2,BIGQUERY_DATASET_ID=KMCC_QC"
```

---

### 6. Google Sheets / BigQuery 인증 계정 불일치
**원인**: 
- `lib/google-sheets.ts`는 Application Default Credentials(ADC) 사용
- `lib/bigquery.ts`는 `BIGQUERY_CREDENTIALS` 또는 `GOOGLE_APPLICATION_CREDENTIALS` 우선 사용
- 둘이 다른 계정을 쓰면, Sheets 접근 권한이 있는 계정과 BQ 권한이 있는 계정이 달라질 수 있음

**해결**: Google Sheets도 동일한 credentials 사용하도록 수정 (아래 코드 반영됨)

---

### 7. Cloud Scheduler 로그로 최근 실행 상태 확인
```bash
# Scheduler 실행 이력
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=sync-sheets-daily" \
  --limit=20 --format="table(timestamp,textPayload,jsonPayload)" \
  --project=csopp-25f2

# Cloud Run 로그 (Sync 관련)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=qc-dashboard AND textPayload:Sync" \
  --limit=30 --project=csopp-25f2
```

---

## 즉시 수동 동기화 (테스트)

```bash
# 배포된 API로 수동 실행
curl -X POST "https://qc-dashboard-wlof52lhea-du.a.run.app/api/sync-sheets" \
  -H "Content-Type: application/json"
```

성공 시: `"success":true`, 저장 건수 반환  
실패 시: 에러 메시지로 원인 파악

---

## 정리: 권장 조치 순서

1. **수동 Sync 테스트** → 실패 시 에러 메시지로 원인 확인
2. **Cloud Scheduler 작업 존재 확인** → 없으면 `setup-cloud-scheduler.sh` 실행
3. **서비스 계정과 Google Sheets 공유** → Sheets 공유에 SA 이메일 추가
4. **Cloud Run 환경 변수** → `GOOGLE_SHEETS_ID`, `BIGQUERY_*` 설정
5. **코드 수정** → Google Sheets도 BigQuery와 동일 credentials 사용 (아래 반영)
