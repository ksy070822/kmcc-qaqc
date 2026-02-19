# Cloud Run 배포

## 수행 작업
1. 빌드 검증 (`npm run build`)
2. TypeScript 타입 체크 (`npx tsc --noEmit`)
3. 배포 안내 (Cloud Build 또는 수동)

## 배포 방법

### Cloud Build (권장)
```bash
gcloud builds submit --config cloudbuild.yaml --region=asia-northeast3 .
```

### 수동 배포
```bash
bash deploy.sh
```

## 환경 정보
- **프로젝트**: csopp-25f2
- **리전**: asia-northeast3 (서울)
- **서비스**: qc-dashboard
- **메모리**: 512Mi, CPU: 1

## 체크리스트
- [ ] `npm run build` 성공
- [ ] `.env.local` 환경변수 확인
- [ ] BigQuery 연결 테스트 완료
- [ ] Cloud Build 트리거 리전 확인 (asia-northeast3)
