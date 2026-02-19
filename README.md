# QC Dashboard

카카오모빌리티 고객센터 QC(품질관리) 대시보드

## 기술 스택

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **UI**: Tailwind CSS v4 + Radix UI + shadcn/ui + Recharts
- **Data**: Google BigQuery (`csopp-25f2.KMCC_QC`)
- **Deploy**: GCP Cloud Run (asia-northeast3)

## 배포

```
GitHub (main push) → Cloud Build → Cloud Run
```
- **URL**: https://qc-dashboard-wlof52lhea-du.a.run.app

## 개발

```bash
# 의존성 설치
npm install

# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 실행
npm run start
```

## 필수 설정

### Apps Script 연동
배포된 URL을 Apps Script 코드에 입력:
```javascript
const WEBAPP_URL = "https://qc-dashboard-wlof52lhea-du.a.run.app/api/sync";
```

## 프로젝트 구조

```
├── app/              # Next.js App Router
│   └── api/          # API endpoints
├── components/       # React 컴포넌트 (shadcn/ui)
├── hooks/            # React hooks
├── lib/              # 유틸리티, 타입, BigQuery 연결
├── scripts/          # DB 스크립트
└── public/           # 정적 파일
```
