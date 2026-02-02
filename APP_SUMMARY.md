# KMCC QC Dashboard - 앱 요약

## 개요

**KMCC QC Dashboard**는 카카오모빌리티 고객센터(KMCC)의 상담 품질(QC) 관리를 위한 웹 기반 대시보드 애플리케이션입니다. 상담사 평가 데이터를 실시간으로 분석하고, AI 기반 예측 및 코칭 기능을 제공합니다.

### 배포 정보
- **서비스 URL**: https://qc-dashboard-731620445039.asia-northeast3.run.app
- **프로젝트 ID**: csopp-25f2
- **리전**: asia-northeast3 (서울)

---

## 주요 기능

### 1. 대시보드 (Dashboard)
- **실시간 현황 모니터링**: 센터별(용산/광주) 상담사 수, 평가 건수, 오류율 표시
- **집중관리 대상 표시**: 위험/양호 상담사 수 실시간 파악
- **트렌드 차트**: 일별/주차별 오류율 추이 시각화
- **센터 비교**: 용산/광주 센터 간 성과 비교
- **목표 달성 현황**: 센터별 목표 대비 현재 오류율 표시

### 2. 상담사 분석 (Agent Analysis)
- **상담사 목록**: 필터링 가능한 상담사 리스트 (센터, 서비스, 채널, 기간별)
- **오류율 분석**: 태도 오류율, 오상담/오처리 오류율 집계
- **상담사 상세 정보**: 개별 상담사의 일별 추이 및 항목별 오류 분석

### 3. 집중관리 (Focus Management)
- **자동 등록 조건**: 태도 오류율 5% 초과 또는 오상담 오류율 6% 초과 시 자동 등록
- **액션 플랜 관리**: 집중관리 대상별 개선 계획 수립 및 이력 관리
- **전일 대비 변화**: 오류율 증감 추적

### 4. 예측 (Predictions)
- **월말 예측**: W1~W3 데이터 기반 W4 오류율 예측
- **목표 달성 확률**: 센터/그룹별 목표 달성 가능성 계산
- **위험도 평가**: Critical/High/Medium/Low 4단계 위험도 분류
- **추세 분석**: 개선/유지/악화 추세 판단

### 5. AI 어시스턴트 (AI Assistant)
- **상담사/그룹 분석**: 선택한 대상에 대한 자동 종합 분석
- **코칭 제안**: AI 기반 맞춤형 코칭 포인트 제공
- **대화형 인터페이스**: 추가 질문을 통한 심층 분석 가능

### 6. 분석 리포트 (Analytics Reports)
- **리포트 생성**: 기간별, 센터별, 유형별 리포트 자동 생성
- **리포트 미리보기**: 생성 전 미리보기 기능

### 7. 목표 관리 (Goal Management)
- **목표 설정**: 센터별, 기간별 오류율 목표 설정
- **달성 현황 추적**: 실시간 목표 달성률 모니터링

### 8. 설정 (Settings)
- **목표 설정**: 센터/서비스별 목표 오류율 관리
- **알림 설정**: 임계치 초과 시 알림 설정
- **Slack 연동**: Slack 채널 연동 설정
- **데이터 동기화**: Google Sheets 연동 및 동기화 관리

---

## 핵심 기술 스택

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| **Next.js** | 16.0.10 | React 프레임워크 (App Router) |
| **React** | 19.2.0 | UI 라이브러리 |
| **TypeScript** | 5.x | 타입 안전성 |
| **Tailwind CSS** | 4.1.9 | 스타일링 |
| **Radix UI** | 최신 | 접근성 준수 UI 컴포넌트 |
| **Recharts** | 2.15.4 | 데이터 시각화 차트 |
| **Lucide React** | 0.454.0 | 아이콘 |

### Backend / Data
| 기술 | 버전 | 용도 |
|------|------|------|
| **Google Cloud BigQuery** | 7.9.0 | 데이터 웨어하우스 |
| **Google Generative AI (Gemini)** | 0.24.1 | AI 분석 및 코칭 |
| **Google APIs** | 170.1.0 | Google Sheets 연동 |
| **Firebase Admin** | 13.6.0 | 인증 및 알림 |

### Infrastructure
| 기술 | 용도 |
|------|------|
| **Google Cloud Run** | 서버리스 컨테이너 호스팅 |
| **Google Cloud Build** | CI/CD 파이프라인 |
| **Artifact Registry** | Docker 이미지 저장소 |
| **Docker** | 컨테이너화 |

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Next.js App (React 19)                  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │Dashboard │ │ Agents   │ │Predictions│            │   │
│  │  └──────────┘ └──────────┘ └──────────┘            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │  Focus   │ │AI Assist │ │ Reports  │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Layer (Next.js)                      │
│  /api/data  /api/agents  /api/predictions  /api/ai/chat     │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    BigQuery     │ │  Gemini AI      │ │ Google Sheets   │
│   (KMCC_QC)     │ │ (gemini-2.0)    │ │   (데이터 소스)   │
│                 │ │                 │ │                 │
│ - evaluations   │ │ - 상담사 분석    │ │ - QC 평가 데이터 │
│ - targets       │ │ - 코칭 제안      │ │ - 동기화         │
│ - agents        │ │ - 질의응답       │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 데이터 모델

### BigQuery 테이블

#### evaluations (평가 데이터)
| 필드 | 타입 | 설명 |
|------|------|------|
| evaluation_id | STRING | 평가 고유 ID |
| evaluation_date | DATE | 평가 일자 |
| center | STRING | 센터 (용산/광주) |
| service | STRING | 서비스 유형 |
| channel | STRING | 채널 (콜/채팅) |
| agent_id | STRING | 상담사 ID |
| agent_name | STRING | 상담사 이름 |
| attitude_error_count | INTEGER | 태도 오류 건수 |
| business_error_count | INTEGER | 업무 오류 건수 |
| greeting_error | BOOLEAN | 첫인사/끝인사 오류 |
| empathy_error | BOOLEAN | 공감표현 오류 |
| ... (16개 오류 항목) | BOOLEAN | 각 오류 항목별 |

#### targets (목표 데이터)
| 필드 | 타입 | 설명 |
|------|------|------|
| target_id | STRING | 목표 고유 ID |
| center | STRING | 센터 |
| target_attitude_error_rate | FLOAT | 태도 오류 목표율 |
| target_business_error_rate | FLOAT | 업무 오류 목표율 |
| period_type | STRING | 기간 유형 (yearly/monthly) |
| start_date | DATE | 시작일 |
| end_date | DATE | 종료일 |

---

## 오류 평가 항목

### 상담태도 (5개 항목)
1. 첫인사/끝인사 누락
2. 공감표현 누락
3. 사과표현 누락
4. 추가문의 누락
5. 불친절

### 오상담/오처리 (11개 항목)
1. 상담유형 오설정
2. 가이드 미준수
3. 본인확인 누락
4. 필수탐색 누락
5. 오안내
6. 전산 처리 누락
7. 전산 처리 미흡/정정
8. 전산 조작 미흡/오류
9. 콜/픽/트립ID 매핑누락&오기재
10. 플래그/키워드 누락&오기재
11. 상담이력 기재 미흡

---

## 예측 알고리즘

### 월말 오류율 예측
```
W4 예측 = W3 오류율 + (W3 - W2) 변화량
월말 예측 = (현재 오류율 × 경과일수 + W4 예측 × 잔여일수) / 총일수
```

### 목표 달성 확률
```
기본 확률 = 100 - ((예측값 - 목표) / 목표) × 100
추세 조정:
  - 개선 추세: +10%
  - 악화 추세: -15%
```

### 위험도 판정
| 위험도 | 조건 |
|--------|------|
| Low | 달성확률 ≥ 70% AND (개선 OR 유지) |
| Medium | 달성확률 ≥ 40% AND 예측값 ≤ 목표×1.1 |
| High | 달성확률 ≥ 20% OR 예측값 ≤ 목표×1.3 |
| Critical | 그 외 |

---

## 환경 변수

| 변수명 | 설명 | 필수 |
|--------|------|------|
| BIGQUERY_PROJECT_ID | BigQuery 프로젝트 ID | ✓ |
| BIGQUERY_DATASET_ID | BigQuery 데이터셋 ID | ✓ |
| BIGQUERY_CREDENTIALS | BigQuery 인증 JSON (선택) | |
| GOOGLE_AI_API_KEY | Gemini AI API 키 | ✓ |
| GOOGLE_AI_MODEL | AI 모델명 (기본: gemini-2.0-flash-exp) | |

---

## 배포 방법

### Cloud Run 배포 (권장)
```bash
# 수동 배포
gcloud builds submit --config cloudbuild.yaml --region=asia-northeast3 .

# 서비스 업데이트
gcloud run services update qc-dashboard \
  --region=asia-northeast3 \
  --set-env-vars="BIGQUERY_PROJECT_ID=csopp-25f2,BIGQUERY_DATASET_ID=KMCC_QC"
```

### 로컬 개발
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

---

## 프로젝트 구조

```
kmcc-qc-dashbord/
├── app/                    # Next.js App Router
│   ├── api/               # API 라우트
│   │   ├── agents/        # 상담사 API
│   │   ├── ai/chat/       # AI 채팅 API
│   │   ├── data/          # 대시보드 데이터 API
│   │   ├── goals/         # 목표 관리 API
│   │   ├── predictions/   # 예측 API
│   │   └── watchlist/     # 집중관리 API
│   ├── page.tsx           # 메인 페이지
│   └── layout.tsx         # 레이아웃
├── components/
│   ├── qc/                # QC 도메인 컴포넌트
│   │   ├── dashboard/     # 대시보드 컴포넌트
│   │   ├── agents/        # 상담사 분석 컴포넌트
│   │   ├── ai-assistant/  # AI 어시스턴트 컴포넌트
│   │   ├── focus/         # 집중관리 컴포넌트
│   │   ├── predictions/   # 예측 컴포넌트
│   │   ├── reports/       # 리포트 컴포넌트
│   │   └── settings/      # 설정 컴포넌트
│   └── ui/                # 공통 UI 컴포넌트 (Radix 기반)
├── hooks/                 # Custom React Hooks
├── lib/                   # 유틸리티 및 서비스
│   ├── bigquery.ts        # BigQuery 클라이언트
│   ├── vertex-ai.ts       # Gemini AI 클라이언트
│   ├── predictions.ts     # 예측 로직
│   └── types.ts           # TypeScript 타입 정의
├── Dockerfile             # Docker 빌드 파일
├── cloudbuild.yaml        # Cloud Build 설정
└── package.json           # 의존성 관리
```

---

## 2026년 목표

| 센터 | 태도 오류율 목표 | 오상담 오류율 목표 |
|------|-----------------|------------------|
| 용산 | 3.3% | 3.9% |
| 광주 | 2.7% | 1.7% |
| 전체 | 3.0% | 3.0% |

---

## 문서 생성일
2026년 1월 26일
