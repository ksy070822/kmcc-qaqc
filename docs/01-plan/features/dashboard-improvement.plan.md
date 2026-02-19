# Dashboard Improvement Planning Document

> **Summary**: QC 대시보드 데이터 연결 정상화, 목업 데이터 제거, AI 연동 개선, 동기화 복구
>
> **Project**: KMCC QC Dashboard
> **Version**: 0.1.0
> **Author**: may.08
> **Date**: 2026-02-16
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

QC 대시보드의 데이터 파이프라인을 정상화하고, 목업 데이터를 실제 데이터로 전환하며, Gemini AI 연동과 API 연결 전반을 개선한다.

### 1.2 Background

- **Cloud Scheduler API 미활성화**: Google Sheets → BigQuery 매일 20시 동기화가 작동하지 않음
- **BigQuery 최신 데이터**: 2026-01-30 (17일 지연, 2월 데이터 없음)
- **QC Dashboard Cloud Run 미배포**: agit-webhook만 배포됨, 대시보드 서비스 없음
- **목업 데이터 잔존**: `lib/mock-data.ts`에 2024년 하드코딩 날짜
- **레거시 코드**: Firebase 관련 코드 미정리

### 1.3 Related Documents

- CLAUDE.md (프로젝트 컨텍스트)
- QC_PROJECT_CONTEXT.md (상세 도메인 지식)
- SYNC_FAILURE_ANALYSIS.md (동기화 장애 분석)
- CLOUD_RUN_DEPLOY.md (배포 가이드)

---

## 2. Scope

### 2.1 In Scope

- [x] BigQuery 데이터 현황 파악 (완료: 256,873건, 259일, ~2026-01-30)
- [ ] Cloud Scheduler API 활성화 및 동기화 작업 재설정
- [ ] 누락된 2월 데이터 수동 동기화
- [ ] Cloud Run 대시보드 서비스 배포
- [ ] 목업 데이터 의존성 제거 및 실데이터 전환
- [ ] Gemini AI 연동 안정화 (Vertex AI 모드 포함)
- [ ] API 엔드포인트 전수 점검 및 오류 수정
- [ ] 레거시 Firebase 코드 정리

### 2.2 Out of Scope

- 새로운 대시보드 기능 추가
- UI/UX 리디자인
- 상담사 챗봇 기능 확장
- BigQuery 테이블 스키마 변경

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | Cloud Scheduler API 활성화 + sync-sheets-daily 작업 생성 | **Critical** | Pending |
| FR-02 | 2026-02-01 ~ 02-16 데이터 수동 동기화 실행 | **Critical** | Pending |
| FR-03 | Cloud Run에 QC Dashboard 서비스 배포 | **High** | Pending |
| FR-04 | mock-data.ts 하드코딩 날짜(2024-12) 제거 | **High** | Pending |
| FR-05 | 대시보드 API가 BigQuery 실데이터만 사용하도록 확인 | **High** | Pending |
| FR-06 | Gemini AI 연동 검증 (로컬 + Vertex AI 모드) | **Medium** | Pending |
| FR-07 | 환경변수 GOOGLE_SHEETS_ID를 .env.local에 추가 | **Medium** | Pending |
| FR-08 | Firebase 레거시 코드 제거 (firebase-admin.ts 등) | **Low** | Pending |
| FR-09 | BigQuery 쿼리 재시도 로직 추가 | **Low** | Pending |
| FR-10 | 불필요한 debug/reset/delete-fake-data 엔드포인트 정리 | **Low** | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 데이터 신선도 | BigQuery 최신 데이터가 당일 -1 이내 | `/api/debug/latest-date` 확인 |
| 동기화 안정성 | 매일 20시 자동 동기화 성공률 95%+ | Cloud Scheduler 로그 |
| API 응답시간 | 주요 API < 3초 | 로컬 테스트 |
| 빌드 성공 | `npm run build` 에러 없음 | CI/CD |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] BigQuery 최신 데이터가 2026-02-16 이후
- [ ] Cloud Scheduler 매일 20시 동기화 정상 작동 확인
- [ ] Cloud Run에 대시보드 서비스 배포 완료
- [ ] `npm run build` 성공
- [ ] 대시보드 페이지에서 실데이터 표시 확인
- [ ] Gemini AI 채팅 기능 정상 동작

### 4.2 Quality Criteria

- [ ] Zero build errors
- [ ] Zero lint errors (critical)
- [ ] 목업 데이터 호출 경로 0건
- [ ] 모든 API 엔드포인트 200 응답

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Cloud Scheduler API 활성화 권한 부족 | High | Medium | GCP 콘솔에서 직접 활성화 또는 관리자 요청 |
| 2월 데이터 Sheets 형식 변경 | High | Low | sync-status API로 Sheets 형식 사전 확인 |
| Cloud Run 배포 실패 | High | Medium | Dockerfile/cloudbuild.yaml 로컬 테스트 선행 |
| Gemini API 키 만료/할당량 초과 | Medium | Low | ai-cost-protection.ts 보호 로직 확인 |
| BigQuery 서비스 계정 키 만료 | High | Low | 키 파일 유효성 사전 확인 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | ☐ |
| **Dynamic** | Feature-based, BaaS integration | Web apps with backend | ☒ |
| **Enterprise** | Strict layer separation, microservices | High-traffic systems | ☐ |

### 6.2 Key Architectural Decisions (기존 유지)

| Decision | Selected | Rationale |
|----------|----------|-----------|
| Framework | Next.js 16 (App Router) | 기존 선택 유지 |
| Styling | Tailwind v4 + shadcn/ui | 기존 선택 유지 |
| Data | Google BigQuery | 기존 선택 유지 |
| AI | Gemini 2.5 Flash | 비용 효율적 |
| Deploy | Cloud Run (asia-northeast3) | GCP 네이티브 |
| Sync | Cloud Scheduler → API Route | 서버리스 스케줄링 |

### 6.3 데이터 파이프라인 아키텍처

```
Google Sheets (QC 평가 원천)
        │
        ▼ [매일 20:00 KST]
Cloud Scheduler (sync-sheets-daily)
        │
        ▼ HTTP POST
Cloud Run (/api/sync-sheets)
        │
        ▼ Batch Insert (중복 방지)
BigQuery (KMCC_QC.evaluations)
        │
        ▼ 실시간 쿼리
Dashboard API (/api/data, /api/predictions, ...)
        │
        ▼
React UI (대시보드 화면)
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `CLAUDE.md` has coding conventions section
- [x] `.claude/rules/typescript.md` exists
- [ ] `docs/01-plan/conventions.md` exists
- [x] TypeScript configuration (`tsconfig.json`)
- [x] PostCSS configuration

### 7.2 환경변수 점검

| Variable | Purpose | 현재 상태 | 조치 |
|----------|---------|-----------|------|
| `BIGQUERY_PROJECT_ID` | BigQuery 프로젝트 | ✅ 설정됨 | - |
| `BIGQUERY_DATASET_ID` | BigQuery 데이터셋 | ✅ 설정됨 | - |
| `GOOGLE_APPLICATION_CREDENTIALS` | 서비스 계정 키 | ✅ 설정됨 | 유효성 확인 |
| `GOOGLE_AI_API_KEY` | Gemini AI 키 | ✅ 설정됨 | 할당량 확인 |
| `GOOGLE_SHEETS_ID` | 스프레드시트 ID | ❌ 미설정 | .env.local에 추가 |
| `USE_VERTEX_AI` | Vertex AI 모드 | ⚠️ false | Cloud Run은 true |

---

## 8. 실행 계획 (Implementation Order)

### Phase 1: 긴급 데이터 복구 (Day 1)
1. Cloud Scheduler API 활성화
2. GOOGLE_SHEETS_ID 환경변수 추가
3. 수동 동기화로 2월 데이터 투입 (`/api/sync-sheets`)
4. BigQuery 최신 데이터 확인

### Phase 2: 코드 정리 (Day 1-2)
5. mock-data.ts 하드코딩 날짜 수정
6. Firebase 레거시 코드 제거
7. 불필요한 API 엔드포인트 정리
8. 스프레드시트 ID 하드코딩 제거

### Phase 3: API 안정화 (Day 2)
9. 전체 API 엔드포인트 점검 및 테스트
10. BigQuery 재시도 로직 추가
11. Gemini AI 연동 검증
12. `npm run build` 성공 확인

### Phase 4: 배포 (Day 2-3)
13. Cloud Run에 대시보드 서비스 배포
14. Cloud Scheduler sync-sheets-daily 작업 생성
15. 동기화 정상 동작 검증
16. 최종 점검

---

## 9. Next Steps

1. [ ] Write design document (`dashboard-improvement.design.md`)
2. [ ] 또는 바로 Do 단계로 진입하여 긴급 수정 착수
3. [ ] Phase 1 완료 후 analyze 실행

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-16 | Initial draft | may.08 |
