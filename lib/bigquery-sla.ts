/**
 * SLA 평가 데이터 모듈
 * 생산성(IPCC/CEMS) + 품질(QA/상담평점/Quiz) 데이터를 수집하여 SLA 점수를 산정
 */

import { getSLAConfig, calculateSLA, getGrade } from "./sla-config"
import { getVoiceProductivity, getVoiceHandlingTime, getChatProductivity } from "./bigquery-productivity"
import { getBigQueryClient } from "./bigquery"
import { getQADashboardStats } from "./bigquery-qa"
import { getCSATDashboardStats } from "./bigquery-csat"
import { getQuizDashboardStats } from "./bigquery-quiz"
import type { SLAResult, SLADailyPoint, SLADailyTrackingData, SLAGrade, CenterName } from "./types"

// ── SLA 스코어카드 캐시 (과거 월 데이터는 불변) ──
const slaCache = new Map<string, { data: SLAResult[]; ts: number }>()
const SLA_CACHE_TTL_PAST = 30 * 60 * 1000   // 과거 월: 30분
const SLA_CACHE_TTL_CURRENT = 5 * 60 * 1000  // 당월: 5분

function getSLACacheKey(month: string, rangeStart?: string | null, rangeEnd?: string | null): string {
  return rangeStart && rangeEnd ? `${month}|${rangeStart}|${rangeEnd}` : month
}

function isCurrentMonth(month: string): boolean {
  const now = new Date()
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  return month === current
}

// ── 월 → 날짜 범위 변환 ──
function monthToDateRange(month: string): { startDate: string; endDate: string } {
  const [y, m] = month.split("-").map(Number)
  const start = `${y}-${String(m).padStart(2, "0")}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return { startDate: start, endDate: end }
}

// ============================================================
// SLA 스코어카드 산정
// ============================================================

/**
 * 특정 월의 SLA 스코어카드 (용산 + 광주)
 * 생산성/품질 데이터를 병렬로 수집 → calculateSLA()로 점수 산정
 */
export async function getSLAScorecard(
  month?: string | null,
  rangeStart?: string | null,
  rangeEnd?: string | null,
): Promise<{ success: boolean; data?: SLAResult[]; error?: string }> {
  try {
    const targetMonth = month || new Date().toISOString().slice(0, 7)

    // ── 캐시 확인 ──
    const cacheKey = getSLACacheKey(targetMonth, rangeStart, rangeEnd)
    const cached = slaCache.get(cacheKey)
    const ttl = isCurrentMonth(targetMonth) ? SLA_CACHE_TTL_CURRENT : SLA_CACHE_TTL_PAST
    if (cached && Date.now() - cached.ts < ttl) {
      return { success: true, data: cached.data }
    }

    // 명시적 날짜 범위가 있으면 사용, 없으면 월 기준
    const { startDate, endDate } = rangeStart && rangeEnd
      ? { startDate: rangeStart, endDate: rangeEnd }
      : monthToDateRange(targetMonth)

    // 전월 계산 (품질 데이터 미확정 시 fallback용)
    const [ty, tm] = targetMonth.split("-").map(Number)
    const prevDate = new Date(ty, tm - 2, 1)
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`
    const { startDate: prevStart, endDate: prevEnd } = monthToDateRange(prevMonth)

    // 생산성 + 당월 품질 먼저 병렬 수집
    const [voiceRes, voiceTimeRes, chatRes, qaRes, csatRes, quizRes] = await Promise.all([
      getVoiceProductivity(null, startDate, endDate),
      getVoiceHandlingTime(null, startDate, endDate),
      getChatProductivity(null, startDate, endDate),
      getQADashboardStats(targetMonth, targetMonth, { minTenureMonths: 1 }),
      getCSATDashboardStats(startDate, endDate),
      getQuizDashboardStats(targetMonth, targetMonth),
    ])

    // 전월 품질은 당월 데이터가 없을 때만 조회 (조건부 fallback)
    const needQaFallback = !qaRes.success || !qaRes.data ||
      (qaRes.data.yongsanAvgScore === 0 && qaRes.data.gwangjuAvgScore === 0)
    const needCsatFallback = !csatRes.success || !csatRes.data ||
      (csatRes.data.avgScore === 0)
    const needQuizFallback = !quizRes.success || !quizRes.data ||
      (quizRes.data.yongsanAvgScore === 0 && quizRes.data.gwangjuAvgScore === 0)

    const [prevQaRes, prevCsatRes, prevQuizRes] = await Promise.all([
      needQaFallback ? getQADashboardStats(prevMonth, prevMonth, { minTenureMonths: 1 }) : Promise.resolve({ success: false } as const),
      needCsatFallback ? getCSATDashboardStats(prevStart, prevEnd) : Promise.resolve({ success: false } as const),
      needQuizFallback ? getQuizDashboardStats(prevMonth, prevMonth) : Promise.resolve({ success: false } as const),
    ])

    const centers: CenterName[] = ["용산", "광주"]
    const results: SLAResult[] = []

    for (const center of centers) {
      const config = getSLAConfig(center)
      const actualValues: Record<string, number> = {}

      // ── 생산성: 응대율 ──
      if (voiceRes.success && voiceRes.data) {
        const vo = voiceRes.data.overview.find((o) => o.center === center)
        if (vo) actualValues.voice_response_rate = vo.responseRate
      }
      if (chatRes.success && chatRes.data) {
        const co = chatRes.data.overview.find((o) => o.center === center)
        if (co) actualValues.chat_response_rate = co.responseRate
      }

      // ── 생산성: 유선 처리시간 (AHT) ──
      if (voiceTimeRes.success && voiceTimeRes.data) {
        const vt = voiceTimeRes.data
        const taxiVoice = vt.find((r) => r.center === center && r.vertical === "택시")
        if (taxiVoice) actualValues.taxi_voice_handling = taxiVoice.avgHandlingTime

        const driverVoice = vt.find((r) => r.center === center && r.vertical === "대리")
        if (driverVoice) actualValues.driver_voice_handling = driverVoice.avgHandlingTime
      }

      // ── 생산성: 채팅 처리시간 (AHT) ──
      if (chatRes.success && chatRes.data) {
        const pt = chatRes.data.processingTime
        const taxiChat = pt.find((r) => r.center === center && r.vertical === "택시")
        if (taxiChat) actualValues.taxi_chat_handling = taxiChat.avgHandlingTime

        const driverChat = pt.find((r) => r.center === center && r.vertical === "대리")
        if (driverChat) actualValues.driver_chat_handling = driverChat.avgHandlingTime
      }

      // ── 품질: QA 평가 점수 (미확정 시 전월 fallback) ──
      if (qaRes.success && qaRes.data) {
        const qaVal = center === "용산" ? qaRes.data.yongsanAvgScore : qaRes.data.gwangjuAvgScore
        if (qaVal > 0) {
          actualValues.qa_score = qaVal
        } else if (prevQaRes.success && prevQaRes.data) {
          const prevVal = center === "용산" ? prevQaRes.data.yongsanAvgScore : prevQaRes.data.gwangjuAvgScore
          if (prevVal > 0) actualValues.qa_score = prevVal
        }
      }

      // ── 품질: 상담평점 평균 평점 (미확정 시 전월 fallback) ──
      if (csatRes.success && csatRes.data) {
        const csatVal = center === "용산"
          ? (csatRes.data.yongsanAvgScore ?? csatRes.data.avgScore)
          : (csatRes.data.gwangjuAvgScore ?? csatRes.data.avgScore)
        if (csatVal > 0) {
          actualValues.csat_score = csatVal
        } else if (prevCsatRes.success && prevCsatRes.data) {
          const prevVal = center === "용산"
            ? (prevCsatRes.data.yongsanAvgScore ?? prevCsatRes.data.avgScore)
            : (prevCsatRes.data.gwangjuAvgScore ?? prevCsatRes.data.avgScore)
          if (prevVal > 0) actualValues.csat_score = prevVal
        }
      }

      // ── 품질: 직무테스트 점수 (미확정 시 전월 fallback) ──
      if (quizRes.success && quizRes.data) {
        const quizVal = center === "용산" ? quizRes.data.yongsanAvgScore : quizRes.data.gwangjuAvgScore
        if (quizVal > 0) {
          actualValues.quiz_score = quizVal
        } else if (prevQuizRes.success && prevQuizRes.data) {
          const prevVal = center === "용산" ? prevQuizRes.data.yongsanAvgScore : prevQuizRes.data.gwangjuAvgScore
          if (prevVal > 0) actualValues.quiz_score = prevVal
        }
      }

      const result = calculateSLA(config, actualValues)
      result.month = targetMonth
      results.push(result)
    }

    // ── 캐시 저장 ──
    slaCache.set(cacheKey, { data: results, ts: Date.now() })

    return { success: true, data: results }
  } catch (error) {
    console.error("[SLA] Scorecard error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// SLA 월별 추이 (최근 N개월)
// ============================================================

export async function getSLAMonthlyTrend(
  months = 6,
): Promise<{ success: boolean; data?: SLAResult[]; error?: string }> {
  try {
    const now = new Date()

    // 최근 N개월 월 키 생성
    const monthKeys: string[] = []
    for (let i = months; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }

    // 병렬 실행 (캐시 히트 시 BQ 쿼리 0건, 미스 시에도 월별 독립 병렬)
    const results = await Promise.all(
      monthKeys.map((m) => getSLAScorecard(m))
    )

    const allResults: SLAResult[] = []
    for (const res of results) {
      if (res.success && res.data) {
        allResults.push(...res.data)
      }
    }

    return { success: true, data: allResults }
  } catch (error) {
    console.error("[SLA] Monthly trend error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ============================================================
// SLA 데일리 트래킹 (일별 누적 SLA + 월말 예측)
// ============================================================

// Cross-project 테이블 참조 (bigquery-productivity.ts 와 동일)
const IPCC_GRP = "`dataanalytics-25f2.dw_ipcc_iprondb.tb_stat_ic_grp_call_dd`"
const GRP_CENTER_SQL = `CASE
  WHEN group_name LIKE '%광주%' THEN '광주'
  WHEN group_name LIKE '%용산%' THEN '용산'
  ELSE NULL
END`

const CEMS_CONSULT = "`dataanalytics-25f2.dw_cems.consult`"
const CEMS_CHAT_INQUIRE = "`dataanalytics-25f2.dw_cems.chat_inquire`"
const CEMS_USER = "`dataanalytics-25f2.dw_cems.user`"
const CEMS_CONSULT_STATUS = "`dataanalytics-25f2.dw_cems.consult_status`"

/**
 * 일별 SLA 누적 추이 + 월말 예측 + 위험 지표
 * 응대율만 일별 변동, 나머지(처리시간/QA/상담평점/Quiz)는 월 고정값 사용
 */
export async function getSLADailyTracking(
  month?: string | null,
): Promise<{ success: boolean; data?: SLADailyTrackingData[]; error?: string }> {
  try {
    const now = new Date()
    const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const [y, m] = targetMonth.split("-").map(Number)

    const monthStart = `${y}-${String(m).padStart(2, "0")}-01`
    const totalDays = new Date(y, m, 0).getDate()
    const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`

    // yesterday or month end (whichever is earlier)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    const dataEnd = yesterdayStr < monthEnd ? yesterdayStr : monthEnd

    // 전월
    const prevDate = new Date(y, m - 2, 1)
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`

    const bq = getBigQueryClient()

    // ── 병렬: 유선일별누적 / 채팅일별누적 / 월고정메트릭(처리시간+품질) / 전월SLA ──
    const [voiceDailyRows, chatDailyRows, fixedMetrics, prevSLARes] = await Promise.all([
      // 1) 유선 일별 누적 응대율 (윈도우 함수)
      bq.query({
        query: `
          WITH daily AS (
            SELECT
              PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING)) AS stat_date,
              ${GRP_CENTER_SQL} AS center,
              SUM(grp_1090) AS offered,
              SUM(grp_1160) AS answered
            FROM ${IPCC_GRP}
            WHERE PARSE_DATE('%Y%m%d', CAST(psr_time_key AS STRING))
                  BETWEEN @monthStart AND @dataEnd
              AND (group_name LIKE '%용산센터%' OR group_name LIKE '%광주센터%')
              AND group_name NOT LIKE '%Outbound%'
              AND group_name NOT LIKE '%RM(O/B)%'
              AND group_name NOT LIKE '%센터교육%'
              AND group_name NOT LIKE '%퇴직자%'
              AND group_name NOT LIKE '%파트너%'
            GROUP BY 1, 2
          )
          SELECT
            FORMAT_DATE('%Y-%m-%d', stat_date) AS stat_date,
            center,
            offered,
            answered,
            SUM(offered) OVER (PARTITION BY center ORDER BY stat_date) AS cum_offered,
            SUM(answered) OVER (PARTITION BY center ORDER BY stat_date) AS cum_answered,
            SAFE_DIVIDE(
              SUM(answered) OVER (PARTITION BY center ORDER BY stat_date),
              SUM(offered) OVER (PARTITION BY center ORDER BY stat_date)
            ) * 100 AS cum_rate
          FROM daily
          WHERE center IS NOT NULL
          ORDER BY center, stat_date
        `,
        params: { monthStart, dataEnd },
      }).then(([rows]) => rows as Record<string, unknown>[]),

      // 2) 채팅 일별 누적 응대율
      bq.query({
        query: `
          WITH new_team AS (
            SELECT consult_id, final_team_id
            FROM (
              SELECT
                cs.consult_id,
                COALESCE(team.team_id1, cs.to_team_id) AS final_team_id,
                ROW_NUMBER() OVER(PARTITION BY cs.consult_id ORDER BY cs.created_at ASC) AS rn
              FROM ${CEMS_CONSULT_STATUS} AS cs
              LEFT JOIN ${CEMS_USER} AS team ON cs.to_user_id = team.id
              WHERE cs.to_user_id IS NOT NULL OR cs.to_team_id IS NOT NULL
            )
            WHERE rn = 1
          ),
          daily AS (
            SELECT
              DATE(c.created_at) AS stat_date,
              CASE COALESCE(u.team_id1, c.skill_team_id, nt.final_team_id)
                WHEN 15 THEN '용산'
                WHEN 14 THEN '광주'
                ELSE NULL
              END AS center,
              COUNT(*) AS offered,
              COUNTIF(ci.chat_end_status IS NOT NULL AND ci.chat_start_at IS NOT NULL) AS answered
            FROM ${CEMS_CONSULT} c
            JOIN ${CEMS_CHAT_INQUIRE} ci ON c.chat_inquire_id = ci.id
            LEFT JOIN ${CEMS_USER} u ON COALESCE(c.user_id, c.first_user_id) = u.id
            LEFT JOIN new_team nt ON c.id = nt.consult_id
            WHERE DATE(c.created_at) BETWEEN @monthStart AND @dataEnd
              AND c.channel_code = 'c1_chat'
              AND c.incoming_path NOT LIKE 'c2_voice_%'
              AND c.incoming_path != 'c2_cti_center_code_error'
            GROUP BY 1, 2
          )
          SELECT
            FORMAT_DATE('%Y-%m-%d', stat_date) AS stat_date,
            center,
            offered,
            answered,
            SUM(offered) OVER (PARTITION BY center ORDER BY stat_date) AS cum_offered,
            SUM(answered) OVER (PARTITION BY center ORDER BY stat_date) AS cum_answered,
            SAFE_DIVIDE(
              SUM(answered) OVER (PARTITION BY center ORDER BY stat_date),
              SUM(offered) OVER (PARTITION BY center ORDER BY stat_date)
            ) * 100 AS cum_rate
          FROM daily
          WHERE center IS NOT NULL
          ORDER BY center, stat_date
        `,
        params: { monthStart, dataEnd },
      }).then(([rows]) => rows as Record<string, unknown>[]),

      // 3) 월 고정 메트릭 (처리시간 + 품질) — MTD 기준
      (async () => {
        const [voiceTimeRes, chatRes, qaRes, csatRes, quizRes] = await Promise.all([
          getVoiceHandlingTime(null, monthStart, dataEnd),
          getChatProductivity(null, monthStart, dataEnd),
          getQADashboardStats(targetMonth, targetMonth, { minTenureMonths: 1 }),
          getCSATDashboardStats(monthStart, dataEnd),
          getQuizDashboardStats(targetMonth, targetMonth),
        ])
        return { voiceTimeRes, chatRes, qaRes, csatRes, quizRes }
      })(),

      // 4) 전월 SLA
      getSLAScorecard(prevMonth),
    ])

    const centers: CenterName[] = ["용산", "광주"]
    const results: SLADailyTrackingData[] = []

    for (const center of centers) {
      const config = getSLAConfig(center)

      // ── 월 고정값 구성 ──
      const fixedValues: Record<string, number> = {}
      const { voiceTimeRes, chatRes, qaRes, csatRes, quizRes } = fixedMetrics

      if (voiceTimeRes.success && voiceTimeRes.data) {
        const vt = voiceTimeRes.data
        const taxiVoice = vt.find((r) => r.center === center && r.vertical === "택시")
        if (taxiVoice) fixedValues.taxi_voice_handling = taxiVoice.avgHandlingTime
        const driverVoice = vt.find((r) => r.center === center && r.vertical === "대리")
        if (driverVoice) fixedValues.driver_voice_handling = driverVoice.avgHandlingTime
        const quickVoice = vt.find((r) => r.center === center && r.vertical === "퀵/배송")
        if (quickVoice) fixedValues.quick_voice_handling = quickVoice.avgHandlingTime
      }
      if (chatRes.success && chatRes.data) {
        const pt = chatRes.data.processingTime
        const taxiChat = pt.find((r) => r.center === center && r.vertical === "택시")
        if (taxiChat) fixedValues.taxi_chat_handling = taxiChat.avgHandlingTime
        const driverChat = pt.find((r) => r.center === center && r.vertical === "대리")
        if (driverChat) fixedValues.driver_chat_handling = driverChat.avgHandlingTime
      }
      if (qaRes.success && qaRes.data) {
        fixedValues.qa_score = center === "용산" ? qaRes.data.yongsanAvgScore : qaRes.data.gwangjuAvgScore
      }
      if (csatRes.success && csatRes.data) {
        fixedValues.csat_score = center === "용산"
          ? (csatRes.data.yongsanAvgScore ?? csatRes.data.avgScore)
          : (csatRes.data.gwangjuAvgScore ?? csatRes.data.avgScore)
      }
      if (quizRes.success && quizRes.data) {
        fixedValues.quiz_score = center === "용산" ? quizRes.data.yongsanAvgScore : quizRes.data.gwangjuAvgScore
      }

      // ── 품질 미확정 시 전월값 대체 ──
      const prevResult = prevSLARes.success && prevSLARes.data
        ? prevSLARes.data.find((r) => r.center === center)
        : null
      if (prevResult) {
        const fallbackKeys = ["qa_score", "csat_score", "quiz_score"]
        for (const key of fallbackKeys) {
          if (!fixedValues[key] || fixedValues[key] === 0) {
            const prevDetail = prevResult.details.find((d) => d.metricId === key)
            if (prevDetail && prevDetail.actualValue > 0) {
              fixedValues[key] = prevDetail.actualValue
            }
          }
        }
      }

      // ── 일별 누적 응대율 → SLA 산정 ──
      const voiceRows = voiceDailyRows.filter((r) => String(r.center) === center)
      const chatRows = chatDailyRows.filter((r) => String(r.center) === center)

      // 날짜 합집합 구성
      const dateSet = new Set<string>()
      for (const r of voiceRows) dateSet.add(String(r.stat_date))
      for (const r of chatRows) dateSet.add(String(r.stat_date))
      const dates = Array.from(dateSet).sort()

      // 누적값 맵 구성
      const voiceMap = new Map(voiceRows.map((r) => [String(r.stat_date), r]))
      const chatMap = new Map(chatRows.map((r) => [String(r.stat_date), r]))

      const dailyPoints: SLADailyPoint[] = []
      for (const date of dates) {
        const vr = voiceMap.get(date)
        const cr = chatMap.get(date)

        const voiceCumRate = vr ? Number(vr.cum_rate) : (dailyPoints.length > 0 ? dailyPoints[dailyPoints.length - 1].voiceResponseRate : 0)
        const chatCumRate = cr ? Number(cr.cum_rate) : (dailyPoints.length > 0 ? dailyPoints[dailyPoints.length - 1].chatResponseRate : 0)

        const dayValues: Record<string, number> = {
          ...fixedValues,
          voice_response_rate: voiceCumRate,
          chat_response_rate: chatCumRate,
        }

        const slaResult = calculateSLA(config, dayValues)
        dailyPoints.push({
          date,
          center,
          totalScore: slaResult.totalScore,
          productivityScore: slaResult.productivityScore,
          qualityScore: slaResult.qualityScore,
          grade: slaResult.grade,
          voiceResponseRate: Math.round(voiceCumRate * 10) / 10,
          chatResponseRate: Math.round(chatCumRate * 10) / 10,
          voiceIncoming: vr ? Number(vr.cum_offered) : (dailyPoints.length > 1 ? dailyPoints[dailyPoints.length - 2].voiceIncoming : 0),
          voiceAnswered: vr ? Number(vr.cum_answered) : (dailyPoints.length > 1 ? dailyPoints[dailyPoints.length - 2].voiceAnswered : 0),
          chatIncoming: cr ? Number(cr.cum_offered) : (dailyPoints.length > 1 ? dailyPoints[dailyPoints.length - 2].chatIncoming : 0),
          chatAnswered: cr ? Number(cr.cum_answered) : (dailyPoints.length > 1 ? dailyPoints[dailyPoints.length - 2].chatAnswered : 0),
        })
      }

      // ── 전월 데이터 ──
      const prevMonthScore = prevResult?.totalScore ?? 0
      const prevMonthGrade = prevResult?.grade ?? "E" as SLAGrade

      // ── 월말 예측 (최근 5일 감쇠 선형 외삽) ──
      const latestPoint = dailyPoints[dailyPoints.length - 1]
      const latestScore = latestPoint?.totalScore ?? 0
      const latestGrade = latestPoint?.grade ?? ("E" as SLAGrade)
      const elapsedDays = dailyPoints.length

      let projectedEndScore = latestScore
      let projectedEndGrade = latestGrade
      const projection: { date: string; score: number; grade: SLAGrade }[] = []

      if (elapsedDays >= 4) {
        // 최근 5일(또는 가용 일수) 기반 일평균 변화율
        const recentN = Math.min(5, elapsedDays - 1)
        const recentPoints = dailyPoints.slice(-recentN - 1)
        let weightedSlope = 0
        let totalWeight = 0
        for (let i = 1; i < recentPoints.length; i++) {
          const weight = i // 최근일수록 가중치 높음
          weightedSlope += (recentPoints[i].totalScore - recentPoints[i - 1].totalScore) * weight
          totalWeight += weight
        }
        const dailySlope = totalWeight > 0 ? weightedSlope / totalWeight : 0

        // 잔여일 동안 감쇠 외삽 (decay 0.9/일)
        const remainingDays = totalDays - elapsedDays
        let projScore = latestScore
        for (let d = 1; d <= remainingDays; d++) {
          const decay = Math.pow(0.9, d)
          projScore += dailySlope * decay
          projScore = Math.max(0, Math.min(100, projScore))
          const projDate = new Date(y, m - 1, elapsedDays + d)
          const dateStr = projDate.toISOString().slice(0, 10)
          const { grade } = getGrade(Math.round(projScore * 10) / 10)
          projection.push({ date: dateStr, score: Math.round(projScore * 10) / 10, grade })
        }
        projectedEndScore = projection.length > 0 ? projection[projection.length - 1].score : latestScore
        projectedEndGrade = projection.length > 0 ? projection[projection.length - 1].grade : latestGrade
      }

      // ── 위험 지표 판별 ──
      const atRiskMetrics: SLADailyTrackingData["atRiskMetrics"] = []
      if (latestPoint && prevResult) {
        const allMetrics = [...config.productivity, ...config.quality]
        for (const metric of allMetrics) {
          const curDetail = (() => {
            // 최신 SLA 산정에서 해당 지표의 실적값 찾기
            const dayValues: Record<string, number> = {
              ...fixedValues,
              voice_response_rate: latestPoint.voiceResponseRate,
              chat_response_rate: latestPoint.chatResponseRate,
            }
            return dayValues[metric.id] ?? 0
          })()
          const prevDetail = prevResult.details.find((d) => d.metricId === metric.id)
          if (!prevDetail) continue

          const prevVal = prevDetail.actualValue
          const curSlaDetail = calculateSLA(config, {
            ...fixedValues,
            voice_response_rate: latestPoint.voiceResponseRate,
            chat_response_rate: latestPoint.chatResponseRate,
          }).details.find((d) => d.metricId === metric.id)

          if (!curSlaDetail) continue

          // 하락 판별
          let trend: "improving" | "stable" | "declining" = "stable"
          if (metric.direction === "higher_better") {
            if (curDetail > prevVal * 1.02) trend = "improving"
            else if (curDetail < prevVal * 0.97) trend = "declining"
          } else {
            if (curDetail < prevVal * 0.95) trend = "improving"
            else if (curDetail > prevVal * 1.05) trend = "declining"
          }

          // 달성률 60% 미만이면서 하락 추세인 경우 위험
          if (trend === "declining" || curSlaDetail.achievementRate < 60) {
            atRiskMetrics.push({
              metricId: metric.id,
              name: metric.name,
              currentValue: Math.round(curDetail * 10) / 10,
              prevValue: Math.round(prevVal * 10) / 10,
              currentScore: curSlaDetail.score,
              maxScore: metric.maxScore,
              direction: metric.direction,
              trend,
            })
          }
        }
      }

      results.push({
        center,
        month: targetMonth,
        dailyPoints,
        projection,
        prevMonthScore,
        prevMonthGrade,
        latestScore,
        latestGrade,
        projectedEndScore,
        projectedEndGrade,
        elapsedDays,
        totalDays,
        atRiskMetrics,
      })
    }

    return { success: true, data: results }
  } catch (error) {
    console.error("[SLA] Daily tracking error:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
