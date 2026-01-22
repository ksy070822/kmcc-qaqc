# AI 비용 보호 체크리스트

## ✅ 구현 완료된 보호 장치

### 1. 코드 레벨 보호
- [x] **Rate Limiting**: 1분당 10회, 1시간당 100회 제한
- [x] **프롬프트 길이 제한**: 최대 50,000자
- [x] **메시지 길이 제한**: 최대 5,000자
- [x] **비용 추정**: 요청 전 비용 계산
- [x] **자동 차단**: 1,000원 이상 요청 차단
- [x] **요청 로깅**: 모든 AI 요청 기록
- [x] **API 키 보안**: 하드코딩 제거, 환경 변수만 사용

### 2. 현재 사용 중인 API
- ✅ **Google AI Studio API** (Vertex AI 아님)
- ✅ 모델: `gemini-2.0-flash-exp` (가장 저렴한 모델)
- ❌ Vertex AI 미사용 (비용 문제 없음)

## ⚠️ 추가 설정 필요 사항

### 1. Cloud Run 환경 변수 확인
```bash
# 환경 변수 확인
gcloud run services describe qc-dashboard \
  --region=asia-northeast3 \
  --format="yaml(spec.template.spec.containers[0].env)"

# 환경 변수 설정 (필요시)
gcloud run services update qc-dashboard \
  --region=asia-northeast3 \
  --set-env-vars="GOOGLE_AI_API_KEY=YOUR_API_KEY,GOOGLE_AI_MODEL=gemini-2.0-flash-exp"
```

### 2. GCP Budget Alert 설정 (권장)
1. **Cloud Console 접속**
   - https://console.cloud.google.com/billing/budgets?project=splyquizkm

2. **예산 생성**
   - 월별 예산: 100,000원 (또는 적절한 금액)
   - 알림 임계값: 50%, 90%, 100%
   - 이메일 알림 설정

3. **또는 스크립트 사용**
   ```bash
   ./setup-budget-alert.sh
   ```

### 3. API 할당량 제한 설정 (권장)
1. **Google Cloud Console 접속**
   - https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

2. **할당량 설정**
   - 일일 요청 수 제한
   - 분당 요청 수 제한

### 4. Secret Manager 사용 (권장)
```bash
# API 키를 Secret Manager에 저장
echo -n "YOUR_API_KEY" | gcloud secrets create google-ai-api-key \
  --data-file=- \
  --replication-policy="automatic"

# Cloud Run에 Secret 연결
gcloud run services update qc-dashboard \
  --region=asia-northeast3 \
  --update-secrets="GOOGLE_AI_API_KEY=google-ai-api-key:latest"
```

## 📊 비용 모니터링

### 현재 비용 확인
1. **Billing Dashboard**
   - https://console.cloud.google.com/billing?project=splyquizkm

2. **API 사용량**
   - https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas?project=splyquizkm

3. **Cloud Monitoring**
   - https://console.cloud.google.com/monitoring?project=splyquizkm

### 비용 추이 확인
- 일일/월별 사용량 추이 확인
- 서비스별 비용 분석
- 이상 패턴 감지

## 🚨 비용 급증 시 대응

### 즉시 조치
1. **API 키 비활성화**
   - https://aistudio.google.com/app/apikey
   - 해당 API 키 삭제 또는 비활성화

2. **Cloud Run 서비스 일시 중지**
   ```bash
   gcloud run services update qc-dashboard \
     --region=asia-northeast3 \
     --no-traffic
   ```

3. **로그 확인**
   ```bash
   gcloud run services logs read qc-dashboard \
     --region=asia-northeast3 \
     --limit=100
   ```

### 원인 파악
- Rate limit 설정 확인
- 비정상적인 요청 패턴 확인
- 프롬프트 길이 확인

## 📝 정기 점검 사항

### 주간 점검
- [ ] API 사용량 확인
- [ ] 비용 추이 확인
- [ ] 로그에서 이상 패턴 확인

### 월간 점검
- [ ] 예산 대비 실제 비용 확인
- [ ] Rate limit 설정 조정 필요 여부 확인
- [ ] 비용 최적화 기회 확인

## 🔗 관련 문서
- [AI_COST_PROTECTION.md](./AI_COST_PROTECTION.md) - 상세 보호 장치 설명
- [setup-budget-alert.sh](./setup-budget-alert.sh) - 예산 알림 설정 스크립트
