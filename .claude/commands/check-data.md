# BigQuery 데이터 점검

## 수행 작업
1. 각 테이블의 최신 데이터 날짜 확인
2. 센터별 데이터 건수 확인
3. 오류율 계산 검증
4. 이상 데이터 탐지

## 점검 스크립트
```bash
# 최신 날짜 확인
npx ts-node scripts/check-latest-date.ts

# 센터별 건수
npx ts-node scripts/check-center-counts.ts

# 스키마 확인
npx ts-node scripts/check-schema.ts

# Sheets vs BigQuery 비교
npx ts-node scripts/compare-sheets-bigquery.ts
```

## 점검 항목
- evaluations 테이블 최신 날짜
- 용산/광주 센터별 검수 건수 균형
- 오류율 공식 적용 정확성 (태도: /5, 오상담: /11)
- 날짜 포맷 일관성 (YYYY-MM-DD)
