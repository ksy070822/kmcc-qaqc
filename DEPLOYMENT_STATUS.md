# 배포 상태 확인

## ✅ GitHub 푸시 완료

변경사항이 GitHub에 푸시되었습니다:
- 커밋: `19f8c2d`
- 브랜치: `main`

## 📦 배포 진행 중

Cloud Build 트리거가 자동으로 배포를 시작합니다.

### 배포 확인 방법

#### 1. Cloud Build 상태 확인
```bash
gcloud builds list --region=asia-northeast3 --limit=5
```

#### 2. Cloud Run 서비스 확인
```bash
gcloud run services describe qc-dashboard --region=asia-northeast3
```

#### 3. 브라우저에서 확인
- 서비스 URL: https://qc-dashboard-wlof52lhea-du.a.run.app
- 대시보드 페이지 새로고침 후 데이터 확인

### 배포 완료 예상 시간
- 빌드: 약 5-10분
- 배포: 약 1-2분
- **총 소요 시간: 약 10-15분**

## 🔍 배포 후 테스트

배포가 완료되면 다음을 확인하세요:

### 1. 대시보드 데이터 확인
```bash
curl "https://qc-dashboard-wlof52lhea-du.a.run.app/api/data?type=dashboard"
```

예상 결과:
- `totalAgentsYongsan`: 0이 아닌 값
- `totalAgentsGwangju`: 0이 아닌 값
- `totalEvaluations`: 0이 아닌 값

### 2. 상담사 목록 확인
```bash
curl "https://qc-dashboard-wlof52lhea-du.a.run.app/api/data?type=agents"
```

### 3. 목표 설정 확인
```bash
curl "https://qc-dashboard-wlof52lhea-du.a.run.app/api/goals"
```

## 🐛 문제 해결

### 배포가 시작되지 않음
- Cloud Build 트리거가 설정되어 있는지 확인
- GitHub 저장소 연결 확인

### 배포 실패
- Cloud Build 로그 확인:
  ```bash
  gcloud builds log [BUILD_ID] --region=asia-northeast3
  ```

### 여전히 오류 발생
- 브라우저 캐시 삭제 후 새로고침
- Cloud Run 로그 확인:
  ```bash
  gcloud logging read "resource.type=cloud_run_revision" --limit=50
  ```
