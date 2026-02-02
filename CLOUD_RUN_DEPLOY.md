# Cloud Run 배포 가이드

이 문서는 QC 대시보드를 Google Cloud Run에 배포하는 방법을 설명합니다.

## 📋 사전 요구사항

1. Google Cloud Platform (GCP) 계정
2. GCP 프로젝트 생성 완료
3. `gcloud` CLI 설치 및 인증 완료
4. GitHub 저장소 (ksy070822/kmcc_QC_dashbord)

## 🚀 배포 방법

### 방법 1: 수동 배포 (첫 배포 시 권장)

#### 1단계: GCP 프로젝트 설정

```bash
# 프로젝트 ID 설정 (실제 프로젝트 ID로 변경)
export PROJECT_ID="your-gcp-project-id"
gcloud config set project $PROJECT_ID
```

#### 2단계: 필요한 API 활성화

```bash
# Cloud Build API 활성화
gcloud services enable cloudbuild.googleapis.com

# Cloud Run API 활성화
gcloud services enable run.googleapis.com

# Artifact Registry API 활성화
gcloud services enable artifactregistry.googleapis.com

# BigQuery API 활성화
gcloud services enable bigquery.googleapis.com
```

#### 3단계: Artifact Registry 저장소 생성

```bash
# Docker 이미지 저장소 생성
gcloud artifacts repositories create kmcc-qc-dashboard \
  --repository-format=docker \
  --location=asia-northeast3 \
  --description="QC Dashboard Docker images"
```

#### 4단계: Cloud Build로 빌드 및 배포

```bash
# 프로젝트 루트에서 실행
cd /Users/may.08/Desktop/kmcc_qc_dashbord

# Cloud Build 제출
gcloud builds submit --config cloudbuild.yaml .
```

이 명령어는 다음을 수행합니다:
- Docker 이미지 빌드
- Artifact Registry에 이미지 푸시
- Cloud Run에 서비스 배포

#### 5단계: 배포 확인

```bash
# Cloud Run 서비스 목록 확인
gcloud run services list --region=asia-northeast3

# 서비스 URL 확인
gcloud run services describe qc-dashboard --region=asia-northeast3 --format="value(status.url)"
```

---

### 방법 2: GitHub 자동 배포 (권장)

#### 1단계: Cloud Build 트리거 생성

1. **Google Cloud Console 접속**
   - https://console.cloud.google.com

2. **Cloud Build → 트리거 메뉴 이동**
   - 좌측 메뉴에서 "Cloud Build" → "트리거" 선택

3. **트리거 만들기 클릭**

4. **트리거 설정:**
   - **이름**: `qc-dashboard-auto-deploy`
   - **이벤트**: `푸시 이벤트`
   - **소스**: GitHub 저장소 연결
     - "연결" 버튼 클릭
     - GitHub 인증 및 저장소 선택: `ksy070822/kmcc_QC_dashbord`
   - **브랜치**: `^main$` (main 브랜치만)
   - **빌드 구성**: `Cloud Build 구성 파일 (yaml 또는 json)`
   - **위치**: `cloudbuild.yaml` (프로젝트 루트)

5. **저장** 클릭

#### 2단계: 테스트

```bash
# main 브랜치에 푸시
git add .
git commit -m "Test Cloud Run deployment"
git push origin main
```

푸시 후 Cloud Build가 자동으로 빌드 및 배포를 시작합니다.

#### 3단계: 빌드 상태 확인

1. **Cloud Console → Cloud Build → 히스토리**
2. 빌드 진행 상황 확인
3. 빌드 완료 후 Cloud Run 서비스 URL 확인

---

## 🔐 BigQuery 인증 설정

Cloud Run 서비스가 BigQuery에 접근하려면 서비스 계정에 적절한 권한이 필요합니다.

### 1단계: Cloud Run 서비스 계정 확인

```bash
# 기본 Compute Engine 서비스 계정 사용
export SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# 또는 커스텀 서비스 계정 생성
gcloud iam service-accounts create qc-dashboard-sa \
  --display-name="QC Dashboard Service Account" \
  --description="Service account for QC Dashboard Cloud Run service"
```

### 2단계: BigQuery 권한 부여

```bash
# BigQuery 데이터 뷰어 역할 부여
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/bigquery.dataViewer"

# BigQuery 작업 사용자 역할 부여 (쿼리 실행)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/bigquery.jobUser"
```

### 3단계: Cloud Run 서비스에 서비스 계정 할당

```bash
# Cloud Run 서비스 업데이트
gcloud run services update qc-dashboard \
  --region=asia-northeast3 \
  --service-account=${SERVICE_ACCOUNT}
```

또는 `cloudbuild.yaml`에서 직접 설정:

```yaml
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: gcloud
  args:
    - 'run'
    - 'deploy'
    - 'qc-dashboard'
    # ... 기타 설정 ...
    - '--service-account'
    - '${SERVICE_ACCOUNT}'
```

---

## 🌍 환경 변수 설정

Cloud Run 서비스에 환경 변수를 설정할 수 있습니다.

### 방법 1: gcloud 명령어

```bash
gcloud run services update qc-dashboard \
  --region=asia-northeast3 \
  --set-env-vars="BIGQUERY_PROJECT_ID=csopp-25f2,BIGQUERY_DATASET_ID=KMCC_QC"
```

### 방법 2: Cloud Console

1. Cloud Run → 서비스 선택
2. "수정 및 새 버전 배포" 클릭
3. "변수 및 시크릿" 탭
4. 환경 변수 추가:
   - `BIGQUERY_PROJECT_ID`: `csopp-25f2`
   - `BIGQUERY_DATASET_ID`: `KMCC_QC`

### 방법 3: cloudbuild.yaml (이미 설정됨)

`cloudbuild.yaml` 파일에 이미 환경 변수가 설정되어 있습니다.

---

## 📊 서비스 모니터링

### 로그 확인

```bash
# 실시간 로그 확인
gcloud run services logs read qc-dashboard --region=asia-northeast3 --follow

# 최근 로그 확인
gcloud run services logs read qc-dashboard --region=asia-northeast3 --limit=50
```

### Cloud Console에서 확인

1. Cloud Run → 서비스 선택
2. "로그" 탭에서 로그 확인
3. "메트릭" 탭에서 성능 지표 확인

---

## 🔄 업데이트 및 재배포

### 수동 재배포

```bash
# 코드 수정 후
git add .
git commit -m "Update dashboard"
git push origin main

# Cloud Build 재실행
gcloud builds submit --config cloudbuild.yaml .
```

### 자동 재배포 (GitHub 트리거 설정 시)

```bash
# main 브랜치에 푸시하면 자동으로 재배포됨
git add .
git commit -m "Update dashboard"
git push origin main
```

---

## 🐛 문제 해결

### 빌드 실패

```bash
# 빌드 로그 확인
gcloud builds list --limit=5
gcloud builds log [BUILD_ID]
```

### 배포 실패

```bash
# Cloud Run 서비스 상태 확인
gcloud run services describe qc-dashboard --region=asia-northeast3

# 로그 확인
gcloud run services logs read qc-dashboard --region=asia-northeast3
```

### BigQuery 접근 오류

1. 서비스 계정 권한 확인:
   ```bash
   gcloud projects get-iam-policy $PROJECT_ID \
     --flatten="bindings[].members" \
     --filter="bindings.members:serviceAccount:${SERVICE_ACCOUNT}"
   ```

2. BigQuery 데이터셋 권한 확인:
   ```bash
   bq show --format=prettyjson KMCC_QC
   ```

### 메모리 부족 오류

`cloudbuild.yaml`에서 메모리 설정 증가:
```yaml
- '--memory'
- '4Gi'  # 2Gi에서 4Gi로 증가
```

---

## 💰 비용 최적화

### 최소 인스턴스 설정

```bash
# 항상 실행 (비용 증가, 응답 속도 향상)
gcloud run services update qc-dashboard \
  --region=asia-northeast3 \
  --min-instances=1

# 요청 시에만 실행 (비용 절감, 콜드 스타트 발생)
gcloud run services update qc-dashboard \
  --region=asia-northeast3 \
  --min-instances=0
```

### CPU 할당

```bash
# 항상 할당 (비용 증가, 성능 향상)
gcloud run services update qc-dashboard \
  --region=asia-northeast3 \
  --cpu-always-allocated

# 요청 시에만 할당 (비용 절감)
gcloud run services update qc-dashboard \
  --region=asia-northeast3 \
  --no-cpu-always-allocated
```

---

## 📝 체크리스트

배포 전 확인사항:

- [ ] GCP 프로젝트 생성 완료
- [ ] 필요한 API 활성화 완료
- [ ] Artifact Registry 저장소 생성 완료
- [ ] Cloud Build 트리거 설정 (자동 배포 시)
- [ ] BigQuery 서비스 계정 권한 설정 완료
- [ ] 환경 변수 설정 완료
- [ ] `cloudbuild.yaml` 프로젝트 ID 확인
- [ ] Dockerfile 및 .dockerignore 확인
- [ ] next.config.mjs standalone 설정 확인

---

## 🔗 유용한 링크

- [Cloud Run 문서](https://cloud.google.com/run/docs)
- [Cloud Build 문서](https://cloud.google.com/build/docs)
- [BigQuery 문서](https://cloud.google.com/bigquery/docs)
- [Artifact Registry 문서](https://cloud.google.com/artifact-registry/docs)

---

## 📞 지원

문제가 발생하면:
1. Cloud Build 로그 확인
2. Cloud Run 로그 확인
3. BigQuery 권한 확인
4. 환경 변수 확인
