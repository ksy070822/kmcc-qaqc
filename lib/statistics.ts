import type { TrendAnalysis } from "@/lib/types"

/**
 * 주간 QC 추세 분석 (선형 회귀 기울기 기반)
 */
export function detectTrend(
  data: Array<{ weekIndex: number; value: number; evalCount: number }>,
): TrendAnalysis | null {
  if (data.length < 3) return null

  const n = data.length
  const values = data.map((d) => d.value)
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean)
    den += (i - xMean) ** 2
  }
  const slope = den !== 0 ? num / den : 0

  const intercept = yMean - slope * xMean
  let ssRes = 0
  let ssTot = 0
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i
    ssRes += (values[i] - predicted) ** 2
    ssTot += (values[i] - yMean) ** 2
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0
  const isSignificant = rSquared > 0.3 && Math.abs(slope) > 0.2

  const direction: TrendAnalysis["direction"] =
    slope < -0.3 ? "improving" : slope > 0.3 ? "deteriorating" : "stable"

  return {
    direction,
    slope: Math.round(slope * 1000) / 1000,
    pValue: Math.round((1 - rSquared) * 1000) / 1000,
    isSignificant,
    recentWeeks: n,
  }
}

/**
 * 베이지안 축소 추정 (Bayesian Shrinkage)
 * 개인 오류율을 그룹 평균 방향으로 보정. 검수 건수가 적을수록 그룹 평균에 가까워짐.
 *
 * @param individualRate 개인 오류율 (0~1)
 * @param sampleSize 개인 검수 건수
 * @param groupRate 그룹 평균 오류율 (0~1)
 * @param priorWeight 사전 가중치 (기본 10, 높을수록 그룹 평균에 가까워짐)
 * @returns 축소 추정된 오류율 (0~1)
 */
export function bayesianShrinkage(
  individualRate: number,
  sampleSize: number,
  groupRate: number,
  priorWeight: number = 10,
): number {
  if (sampleSize <= 0) return groupRate
  const shrunk = (sampleSize * individualRate + priorWeight * groupRate) / (sampleSize + priorWeight)
  return Math.max(0, Math.min(1, shrunk))
}

/**
 * 신입 안정화 지연 판정
 * 신입 상담사의 오류율이 동일 코호트 평균 + 1 표준편차 이상이면 안정화 지연으로 판정
 *
 * @param currentRate 현재 오류율 (%)
 * @param cohortAvg 코호트 평균 오류율 (%)
 * @param cohortStd 코호트 표준편차 (%)
 * @returns 안정화 지연 여부
 */
export function isStabilizationDelayed(
  currentRate: number,
  cohortAvg: number,
  cohortStd: number,
): boolean {
  return currentRate > cohortAvg + cohortStd
}

/**
 * 취약점 유의성 검정 (간이 z-test)
 * 카테고리 오류율이 그룹 평균보다 유의하게 높은지 판정
 *
 * @param errorRate 개인 카테고리 오류율
 * @param groupRate 그룹 카테고리 평균 오류율
 * @param sampleSize 검수 건수
 * @returns { significant: boolean; zScore: number }
 */
export function testWeaknessSignificance(
  errorRate: number,
  groupRate: number,
  sampleSize: number,
): { significant: boolean; zScore: number } {
  if (sampleSize < 5) return { significant: false, zScore: 0 }

  const se = Math.sqrt((groupRate * (1 - groupRate)) / sampleSize)
  if (se === 0) return { significant: errorRate > groupRate, zScore: errorRate > groupRate ? 999 : 0 }

  const zScore = (errorRate - groupRate) / se
  return {
    significant: zScore > 1.645, // one-tailed 95% confidence
    zScore: Math.round(zScore * 100) / 100,
  }
}
