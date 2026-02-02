#!/bin/bash
# splyquizkm KMCC_QC → csopp-25f2 KMCC_QC 테이블 복사
# 사용법: ./scripts/copy-bigquery-to-csopp.sh

set -e
SRC_PROJECT="splyquizkm"
DST_PROJECT="csopp-25f2"
DATASET="KMCC_QC"
LOCATION="asia-northeast3"

echo "📋 splyquizkm → csopp-25f2 BigQuery 복사"
echo ""

# 테이블 목록 조회
echo "1. 소스 테이블 목록 확인..."
TABLES=$(bq ls --project_id=$SRC_PROJECT --format=csv $SRC_PROJECT:$DATASET 2>/dev/null | tail -n +2 | cut -d',' -f1 | tr -d '"' || true)

if [ -z "$TABLES" ]; then
  # 알려진 테이블 사용
  TABLES="evaluations targets"
  echo "   기본 테이블 사용: $TABLES"
else
  echo "   발견된 테이블: $TABLES"
fi
echo ""

# 각 테이블 복사
for TABLE in $TABLES; do
  echo "2. 복사 중: $TABLE"
  bq cp --project_id=$SRC_PROJECT \
    $SRC_PROJECT:$DATASET.$TABLE \
    $DST_PROJECT:$DATASET.$TABLE
  echo "   ✅ $TABLE 완료"
  echo ""
done

echo "✅ 모든 테이블 복사 완료"
echo ""
echo "다음 단계: 배포 환경에 BIGQUERY_PROJECT_ID=csopp-25f2 설정"
