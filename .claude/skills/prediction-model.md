# 월말 예측 모델 도메인 지식

## 주차 정의
- W1: 1~5일 (5일, 변동성 큼)
- W2: 6~12일 (7일)
- W3: 13~19일 (7일)
- W4: 20~31일 (12일, 가장 긴 구간)

## 예측 알고리즘

### W4 예측
```
W4_predicted = W3_rate + (W3_rate - W2_rate)
```
W2→W3 변화량을 W3→W4에 적용 (추세 연장).

### 월말 예측
```
predicted = (current_rate x days_passed + W4_predicted x days_remaining) / 31
```
경과일과 잔여일의 가중 평균.

### 주의사항
- 월초(1~5일)에는 W1 데이터만 있어 예측 신뢰도 낮음
- 주차별 데이터 2주 이상 필요
- `Math.max(0, ...)` 처리로 음수 방지

## 추세 판정
| 추세 | 조건 | 의미 |
|:---|:---|:---|
| improving | W3-W2 < -0.3%p | 개선 중 |
| stable | \|W3-W2\| <= 0.3%p | 안정적 |
| worsening | W3-W2 > 0.3%p | 악화 중 |

## 위험도 판정
| 레벨 | 달성확률 | 추가 조건 |
|:---|:---|:---|
| low | 70%+ | 추세 improving/stable |
| medium | 40-70% | predicted <= target x 1.1 |
| high | 20-40% | 악화 추세 |
| critical | <20% | predicted > target x 1.3 |

## 집중관리(Watch List) 자동 등록
다음 중 하나 해당 시 자동 등록:
1. 달성 확률 30% 미만
2. 전주 대비 50% 이상 급등
3. 악화 추세 + 목표 초과
4. Critical 위험도
5. 상담사: 태도 5%초과 또는 오상담 6%초과

## 관련 파일
- `lib/predictions.ts` - 예측 로직 구현
- `hooks/use-predictions.ts` - 예측 데이터 React hook
- `app/api/predictions/route.ts` - 예측 API
