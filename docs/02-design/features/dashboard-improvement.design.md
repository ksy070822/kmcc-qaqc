# Dashboard Improvement Design Document

> **Summary**: QC 대시보드 데이터 파이프라인 정상화 및 코드 품질 개선 설계
>
> **Project**: KMCC QC Dashboard
> **Version**: 0.1.0
> **Author**: may.08
> **Date**: 2026-02-16
> **Status**: Draft
> **Plan Reference**: `docs/01-plan/features/dashboard-improvement.plan.md`

---

## 1. 현재 상태 진단 (As-Is)

### 1.1 데이터 파이프라인

```
Google Sheets (QC 평가)
        │
        ✖ Cloud Scheduler API 미활성화
        │ → 매일 20시 자동 동기화 작동 안 함
        │
Cloud Run
        │ → QC Dashboard 서비스 미배포 (agit-webhook만 존재)
        │
BigQuery (KMCC_QC.evaluations)
        │ → 최신 데이터: 2026-01-30 (17일 지연)
        │ → 총 256,873건, 259일치
        ▼
Dashboard (로컬에서만 작동)
```

### 1.2 코드 의존성 맵

```
14개 컴포넌트 → import from "mock-data.ts"
                    │
                    ├── re-export from "constants.ts" (상수만 사용) ← 정상
                    │   evaluationItems, groups, serviceGroups,
                    │   channelTypes, tenureCategories, tenures
                    │
                    └── 미사용 목업 함수들 ← 정리 대상
                        generateAgents, generateDailyEvaluations,
                        generateGroupStats, generateTrendData,
                        generateItemDistribution, generateActionPlans,
                        defaultGoals (2024-12 하드코딩),
                        defaultAlertSettings
```

### 1.3 Firebase 레거시

```
firebase-admin.ts → app/api/reset/route.ts (403 비활성화)
                 → 다른 곳에서 사용 안 함
```

---

## 2. 목표 상태 설계 (To-Be)

### 2.1 데이터 파이프라인

```
Google Sheets (QC 평가)
        │
        ▼ [매일 20:00 KST]
Cloud Scheduler (sync-sheets-daily) ← API 활성화 + 작업 생성
        │
        ▼ HTTP POST (인증: Cloud Run Invoker)
Cloud Run (/api/sync-sheets) ← 대시보드 서비스 배포
        │
        ▼ Batch Insert (중복 방지)
BigQuery (KMCC_QC.evaluations) ← 2월 데이터 수동 동기화
        │
        ▼ 실시간 쿼리
Dashboard API (/api/data, /api/predictions, ...)
        │
        ▼
React UI (대시보드 화면)
```

---

## 3. 상세 설계

### 3.1 Phase 1: 데이터 복구 (Critical)

#### 3.1.1 Cloud Scheduler API 활성화

```bash
# GCP 콘솔에서 Cloud Scheduler API 활성화
# https://console.developers.google.com/apis/api/cloudscheduler.googleapis.com/overview?project=csopp-25f2

# 또는 gcloud CLI:
gcloud services enable cloudscheduler.googleapis.com --project=csopp-25f2
```

#### 3.1.2 GOOGLE_SHEETS_ID 환경변수 추가

**파일**: `.env.local`
```diff
+ GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o
```

#### 3.1.3 수동 동기화 실행

로컬에서 `npm run dev` 실행 후 수동 sync 호출:
```bash
curl -X POST http://localhost:3000/api/sync-sheets
```

또는 Cloud Run 배포 후:
```bash
curl -X POST https://{SERVICE_URL}/api/sync-sheets
```

#### 3.1.4 동기화 결과 검증

```sql
-- 2월 데이터 확인
SELECT evaluation_date, COUNT(*) as cnt
FROM KMCC_QC.evaluations
WHERE evaluation_date >= '2026-02-01'
GROUP BY evaluation_date
ORDER BY evaluation_date
```

---

### 3.2 Phase 2: 코드 정리

#### 3.2.1 mock-data.ts에서 constants.ts로 import 경로 변경

**영향 받는 파일 (14개)**:
| 파일 | 현재 import | 변경 후 import |
|:---|:---|:---|
| `components/qc/reports/report-generator.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/predictions/index.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/settings/alert-settings.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/agents/agent-filters.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/goals/goal-form-modal.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/dashboard/weekly-error-table.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/ai-assistant/agent-selector.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/agents/agent-detail-modal.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/dashboard/daily-error-table.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/dashboard/dashboard-filters.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/dashboard/tenure-error-table.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/dashboard/item-analysis.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/dashboard/service-weekly-table.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |
| `components/qc/focus/index.tsx` | `from "@/lib/mock-data"` | `from "@/lib/constants"` |

**변경 방식**: `@/lib/mock-data` → `@/lib/constants` (constants.ts에 이미 동일 export 존재)

#### 3.2.2 mock-data.ts 삭제

import 경로 변경 완료 후 `lib/mock-data.ts` 삭제.
- constants.ts의 re-export 라인만 제거하면 됨
- 목업 생성 함수 및 defaultGoals는 더 이상 사용되지 않음

#### 3.2.3 Firebase 레거시 코드 제거

삭제 대상:
- `lib/firebase-admin.ts`
- `app/api/reset/route.ts` (이미 403 비활성화)
- `app/api/delete-fake-data/route.ts` (dev only, 불필요)

#### 3.2.4 constants.ts에 tenures export 추가

`mock-data.ts`에서 re-export하던 `tenures`를 constants.ts에 직접 정의 확인 필요.

---

### 3.3 Phase 3: API 안정화

#### 3.3.1 BigQuery 쿼리 재시도 로직

**파일**: `lib/bigquery.ts`

```typescript
// 재시도 유틸리티 추가
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const isRetryable = error instanceof Error && (
        error.message.includes('UNAVAILABLE') ||
        error.message.includes('DEADLINE_EXCEEDED') ||
        error.message.includes('INTERNAL')
      );
      if (!isRetryable) throw error;
      console.warn(`[BigQuery] Retry ${attempt}/${maxRetries} after ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw new Error('Unreachable');
}
```

#### 3.3.2 Vertex AI 환경변수 정리

**파일**: `lib/vertex-ai.ts`
- `GCP_PROJECT_ID` → `VERTEX_AI_PROJECT_ID`와 통일 (Line 57)
- 현재 `.env.local`에는 `VERTEX_AI_PROJECT_ID=csopp-25f2`이지만 코드는 `GCP_PROJECT_ID` 참조

```diff
- const projectId = process.env.GCP_PROJECT_ID;
+ const projectId = process.env.VERTEX_AI_PROJECT_ID || process.env.GCP_PROJECT_ID;
```

#### 3.3.3 sync-sheets IN절 SQL Injection 방지

**파일**: `app/api/sync-sheets/route.ts` (Line 77)

현재:
```typescript
const idsList = evaluationIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
```

개선: UNNEST + parameterized query 사용 (대량 데이터에 더 안전)
```typescript
// 청크 단위로 파라미터화된 쿼리 사용
const CHUNK_SIZE = 10000;
for (let i = 0; i < evaluationIds.length; i += CHUNK_SIZE) {
  const chunk = evaluationIds.slice(i, i + CHUNK_SIZE);
  const [rows] = await bigquery.query({
    query: `SELECT DISTINCT evaluation_id FROM ${EVAL_TABLE} WHERE evaluation_id IN UNNEST(@ids)`,
    params: { ids: chunk },
    types: { ids: ['STRING'] },
    location: 'asia-northeast3',
  });
  rows.forEach((row: any) => existingIds.add(row.evaluation_id));
}
```

#### 3.3.4 빌드 검증

```bash
npm run build  # 모든 변경 후 빌드 성공 확인
npm run lint   # lint 에러 0건 확인
```

---

### 3.4 Phase 4: 배포

#### 3.4.1 Cloud Run 배포

```bash
# Cloud Build를 통한 배포
gcloud builds submit \
  --config=cloudbuild.yaml \
  --project=csopp-25f2 \
  --region=asia-northeast3

# 또는 직접 배포
gcloud run deploy qc-dashboard \
  --source . \
  --project csopp-25f2 \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars="BIGQUERY_PROJECT_ID=csopp-25f2,BIGQUERY_DATASET_ID=KMCC_QC,USE_VERTEX_AI=true,VERTEX_AI_PROJECT_ID=csopp-25f2,VERTEX_AI_LOCATION=asia-northeast3,GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o"
```

#### 3.4.2 Cloud Scheduler 작업 생성

```bash
gcloud scheduler jobs create http sync-sheets-daily \
  --project=csopp-25f2 \
  --location=asia-northeast3 \
  --schedule="0 20 * * *" \
  --time-zone="Asia/Seoul" \
  --uri="https://{SERVICE_URL}/api/sync-sheets" \
  --http-method=POST \
  --oidc-service-account-email=csopp-25f2@appspot.gserviceaccount.com \
  --oidc-token-audience="https://{SERVICE_URL}" \
  --attempt-deadline=300s
```

---

## 4. 구현 순서 체크리스트

### Phase 1: 데이터 복구 (Critical)
- [ ] 1-1. `.env.local`에 `GOOGLE_SHEETS_ID` 추가
- [ ] 1-2. Cloud Scheduler API 활성화 (`gcloud services enable`)
- [ ] 1-3. 로컬 `npm run dev`로 수동 동기화 테스트
- [ ] 1-4. BigQuery 2월 데이터 확인

### Phase 2: 코드 정리 (High)
- [ ] 2-1. 14개 컴포넌트 import 경로 `mock-data` → `constants` 변경
- [ ] 2-2. `constants.ts`에 tenures export 확인/추가
- [ ] 2-3. `lib/mock-data.ts` 삭제
- [ ] 2-4. `lib/firebase-admin.ts` 삭제
- [ ] 2-5. `app/api/reset/route.ts` 삭제
- [ ] 2-6. `app/api/delete-fake-data/route.ts` 삭제

### Phase 3: API 안정화 (Medium)
- [ ] 3-1. BigQuery withRetry 유틸리티 추가
- [ ] 3-2. vertex-ai.ts 환경변수 통일 (VERTEX_AI_PROJECT_ID)
- [ ] 3-3. sync-sheets 파라미터화 쿼리로 변경
- [ ] 3-4. `npm run build` 성공 확인
- [ ] 3-5. `npm run lint` 에러 0건 확인

### Phase 4: 배포 (High)
- [ ] 4-1. Cloud Run에 qc-dashboard 서비스 배포
- [ ] 4-2. Cloud Scheduler sync-sheets-daily 작업 생성
- [ ] 4-3. Cloud Scheduler 수동 실행 테스트
- [ ] 4-4. 동기화 정상 동작 최종 검증

---

## 5. 리스크 대응

| 리스크 | 대응 방안 |
|:---|:---|
| Cloud Scheduler API 활성화 권한 없음 | GCP 콘솔에서 프로젝트 관리자 권한으로 활성화 |
| 수동 동기화 시 대량 데이터 타임아웃 | BATCH_SIZE=10000, 청크 단위 처리 이미 구현됨 |
| Cloud Run 배포 실패 (Dockerfile) | 로컬 Docker 빌드 먼저 테스트 |
| import 경로 변경 후 빌드 에러 | constants.ts re-export 확인 후 변경 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-16 | Initial design | may.08 |
