# KOMI - 품질 종합 대시보드

카카오모빌리티 고객센터 품질관리 통합 대시보드 (QC + QA + CSAT + 생산성 + SLA)

## 팀 구성

| 담당자 | 도메인 | 브랜치 |
|--------|--------|--------|
| **May** | QC + 직무테스트 + 총괄 | `feature/qc-may` |
| **Cobb** | 생산성 (Productivity) | `feature/productivity-cobb` |
| **Dean** | SLA 평가 | `feature/sla-dean` |
| **Rishal** | QA + 상담평점 CSAT | `feature/qa-rishal` |

## 빠른 시작

```bash
# 1. 클론
git clone https://github.kakaocorp.com/csopp/komi.git
cd komi

# 2. 내 브랜치로 이동 (예: Cobb)
git checkout feature/productivity-cobb

# 3. 자동 환경 셋업 (Node.js, gcloud, npm 등 한번에 설치)
chmod +x scripts/setup-dev.sh && ./scripts/setup-dev.sh

# 4. 개발 서버 실행
npm run dev
# → http://localhost:3000
```

> 자세한 환경 설정은 [docs/onboarding-kit/ONBOARDING.md](docs/onboarding-kit/ONBOARDING.md) 참고

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript (strict) |
| UI | Tailwind CSS v4 + shadcn/ui + Recharts |
| Data | Google BigQuery (`csopp-25f2.KMCC_QC`) + Google Sheets |
| Deploy | GCP Cloud Run (asia-northeast3) |
| AI | Vertex AI / Google Generative AI |

## 프로젝트 구조

```
komi/
├── app/                        # Next.js App Router
│   ├── api/                    # API 엔드포인트
│   │   ├── data/               # QC 데이터 API
│   │   ├── import-qa/          # QA 데이터 임포트
│   │   ├── predictions/        # 예측 API
│   │   └── ...
│   ├── mypage/                 # 마이페이지
│   └── page.tsx                # 메인 페이지
├── components/qc/              # 도메인별 대시보드 UI
│   ├── dashboard/              # QC 메인 ← May
│   ├── qa-dashboard/           # QA ← Rishal
│   ├── csat-dashboard/         # CSAT ← Rishal
│   ├── quiz-dashboard/         # 직무테스트 ← May
│   ├── productivity-dashboard/ # 생산성 ← Cobb (신규)
│   ├── sla-dashboard/          # SLA ← Dean (신규)
│   └── quality-dashboard/      # 품질 종합 탭 래퍼
├── lib/                        # 핵심 비즈니스 로직
│   ├── bigquery.ts             # BigQuery 공통 (수정 금지)
│   ├── bigquery-qa.ts          # QA 쿼리 ← Rishal
│   ├── bigquery-csat.ts        # CSAT 쿼리 ← Rishal
│   ├── bigquery-productivity.ts # 생산성 쿼리 ← Cobb (신규)
│   ├── bigquery-sla.ts         # SLA 쿼리 ← Dean (신규)
│   ├── constants.ts            # 설정값 (수정 시 May에게 알림)
│   └── types.ts                # 타입 정의 (수정 시 May에게 알림)
├── hooks/                      # React hooks
├── docs/onboarding-kit/        # 온보딩 문서
├── scripts/                    # 운영 스크립트
└── public/                     # 정적 파일
```

## 브랜치 전략

```
main (보호됨 - PR로만 머지)
 ├── feature/qc-may
 ├── feature/productivity-cobb
 ├── feature/sla-dean
 └── feature/qa-rishal
```

### 규칙

1. **main에 직접 push 금지** — PR 생성 후 리뷰를 거쳐 머지
2. **내 브랜치에서만 작업** — 남의 도메인 파일 수정 금지
3. **매일 작업 전** `git pull origin main`으로 최신 코드 반영

> 자세한 Git 워크플로우는 [docs/onboarding-kit/GIT_WORKFLOW.md](docs/onboarding-kit/GIT_WORKFLOW.md) 참고

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 로컬 개발 서버 (자동 새로고침) |
| `npm run build -- --webpack` | 프로덕션 빌드 |
| `npm run lint` | 코드 문법 검사 |

## 공통 파일 수정 규칙

아래 파일은 여러 도메인에 영향을 줍니다. **수정 전 May에게 알려주세요.**

| 파일 | 이유 |
|------|------|
| `lib/constants.ts` | 모든 도메인 설정값 |
| `lib/types.ts` | 공통 타입 정의 |
| `app/page.tsx` | 메인 라우팅 |
| `components/qc/quality-dashboard/index.tsx` | 탭 래퍼 |

## 문서

| 문서 | 내용 |
|------|------|
| [ONBOARDING.md](docs/onboarding-kit/ONBOARDING.md) | 환경 설정 가이드 |
| [GIT_WORKFLOW.md](docs/onboarding-kit/GIT_WORKFLOW.md) | Git 브랜치/커밋/PR 가이드 |
| [DOMAIN_GUIDE.md](docs/onboarding-kit/DOMAIN_GUIDE.md) | 도메인별 작업 파일 안내 |

## 배포

```
GitHub (main push) → Cloud Build → Cloud Run (자동)
```
