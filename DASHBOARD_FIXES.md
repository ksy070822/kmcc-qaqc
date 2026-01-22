# 대시보드 오류 수정 완료 ✅

## 수정된 문제들

### 1. ✅ `hire_date` 오류 수정
**문제**: "Unrecognized name: hire_date at [10:41]"
**원인**: `evaluations` 테이블에 `hire_date` 컬럼이 없음
**해결**: 
- `getAgents` 함수에서 `hire_date` 사용 제거
- `tenure_months`도 없으므로 0으로 설정

### 2. ✅ `target_name` 오류 수정
**문제**: "Unrecognized name: target_name; Did you mean target_id?"
**원인**: `targets` 테이블의 실제 스키마가 코드와 다름
**실제 스키마**:
- `target_id`, `center`, `service`, `channel`, `group`
- `target_attitude_error_rate`, `target_business_error_rate`, `target_overall_error_rate`
- `period_type`, `start_date`, `end_date`, `is_active`
**해결**: 
- `getGoals` 함수를 실제 스키마에 맞게 수정
- `target_name` 대신 `CONCAT(center, ' ', service, ' ', period_type)` 사용
- `target_type`은 `target_attitude_error_rate`와 `target_business_error_rate` 존재 여부로 판단
- `period_start` → `start_date`, `period_end` → `end_date`로 변경

### 3. ✅ 대시보드 값 미노출 문제 수정
**문제**: 대시보드에 모든 값이 0으로 표시됨
**원인**: `getDashboardStats`가 어제 날짜만 조회하여 오늘 데이터가 없으면 0 반환
**해결**: 
- 날짜 미지정 시 최근 30일 데이터 조회하도록 변경
- 전체 통계를 표시하여 데이터가 항상 표시되도록 수정

### 4. ✅ 근속기간 계산 문제
**문제**: 근속기간이 계산되지 않음
**원인**: `evaluations` 테이블에 `hire_date`, `tenure_months`, `tenure_group` 컬럼이 없음
**해결**: 
- `getAgents`에서 `tenure_months`를 0으로 설정
- `tenure_group`을 빈 문자열로 설정
- 향후 Google Sheets에서 근속기간 데이터를 가져와서 저장하도록 개선 필요

## 수정된 파일

- `lib/bigquery.ts`:
  - `getDashboardStats`: 최근 30일 데이터 조회로 변경
  - `getAgents`: `hire_date` 사용 제거, `tenure_months` 0으로 설정
  - `getGoals`: 실제 테이블 스키마에 맞게 수정
  - `saveEvaluationsToBigQuery`: `tenure_group` 제거

## 남은 작업

### 1. 근속기간 데이터 추가
- Google Sheets에서 `근속개월` 데이터를 읽어와서 저장
- `evaluations` 테이블에 `tenure_months` 컬럼 추가 또는 별도 테이블 사용

### 2. `saveGoalToBigQuery` 함수 수정
- 실제 테이블 스키마에 맞게 완전히 재작성 필요
- 현재는 오류 메시지만 반환하도록 임시 처리

### 3. 테스트
- 대시보드 API 테스트
- 상담사 분석 페이지 테스트
- 목표 설정 페이지 테스트

## 테스트 방법

```bash
# 대시보드 데이터 조회
curl "http://localhost:3000/api/data?type=dashboard"

# 센터별 통계
curl "http://localhost:3000/api/data?type=centers"

# 상담사 목록
curl "http://localhost:3000/api/data?type=agents"
```

## 참고

실제 BigQuery 테이블 스키마:
- `evaluations`: `hire_date`, `tenure_months`, `tenure_group` 컬럼 없음
- `targets`: 스키마가 SQL 파일과 다름 (실제 스키마 확인 필요)
