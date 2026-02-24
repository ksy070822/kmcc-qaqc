/**
 * 통계 엔진 - QC 편향 보정, 추세 감지, 유의성 검정
 *
 * QC 평가는 무작위 샘플이 아닌 부진자/신입 우선 대상이므로
 * 베이지안 축소 추정으로 편향을 보정한다.
 */

import type { BayesianQcRate, TrendAnalysis } from './types'
import { BAYESIAN_CONFIG, TREND_CONFIG } from './constants'

// ============================================================
// 1. 베이지안 축소 추정 (Bayesian Shrinkage)
// ============================================================

/**
 * 베이지안 축소 추정으로 QC 오류율을 보정한다.
 *
 * 문제: QC 평가 건수가 적은 상담사의 오류율이 과대/과소 추정될 수 있음.
 * 예: 2건 중 1건 오류 → 50% 오류율 (실제보다 과대)
 *
 * 해결: 그룹 평균(사전분포)으로 당겨서 "작은 n의 극단치"를 보정.
 * adjustedRate = (n * rawRate + k * priorRate) / (n + k)
 * k = shrinkageStrength (기본 5)
 *
 * n이 작으면 priorRate(그룹 평균)에 가깝게, n이 크면 rawRate(본인 오류율)에 가깝게.
 */
export function bayesianShrinkage(
  rawRate: number,
  evalCount: number,
  priorRate: number,
): BayesianQcRate {
  const k = BAYESIAN_CONFIG.shrinkageStrength
  const adjustedRate = (evalCount * rawRate + k * priorRate) / (evalCount + k)

  let confidence: 'low' | 'moderate' | 'high'
  if (evalCount >= BAYESIAN_CONFIG.minEvalsForHigh) {
    confidence = 'high'
  } else if (evalCount >= BAYESIAN_CONFIG.minEvalsForModerate) {
    confidence = 'moderate'
  } else {
    confidence = 'low'
  }

  return {
    rawRate,
    adjustedRate,
    evalCount,
    confidence,
    priorRate,
  }
}

/**
 * 다수 상담사의 QC 오류율을 일괄 베이지안 보정한다.
 * priorRate는 해당 그룹(서비스+채널)의 전체 평균을 사용.
 */
export function bayesianShrinkageBatch(
  agents: Array<{ agentId: string; rawRate: number; evalCount: number }>,
  groupAvgRate: number,
): Array<{ agentId: string } & BayesianQcRate> {
  return agents.map(a => ({
    agentId: a.agentId,
    ...bayesianShrinkage(a.rawRate, a.evalCount, groupAvgRate),
  }))
}

// ============================================================
// 2. 추세 감지 (Weighted Least Squares)
// ============================================================

/**
 * 가중최소제곱(WLS) 회귀로 추세를 감지한다.
 * 최근 데이터에 지수 감쇠 가중치를 부여하여 최신 추세를 반영.
 *
 * @param dataPoints 시간순 데이터 [{ weekIndex, value }]
 *   weekIndex: 0=가장 오래된 주, n-1=최근 주
 *   value: 오류율 등 측정값
 * @returns 추세 분석 결과
 */
export function detectTrend(
  dataPoints: Array<{ weekIndex: number; value: number }>,
): TrendAnalysis | null {
  const n = dataPoints.length
  if (n < TREND_CONFIG.minWeeks) return null

  // 지수 감쇠 가중치: 최근일수록 높은 가중치
  const decay = TREND_CONFIG.decayFactor
  const weights = dataPoints.map((_, i) => Math.pow(decay, n - 1 - i))

  // WLS 회귀: y = a + b*x (가중)
  const { slope, intercept } = weightedLinearRegression(
    dataPoints.map(d => d.weekIndex),
    dataPoints.map(d => d.value),
    weights,
  )

  // 잔차 기반 p-value 근사 (t-검정)
  const pValue = wlsTTest(
    dataPoints.map(d => d.weekIndex),
    dataPoints.map(d => d.value),
    weights,
    slope,
    intercept,
  )

  const isSignificant = pValue < TREND_CONFIG.significanceLevel

  let direction: TrendAnalysis['direction']
  if (!isSignificant) {
    direction = 'stable'
  } else if (slope < 0) {
    direction = 'improving' // 오류율 감소 = 개선
  } else {
    direction = 'deteriorating' // 오류율 증가 = 악화
  }

  return {
    direction,
    slope,
    pValue,
    isSignificant,
    recentWeeks: n,
  }
}

/**
 * 가중 선형 회귀 (Weighted Least Squares)
 */
function weightedLinearRegression(
  x: number[],
  y: number[],
  w: number[],
): { slope: number; intercept: number } {
  const n = x.length
  let sumW = 0, sumWx = 0, sumWy = 0, sumWxx = 0, sumWxy = 0

  for (let i = 0; i < n; i++) {
    sumW += w[i]
    sumWx += w[i] * x[i]
    sumWy += w[i] * y[i]
    sumWxx += w[i] * x[i] * x[i]
    sumWxy += w[i] * x[i] * y[i]
  }

  const denom = sumW * sumWxx - sumWx * sumWx
  if (Math.abs(denom) < 1e-12) {
    return { slope: 0, intercept: sumWy / sumW }
  }

  const slope = (sumW * sumWxy - sumWx * sumWy) / denom
  const intercept = (sumWy - slope * sumWx) / sumW

  return { slope, intercept }
}

/**
 * WLS t-검정 p-value 근사
 */
function wlsTTest(
  x: number[],
  y: number[],
  w: number[],
  slope: number,
  intercept: number,
): number {
  const n = x.length
  if (n <= 2) return 1.0

  // 가중 잔차 제곱합
  let ssRes = 0, sumW = 0, sumWx = 0, sumWxx = 0
  for (let i = 0; i < n; i++) {
    const residual = y[i] - (intercept + slope * x[i])
    ssRes += w[i] * residual * residual
    sumW += w[i]
    sumWx += w[i] * x[i]
    sumWxx += w[i] * x[i] * x[i]
  }

  const df = n - 2
  const mse = ssRes / df
  const denomX = sumWxx - (sumWx * sumWx) / sumW

  if (Math.abs(denomX) < 1e-12 || mse < 1e-12) return 1.0

  const seBeta = Math.sqrt(mse / denomX)
  if (seBeta < 1e-12) return 0

  const tStat = Math.abs(slope / seBeta)

  // t분포 → p-value 근사 (양측검정, Student's t CDF 근사)
  return tDistPValue(tStat, df)
}

/**
 * Student's t 분포 p-value 근사 (양측)
 * Abramowitz & Stegun 근사 사용
 */
function tDistPValue(t: number, df: number): number {
  // 정규분포 근사 (df가 충분히 큰 경우)
  if (df > 30) {
    const z = t
    // 표준정규분포 CDF 근사
    const p = 2 * (1 - normalCDF(z))
    return Math.max(0, Math.min(1, p))
  }

  // Beta 불완전 함수 기반 근사
  const x = df / (df + t * t)
  const a = df / 2
  const b = 0.5

  // 간단한 근사: regularized incomplete beta function
  const p = incompleteBeta(x, a, b)
  return Math.max(0, Math.min(1, p))
}

/**
 * 표준정규분포 CDF 근사 (Abramowitz & Stegun 26.2.17)
 */
function normalCDF(x: number): number {
  if (x < -8) return 0
  if (x > 8) return 1

  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422804014327 // 1/sqrt(2*PI)
  const p = d * Math.exp(-x * x / 2) *
    (t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))))

  return x > 0 ? 1 - p : p
}

/**
 * 정규화 불완전 베타 함수 근사 (급수전개)
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  // 간단한 급수 근사 (처음 50항)
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a

  // continued fraction (Lentz's method 간소화)
  let sum = 1
  let term = 1
  for (let n = 1; n <= 50; n++) {
    term *= (n - b) * x / (a + n)
    sum += term
    if (Math.abs(term) < 1e-10) break
  }

  return Math.min(1, front * sum)
}

/**
 * log(Gamma(x)) Stirling 근사
 */
function lnGamma(x: number): number {
  if (x <= 0) return 0
  // Lanczos 근사
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]

  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x)
  }

  const xm1 = x - 1
  let a = c[0]
  const t = xm1 + g + 0.5
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (xm1 + i)
  }

  return 0.5 * Math.log(2 * Math.PI) + (xm1 + 0.5) * Math.log(t) - t + Math.log(a)
}

// ============================================================
// 3. 취약점 유의성 검정
// ============================================================

/**
 * 특정 오류 항목이 "진짜 약점"인지 우연 변동인지 검정한다.
 * z-검정: 상담사의 오류율 vs 그룹 오류율
 *
 * @param agentErrorRate 상담사의 해당 항목 오류율
 * @param agentEvalCount 상담사의 평가 건수
 * @param groupErrorRate 그룹의 해당 항목 오류율
 * @param groupEvalCount 그룹의 총 평가 건수
 * @returns { isSignificant, zScore, pValue }
 */
export function testWeaknessSignificance(
  agentErrorRate: number,
  agentEvalCount: number,
  groupErrorRate: number,
  groupEvalCount: number,
): { isSignificant: boolean; zScore: number; pValue: number } {
  // 풀링된 비율
  const pooledRate = (agentErrorRate * agentEvalCount + groupErrorRate * groupEvalCount) /
    (agentEvalCount + groupEvalCount)

  if (pooledRate <= 0 || pooledRate >= 1 || agentEvalCount === 0) {
    return { isSignificant: false, zScore: 0, pValue: 1 }
  }

  // 표준오차
  const se = Math.sqrt(
    pooledRate * (1 - pooledRate) * (1 / agentEvalCount + 1 / groupEvalCount),
  )

  if (se < 1e-12) {
    return { isSignificant: false, zScore: 0, pValue: 1 }
  }

  const zScore = (agentErrorRate - groupErrorRate) / se
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore))) // 양측검정

  return {
    isSignificant: pValue < TREND_CONFIG.significanceLevel,
    zScore,
    pValue,
  }
}

/**
 * 여러 오류 항목에 대해 일괄 유의성 검정
 */
export function testMultipleWeaknesses(
  items: Array<{
    itemKey: string
    agentRate: number
    agentCount: number
    groupRate: number
    groupCount: number
  }>,
): Array<{
  itemKey: string
  isSignificant: boolean
  zScore: number
  pValue: number
}> {
  return items.map(item => ({
    itemKey: item.itemKey,
    ...testWeaknessSignificance(
      item.agentRate,
      item.agentCount,
      item.groupRate,
      item.groupCount,
    ),
  }))
}

// ============================================================
// 4. 유틸리티
// ============================================================

/**
 * 신뢰구간 계산 (이항분포 Wald 구간)
 */
export function confidenceInterval(
  rate: number,
  n: number,
  zLevel: number = 1.96, // 95% CI
): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 1 }

  const se = Math.sqrt((rate * (1 - rate)) / n)
  return {
    lower: Math.max(0, rate - zLevel * se),
    upper: Math.min(1, rate + zLevel * se),
  }
}

/**
 * 코호트 평균 대비 지연 여부 판정
 * 신입 상담사의 현재 주차 오류율이 코호트 평균보다 높은지 검사
 */
export function isStabilizationDelayed(
  currentWeekErrorRate: number,
  cohortAvgErrorRate: number,
  cohortStdDev: number,
  thresholdSigma: number = 1.0,
): boolean {
  return currentWeekErrorRate > cohortAvgErrorRate + thresholdSigma * cohortStdDev
}
