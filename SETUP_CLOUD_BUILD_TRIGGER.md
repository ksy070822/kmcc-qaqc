# Cloud Build 트리거 설정 가이드 (조직 정책 제약 해결)

## 문제
`gcloud builds submit` 명령어가 조직 정책 제약으로 인해 실패합니다.

## 해결: Cloud Build 트리거 사용

GitHub에 푸시하면 자동으로 서울 리전에서 빌드되도록 트리거를 설정합니다.

## 설정 단계

### 1단계: Cloud Console 접속

1. https://console.cloud.google.com 접속
2. 프로젝트 `splyquizkm` 선택
3. **Cloud Build** → **트리거** 메뉴로 이동
   - 또는 직접 URL: https://console.cloud.google.com/cloud-build/triggers?project=splyquizkm

### 2단계: 트리거 만들기

1. **"트리거 만들기"** 버튼 클릭

2. **이름**: `qc-dashboard-auto-deploy`

3. **이벤트**: `푸시 이벤트` 선택

4. **소스**: 
   - **"연결"** 버튼 클릭
   - GitHub 인증
   - 저장소 선택: `may070822/kmcc-qc-dashbord`
   - **"연결"** 클릭

5. **브랜치**: `^main$` (main 브랜치만)

6. **빌드 구성**:
   - `Cloud Build 구성 파일 (yaml 또는 json)` 선택
   - **위치**: `cloudbuild.yaml`

7. **중요: 리전 설정**
   - **"고급"** 섹션 펼치기
   - **"리전"** 필드에 `asia-northeast3` 입력
   - 또는 드롭다운에서 **"asia-northeast3 (Seoul)"** 선택

8. **대체 변수 (Substitutions)**:
   - `_SERVICE_NAME`: `qc-dashboard`
   - `_REGION`: `asia-northeast3`

9. **"만들기"** 버튼 클릭

### 3단계: 트리거 테스트

```bash
# GitHub에 푸시하면 자동으로 빌드 시작
git add .
git commit -m "Test Cloud Build trigger"
git push may main
```

### 4단계: 빌드 상태 확인

1. **Cloud Console** → **Cloud Build** → **히스토리**
2. 빌드 진행 상황 확인
3. 빌드 완료 후 Cloud Run 서비스 확인

## 트리거 설정 확인

트리거가 올바르게 설정되었는지 확인:

```bash
# 트리거 목록 확인
gcloud builds triggers list --region=asia-northeast3

# 트리거 상세 정보 확인
gcloud builds triggers describe [TRIGGER_ID] --region=asia-northeast3
```

## 문제 해결

### 트리거가 실행되지 않는 경우

1. **트리거 리전 확인**
   - 트리거 편집 → 리전이 `asia-northeast3`인지 확인

2. **GitHub 연결 확인**
   - 트리거 설정 → 소스 연결 상태 확인

3. **브랜치 패턴 확인**
   - `^main$` 패턴이 올바른지 확인

### 빌드는 시작되지만 실패하는 경우

1. **빌드 로그 확인**
   ```bash
   gcloud builds list --region=asia-northeast3 --limit=5
   gcloud builds log [BUILD_ID] --region=asia-northeast3
   ```

2. **Artifact Registry 권한 확인**
   - Cloud Build 서비스 계정에 Artifact Registry Writer 권한 필요

3. **Cloud Run 권한 확인**
   - Cloud Build 서비스 계정에 Cloud Run Admin 권한 필요

## 권한 설정 (필요시)

```bash
PROJECT_ID="splyquizkm"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Artifact Registry 권한
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Cloud Run 권한
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Service Account User 권한
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

## 자동 배포 확인

트리거 설정 후:
- `main` 브랜치에 푸시하면 자동으로 빌드 시작
- 빌드 완료 후 자동으로 Cloud Run 배포
- 모든 작업이 서울 리전(`asia-northeast3`)에서 실행됨
