# AI 비용 보호 가이드

## 개요

이 문서는 Vertex AI/Google AI API 사용 시 비용 폭증을 방지하기 위한 안전장치에 대해 설명합니다.

## 현재 구현된 보호 장치

### 1. Rate Limiting (요청 빈도 제한)
- **1분당 최대 10회 요청**
- **1시간당 최대 100회 요청**
- 초과 시 자동 차단

### 2. 프롬프트 길이 제한
- **최대 프롬프트 길이: 50,000자** (약 12,500 토큰)
- **최대 사용자 메시지: 5,000자**
- 초과 시 요청 거부

### 3. 비용 추정 및 경고
- 요청 전 비용 추정
- **100원 이상**: 경고 로깅
- **500원 이상**: 경고 로깅 + 모니터링
- **1,000원 이상**: 자동 차단

### 4. 요청 로깅
- 모든 AI 요청을 로깅하여 비용 추적
- 예상 토큰 수, 예상 비용, 응답 시간 기록

## 비용 모니터링

### Cloud Console에서 확인
1. **Billing Dashboard**: https://console.cloud.google.com/billing
2. **API & Services > Quotas**: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
3. **Cloud Monitoring**: https://console.cloud.google.com/monitoring

### 예산 알림 설정 (권장)

```bash
# 예산 생성
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="AI API Monthly Budget" \
  --budget-amount=100000 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100 \
  --projects=splyquizkm
```

## 추가 보호 조치 권장사항

### 1. Google Cloud Budget Alert 설정
- 월별 예산 한도 설정
- 50%, 90%, 100% 임계값에서 알림
- 자동 비용 제한 (선택)

### 2. API 할당량 제한
- Google Cloud Console에서 API 할당량 설정
- 일일/월별 사용량 제한

### 3. 환경 변수 보안
- **절대 하드코딩하지 않음** ✅
- Cloud Run 환경 변수로만 설정
- Secret Manager 사용 권장

### 4. 모니터링 대시보드
- Cloud Monitoring에서 AI API 사용량 추적
- 비용 추이 차트 설정

## 현재 설정 확인

### API 키 확인
```bash
# Cloud Run 환경 변수 확인
gcloud run services describe qc-dashboard \
  --region=asia-northeast3 \
  --format="value(spec.template.spec.containers[0].env)"
```

### Rate Limit 설정 확인
- 파일: `lib/ai-cost-protection.ts`
- `MAX_REQUESTS_PER_WINDOW`: 1분당 최대 요청 수
- `MAX_REQUESTS_PER_HOUR`: 1시간당 최대 요청 수

## 비용 최적화 팁

1. **프롬프트 최적화**: 불필요한 데이터 제거
2. **캐싱 활용**: 동일한 질문에 대한 응답 캐싱
3. **모델 선택**: `gemini-2.0-flash-exp` (가장 저렴)
4. **배치 처리**: 여러 요청을 하나로 묶기 (현재 미구현)

## 문제 발생 시 대응

### 비용 급증 감지 시
1. 즉시 API 키 비활성화
2. Cloud Run 서비스 일시 중지
3. 로그 확인하여 원인 파악
4. Rate limit 설정 강화

### API 키 비활성화
```bash
# Google AI Studio에서 API 키 삭제/비활성화
# https://aistudio.google.com/app/apikey
```

## 참고 자료

- [Google AI API 가격](https://ai.google.dev/pricing)
- [Cloud Billing 문서](https://cloud.google.com/billing/docs)
- [API 할당량 관리](https://cloud.google.com/apis/docs/capping-api-usage)
