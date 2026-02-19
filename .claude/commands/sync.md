# Google Sheets → BigQuery 데이터 동기화

## 수행 작업
1. `scripts/sync-standalone.ts` 실행하여 Google Sheets 데이터를 BigQuery로 동기화
2. 동기화 결과 확인 (건수, 오류 여부)
3. 최신 데이터 날짜 확인

## 실행 방법
```bash
npx ts-node scripts/sync-standalone.ts
```

## 동기화 후 확인
- BigQuery `evaluations` 테이블 최신 날짜
- 동기화된 건수 vs Google Sheets 원본 건수
- 오류 로그 확인

## 주의사항
- `.env.local` 환경변수 필요 (BIGQUERY_PROJECT_ID, BIGQUERY_DATASET_ID)
- 서비스 계정 키 파일 필요 (`splyquizkm-*.json`)
- 이미 존재하는 데이터는 중복 삽입하지 않음
