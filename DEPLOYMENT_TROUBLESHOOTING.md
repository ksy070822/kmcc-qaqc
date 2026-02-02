# Cloud Run 배포 문제 해결 가이드

## 현재 문제: Docker 이미지를 찾을 수 없음

**에러 메시지:**
```
Image 'asia-northeast3-docker.pkg.dev/csopp-25f2/cloud-run-source-deploy/qc-dashboard:latest' not found.
```

## 해결 방법

### 1. Artifact Registry 저장소 확인

```bash
# 저장소 목록 확인
gcloud artifacts repositories list --location=asia-northeast3

# 저장소가 없으면 생성
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=asia-northeast3 \
  --description="Cloud Run source deploy Docker images"
```

### 2. 수동 빌드 및 배포 실행

```bash
# 프로젝트 디렉토리에서 실행
cd /Users/may.08/Desktop/kmcc_qc_dashbord

# fix-deployment.sh 스크립트 실행
./fix-deployment.sh csopp-25f2

# 또는 수동으로 실행
gcloud builds submit \
  --config cloudbuild.yaml \
  --region=asia-northeast3 \
  --substitutions=_SERVICE_NAME=qc-dashboard,_REGION=asia-northeast3 \
  .
```

### 3. 빌드 로그 확인

```bash
# 최근 빌드 목록 확인
gcloud builds list --region=asia-northeast3 --limit=5

# 특정 빌드 로그 확인
gcloud builds log [BUILD_ID] --region=asia-northeast3
```

### 4. Cloud Run 서비스 상태 확인

```bash
# 서비스 상태 확인
gcloud run services describe qc-dashboard \
  --region=asia-northeast3 \
  --format="yaml(status)"

# 서비스 로그 확인
gcloud run services logs read qc-dashboard \
  --region=asia-northeast3 \
  --limit=50
```

## 일반적인 문제 및 해결책

### 문제 1: Artifact Registry 권한 오류

**해결:**
```bash
# Cloud Build 서비스 계정에 Artifact Registry 권한 부여
PROJECT_NUMBER=$(gcloud projects describe csopp-25f2 --format="value(projectNumber)")
gcloud projects add-iam-policy-binding csopp-25f2 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### 문제 2: Cloud Run 배포 권한 오류

**해결:**
```bash
# Cloud Build 서비스 계정에 Cloud Run 권한 부여
PROJECT_NUMBER=$(gcloud projects describe csopp-25f2 --format="value(projectNumber)")
gcloud projects add-iam-policy-binding csopp-25f2 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"
```

### 문제 3: 이미지가 빌드되었지만 푸시 실패

**확인:**
```bash
# Artifact Registry에 이미지가 있는지 확인
gcloud artifacts docker images list \
  asia-northeast3-docker.pkg.dev/csopp-25f2/cloud-run-source-deploy/qc-dashboard \
  --include-tags
```

**해결:**
- 빌드 로그에서 푸시 단계 확인
- Artifact Registry API 활성화 확인
- 네트워크 문제 확인

### 문제 4: 빌드는 성공했지만 Cloud Run 배포 실패

**확인:**
```bash
# Cloud Run 이벤트 확인
gcloud run services describe qc-dashboard \
  --region=asia-northeast3 \
  --format="yaml(status.conditions)"
```

**해결:**
- 환경 변수 확인
- 메모리/CPU 제한 확인
- 서비스 계정 권한 확인

## 빠른 재배포

```bash
# 1. 최신 코드 확인
git pull origin main

# 2. 빌드 및 배포
./fix-deployment.sh csopp-25f2

# 3. 배포 확인
gcloud run services describe qc-dashboard \
  --region=asia-northeast3 \
  --format="value(status.url)"
```

## 체크리스트

배포 전 확인:
- [ ] Artifact Registry 저장소 존재 확인
- [ ] Cloud Build API 활성화 확인
- [ ] Cloud Run API 활성화 확인
- [ ] Artifact Registry API 활성화 확인
- [ ] 서비스 계정 권한 확인
- [ ] cloudbuild.yaml의 프로젝트 ID 확인
- [ ] Dockerfile이 올바른지 확인
- [ ] next.config.mjs의 standalone 설정 확인

## 유용한 명령어

```bash
# 프로젝트 ID 확인
gcloud config get-value project

# 활성화된 API 목록
gcloud services list --enabled

# Cloud Run 서비스 목록
gcloud run services list --region=asia-northeast3

# 빌드 히스토리
gcloud builds list --region=asia-northeast3 --limit=10

# 실시간 로그
gcloud run services logs read qc-dashboard --region=asia-northeast3 --follow
```
