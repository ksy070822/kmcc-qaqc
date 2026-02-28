// 예측 모델 로직 (QC_PROJECT_CONTEXT 기반)
import { CENTER_TARGET_RATES, GOAL_MISSED_MULTIPLIER } from "@/lib/constants"

export interface WeeklyData {
  week: string
  rate: number
  count: number
  errors: number
}

export interface PredictionResult {
  currentRate: number
  predictedRate: number
  targetRate: number
  achievementProbability: number
  trend: 'improving' | 'stable' | 'worsening'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  weeklyRates: number[]
  w4Predicted: number
}

export interface GroupPrediction {
  center: '용산' | '광주'
  group: string
  service: string
  channel: string
  attitudePrediction: PredictionResult
  processPrediction: PredictionResult
  totalPrediction: PredictionResult
  watchListReason?: string[]
}

export interface AgentErrorInfo {
  name: string
  count: number
  rate: number // 오류율 (%)
}

export interface AgentPrediction {
  agentId: string
  agentName: string
  center: '용산' | '광주'
  group: string
  attitudeRate: number
  processRate: number
  totalRate: number
  trend: 'improving' | 'stable' | 'worsening'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  watchListReason?: string[]
  mainErrors: AgentErrorInfo[] // 오류 이름과 오류율 포함
}

// 주차 정의 (1~5일: W1, 6~12일: W2, 13~19일: W3, 20~31일: W4)
export function getWeek(day: number): 'W1' | 'W2' | 'W3' | 'W4' {
  if (day <= 5) return 'W1'
  if (day <= 12) return 'W2'
  if (day <= 19) return 'W3'
  return 'W4'
}

// 현재 주차 반환
export function getCurrentWeek(): 'W1' | 'W2' | 'W3' | 'W4' {
  const today = new Date()
  return getWeek(today.getDate())
}

// 추세 판정
export function determineTrend(weeklyRates: number[]): 'improving' | 'stable' | 'worsening' {
  if (weeklyRates.length < 2) return 'stable'
  
  const recentChange = weeklyRates[weeklyRates.length - 1] - weeklyRates[weeklyRates.length - 2]
  
  if (recentChange < -0.3) return 'improving'   // 0.3%p 이상 개선
  if (recentChange > 0.3) return 'worsening'    // 0.3%p 이상 악화
  return 'stable'
}

// 월말 예측 알고리즘
export function predictMonthEnd(
  currentRate: number,
  weeklyRates: number[],
  daysPassed: number,
  daysRemaining: number
): { predicted: number; w4Predicted: number } {
  const totalDays = daysPassed + daysRemaining
  
  // W4 예측: 최근 추세 반영 (W2→W3 변화량을 W3→W4에 적용)
  let w4Predicted = currentRate
  if (weeklyRates.length >= 2) {
    const weeklyChange = weeklyRates[weeklyRates.length - 1] - weeklyRates[weeklyRates.length - 2]
    w4Predicted = Math.max(0, weeklyRates[weeklyRates.length - 1] + weeklyChange)
  }
  
  // 월말 예측: 가중 평균
  const predicted = (currentRate * daysPassed + w4Predicted * daysRemaining) / totalDays
  
  return { predicted: Number(predicted.toFixed(2)), w4Predicted: Number(w4Predicted.toFixed(2)) }
}

// 달성 확률 계산
export function calculateAchievementProbability(
  predicted: number,
  target: number,
  trend: 'improving' | 'stable' | 'worsening'
): number {
  // 기본 확률: 예측값과 목표의 비율
  let baseProbability = 100 - ((predicted - target) / target) * 100
  
  // 추세에 따른 조정
  if (trend === 'improving') baseProbability += 10
  if (trend === 'worsening') baseProbability -= 15
  
  // 0~100% 범위로 제한
  return Math.min(100, Math.max(0, Math.round(baseProbability)))
}

// 위험도 판정
export function determineRiskLevel(
  predicted: number,
  target: number,
  trend: 'improving' | 'stable' | 'worsening',
  achievementProb: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (achievementProb >= 70 && (trend === 'improving' || trend === 'stable')) {
    return 'low'
  }
  if (achievementProb >= 40 && predicted <= target * GOAL_MISSED_MULTIPLIER) {
    return 'medium'
  }
  if (achievementProb >= 20 || predicted <= target * 1.3) {
    return 'high'
  }
  return 'critical'
}

// 집중관리 등록 조건 체크
export function checkWatchListConditions(
  prediction: PredictionResult,
  previousWeekRate?: number
): string[] {
  const reasons: string[] = []
  
  // 1. 목표 달성 확률 30% 미만
  if (prediction.achievementProbability < 30) {
    reasons.push('목표 달성 확률 30% 미만')
  }
  
  // 2. 전주 대비 50% 이상 급등
  if (previousWeekRate && prediction.currentRate > previousWeekRate * 1.5) {
    reasons.push('전주 대비 50% 이상 급등')
  }
  
  // 3. 악화 추세 + 목표 초과
  if (prediction.trend === 'worsening' && prediction.currentRate > prediction.targetRate) {
    reasons.push('악화 추세 + 목표 초과')
  }
  
  // 4. Critical 위험도
  if (prediction.riskLevel === 'critical') {
    reasons.push('위험도 Critical')
  }
  
  return reasons
}

// 상담사 집중관리 조건 (태도 5% 초과 또는 오상담 6% 초과)
export function checkAgentWatchConditions(
  attitudeRate: number,
  processRate: number
): string[] {
  const reasons: string[] = []
  
  if (attitudeRate > 5) {
    reasons.push(`태도 오류율 ${attitudeRate.toFixed(2)}% (기준 5% 초과)`)
  }
  if (processRate > 6) {
    reasons.push(`오상담 오류율 ${processRate.toFixed(2)}% (기준 6% 초과)`)
  }
  
  return reasons
}

// 목표 데이터 (2026년 기준) — CENTER_TARGET_RATES에서 파생
export const targets2026 = {
  용산: { attitude: CENTER_TARGET_RATES.용산.attitude, process: CENTER_TARGET_RATES.용산.ops },
  광주: { attitude: CENTER_TARGET_RATES.광주.attitude, process: CENTER_TARGET_RATES.광주.ops },
  전체: { attitude: CENTER_TARGET_RATES.전체.attitude, process: CENTER_TARGET_RATES.전체.ops },
}

// 예측 결과 생성
export function generatePrediction(
  currentRate: number,
  weeklyRates: number[],
  targetRate: number,
  daysPassed: number = 15,
  daysRemaining: number = 16
): PredictionResult {
  const trend = determineTrend(weeklyRates)
  const { predicted, w4Predicted } = predictMonthEnd(currentRate, weeklyRates, daysPassed, daysRemaining)
  const achievementProbability = calculateAchievementProbability(predicted, targetRate, trend)
  const riskLevel = determineRiskLevel(predicted, targetRate, trend, achievementProbability)
  
  return {
    currentRate,
    predictedRate: predicted,
    targetRate,
    achievementProbability,
    trend,
    riskLevel,
    weeklyRates,
    w4Predicted,
  }
}

// 위험도별 스타일 정보
export const riskLevelStyles = {
  low: { label: '안정', color: 'bg-green-100 text-green-800', icon: '🟢' },
  medium: { label: '관찰', color: 'bg-blue-100 text-blue-800', icon: '🟡' },
  high: { label: '주의', color: 'bg-orange-100 text-orange-800', icon: '🟠' },
  critical: { label: '긴급', color: 'bg-red-100 text-red-800', icon: '🔴' },
}

// 추세별 스타일 정보
export const trendStyles = {
  improving: { label: '개선', color: 'text-green-600', arrow: '↓' },
  stable: { label: '유지', color: 'text-gray-600', arrow: '→' },
  worsening: { label: '악화', color: 'text-red-600', arrow: '↑' },
}
