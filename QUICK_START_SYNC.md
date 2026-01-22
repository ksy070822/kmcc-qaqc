# 빠른 시작: Google Sheets 동기화 테스트

서비스 계정(`data-460@splyquizkm.iam.gserviceaccount.com`)이 Google Sheets에 공유되었으므로 이제 동기화를 테스트할 수 있습니다.

## 🚀 빠른 테스트

### 1. 로컬에서 테스트 (권장)

```bash
# 개발 서버 시작
npm run dev

# 다른 터미널에서 동기화 테스트
npx tsx scripts/test-sync-sheets.ts local
```

### 2. 데이터 비교 (현재 상태 확인)

```bash
# Google Sheets와 BigQuery 데이터 비교
npx tsx scripts/compare-sheets-bigquery.ts
```

이 스크립트는:
- Google Sheets의 용산/광주 시트 데이터 읽기
- BigQuery의 현재 데이터와 비교
- 누락된 데이터 확인
- 날짜별 통계 제공

### 3. 수동 동기화 실행

```bash
# API 엔드포인트 직접 호출
curl -X POST http://localhost:3000/api/sync-sheets \
  -H "Content-Type: application/json"
```

## 📋 환경 변수 확인

로컬 테스트를 위해 `.env.local` 파일에 다음이 설정되어 있는지 확인:

```bash
GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o
BIGQUERY_PROJECT_ID=splyquizkm
BIGQUERY_DATASET_ID=KMCC_QC
BIGQUERY_CREDENTIALS={"type":"service_account",...}
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json
```

## ✅ 예상 결과

성공 시:
- Google Sheets에서 데이터 읽기 성공
- BigQuery 중복 체크 완료
- 새 데이터만 저장됨
- 저장된 건수 표시

## 🐛 문제 해결

### "insufficient authentication scopes" 오류
→ 서비스 계정이 Google Sheets에 공유되었는지 확인
→ 서비스 계정 이메일: `data-460@splyquizkm.iam.gserviceaccount.com`

### "API not enabled" 오류
```bash
gcloud services enable sheets.googleapis.com --project=splyquizkm
```

### 데이터가 0건으로 표시됨
→ 모든 데이터가 이미 동기화되었을 수 있음
→ `compare-sheets-bigquery.ts` 실행하여 확인

## 📊 다음 단계

동기화가 성공하면:
1. Cloud Run에 배포
2. Cloud Scheduler 설정 (매일 저녁 8시 자동 실행)
3. 모니터링 설정

자세한 내용은 `GOOGLE_SHEETS_SYNC.md` 참조
