/**
 * 코칭 카테고리 매핑 엔진
 *
 * QC 16개 오류항목과 QA 22개 채점항목을 8개 코칭 카테고리로 통합하여
 * 상담사별 취약점 분석, 상담유형별 드릴다운, 코칭 처방을 생성한다.
 */

import type {
  CoachingCategoryId,
  CategoryWeakness,
  ConsultTypeErrorAnalysis,
  ConsultTypeCorrectionAnalysis,
  CoachingPrescription,
  CoachingTier,
  AgentCoachingPlan,
  TenureBand,
  UnderperformingCriterionId,
  UnderperformingCriterionResult,
  UnderperformingStatus,
} from './types'
import {
  COACHING_CATEGORIES,
  COACHING_CATEGORY_MAP,
  QC_ERROR_TO_CATEGORY,
  COACHING_TIERS,
  getTenureBand,
  TENURE_RISK_MULTIPLIER,
  UNDERPERFORMING_CRITERIA,
  UNDERPERFORMING_MONTHLY_THRESHOLDS,
  UNDERPERFORMING_MONTHLY_RESOLUTION,
  LOW_QUALITY_RULES,
} from './constants'
import { bayesianShrinkage, testWeaknessSignificance } from './statistics'

// ============================================================
// 1. QC 오류 → 카테고리별 집계
// ============================================================

/** QC 오류 항목별 건수 데이터 */
export interface QcErrorCounts {
  [columnKey: string]: number // 예: { '오안내': 3, '가이드미준수': 1, ... }
}

/**
 * QC 오류 건수를 8개 코칭 카테고리별로 집계한다.
 */
export function aggregateQcByCategory(
  errorCounts: QcErrorCounts,
  totalEvals: number,
): Array<{ categoryId: CoachingCategoryId; errorCount: number; errorRate: number }> {
  const result = {} as Record<CoachingCategoryId, number>
  for (const cat of COACHING_CATEGORIES) {
    result[cat.id] = 0
  }

  for (const [key, count] of Object.entries(errorCounts)) {
    const catId = QC_ERROR_TO_CATEGORY[key]
    if (catId && count > 0) {
      result[catId] += count
    }
  }

  return COACHING_CATEGORIES
    .filter(c => c.qcItems.length > 0)
    .map(c => ({
      categoryId: c.id,
      errorCount: result[c.id] || 0,
      errorRate: totalEvals > 0 ? (result[c.id] || 0) / totalEvals : 0,
    }))
}

// ============================================================
// 2. QA 점수 → 카테고리별 점수율 산출
// ============================================================

/** QA 항목별 점수 데이터 (columnKey → score) */
export interface QaScoreData {
  [columnKey: string]: number | null // 예: { businessKnowledge: 12, ... }
}

/** QA 항목별 만점 매핑 (QA_EVALUATION_ITEMS에서 추출) */
export interface QaMaxScoreMap {
  [columnKey: string]: number // 예: { businessKnowledge: 15, ... }
}

/**
 * QA 점수를 8개 코칭 카테고리별 점수율(0~1)로 산출한다.
 */
export function aggregateQaByCategory(
  scoreData: QaScoreData,
  maxScoreMap: QaMaxScoreMap,
): Array<{
  categoryId: CoachingCategoryId
  items: Array<{ name: string; score: number; maxScore: number }>
  avgRate: number
}> {
  return COACHING_CATEGORIES
    .filter(c => c.qaItems.length > 0)
    .map(c => {
      const items = c.qaItems
        .filter(key => maxScoreMap[key] !== undefined && maxScoreMap[key] > 0)
        .map(key => ({
          name: key,
          score: scoreData[key] ?? 0,
          maxScore: maxScoreMap[key],
        }))

      const totalScore = items.reduce((sum, i) => sum + i.score, 0)
      const totalMax = items.reduce((sum, i) => sum + i.maxScore, 0)
      const avgRate = totalMax > 0 ? totalScore / totalMax : 1

      return { categoryId: c.id, items, avgRate }
    })
}

// ============================================================
// 3. QC+QA 통합 카테고리 취약점 판정
// ============================================================

/**
 * QC 오류율 + QA 점수율을 가중평균하여 카테고리별 통합 점수(0~100)를 산출하고
 * 취약점 심각도를 판정한다.
 *
 * 점수 = (1 - 카테고리별 가중 종합 오류율) × 100
 * - QC: 오류율이 높을수록 나쁨 (오류건수/검수건수)
 * - QA: 점수율이 낮을수록 나쁨 (1 - 점수/만점)
 */
export function assessCategoryWeaknesses(
  qcErrors: QcErrorCounts,
  qcTotalEvals: number,
  qaScores: QaScoreData,
  qaMaxScores: QaMaxScoreMap,
  groupQcRates?: Record<string, number>, // 그룹 평균 오류율 (유의성 검정용)
  groupQcCount?: number,
): CategoryWeakness[] {
  const qcByCategory = aggregateQcByCategory(qcErrors, qcTotalEvals)
  const qaByCategory = aggregateQaByCategory(qaScores, qaMaxScores)

  const qcMap = new Map(qcByCategory.map(q => [q.categoryId, q]))
  const qaMap = new Map(qaByCategory.map(q => [q.categoryId, q]))

  return COACHING_CATEGORIES.map(catDef => {
    const qc = qcMap.get(catDef.id)
    const qa = qaMap.get(catDef.id)

    // QC 기여: 오류율 → 0~1 (높을수록 나쁨)
    const qcBadRate = qc ? qc.errorRate : 0
    // QA 기여: 1 - 점수율 → 0~1 (높을수록 나쁨)
    const qaBadRate = qa ? 1 - qa.avgRate : 0

    // 가중 종합 오류율
    const combinedBadRate =
      catDef.qcWeight * qcBadRate + catDef.qaWeight * qaBadRate

    // 점수 변환 (0~100, 100=완벽)
    const score = Math.max(0, Math.min(100, (1 - combinedBadRate) * 100))

    // 심각도 판정
    let severity: CategoryWeakness['severity']
    if (score < 60) {
      severity = 'critical'
    } else if (score < 80) {
      severity = 'weak'
    } else {
      severity = 'normal'
    }

    // 신뢰도: QC 건수 기반
    let confidence: CategoryWeakness['confidence']
    if (qcTotalEvals >= 15) confidence = 'high'
    else if (qcTotalEvals >= 5) confidence = 'moderate'
    else confidence = 'low'

    return {
      categoryId: catDef.id,
      label: catDef.label,
      score,
      severity,
      qcEvidence: {
        errorItems: catDef.qcItems,
        errorCount: qc?.errorCount ?? 0,
        totalEvals: qcTotalEvals,
        errorRate: qc?.errorRate ?? 0,
      },
      qaEvidence: {
        items: qa?.items ?? [],
        avgRate: qa?.avgRate ?? 1,
      },
      confidence,
    }
  })
}

// ============================================================
// 4. 상담유형별 오류 분석 (업무지식 드릴다운)
// ============================================================

/**
 * 업무지식 오류(오안내, 가이드미준수)가 어떤 상담유형에서 발생하는지 분석한다.
 * BQ 쿼리 결과를 가공하여 ConsultTypeErrorAnalysis 배열로 반환.
 *
 * @param agentErrors 상담사의 상담유형별 오류 건수 (BQ에서 조회)
 * @param groupErrors 그룹 전체의 상담유형별 오류 비율 (비교용)
 */
export function analyzeConsultTypeErrors(
  agentErrors: Array<{ depth2: string; depth3: string | null; errorCount: number }>,
  groupErrors: Array<{ depth2: string; depth3: string | null; errorPct: number }>,
): ConsultTypeErrorAnalysis[] {
  const totalErrors = agentErrors.reduce((sum, e) => sum + e.errorCount, 0)
  if (totalErrors === 0) return []

  const groupMap = new Map(
    groupErrors.map(g => [`${g.depth2}|${g.depth3 ?? ''}`, g.errorPct]),
  )

  return agentErrors
    .map(e => {
      const errorPct = (e.errorCount / totalErrors) * 100
      const key = `${e.depth2}|${e.depth3 ?? ''}`
      const groupAvgErrorPct = groupMap.get(key) ?? 0

      return {
        depth2: e.depth2,
        depth3: e.depth3,
        errorCount: e.errorCount,
        errorPct,
        groupAvgErrorPct,
        isHighlighted: errorPct > groupAvgErrorPct * 1.5, // 그룹 평균의 1.5배 이상
      }
    })
    .sort((a, b) => b.errorCount - a.errorCount)
}

/**
 * 상담유형 오설정 분석 (수정 전/후 비교)
 * 수정 후 값이 존재하는 건 = 상담사가 오설정 → 검수자가 정정
 */
export function analyzeConsultTypeCorrections(
  corrections: Array<{
    originalDepth1: string
    originalDepth2: string
    correctedDepth1: string
    correctedDepth2: string
    count: number
  }>,
  totalEvals: number,
): ConsultTypeCorrectionAnalysis {
  const correctionCount = corrections.reduce((sum, c) => sum + c.count, 0)

  return {
    correctionCount,
    totalEvals,
    correctionRate: totalEvals > 0 ? (correctionCount / totalEvals) * 100 : 0,
    topMisclassifications: corrections
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  }
}

// ============================================================
// 5. 코칭 처방 생성
// ============================================================

/** 처방 템플릿 */
const PRESCRIPTION_TEMPLATES: Record<CoachingCategoryId, {
  weak: string
  critical: string
}> = {
  greeting: {
    weak: '인사/끝인사 멘트 체크리스트 활용 + 우수사례 청취 1건/일',
    critical: '1:1 인사예절 코칭 + 사이드바이사이드 모니터링 2일',
  },
  empathy: {
    weak: '매일 우수사례 2건 청취 + 감성케어 표현 정리',
    critical: '매일 우수사례 2건 청취 + 1:1 감성케어 코칭 + 롤플레잉',
  },
  inquiry: {
    weak: '본인확인/필수탐색 체크리스트 활용 + 주 1회 사례 리뷰',
    critical: '문의파악 프로세스 재교육 + 사이드바이사이드 모니터링',
  },
  knowledge: {
    weak: '취약 상담유형 가이드 집중 학습 + 주 1회 오안내 사례 리뷰',
    critical: '취약 상담유형 1:1 교육 + 매일 가이드 퀴즈 + 멘토링',
  },
  processing: {
    weak: '전산처리 체크리스트 활용 + 주 1회 처리 내역 점검',
    critical: '전산처리 재교육 + 사이드바이사이드 모니터링 + 일일 점검',
  },
  records: {
    weak: '상담이력 작성 가이드 확인 + 주 1회 이력 점검',
    critical: '이력 작성 재교육 + 상담유형 설정 집중 코칭',
  },
  satisfaction: {
    weak: '체감만족 우수사례 분석 + 신속 응대 기법 학습',
    critical: '고객 체감 만족도 집중 코칭 + 상담평점 저점 건 사례 분석',
  },
  communication: {
    weak: '언어표현/맞춤법 자가점검 + 주 1회 피드백',
    critical: '의사소통 역량 강화 교육 + 음성연출/문장력 집중 코칭',
  },
}

/**
 * 취약점 분석 결과로 코칭 처방을 생성한다.
 * weak/critical 카테고리만 처방 대상.
 */
export function generatePrescriptions(
  weaknesses: CategoryWeakness[],
  consultTypeErrors?: ConsultTypeErrorAnalysis[],
): CoachingPrescription[] {
  return weaknesses
    .filter(w => w.severity !== 'normal')
    .sort((a, b) => a.score - b.score) // 가장 약한 것부터
    .map(w => {
      const template = PRESCRIPTION_TEMPLATES[w.categoryId]
      let description = w.severity === 'critical' ? template.critical : template.weak

      // 구체적 오류 항목이 있으면 처방 문구에 삽입
      if (w.qcEvidence.errorItems.length > 0) {
        const itemSummary = w.qcEvidence.errorItems.slice(0, 3).join(', ')
        description = `[${itemSummary}] ${w.qcEvidence.errorCount}건 오류 — ${description}`
      }

      // 업무지식 카테고리면 상담유형 상세 추가
      let consultTypeDetail: string | undefined
      if (w.categoryId === 'knowledge' && consultTypeErrors && consultTypeErrors.length > 0) {
        const top3 = consultTypeErrors
          .filter(e => e.isHighlighted || e.errorCount >= 2)
          .slice(0, 3)
        if (top3.length > 0) {
          consultTypeDetail = top3
            .map(e => `${e.depth2}${e.depth3 ? '_' + e.depth3 : ''} (${e.errorCount}건)`)
            .join(', ')
        }
      }

      // 근거 요약
      const evidenceParts: string[] = []
      if (w.qcEvidence.errorCount > 0) {
        evidenceParts.push(`QC 오류 ${w.qcEvidence.errorCount}건/${w.qcEvidence.totalEvals}건`)
      }
      if (w.qaEvidence.avgRate < 1) {
        evidenceParts.push(`QA 점수율 ${Math.round(w.qaEvidence.avgRate * 100)}%`)
      }

      return {
        categoryId: w.categoryId,
        categoryLabel: w.label,
        severity: w.severity as 'weak' | 'critical',
        description,
        consultTypeDetail,
        evidence: evidenceParts.join(', ') || '데이터 부족',
      }
    })
}

// ============================================================
// 6. 코칭 티어 산정
// ============================================================

/**
 * 리스크 점수 + 근속 + 이전 상태를 고려하여 코칭 티어를 산정한다.
 */
export function determineCoachingTier(
  riskScore: number,
  tenureBand: TenureBand,
  prevRiskScore?: number,
  isExistingUnderperformer?: boolean,
): { tier: CoachingTier; reason: string } {
  // 기본 티어: 리스크 점수 기준
  let baseTier = COACHING_TIERS.find(t => riskScore >= t.minRisk && riskScore < t.maxRisk)
    || COACHING_TIERS[COACHING_TIERS.length - 1]

  let tier = baseTier.tier
  const reasons: string[] = [`리스크 ${Math.round(riskScore)}점 → ${tier}`]

  // 자동 상향 규칙
  const tierOrder: CoachingTier[] = ['일반', '주의', '위험', '심각', '긴급']
  const tierIdx = tierOrder.indexOf(tier)

  // 1. 신입 (<2개월) → 최소 "주의"
  if (tenureBand === 'new_hire' && tierIdx < 1) {
    tier = '주의'
    reasons.push('신입(2개월 미만) → 최소 주의')
  }

  // 2. 초기적응 (2-6개월) → 한 단계 상향
  if (tenureBand === 'early' && tierIdx < tierOrder.length - 1) {
    tier = tierOrder[Math.min(tierIdx + 1, tierOrder.length - 1)]
    reasons.push('초기적응(2-6개월) → 한 단계 상향')
  }

  // 3. 전월 대비 리스크 +10 이상 악화
  if (prevRiskScore !== undefined && riskScore - prevRiskScore >= 10) {
    const currentIdx = tierOrder.indexOf(tier)
    if (currentIdx < tierOrder.length - 1) {
      tier = tierOrder[currentIdx + 1]
      reasons.push(`전월 대비 +${Math.round(riskScore - prevRiskScore)}점 악화 → 상향`)
    }
  }

  // 4. 기존 집중관리상담사 → 최소 "위험"
  if (isExistingUnderperformer && tierOrder.indexOf(tier) < 2) {
    tier = '위험'
    reasons.push('기존 집중관리상담사 → 최소 위험')
  }

  return { tier, reason: reasons.join(' | ') }
}

// ============================================================
// 7. 근속별 리포트 유형 판정
// ============================================================

export type ReportMode = 'daily_intensive' | 'daily_conditional' | 'weekly_phased'

/**
 * 상담사의 근속과 성과에 따라 리포트 모드를 결정한다.
 *
 * - 1개월 미만: 무조건 데일리 밀접 모니터링
 * - 1~2개월: 부진자는 데일리 유지, 양호하면 주간 전환
 * - 3개월+: 주간 리포트 (주차별 구성 다름) + 월간 리포트
 */
export function determineReportMode(
  tenureMonths: number,
  isUnderperforming: boolean, // 1개월차 데이터 기준 부진 여부
): ReportMode {
  if (tenureMonths < 1) {
    return 'daily_intensive'
  }
  if (tenureMonths < 2 && isUnderperforming) {
    return 'daily_conditional'
  }
  return 'weekly_phased'
}

/**
 * 현재 날짜 기준 주간 리포트 주차(phase)를 결정한다.
 * 주간 기준: 목~수 (기존 getThursdayWeek 활용)
 */
export function getWeeklyReportPhase(dayOfMonth: number): 'month_start' | 'week2' | 'week3' | 'month_end' {
  if (dayOfMonth <= 7) return 'month_start'
  if (dayOfMonth <= 14) return 'week2'
  if (dayOfMonth <= 21) return 'week3'
  return 'month_end'
}

// ============================================================
// 8. 미흡상담사 관리 (24.04.01~ 시행 기준)
// ============================================================

/**
 * 주간/월간 데이터로 미흡상담사 4개 기준을 판정한다.
 *
 * @param weeklyData 주간 데이터 (QC 태도/오상담 오류율, 상담평점 저점 건수)
 * @param monthlyData 월간 데이터 (QA 업무지식 점수, 상담평점 저점 건수)
 * @param tenureMonths 상담사 근속개월
 */
export function evaluateUnderperformingCriteria(
  weeklyData: {
    qcAttitudeRate: number    // QC 상담태도 오류율 (%)
    qcOpsRate: number         // QC 오상담/오처리 오류율 (%)
    qcEvalCount: number       // QC 검수 건수
    csatLowScoreWeekly: number // 상담평가 저점(1·2점) 주 건수
  },
  monthlyData: {
    qaKnowledgeScore: number | null  // QA 업무지식 점수 (null = 미평가)
    csatLowScoreMonthly: number      // 상담평가 저점(1·2점) 월 건수
  },
  tenureMonths: number,
): UnderperformingCriterionResult[] {
  const results: UnderperformingCriterionResult[] = []

  for (const criterion of UNDERPERFORMING_CRITERIA) {
    let value: number
    let flagged = false
    let excluded = false
    let excludeReason: string | undefined

    switch (criterion.id) {
      case 'qa_knowledge': {
        // 투입 후 1개월 미만 제외
        if (criterion.minTenureMonths && tenureMonths < criterion.minTenureMonths) {
          excluded = true
          excludeReason = `근속 ${tenureMonths.toFixed(1)}개월 (1개월 미만 제외)`
          value = monthlyData.qaKnowledgeScore ?? 0
        } else if (monthlyData.qaKnowledgeScore === null) {
          excluded = true
          excludeReason = 'QA 업무지식 미평가'
          value = 0
        } else {
          value = monthlyData.qaKnowledgeScore
          flagged = value <= criterion.threshold // ≤7점
        }
        break
      }
      case 'qc_attitude': {
        value = weeklyData.qcAttitudeRate
        // QC검수 10건 이상 요건
        if (criterion.minEvals && weeklyData.qcEvalCount < criterion.minEvals) {
          excluded = true
          excludeReason = `QC검수 ${weeklyData.qcEvalCount}건 (10건 미만)`
        } else {
          flagged = value >= criterion.threshold // ≥15%
        }
        break
      }
      case 'qc_ops': {
        value = weeklyData.qcOpsRate
        if (criterion.minEvals && weeklyData.qcEvalCount < criterion.minEvals) {
          excluded = true
          excludeReason = `QC검수 ${weeklyData.qcEvalCount}건 (10건 미만)`
        } else {
          flagged = value >= criterion.threshold // ≥10%
        }
        break
      }
      case 'csat_low_score': {
        // 주 단위 ≥3건 OR 월 단위 ≥12건
        const weeklyFlagged = weeklyData.csatLowScoreWeekly >= criterion.threshold
        const monthlyThreshold = UNDERPERFORMING_MONTHLY_THRESHOLDS[criterion.id] ?? criterion.threshold
        const monthlyFlagged = monthlyData.csatLowScoreMonthly >= monthlyThreshold
        value = weeklyData.csatLowScoreWeekly
        flagged = weeklyFlagged || monthlyFlagged
        break
      }
    }

    results.push({
      criterionId: criterion.id,
      label: criterion.label,
      period: criterion.period,
      flagged: excluded ? false : flagged,
      value,
      threshold: criterion.threshold,
      evalCount: criterion.id.startsWith('qc_') ? weeklyData.qcEvalCount : undefined,
      minEvals: criterion.minEvals,
      excluded,
      excludeReason,
    })
  }

  return results
}

/**
 * 해소 기준 판정: 각 항목이 해소되었는지 검사한다.
 *
 * @param criterionId 판정 대상 항목
 * @param recentWeeklyValues 최근 N주간 실측값 배열 (최신이 마지막)
 * @param nextMonthValue M+1 월간 실측값 (QA, 상담평점 월간용)
 */
export function checkResolution(
  criterionId: UnderperformingCriterionId,
  recentWeeklyValues: number[],
  nextMonthValue?: number,
): boolean {
  const criterion = UNDERPERFORMING_CRITERIA.find(c => c.id === criterionId)
  if (!criterion) return false

  const { resolution, direction } = criterion

  // M+1 기준 해소 (QA 업무지식, 상담평점 월간)
  if (resolution.nextMonth && nextMonthValue !== undefined) {
    if (criterionId === 'qa_knowledge') {
      return nextMonthValue >= resolution.threshold // M+1 ≥7점
    }
    if (criterionId === 'csat_low_score') {
      const monthlyResThreshold = UNDERPERFORMING_MONTHLY_RESOLUTION[criterionId] ?? resolution.threshold
      return nextMonthValue <= monthlyResThreshold // M+1 ≤12건
    }
  }

  // 연속 주 기준 해소 (QC 태도, QC 오상담, 상담평점 주간)
  if (resolution.consecutiveWeeks) {
    const needed = resolution.consecutiveWeeks
    if (recentWeeklyValues.length < needed) return false

    const lastN = recentWeeklyValues.slice(-needed)
    // direction === 'gte' → 선정은 ≥threshold, 해소는 ≤threshold (2주 연속)
    return lastN.every(v => v <= resolution.threshold)
  }

  return false
}

/**
 * 저품질 상담사 판정
 *
 * 규칙:
 * 1. 주단위 3주 연속 적발 → 저품질
 * 2. 3개 항목 당월 동시 적발 → 해당월 즉시 저품질
 * 3. 신입(3개월 미만): 저품질이어도 전배/업무배제/업무시간 변경은 유예
 */
export function determineLowQualityStatus(
  consecutiveWeeks: number,
  monthlyFlaggedCriteriaCount: number,
  tenureMonths: number,
): {
  isLowQuality: boolean
  reason?: string
  isNewHireExempt: boolean
} {
  const { consecutiveWeeksForLowQuality, simultaneousCriteriaForImmediate, newHireExemptMonths } = LOW_QUALITY_RULES
  const isNewHireExempt = tenureMonths < newHireExemptMonths

  // 3주 연속 적발
  if (consecutiveWeeks >= consecutiveWeeksForLowQuality) {
    return {
      isLowQuality: true,
      reason: `${consecutiveWeeks}주 연속 적발 (기준: ${consecutiveWeeksForLowQuality}주)`,
      isNewHireExempt,
    }
  }

  // 3개 항목 당월 동시 적발
  if (monthlyFlaggedCriteriaCount >= simultaneousCriteriaForImmediate) {
    return {
      isLowQuality: true,
      reason: `${monthlyFlaggedCriteriaCount}개 항목 당월 동시 적발 (기준: ${simultaneousCriteriaForImmediate}개)`,
      isNewHireExempt,
    }
  }

  return { isLowQuality: false, isNewHireExempt }
}

/**
 * 미흡상담사 종합 판정을 수행하고 UnderperformingStatus를 반환한다.
 * BQ에서 조회한 데이터를 인자로 받아 순수 로직만 처리.
 */
export function buildUnderperformingStatus(
  agent: {
    agentId: string
    agentName: string
    center: string
    service: string
    channel: string
    tenureMonths: number
  },
  weeklyData: {
    qcAttitudeRate: number
    qcOpsRate: number
    qcEvalCount: number
    csatLowScoreWeekly: number
  },
  monthlyData: {
    qaKnowledgeScore: number | null
    csatLowScoreMonthly: number
  },
  consecutiveWeeks: number,
  monthlyFlaggedCriteriaCount: number,
  resolvedCriteria: UnderperformingCriterionId[],
): UnderperformingStatus {
  // 1. 4개 기준 판정
  const criteria = evaluateUnderperformingCriteria(weeklyData, monthlyData, agent.tenureMonths)
  const flaggedCount = criteria.filter(c => c.flagged).length

  // 2. 저품질 판정
  const lowQuality = determineLowQualityStatus(
    consecutiveWeeks,
    monthlyFlaggedCriteriaCount,
    agent.tenureMonths,
  )

  return {
    ...agent,
    criteria,
    flaggedCount,
    isFlagged: flaggedCount > 0,
    consecutiveWeeks,
    isLowQuality: lowQuality.isLowQuality,
    lowQualityReason: lowQuality.reason,
    isNewHireExempt: lowQuality.isNewHireExempt,
    resolvedCriteria,
    allResolved: resolvedCriteria.length >= flaggedCount && flaggedCount > 0,
  }
}
