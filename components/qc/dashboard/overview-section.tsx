"use client"

import { StatsCard } from "../stats-card"

interface CenterErrorRates {
  yongsan: number
  gwangju: number
}

interface OverviewSectionProps {
  totalAgentsYongsan: number
  totalAgentsGwangju: number
  totalEvaluations: number
  watchlistYongsan: number
  watchlistGwangju: number
  attitudeErrorRate: number
  attitudeErrorTrend: number
  consultErrorRate: number
  consultErrorTrend: number
  overallErrorRate: number
  overallErrorTrend: number
  onWatchlistClick?: () => void
  attitudeErrorByCenter?: CenterErrorRates
  consultErrorByCenter?: CenterErrorRates
  overallErrorByCenter?: CenterErrorRates
  weekLabel?: string
  /** 관리자 스코핑: "용산" | "광주" 지정 시 단일 센터 뷰 */
  scopeCenter?: string
}

export function OverviewSection({
  totalAgentsYongsan,
  totalAgentsGwangju,
  totalEvaluations,
  watchlistYongsan,
  watchlistGwangju,
  attitudeErrorRate,
  attitudeErrorTrend,
  consultErrorRate,
  consultErrorTrend,
  overallErrorRate,
  overallErrorTrend,
  onWatchlistClick,
  attitudeErrorByCenter,
  consultErrorByCenter,
  overallErrorByCenter,
  weekLabel,
  scopeCenter,
}: OverviewSectionProps) {
  const agentsYongsan = totalAgentsYongsan || 0
  const agentsGwangju = totalAgentsGwangju || 0
  const evaluations = totalEvaluations || 0
  const watchlistY = watchlistYongsan || 0
  const watchlistG = watchlistGwangju || 0

  const isScoped = !!scopeCenter
  const isYongsan = scopeCenter === "용산"

  // 스코핑 시 해당 센터의 오류율 사용, 아니면 전체 평균
  const attitudeRate = isScoped
    ? (isYongsan ? attitudeErrorByCenter?.yongsan : attitudeErrorByCenter?.gwangju) ?? attitudeErrorRate ?? 0
    : attitudeErrorRate || 0
  const consultRate = isScoped
    ? (isYongsan ? consultErrorByCenter?.yongsan : consultErrorByCenter?.gwangju) ?? consultErrorRate ?? 0
    : consultErrorRate || 0
  const overallRate = isScoped
    ? (isYongsan ? overallErrorByCenter?.yongsan : overallErrorByCenter?.gwangju) ?? overallErrorRate ?? 0
    : overallErrorRate || 0

  // 스코핑 시 해당 센터 인원/유의상담사만
  const displayAgents = isScoped ? (isYongsan ? agentsYongsan : agentsGwangju) : (agentsYongsan + agentsGwangju)
  const displayWatchlist = isScoped ? (isYongsan ? watchlistY : watchlistG) : (watchlistY + watchlistG)
  const agentSubtitle = isScoped ? `${scopeCenter} 센터` : `용산 ${agentsYongsan}명 / 광주 ${agentsGwangju}명`
  const watchlistSubtitle = isScoped ? `${scopeCenter} 센터` : `용산 ${watchlistY}명 / 광주 ${watchlistG}명`

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <StatsCard
        title="총 상담사"
        value={String(displayAgents || 0)}
        subtitle={agentSubtitle}
      />
      <StatsCard
        title="이번주 평가건수"
        value={typeof evaluations === 'number' ? evaluations.toLocaleString('ko-KR') : String(evaluations || 0)}
        subtitle={weekLabel || "이번주 누적"}
      />
      <StatsCard
        title="유의상담사"
        value={String(displayWatchlist || 0)}
        subtitle={watchlistSubtitle}
        variant={displayWatchlist > 10 ? "destructive" : displayWatchlist > 5 ? "warning" : "default"}
        onClick={onWatchlistClick}
        clickable={!!onWatchlistClick}
      />
      <StatsCard
        title="상담태도 오류율"
        value={`${attitudeRate.toFixed(2)}%`}
        trend={attitudeErrorTrend}
        trendLabel="전주 대비"
        variant={attitudeRate > 3 ? "warning" : "success"}
        centerBreakdown={!isScoped && attitudeErrorByCenter ? {
          yongsan: `${(attitudeErrorByCenter.yongsan || 0).toFixed(2)}%`,
          gwangju: `${(attitudeErrorByCenter.gwangju || 0).toFixed(2)}%`
        } : undefined}
      />
      <StatsCard
        title="오상담/오처리 오류율"
        value={`${consultRate.toFixed(2)}%`}
        trend={consultErrorTrend}
        trendLabel="전주 대비"
        variant={consultRate > 3 ? "warning" : "success"}
        centerBreakdown={!isScoped && consultErrorByCenter ? {
          yongsan: `${(consultErrorByCenter.yongsan || 0).toFixed(2)}%`,
          gwangju: `${(consultErrorByCenter.gwangju || 0).toFixed(2)}%`
        } : undefined}
      />
      <StatsCard
        title="전체 오류율"
        value={`${overallRate.toFixed(2)}%`}
        trend={overallErrorTrend}
        trendLabel="전주 대비"
        variant={overallRate > 5 ? "destructive" : overallRate > 3 ? "warning" : "success"}
        centerBreakdown={!isScoped && overallErrorByCenter ? {
          yongsan: `${(overallErrorByCenter.yongsan || 0).toFixed(2)}%`,
          gwangju: `${(overallErrorByCenter.gwangju || 0).toFixed(2)}%`
        } : undefined}
      />
    </div>
  )
}
