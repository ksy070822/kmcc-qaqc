# QC 대시보드 프로젝트 진행사항 및 주요 스펙

> **작성일**: 2026-01-21  
> **목적**: 클로드코드에서 작업 재개를 위한 프로젝트 현황 정리

---

## 📋 프로젝트 개요

### 프로젝트 정보
- **프로젝트명**: KM 고객센터 QC 대시보드
- **담당자**: 메이 (CX Synergy팀, 카카오모빌리티 고객센터)
- **목적**: 고객센터 상담 품질 실시간 모니터링 및 월말 목표 달성 예측
- **GitHub**: https://github.com/ksy070822/kmcc_QC_dashbord
- **배포 URL**: kmcc-qc-dashbord-iota.vercel.app

### 비즈니스 컨텍스트
- **센터**: 용산센터 (약 200명), 광주센터 (약 100명)
- **서비스**: 택시, 퀵, 대리, 배송, 바이크/마스, 주차/카오너, 화물, 지금여기
- **채널**: 유선, 채팅
- **평가 항목**: 상담태도 5개, 오상담/오처리 11개 (총 16개)

---

## 🛠️ 기술 스택

### 프론트엔드
- **프레임워크**: Next.js 16.0.10 (App Router)
- **언어**: TypeScript 5
- **UI 라이브러리**: 
  - Radix UI (다양한 컴포넌트)
  - Tailwind CSS 4.1.9
  - Recharts 2.15.4 (차트)
  - Lucide React (아이콘)
- **상태 관리**: React Hooks (useState, useCallback 등)
- **폼 관리**: React Hook Form + Zod

### 백엔드
- **런타임**: Node.js
- **데이터베이스**: Google BigQuery
  - 프로젝트: `splyquizkm`
  - 데이터셋: `KMCC_QC`
  - 리전: `asia-northeast3` (서울)
- **인증**: Google Cloud 서비스 계정 (JSON 키)

### 배포
- **호스팅**: Vercel
- **빌드 도구**: Next.js 빌드 시스템

---

## ✅ 현재 구현 상태

### 완료된 기능

#### 1. 데이터베이스 연동 ✅
- [x] BigQuery 연결 설정 (`lib/bigquery.ts`)
- [x] BigQuery 테이블 생성 (6개 테이블)
- [x] 서비스 계정 인증 설정
- [x] Firebase → BigQuery 전환 완료

#### 2. API 엔드포인트 ✅
| 엔드포인트 | 메서드 | 상태 | 설명 |
|:---|:---|:---:|:---|
| `/api/data` | GET | ✅ | 대시보드 통계, 센터별 데이터, 트렌드 |
| `/api/agents` | GET | ✅ | 상담사 목록 및 상세 정보 |
| `/api/watchlist` | GET/POST | ✅ | 집중관리 대상 목록 |
| `/api/goals` | GET/POST/PUT/DELETE | ✅ | 목표 설정 및 조회 |
| `/api/predictions` | GET | ✅ | 월말 예측 데이터 |
| `/api/sync` | POST | ✅ | Google Apps Script 동기화 |
| `/api/reset` | POST | ⚠️ | 데이터 리셋 (개발용) |

#### 3. React Hooks ✅
- [x] `hooks/use-qc-data.ts` - 대시보드 데이터
- [x] `hooks/use-agents.ts` - 상담사 데이터
- [x] `hooks/use-watchlist.ts` - 집중관리 데이터
- [x] `hooks/use-goals.ts` - 목표 데이터

#### 4. UI 컴포넌트 ✅
- [x] **대시보드** (`components/qc/dashboard/`)
  - 개요 통계 카드
  - 센터별 비교
  - 오류 트렌드 차트
  - 일별/주별/근속별 오류 테이블
  - 서비스별 주간 테이블
  - 목표 달성 현황
  - 아이템 분석
  - 히트맵
  - 집중관리 미리보기

- [x] **상담사 분석** (`components/qc/agents/`)
  - 상담사 필터링
  - 상담사 테이블
  - 상담사 상세 모달

- [x] **집중관리** (`components/qc/focus/`)
  - 집중관리 대상 테이블
  - 액션플랜 모달
  - 액션플랜 이력
  - 개선 통계

- [x] **목표관리** (`components/qc/goals/`)
  - 목표 카드
  - 목표 달성 차트
  - 목표 요약
  - 목표 설정 모달

- [x] **리포트** (`components/qc/reports/`)
  - 리포트 생성기
  - 리포트 이력
  - 리포트 미리보기

- [x] **설정** (`components/qc/settings/`)
  - 알림 설정
  - 데이터 동기화 설정
  - 목표 설정
  - Slack 설정

#### 5. 공통 컴포넌트 ✅
- [x] Sidebar (네비게이션)
- [x] Header (날짜 선택, 새로고침)
- [x] StatsCard (통계 카드)
- [x] UI 컴포넌트 라이브러리 (shadcn/ui 기반)

---

## 📊 데이터 구조

### BigQuery 테이블

#### 1. `evaluations` (원천 평가 데이터)
- **파티션**: `evaluation_date` (DATE)
- **클러스터**: `center`, `service`, `channel`
- **주요 필드**:
  - 기본 정보: `evaluation_id`, `evaluation_date`, `consult_date`, `consult_id`
  - 센터/서비스/채널: `center`, `service`, `channel`
  - 상담사 정보: `agent_id`, `agent_name`, `hire_date`, `tenure_months`
  - 태도 항목 (5개): `greeting_error`, `empathy_error`, `apology_error`, `additional_inquiry_error`, `unkind_error`
  - 오상담 항목 (11개): `consult_type_error`, `guide_error`, `identity_check_error`, 등
  - 집계: `attitude_error_count`, `ops_error_count`, `total_error_count`

#### 2. `agents` (상담사 마스터)
- **주요 필드**: `agent_id`, `agent_name`, `center`, `service`, `channel`, `hire_date`, `tenure_months`, `risk_level`, `is_watch_list`

#### 3. `metrics_daily` (일별 집계)
- **파티션**: `metric_date` (DATE)
- **클러스터**: `dimension_type`, `center`
- **집계 차원**: 센터, 서비스, 채널, 상담사별 일별 통계

#### 4. `predictions` (월말 예측)
- **파티션**: `prediction_date` (DATE)
- **주요 필드**: 현재 오류율, 주차별 오류율, 예측 오류율, 목표 대비 달성 확률, 위험도

#### 5. `watch_list` (집중관리 대상)
- **주요 필드**: `watch_id`, `dimension_type`, `dimension_value`, `center`, `agent_id`, `reason`, `risk_factors`, `action_plan`, `action_status`

#### 6. `targets` (목표 설정)
- **주요 필드**: `target_id`, `center`, `target_type` (attitude/ops), `target_rate`, `period_type`, `period_start`, `period_end`

### 현재 데이터 상태
- **evaluations**: 118,766건 (2025-10-02 ~ 2026-01-20)
- **agents**: 동적 생성 (evaluations에서 추출)
- **targets**: 6건 (2026년 1월 목표)
- **watch_list**: 동적 생성
- **metrics_daily**: 미구현 (향후 구현 예정)
- **predictions**: 미구현 (향후 구현 예정)

---

## 🔄 데이터 흐름

```
[데이터 원천]
  └─ Google Sheets (용산/광주)
      │
      └─ Google Apps Script (매일 새벽 자동 실행)
          │
          └─ POST /api/sync
              │
              └─ BigQuery evaluations 테이블
                  │
                  ├─ 실시간 집계 쿼리
                  │   └─ 대시보드 표시
                  │
                  ├─ 예측 로직 (향후 구현)
                  │   └─ predictions 테이블
                  │
                  └─ 위험도 판정
                      └─ watch_list 테이블
```

---

## 📐 주요 계산 로직

### 오류율 계산
```typescript
// 상담태도 오류율
attitude_error_rate = (태도 오류 건수) / (검수 건수 × 5) × 100

// 오상담 오류율
ops_error_rate = (오상담 오류 건수) / (검수 건수 × 11) × 100

// 전체 오류율
total_error_rate = attitude_error_rate + ops_error_rate
```

**중요**: 검수 1건에서 여러 오류가 발생할 수 있으므로, 분모는 `검수 건수 × 항목 수`

### 예측 로직 (설계 완료, 구현 예정)
1. **주차 정의**: 1~5일(W1), 6~12일(W2), 13~19일(W3), 20~31일(W4)
2. **W4 예측**: W2→W3 변화량을 W3→W4에 적용
3. **월말 예측**: 가중 평균 (현재 오류율 × 경과일수 + W4 예측 × 남은 일수) / 총 일수
4. **추세 판정**: 개선/악화/유지 (0.3%p 기준)
5. **위험도 판정**: 달성 확률과 추세 기반 (low/medium/high/critical)

---

## 🎯 목표 설정

### 2026년 월간 목표
| 센터 | 상담태도 목표 | 오상담 목표 |
|:---|:---:|:---:|
| **용산** | 3.3% 이하 | 3.9% 이하 |
| **광주** | 2.7% 이하 | 1.7% 이하 |
| **전체** | 3.0% 이하 | 3.0% 이하 |

---

## 🔧 환경 설정

### 필수 환경 변수

#### 로컬 개발 (`.env.local`)
```bash
BIGQUERY_PROJECT_ID=splyquizkm
BIGQUERY_DATASET_ID=KMCC_QC
GOOGLE_APPLICATION_CREDENTIALS=./splyquizkm-c7fc16583892.json
```

#### Vercel 배포
```bash
BIGQUERY_PROJECT_ID=splyquizkm
BIGQUERY_DATASET_ID=KMCC_QC
BIGQUERY_CREDENTIALS={"type":"service_account",...전체 JSON...}
```

### 서비스 계정 권한
- BigQuery Data Editor
- BigQuery Job User

---

## 📁 프로젝트 구조

```
kmcc_qc_dashbord/
├── app/
│   ├── api/                    # API 라우트
│   │   ├── agents/            # 상담사 API
│   │   ├── data/              # 대시보드 데이터 API
│   │   ├── goals/             # 목표 API
│   │   ├── predictions/       # 예측 API
│   │   ├── sync/              # 동기화 API
│   │   ├── watchlist/         # 집중관리 API
│   │   └── reset/             # 리셋 API
│   ├── globals.css            # 전역 스타일
│   └── page.tsx               # 메인 페이지
│
├── components/
│   ├── qc/                    # QC 관련 컴포넌트
│   │   ├── agents/           # 상담사 분석
│   │   ├── dashboard/        # 대시보드
│   │   ├── focus/            # 집중관리
│   │   ├── goals/            # 목표관리
│   │   ├── reports/          # 리포트
│   │   ├── settings/         # 설정
│   │   ├── header.tsx        # 헤더
│   │   ├── sidebar.tsx       # 사이드바
│   │   └── stats-card.tsx    # 통계 카드
│   └── ui/                    # 공통 UI 컴포넌트 (shadcn/ui)
│
├── hooks/                      # React Hooks
│   ├── use-agents.ts
│   ├── use-goals.ts
│   ├── use-qc-data.ts
│   └── use-watchlist.ts
│
├── lib/
│   ├── bigquery.ts            # BigQuery 클라이언트 및 쿼리 함수
│   ├── types.ts               # TypeScript 타입 정의
│   ├── utils.ts               # 유틸리티 함수
│   └── use-dashboard-data.ts  # 대시보드 데이터 훅
│
├── public/                     # 정적 파일
│
├── .gitignore                 # Git 제외 파일
├── package.json               # 의존성
├── tsconfig.json              # TypeScript 설정
├── next.config.mjs            # Next.js 설정
│
└── 문서/
    ├── README.md
    ├── QC_PROJECT_CONTEXT.md  # 프로젝트 컨텍스트
    ├── BIGQUERY_SETUP.md      # BigQuery 설정 가이드
    ├── DEPLOYMENT_COMPLETE.md # 배포 완료 문서
    ├── CLAUDE_CODE_작업가이드.md
    ├── KMCC_QC_tables.sql     # BigQuery 테이블 생성 SQL
    └── PROJECT_STATUS.md       # 이 문서
```

---

## ⚠️ 알려진 이슈 및 제한사항

### 1. Hydration 경고
- Header 컴포넌트의 시간 표시로 인한 서버/클라이언트 불일치
- 기능에는 영향 없음 (선택적 수정)

### 2. BigQuery 일시적 오류
- 간헐적으로 "internal error" 발생
- 재시도 시 성공 (BigQuery 자체 문제)

### 3. 미구현 기능
- `metrics_daily` 테이블 집계 (성능 최적화용)
- `predictions` 테이블 자동 생성 (월말 예측)
- Apps Script 자동 트리거 설정

---

## 🚀 다음 작업 (우선순위)

### 높은 우선순위
1. [ ] **예측 기능 완성**
   - `lib/predictions.ts` 구현
   - `/api/predictions` 엔드포인트 완성
   - 대시보드에 예측 섹션 추가

2. [ ] **성능 최적화**
   - `metrics_daily` 테이블 집계 로직 구현
   - 쿼리 캐싱 추가
   - agents 테이블 채우기

3. [ ] **자동 동기화**
   - Apps Script 트리거 설정 (매일 저녁 8시)
   - 또는 Cloud Scheduler + Cloud Functions

### 중간 우선순위
4. [ ] **리포트 기능 완성**
   - 리포트 생성 API 구현
   - PDF/Excel 내보내기

5. [ ] **알림 기능**
   - Slack 연동
   - 이메일 알림
   - 위험도 기반 자동 알림

### 낮은 우선순위
6. [ ] **Hydration 경고 수정**
7. [ ] **에러 핸들링 개선**
8. [ ] **로딩 상태 개선**
9. [ ] **접근성 개선**

---

## 📝 주요 파일 설명

### 핵심 파일
- `lib/bigquery.ts`: BigQuery 클라이언트 및 모든 쿼리 함수
- `lib/types.ts`: TypeScript 타입 정의
- `app/page.tsx`: 메인 페이지 (라우팅)
- `components/qc/dashboard/index.tsx`: 대시보드 메인 컴포넌트

### API 라우트
- `app/api/data/route.ts`: 대시보드 데이터
- `app/api/agents/route.ts`: 상담사 데이터
- `app/api/sync/route.ts`: Google Apps Script 동기화

### Hooks
- `hooks/use-qc-data.ts`: 대시보드 데이터 훅
- `hooks/use-agents.ts`: 상담사 데이터 훅

---

## 🔐 보안 주의사항

### 민감한 파일
- `splyquizkm-c7fc16583892.json`: 서비스 계정 키 (`.gitignore`에 추가됨)
- 환경 변수: Vercel에만 저장, 로컬 `.env.local`은 Git 제외

### 권한 관리
- BigQuery: 읽기/쓰기 권한만 부여
- 서비스 계정: 최소 권한 원칙

---

## 📞 참고 문서

1. **QC_PROJECT_CONTEXT.md**: 프로젝트 비즈니스 컨텍스트 및 상세 설명
2. **BIGQUERY_SETUP.md**: BigQuery 설정 가이드
3. **DEPLOYMENT_COMPLETE.md**: 배포 완료 상태
4. **CLAUDE_CODE_작업가이드.md**: 작업 가이드
5. **KMCC_QC_tables.sql**: BigQuery 테이블 스키마

---

## 🎯 작업 재개 시 체크리스트

1. [ ] 프로젝트 클론 및 의존성 설치
   ```bash
   git clone https://github.com/ksy070822/kmcc_QC_dashbord.git
   cd kmcc_qc_dashbord
   pnpm install
   ```

2. [ ] 환경 변수 설정
   - `.env.local` 파일 생성
   - 서비스 계정 키 파일 확인

3. [ ] BigQuery 연결 확인
   - 테이블 존재 확인
   - 쿼리 테스트

4. [ ] 개발 서버 실행
   ```bash
   pnpm dev
   ```

5. [ ] 주요 기능 테스트
   - 대시보드 데이터 로드
   - 상담사 목록 조회
   - 집중관리 목록 조회

---

**마지막 업데이트**: 2026-01-21  
**작성자**: Claude (Anthropic)  
**목적**: 클로드코드 작업 재개 가이드
