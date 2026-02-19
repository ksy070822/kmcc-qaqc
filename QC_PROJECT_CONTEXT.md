# QC 대시보드 프로젝트 컨텍스트

> 이 문서는 AI 코딩 도구(Claude Code, Cursor 등)가 프로젝트 맥락을 이해하고 작업을 이어갈 수 있도록 작성되었습니다.

---

## 📋 프로젝트 개요

### 담당자 정보
- **담당자**: 메이 (CX Synergy팀)
- **회사**: 카카오모빌리티 고객센터
- **역할**: QC(Quality Control) 품질관리 운영

### 프로젝트 목적
고객센터 상담 품질을 실시간으로 모니터링하고, **월말 목표 달성 여부를 예측**하여 선제적으로 대응하는 대시보드 시스템 구축

---

## 🏢 비즈니스 컨텍스트

### 조직 구조
```
카카오모빌리티 고객센터
├── 용산센터 (약 200명)
│   ├── 택시 (유선/채팅)
│   ├── 퀵 (유선/채팅)
│   ├── 대리 (유선/채팅)
│   └── 배송 (유선/채팅)
│
└── 광주센터 (약 100명)
    ├── 택시 (유선/채팅)
    ├── 퀵 (유선/채팅)
    ├── 대리 (유선/채팅)
    ├── 바이크/마스 (유선/채팅)
    ├── 주차/카오너 (유선/채팅)
    ├── 화물 (유선/채팅)
    └── 지금여기 (유선/채팅)
```

### 서비스 및 채널
| 서비스 | 설명 |
|:---|:---|
| 택시 | 카카오택시 관련 상담 |
| 퀵 | 퀵서비스 상담 |
| 대리 | 대리운전 상담 |
| 바이크/마스 | 바이크 배달 상담 |
| 주차/카오너 | 주차 서비스 상담 |
| 화물 | 화물 운송 상담 |
| 지금여기 | 위치 기반 서비스 상담 |

| 채널 | 설명 |
|:---|:---|
| 유선 | 전화 상담 |
| 채팅 | 카카오톡 채팅 상담 |

---

## 📊 QC 평가 체계

### 평가 항목

#### 상담태도 (5개 항목)
| 항목 | 코드명 | 설명 |
|:---|:---|:---|
| 첫인사/끝인사 누락 | `greeting_error` | 인사말 미사용 |
| 공감표현 누락 | `empathy_error` | 고객 감정에 공감 표현 없음 |
| 사과표현 누락 | `apology_error` | 불편 상황에 사과 없음 |
| 추가문의 누락 | `additional_inquiry_error` | 추가 도움 필요 여부 미확인 |
| 불친절 | `unkind_error` | 불친절한 응대 |

#### 오상담/오처리 (11개 항목)
| 항목 | 코드명 | 설명 |
|:---|:---|:---|
| 상담유형 오설정 | `consult_type_error` | 상담 분류 잘못 선택 |
| 가이드 미준수 | `guide_error` | 정해진 안내 절차 미준수 |
| 본인확인 누락 | `identity_check_error` | 본인 확인 절차 생략 |
| 필수탐색 누락 | `required_search_error` | 필수 정보 조회 생략 |
| 오안내 | `wrong_guide_error` | 잘못된 정보 안내 |
| 전산 처리 누락 | `process_missing_error` | 시스템 처리 누락 |
| 전산 처리 미흡/정정 | `process_incomplete_error` | 불완전한 처리 |
| 전산 조작 미흡/오류 | `system_error` | 시스템 조작 오류 |
| 콜/픽/트립ID 매핑누락 | `id_mapping_error` | ID 기재 누락/오류 |
| 플래그/키워드 누락 | `flag_keyword_error` | 태그 미기재 |
| 상담이력 기재 미흡 | `history_error` | 상담 내용 기록 부실 |

### 오류율 계산 공식

```
상담태도 오류율 = (태도 오류 건수) / (검수 건수 × 5) × 100
오상담 오류율 = (오상담 오류 건수) / (검수 건수 × 11) × 100
```

**중요**: 검수 1건에서 여러 오류가 발생할 수 있으므로, 분모는 `검수 건수 × 항목 수`

#### 계산 예시
```
검수 100건, 태도 오류 15건 발생 시:
태도 오류율 = 15 / (100 × 5) × 100 = 3.0%

검수 100건, 오상담 오류 22건 발생 시:
오상담 오류율 = 22 / (100 × 11) × 100 = 2.0%
```

---

## 🎯 2026년 목표

### 센터별 월간 목표
| 센터 | 상담태도 목표 | 오상담 목표 |
|:---|:---:|:---:|
| **용산** | 3.3% 이하 | 3.9% 이하 |
| **광주** | 2.7% 이하 | 1.7% 이하 |
| **전체** | 3.0% 이하 | 3.0% 이하 |

### 목표 설정 배경
- 2025년 실적 기반으로 설정
- 광주가 용산보다 엄격한 이유: 2025년 광주 실적이 더 좋았음
- 분기/연간 단위로도 관리하지만, 월간 목표가 핵심

---

## 📈 예측 모델 로직

### 1. 주차 정의
```javascript
function getWeek(day) {
  if (day <= 5) return 'W1';   // 1~5일
  if (day <= 12) return 'W2';  // 6~12일
  if (day <= 19) return 'W3';  // 13~19일
  return 'W4';                  // 20~31일
}
```

### 2. 월말 예측 알고리즘

```javascript
function predictMonthEnd(currentRate, weeklyRates, daysPassed, daysRemaining) {
  const totalDays = 31;
  
  // W4 예측: 최근 추세 반영 (W2→W3 변화량을 W3→W4에 적용)
  const weeklyChange = weeklyRates[2] - weeklyRates[1];  // W3 - W2
  const w4Predicted = Math.max(0, weeklyRates[2] + weeklyChange);
  
  // 월말 예측: 가중 평균
  const predicted = (currentRate * daysPassed + w4Predicted * daysRemaining) / totalDays;
  
  return { predicted, w4Predicted };
}
```

### 3. 추세 판정

```javascript
function determineTrend(weeklyRates) {
  const recentChange = weeklyRates[2] - weeklyRates[1];  // W3 - W2
  
  if (recentChange < -0.3) return 'improving';  // 0.3%p 이상 개선
  if (recentChange > 0.3) return 'worsening';   // 0.3%p 이상 악화
  return 'stable';
}
```

### 4. 위험도 판정

| 레벨 | 조건 | 의미 |
|:---|:---|:---|
| 🟢 `low` | 달성확률 70%↑, 추세 개선/유지 | 안정 |
| 🟡 `medium` | 달성확률 40~70%, 목표×1.1 이내 | 관찰 필요 |
| 🟠 `high` | 달성확률 20~40%, 악화 추세 | 주의 필요 |
| 🔴 `critical` | 달성확률 20%↓, 목표×1.3 초과 | 긴급 대응 |

```javascript
function determineRiskLevel(predicted, target, trend, achievementProb) {
  if (achievementProb >= 70 && (trend === 'improving' || trend === 'stable')) {
    return 'low';
  }
  if (achievementProb >= 40 && predicted <= target * 1.1) {
    return 'medium';
  }
  if (achievementProb >= 20 || predicted <= target * 1.3) {
    return 'high';
  }
  return 'critical';
}
```

### 5. 집중관리(Watch List) 자동 등록 조건

다음 중 하나라도 해당되면 자동 등록:
1. **목표 달성 확률 30% 미만**
2. **전주 대비 50% 이상 급등** (급격한 악화)
3. **악화 추세 + 목표 초과**
4. **Critical 위험도**
5. **상담사: 태도 5% 초과 또는 오상담 6% 초과**

---

## 📊 분석 결과 (2026년 1월 기준)

### 용산센터 그룹별 현황 및 예측

| 그룹 | 검수 | 태도현재 | 태도예측 | 태도판정 | 오상담현재 | 오상담예측 | 오상담판정 | 종합 |
|:---|---:|---:|---:|:---:|---:|---:|:---:|:---:|
| 택시 채팅 | 317 | 2.78% | 2.46% | ✅ | 4.01% | 3.82% | ✅ | 🟢 |
| 택시 유선 | 370 | 5.08% | 4.84% | ❌ | 6.71% | 7.16% | ❌ | 🔴 |
| 퀵 채팅 | 254 | 4.65% | 5.45% | ❌ | 4.62% | 4.67% | ❌ | 🔴 |
| 퀵 유선 | 557 | 7.61% | 8.23% | ❌ | 4.83% | 3.72% | ✅ | 🟠 |
| **종합** | 1500 | 5.45% | 5.51% | ❌ | 5.08% | 4.78% | ❌ | 🔴 |

### 집중관리 대상 상담사 TOP 10

| 순위 | 그룹 | 이름 | 태도율 | 오상담율 | 주요 오류 |
|:---:|:---|:---|---:|---:|:---|
| 1 | 택시유선 | 이선희 | 18.57% | 8.44% | 공감(12) |
| 2 | 퀵유선 | 송은규 | 17.27% | 9.50% | 공감(19), 상담유형(9) |
| 3 | 퀵유선 | 장성수 | 16.00% | 4.36% | 공감(20) |
| 4 | 택시유선 | 김보은 | 15.00% | 13.64% | 공감(8), 상담유형(6) |
| 5 | 택시유선 | 윤하정 | 14.55% | 6.61% | 공감(8) |

### 핵심 발견사항
1. **공감표현 누락**이 전 그룹 공통 최다 오류
2. **상담유형 오설정**이 2위 오류
3. **유선 채널**이 채팅보다 오류율 2배 이상 높음
4. 총 **44명** 집중관리 대상 식별

---

## 🛠️ 기술 스택

### 현재 구조
```
kmcc_QC_dashbord/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 메인 대시보드
│   ├── api/
│   │   ├── bigquery-sync/ # 데이터 동기화 API
│   │   └── predictions/   # 예측 API (추가 예정)
│   └── ...
├── components/             # React 컴포넌트
├── hooks/                  # React hooks
├── lib/
│   ├── bigquery.ts        # BigQuery 연결
│   ├── types.ts           # 타입 정의
│   └── predictions.ts     # 예측 로직 (추가 예정)
└── ...
```

### 인프라
| 항목 | 현재 | 목표 |
|:---|:---|:---|
| **호스팅** | GCP Cloud Run | GCP Cloud Run |
| **데이터베이스** | (없음) | BigQuery |
| **프로젝트** | - | csopp-25f2 |
| **데이터셋** | - | KMCC_QC |
| **리전** | - | asia-northeast3 (서울) |

### BigQuery 테이블 구조

```
KMCC_QC 데이터셋
├── evaluations      # 원천 평가 데이터 (파티션: evaluation_date)
├── agents           # 상담사 마스터
├── metrics_daily    # 일별 집계 (파티션: metric_date)
├── predictions      # 월말 예측 결과 (파티션: prediction_date)
├── watch_list       # 집중관리 대상
└── targets          # 목표 설정
```

---

## 🔄 데이터 흐름

```
[데이터 원천]                    [BigQuery]                    [대시보드]
                                
구글시트 (용산/광주)              evaluations                   메인 대시보드
    │                               │                              │
    │ Apps Script                   │ 집계 쿼리                    │ API 호출
    │ (매일 새벽)                   ▼                              │
    │                           metrics_daily                      │
    └───────────────────────────────┤                              │
                                    │ 예측 로직                    │
                                    ▼                              │
                                predictions ──────────────────────▶│
                                    │                              │
                                    │ 위험도 판정                  │
                                    ▼                              │
                                watch_list ───────────────────────▶│
```

---

## 📝 API 엔드포인트

### 구현 완료
| 엔드포인트 | 메서드 | 설명 |
|:---|:---|:---|
| `/api/bigquery-sync` | POST | 구글시트 → BigQuery 동기화 |

### 구현 예정
| 엔드포인트 | 메서드 | 설명 |
|:---|:---|:---|
| `/api/dashboard` | GET | 대시보드 메인 데이터 |
| `/api/predictions` | GET | 월말 예측 데이터 |
| `/api/agents` | GET | 상담사 목록 |
| `/api/agents/[id]` | GET | 상담사 상세 |
| `/api/watch-list` | GET/POST | 집중관리 목록 |
| `/api/reports` | GET | 리포트 생성 |

---

## ⚠️ 중요 사항

### 오류율 계산 주의점
- 분모는 `검수 건수 × 항목 수` (태도는 ×5, 오상담은 ×11)
- 검수 1건에서 여러 오류 발생 가능
- Y/N 플래그를 BOOL로 변환하여 집계

### 예측 모델 주의점
- 주차별 데이터가 2주 이상 있어야 추세 예측 가능
- W1은 데이터가 적어 변동성 큼 (5일치)
- 월초(1~5일)에는 예측 신뢰도 낮음

### 센터별 차이
- 용산/광주 목표가 다름 (광주가 더 엄격)
- 서비스 구성이 다름 (광주가 더 다양)
- 필터링 시 센터 구분 필수

---

## 🚀 다음 작업

### 즉시 필요
1. [ ] BigQuery 테이블 생성 (`KMCC_QC_tables.sql` 실행)
2. [ ] `lib/bigquery.ts` - DATASET_ID를 `KMCC_QC`로 변경
3. [ ] `lib/predictions.ts` 파일 추가
4. [ ] `/app/api/predictions/route.ts` API 추가
5. [ ] 대시보드 컴포넌트에서 예측 데이터 연동

### 승인 대기
1. [ ] Cloud Run 배포 권한
2. [ ] BigQuery 서비스 계정 권한

### 이후 작업
1. [ ] Cloud Run 배포 설정 (Dockerfile)
2. [ ] Apps Script 트리거 설정 (자동 동기화)
3. [ ] IAP 인증 설정 (회사 계정만 접근)

---

## 📚 참고 파일

| 파일 | 설명 |
|:---|:---|
| `KMCC_QC_tables.sql` | BigQuery 테이블 생성 SQL |
| `predictions_api.ts` | 예측 로직 TypeScript 코드 |
| `CLAUDE_CODE_작업가이드.md` | 상세 작업 가이드 |

---

## 💬 용어 정리

| 용어 | 설명 |
|:---|:---|
| QC | Quality Control, 품질관리 |
| 검수 | 상담 품질 평가 1건 |
| 태도 오류 | 상담 태도 관련 오류 (5개 항목) |
| 오상담 | 업무 처리 관련 오류 (11개 항목) |
| 집중관리 | 고위험 상담사/그룹 관리 |
| Watch List | 집중관리 대상 목록 |
| W1/W2/W3/W4 | 월간 주차 구분 |

---

*Last Updated: 2026-01-20*
*Author: Claude (Anthropic)*
*For: Claude Code, Cursor AI*
