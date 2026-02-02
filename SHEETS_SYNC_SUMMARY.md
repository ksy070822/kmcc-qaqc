# Google Sheets → BigQuery 자동 동기화 구현 완료 ✅

## 📋 구현 완료 사항

### 1. Google Sheets API 연동 ✅
- **파일**: `lib/google-sheets.ts`
- **기능**:
  - Google Sheets에서 용산/광주 시트 데이터 읽기
  - 스프레드시트 데이터를 평가 데이터 형식으로 변환
  - 상담태도/오상담 오류 건수 자동 계산

### 2. 자동 동기화 API ✅
- **파일**: `app/api/sync-sheets/route.ts`
- **기능**:
  - Google Sheets에서 데이터 읽기
  - BigQuery 중복 체크 (증분 업데이트)
  - 새 데이터만 BigQuery에 저장
  - 배치 처리 (10,000건씩)

### 3. Cloud Scheduler 설정 ✅
- **파일**: `scripts/setup-cloud-scheduler.sh`, `cloud-scheduler-setup.md`
- **기능**:
  - 매일 저녁 8시 (KST) 자동 실행
  - OIDC 인증 설정
  - 자동 권한 설정

### 4. 데이터 비교 도구 ✅
- **파일**: `scripts/compare-sheets-bigquery.ts`
- **기능**:
  - Google Sheets와 BigQuery 데이터 비교
  - 누락된 데이터 확인
  - 날짜별 통계 제공

### 5. 테스트 도구 ✅
- **파일**: `scripts/test-sync-sheets.ts`
- **기능**: API 엔드포인트 테스트

## 🚀 빠른 시작

### 1단계: Google Sheets 공유 설정

1. Google Sheets 문서 열기: https://docs.google.com/spreadsheets/d/14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o
2. "공유" 버튼 클릭
3. 서비스 계정 이메일 추가 (읽기 권한)
   - 서비스 계정 이메일 확인:
     ```bash
     cat service-account-key.json | jq .client_email
     ```
   - 또는 "링크가 있는 모든 사용자"에게 읽기 권한 부여

### 2단계: 환경 변수 설정

**로컬 개발** (`.env.local`):
```bash
GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o
BIGQUERY_PROJECT_ID=csopp-25f2
BIGQUERY_DATASET_ID=KMCC_QC
BIGQUERY_CREDENTIALS={"type":"service_account",...}
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json
```

**Cloud Run**:
```bash
gcloud run services update qc-dashboard \
  --set-env-vars="GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o" \
  --region=asia-northeast3
```

### 3단계: 수동 동기화 테스트

```bash
# 로컬에서 테스트
npm run dev
# 다른 터미널에서
npx tsx scripts/test-sync-sheets.ts local

# 또는 프로덕션에서 테스트
npx tsx scripts/test-sync-sheets.ts production
```

### 4단계: 자동 동기화 설정

```bash
# Cloud Scheduler 설정
./scripts/setup-cloud-scheduler.sh
```

## 📊 데이터 흐름

```
Google Sheets (용산/광주 시트)
    ↓
Google Sheets API (읽기)
    ↓
데이터 파싱 및 변환
    ↓
BigQuery 중복 체크
    ↓
새 데이터만 BigQuery에 저장
    ↓
매일 저녁 8시 자동 실행 (Cloud Scheduler)
```

## 🔍 데이터 확인

### 현재 BigQuery 데이터 건수 확인
```bash
npx tsx scripts/check-data-count.ts
```

### Google Sheets vs BigQuery 비교
```bash
npx tsx scripts/compare-sheets-bigquery.ts
```

## 📝 주요 특징

1. **증분 업데이트**: 중복 데이터 자동 제거
   - `evaluation_id` 기반 중복 체크
   - 상담ID가 있으면 사용, 없으면 행 번호 사용

2. **자동 오류 계산**:
   - 상담태도 오류: 첫인사/끝인사, 공감표현, 사과표현, 추가문의, 불친절
   - 오상담/오처리 오류: 상담유형, 가이드, 본인확인, 필수탐색, 오안내, 전산처리 등

3. **배치 처리**: 10,000건씩 나누어 저장 (BigQuery 제한)

4. **에러 핸들링**: 각 행 파싱 오류 시에도 계속 진행

## 🐛 문제 해결

### "insufficient authentication scopes" 오류
→ Google Sheets 공유 설정 확인 (1단계 참조)

### "API not enabled" 오류
```bash
gcloud services enable sheets.googleapis.com
```

### 데이터가 동기화되지 않음
1. `compare-sheets-bigquery.ts` 실행하여 데이터 비교
2. API 엔드포인트 직접 호출 테스트
3. Cloud Run 로그 확인

## 📚 관련 문서

- `GOOGLE_SHEETS_SYNC.md`: 상세 가이드
- `cloud-scheduler-setup.md`: Cloud Scheduler 설정 가이드
- `scripts/compare-sheets-bigquery.ts`: 데이터 비교 스크립트
- `scripts/test-sync-sheets.ts`: 테스트 스크립트

## ✅ 다음 단계

1. [ ] Google Sheets 공유 설정 완료
2. [ ] 환경 변수 설정 완료
3. [ ] 수동 동기화 테스트 완료
4. [ ] 데이터 비교 스크립트 실행
5. [ ] Cloud Scheduler 설정 완료
6. [ ] 자동 동기화 확인

## 📞 지원

문제가 발생하면:
1. Cloud Run 로그 확인
2. `compare-sheets-bigquery.ts` 실행하여 데이터 상태 확인
3. `test-sync-sheets.ts` 실행하여 API 테스트
