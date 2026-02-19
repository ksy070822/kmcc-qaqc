# 배포 가이드

## 배포 경로

```
GitHub (main push) → Cloud Build (cloudbuild.yaml) → Cloud Run (asia-northeast3)
```

- **프로젝트**: `csopp-25f2`
- **리전**: `asia-northeast3` (서울)
- **서비스**: `qc-dashboard`
- **URL**: https://qc-dashboard-wlof52lhea-du.a.run.app

---

## 배포 방법

### 자동 배포 (GitHub push)
```bash
git add .
git commit -m "Update dashboard"
git push origin main
```
Cloud Build 트리거가 자동으로 빌드 및 배포합니다. (약 10-15분 소요)

### 수동 배포 (Cloud Build)
```bash
gcloud builds submit --config cloudbuild.yaml --region=asia-northeast3 .
```

### 수동 배포 (스크립트)
```bash
bash deploy.sh
```

---

## 배포 확인

### Cloud Build 상태
```bash
gcloud builds list --region=asia-northeast3 --limit=5
```

### Cloud Run 서비스 확인
```bash
gcloud run services describe qc-dashboard --region=asia-northeast3
```

### 브라우저 확인
https://qc-dashboard-wlof52lhea-du.a.run.app

---

## Apps Script 연동

배포된 URL을 Apps Script 코드에 입력:
```javascript
const WEBAPP_URL = "https://qc-dashboard-wlof52lhea-du.a.run.app/api/sync";
```

---

## 로컬 실행 (테스트용)

```bash
npm install
npm run dev
# http://localhost:3000 접속
```

---

## 문제 해결

### 빌드 에러
- `npm run build` 로컬에서 실행하여 에러 확인
- TypeScript 에러는 `next.config.mjs`에서 무시 설정됨

### CORS 에러
- Cloud Run은 `--allow-unauthenticated` 설정으로 외부 접근 허용
- 필요 시 `lib/cors.ts`에서 CORS 설정 조정

### Apps Script 연결 안 됨
- 웹앱 URL이 정확한지 확인
- `/api/sync` 경로 포함 확인
- Cloud Run 배포 완료 후 확인
