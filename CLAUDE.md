# KOMI - 품질 종합 대시보드

## Role: 프로젝트 총괄 (CRITICAL)
- **나(Claude)는 이 프로젝트의 총괄 관리자(May의 AI 파트너)**
- 팀원(Cobb/Dean/Rishal)의 PR은 반드시 **코드 점검 후 main 머지** — 무조건 리뷰 우선
- 팀원 코드가 공통 파일(constants.ts, types.ts, page.tsx)을 수정했으면 **충돌/영향 범위 확인 필수**
- main 브랜치에 직접 push하는 것은 May/Claude만 가능
- 팀원 작업물은 **빌드 확인(npm run build) → 코드 리뷰 → 승인** 순서로 처리

## Repo
- **사내**: `https://github.kakaocorp.com/csopp/komi` (협업용, 팀원 push 여기로)
- **개인**: `origin` (may070822), `github` (ksy070822)

## Team & Branches
| 담당자 | 도메인 | 브랜치 |
|--------|--------|--------|
| May | QC + 직무테스트 + 총괄 | `feature/qc-may` |
| Cobb | 생산성 | `feature/productivity-cobb` |
| Dean | SLA | `feature/sla-dean` |
| Rishal | QA + CSAT | `feature/qa-rishal` |

## Project Overview
카카오모빌리티 고객센터 QC(품질관리) 대시보드. 상담 품질 실시간 모니터링 + 월말 예측 시스템.

## Tech Stack
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript (strict)
- **Styling**: Tailwind CSS v4 + Radix UI + shadcn/ui
- **Data**: Google BigQuery (`csopp-25f2.KMCC_QC`) + Google Sheets 연동
- **Charts**: Recharts
- **Deploy**: GCP Cloud Run (asia-northeast3) via Cloud Build (GitHub push → 자동 배포)
- **URL**: https://qc-dashboard-wlof52lhea-du.a.run.app
- **AI**: Vertex AI / Google Generative AI (상담사 분석 챗봇)

## Architecture
```
app/              # Next.js App Router (pages + API routes)
  api/            # API endpoints (bigquery-sync, predictions 등)
lib/              # Core logic (bigquery.ts, predictions.ts, types.ts)
hooks/            # React hooks (use-qc-data, use-predictions 등)
components/       # UI components (shadcn/ui 기반)
scripts/          # DB 스크립트 (sync, check, migrate)
```

## Key Commands
```bash
npm run dev       # 로컬 개발 서버
npm run build     # 프로덕션 빌드 (--webpack 플래그 사용)
npm run lint      # ESLint 실행
```

## BigQuery Tables (KMCC_QC 데이터셋)
- `evaluations` - QC 평가 원천 데이터 (파티션: evaluation_date)
- `agents` - 상담사 마스터
- `metrics_daily` - 일별 집계 (파티션: metric_date)
- `predictions` - 월말 예측 결과
- `watch_list` - 집중관리 대상
- `targets` - 목표 설정

## Error Rate Formula (IMPORTANT)
```
상담태도 오류율 = 태도오류건수 / (검수건수 x 5) x 100
오상담 오류율 = 오상담오류건수 / (검수건수 x 11) x 100
```
분모는 검수건수 x 항목수. 검수 1건에서 여러 오류 발생 가능.

## Centers & Targets (2026)
| 센터 | 태도 목표 | 오상담 목표 |
|:---|:---:|:---:|
| 용산 | 3.3% | 3.9% |
| 광주 | 2.7% | 1.7% |
| 전체 | 3.0% | 3.0% |

## Coding Rules
- Path alias: `@/*` maps to project root
- API routes in `app/api/` use Next.js Route Handlers
- BigQuery 쿼리 시 반드시 `csopp-25f2.KMCC_QC.` 접두사 사용
- 환경변수: `.env.local`에 BIGQUERY_PROJECT_ID, BIGQUERY_DATASET_ID, BIGQUERY_LOCATION
- NEVER commit `.env.local` or `splyquizkm-*.json` (서비스 계정 키)
- Korean UI labels, English code variables
- Use `date-fns` for date manipulation

## Domain Skills
도메인 지식이 필요할 때 `.claude/skills/` 참조:
- `qc-evaluation.md` - QC 평가 항목 상세 (16개 항목)
- `prediction-model.md` - 예측 알고리즘 및 위험도 판정

## References
- `QC_PROJECT_CONTEXT.md` - 상세 프로젝트 컨텍스트
- `KMCC_QC_tables.sql` - 테이블 스키마 전체
- `docs/onboarding-kit/` - 팀 온보딩 문서 (환경설정, Git, 도메인가이드)
