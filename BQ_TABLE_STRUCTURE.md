# BigQuery 테이블 구조 (KMCC_QC)

> 프로젝트: `csopp-25f2` / 데이터셋: `KMCC_QC` / 리전: `asia-northeast3`

## 테이블 요약

| # | 테이블 | 행 수 | 파티션 | 용도 |
|---|--------|------:|--------|------|
| 1 | `evaluations` | 78,598 | evaluation_date (DAY) | QC 평가 원천 데이터 |
| 2 | `agents` | 427 | - | 상담사 마스터 |
| 3 | `users` | 321 | - | 대시보드 사용자 |
| 4 | `targets` | 7 | - | 센터별 목표 설정 |
| 5 | `underperforming_weekly` | 1,441 | report_date (DAY) | 주간 부진상담자 관리 |
| 6 | `qc_weekly_actions` | 1,324 | report_date (DAY) | 주간 QC 리포트 액션 |
| 7 | `qc_weekly_issues` | 998 | - | 서비스별 원인/방안 |
| 8 | `metrics_daily` | 0 | metric_date (DAY) | 일별 집계 |
| 9 | `predictions` | 0 | prediction_date (DAY) | 월말 예측 결과 |
| 10 | `watch_list` | 0 | - | 집중관리 대상 |
| 11 | `action_plans` | 0 | - | 개선 계획 |
| 12 | `underperforming_agents` | 0 | - | 부진자 현황 요약 |
| 13 | `weekly_reports` | 0 | report_date (DAY) | 주간 리포트 요약 |

---

## 테이블 관계도

```
[agents] 427명 ─────┬──→ [evaluations] 78,598건 (QC 평가 원천)
  상담사 마스터       │        ↓ 집계
                     │    [metrics_daily] (일별 오류율)
                     │    [predictions] (월말 예측)
                     │
                     ├──→ [underperforming_weekly] 1,441건 (부진자 주간 추적)
                     │        ↓ 요약
                     │    [underperforming_agents] (부진자 현황)
                     │    [watch_list] (집중관리)
                     │    [action_plans] (개선계획)
                     │
                     └──→ [qc_weekly_actions] 1,324건 (주간 리포트 액션)
                              │
                              └──→ [qc_weekly_issues] 998건 (서비스별 원인/방안)

[targets] 7건 ──→ 센터별 오류율 목표
[users] 321명 ──→ 대시보드 로그인/권한
[weekly_reports] ──→ 주간 리포트 요약 (CenterComparison용)
```

---

## 상세 스키마

### 1. evaluations (QC 평가 원천)
> 파티션: `evaluation_date` (DAY) | 78,598건

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| evaluation_id | STRING | O | PK |
| evaluation_date | DATE | O | 평가 일자 (파티션 키) |
| center | STRING | O | 센터 (용산/광주) |
| agent_id | STRING | O | 상담사 영문ID |
| agent_name | STRING | O | 상담사 한글명 |
| service | STRING | O | 서비스 (택시/퀵/대리/바이크마스/주차카오너) |
| channel | STRING | O | 채널 (유선/채팅) |
| group | STRING | O | 그룹 (서비스/채널 조합) |
| consultation_id | STRING | | 상담 건 ID |
| consultation_datetime | TIMESTAMP | | 상담 일시 |
| evaluation_round | STRING | | 평가 회차 |
| consult_type_depth1_1~4 | STRING | | 상담유형 1depth (4개) |
| consult_type_depth2_1~4 | STRING | | 상담유형 2depth (4개) |
| **상담태도 오류 (5개)** | | | |
| greeting_error | BOOLEAN | | 첫인사/끝인사 누락 |
| empathy_error | BOOLEAN | | 공감표현 누락 |
| apology_error | BOOLEAN | | 사과표현 누락 |
| additional_inquiry_error | BOOLEAN | | 추가문의 누락 |
| unkind_error | BOOLEAN | | 불친절 |
| **오상담/오처리 오류 (11개)** | | | |
| consult_type_error | BOOLEAN | | 상담유형 오설정 |
| guide_error | BOOLEAN | | 가이드 미준수 |
| identity_check_error | BOOLEAN | | 본인확인 누락 |
| required_search_error | BOOLEAN | | 필수탐색 누락 |
| wrong_guide_error | BOOLEAN | | 오안내 |
| process_missing_error | BOOLEAN | | 전산 처리 누락 |
| process_incomplete_error | BOOLEAN | | 전산 처리 미흡/정정 |
| system_error | BOOLEAN | | 전산 조작 미흡/오류 |
| id_mapping_error | BOOLEAN | | 콜/픽/트립ID 매핑누락 |
| flag_keyword_error | BOOLEAN | | 플래그/키워드 누락 |
| history_error | BOOLEAN | | 상담이력 기재 미흡 |
| **집계 컬럼** | | | |
| attitude_error_count | INTEGER | | 태도 오류 합계 |
| business_error_count | INTEGER | | 오상담 오류 합계 |
| total_error_count | INTEGER | | 전체 오류 합계 |
| comment | STRING | | 코멘트 |
| ai_evaluated | BOOLEAN | | AI 평가 여부 |
| ai_error | BOOLEAN | | AI 오류 여부 |
| content | STRING | | 상담 내용 |
| processed_date | DATE | | 처리 일자 |
| processor | STRING | | 처리자 |
| created_at | TIMESTAMP | O | 생성일 |
| updated_at | TIMESTAMP | O | 수정일 |
| source_row_index | INTEGER | | 원본 행 번호 |

**오류율 산출 공식:**
```
상담태도 오류율 = 태도오류건수 / (검수건수 x 5) x 100
오상담 오류율 = 오상담오류건수 / (검수건수 x 11) x 100
```

---

### 2. agents (상담사 마스터)
> 427건

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| agent_id | STRING | O | 영문ID (PK) |
| agent_name | STRING | O | 한글명 |
| odoo_id | STRING | | Odoo 사번 |
| center | STRING | O | 센터 |
| service | STRING | O | 서비스 |
| channel | STRING | O | 채널 |
| group | STRING | O | 그룹 |
| hire_date | DATE | | 입사일 |
| tenure_months | INTEGER | | 근속개월 |
| tenure | STRING | | 근속 구분 |
| manager | STRING | | 관리자 |
| group_change_info | STRING | | 그룹 변경 이력 |
| created_at | TIMESTAMP | O | |
| updated_at | TIMESTAMP | O | |

---

### 3. underperforming_weekly (주간 부진상담자)
> 파티션: `report_date` (DAY) | 1,441건

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| record_id | STRING | O | PK |
| center | STRING | | 센터 |
| report_week | STRING | | 주차 코드 (2025-W05) |
| report_week_label | STRING | | 주차 라벨 (2월 1주차) |
| report_date | DATE | | 리포트 기준일 |
| agent_name | STRING | | 상담사 한글명 |
| agent_english_id | STRING | | 상담사 영문ID |
| vertical | STRING | | 버티컬 |
| service | STRING | | 서비스 |
| channel | STRING | | 채널 |
| hire_date | DATE | | 입사일 |
| tenure_months | INTEGER | | 근속개월 |
| qc_attitude_error | BOOLEAN | | 태도 오류 여부 |
| qc_ops_error | BOOLEAN | | 오상담 오류 여부 |
| is_underperforming | BOOLEAN | | 부진 여부 |
| note | STRING | | 비고 |
| source_file | STRING | | 원본 파일명 |
| source_post_id | STRING | | 아지트 게시글 ID |
| underperforming_reason | STRING | | 부진 사유 |

---

### 4. qc_weekly_actions (주간 QC 리포트 액션)
> 파티션: `report_date` (DAY) | 1,324건

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| action_id | STRING | O | PK |
| post_id | STRING | O | 아지트 게시글 ID |
| parent_id | STRING | O | 부모 게시글 ID |
| center | STRING | | 센터 |
| report_week | STRING | | 주차 코드 |
| report_week_label | STRING | | 주차 라벨 |
| report_date | DATE | | 리포트 기준일 |
| service | STRING | | 서비스 |
| channel | STRING | | 채널 |
| item_seq | INTEGER | | 항목 순번 |
| item_name | STRING | | 항목명 |
| item_category | STRING | | 항목 분류 |
| cause | STRING | | 원인 |
| plan | STRING | | 개선 계획 |
| author_id | STRING | | 작성자 ID |
| created_at | TIMESTAMP | | 작성일 |

---

### 5. qc_weekly_issues (서비스별 원인/방안)
> 998건

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| record_id | STRING | O | PK |
| center | STRING | | 센터 |
| report_week_label | STRING | | 주차 라벨 |
| report_date | DATE | | 리포트 기준일 |
| source_post_id | STRING | | 아지트 댓글 ID |
| author_id | STRING | | 작성자 ID |
| report_type | STRING | | 리포트 유형 (전체서비스/화물/퀵) |
| service | STRING | | 서비스 (6개: 택시/대리/퀵/주차카오너/화물/바이크MaaS) |
| service_note | STRING | | 원본 서비스명 |
| item_no | INTEGER | | 항목 번호 (①②③...) |
| item_name | STRING | | 오류 항목명 |
| cause | STRING | | 원인 |
| action | STRING | | 개선 방안 |

---

### 6. targets (목표 설정)
> 7건

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| target_id | STRING | O | PK |
| center | STRING | | 센터 |
| service | STRING | | 서비스 |
| channel | STRING | | 채널 |
| group | STRING | | 그룹 |
| target_attitude_error_rate | FLOAT | | 태도 목표 오류율 |
| target_business_error_rate | FLOAT | | 오상담 목표 오류율 |
| target_overall_error_rate | FLOAT | | 전체 목표 오류율 |
| period_type | STRING | O | 기간 유형 |
| start_date | DATE | O | 시작일 |
| end_date | DATE | O | 종료일 |
| is_active | BOOLEAN | O | 활성 여부 |
| created_at | TIMESTAMP | O | |
| updated_at | TIMESTAMP | O | |

**2026년 목표:**
| 센터 | 태도 목표 | 오상담 목표 |
|:---|:---:|:---:|
| 용산 | 3.3% | 3.9% |
| 광주 | 2.7% | 1.7% |
| 전체 | 3.0% | 3.0% |

---

### 7. users (대시보드 사용자)
> 321건

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| user_id | STRING | O | PK |
| user_name | STRING | O | 사용자명 |
| email | STRING | | 이메일 |
| role | STRING | O | 역할 (hq_admin/team_lead/instructor/agent) |
| center | STRING | | 센터 |
| service | STRING | | 서비스 |
| channel | STRING | | 채널 |
| agent_id | STRING | | 상담사 ID (연결) |
| is_active | BOOLEAN | | 활성 여부 |
| password_hash | STRING | | 비밀번호 해시 |
| last_login | TIMESTAMP | | 최종 로그인 |
| created_at | TIMESTAMP | | |
| updated_at | TIMESTAMP | | |

---

### 8~13. 대시보드 기능 테이블 (빈 테이블)

#### metrics_daily (일별 집계)
> evaluations에서 일별로 집계하여 저장. 16개 항목별 오류 건수 + 오류율.

#### predictions (월말 예측)
> 현재 실적 기반 월말 예측 오류율, 달성 확률, 위험도 등.

#### watch_list (집중관리)
> 오류율 기준 초과 상담사/그룹 자동 등록.

#### action_plans (개선 계획)
> 부진 상담사별 개선 계획 및 피드백 이력.

#### underperforming_agents (부진자 요약)
> underperforming_weekly의 요약 뷰. 상담사별 추적 현황.

#### weekly_reports (주간 리포트 요약)
> 센터/서비스별 주간 오류율 요약 + 전주 대비 트렌드.
