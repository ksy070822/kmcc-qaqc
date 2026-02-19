# BigQuery 설정 가이드

이 프로젝트는 Firebase에서 BigQuery로 전환되었습니다.

## 📋 필수 준비 사항

### 1. BigQuery 테이블 생성
`KMCC_QC_tables.sql` 파일의 SQL을 BigQuery 콘솔에서 실행하여 테이블을 생성합니다.

```sql
-- 프로젝트: csopp-25f2
-- 데이터셋: KMCC_QC
-- 리전: asia-northeast3 (서울)
```

### 2. GCP 서비스 계정 생성
1. GCP 콘솔 > IAM & Admin > Service Accounts
2. 새 서비스 계정 생성
3. 권한: `BigQuery Data Editor`, `BigQuery Job User`
4. 키 생성 (JSON 형식)

### 3. 패키지 설치

```bash
npm install @google-cloud/bigquery
# 또는
pnpm add @google-cloud/bigquery
```

## 🔧 환경 변수 설정

### 로컬 개발 환경

`.env.local` 파일을 생성하고 다음 내용을 추가:

```bash
BIGQUERY_PROJECT_ID=csopp-25f2
BIGQUERY_DATASET_ID=KMCC_QC
GOOGLE_APPLICATION_CREDENTIALS=./csopp-25f2-service-account.json
```

서비스 계정 키 파일(`csopp-25f2-service-account.json`)을 프로젝트 루트에 저장합니다.

### Cloud Run 배포 환경

Cloud Run은 GCP 서비스 계정을 통해 BigQuery에 자동 인증됩니다.
`cloudbuild.yaml`에서 빌드/배포 설정을 관리합니다.

## 🚀 실행

```bash
# 개발 서버 시작
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm run start
```

## 📊 API 엔드포인트

### 대시보드 데이터
- `GET /api/data?type=dashboard&date=2026-01-20`
- `GET /api/data?type=centers`
- `GET /api/data?type=trend&days=14`

### 상담사 데이터
- `GET /api/agents?center=용산&service=택시&channel=유선`

### 집중관리 대상
- `GET /api/watchlist?center=용산&channel=유선`

### 목표 데이터
- `GET /api/goals?center=용산&periodType=monthly`

### 예측 데이터
- `GET /api/predictions?month=2026-01&center=용산`

### 데이터 동기화
- `POST /api/sync` (Google Apps Script에서 호출)

## 🔍 문제 해결

### 1. 인증 오류
- 서비스 계정 키가 올바른 위치에 있는지 확인
- 서비스 계정에 BigQuery 권한이 있는지 확인
- 환경 변수가 올바르게 설정되었는지 확인

### 2. 데이터가 표시되지 않음
- BigQuery 테이블이 생성되었는지 확인
- 테이블에 데이터가 있는지 확인:
  ```sql
  SELECT COUNT(*) FROM `csopp-25f2.KMCC_QC.evaluations`;
  ```
- 브라우저 콘솔에서 API 오류 확인

### 3. 쿼리 오류
- BigQuery 콘솔에서 쿼리 직접 실행하여 확인
- 날짜 형식이 `YYYY-MM-DD` 인지 확인
- 파티션 필드(`evaluation_date`)가 WHERE 절에 포함되었는지 확인

## 📁 변경 사항

### 생성된 파일
- `lib/bigquery.ts` - BigQuery 연결 및 쿼리 함수
- `app/api/agents/route.ts` - 상담사 API
- `app/api/watchlist/route.ts` - 집중관리 API
- `app/api/goals/route.ts` - 목표 API
- `app/api/predictions/route.ts` - 예측 API
- `hooks/use-agents.ts` - 상담사 데이터 훅
- `hooks/use-watchlist.ts` - 집중관리 데이터 훅
- `hooks/use-goals.ts` - 목표 데이터 훅

### 수정된 파일
- `app/api/data/route.ts` - Firebase → BigQuery
- `app/api/sync/route.ts` - Firebase → BigQuery
- `components/qc/agents/index.tsx` - API 연동
- `components/qc/focus/index.tsx` - API 연동
- `components/qc/goals/index.tsx` - API 연동

### 백업된 파일
- `lib/firebase-admin.ts.backup`
- `lib/firebase.ts.backup`

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. 브라우저 개발자 도구 콘솔
2. 서버 로그 (`npm run dev`의 터미널 출력)
3. BigQuery 콘솔의 쿼리 실행 로그
