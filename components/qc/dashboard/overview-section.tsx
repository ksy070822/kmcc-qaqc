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
  onWatchlistClick: () => void
  attitudeErrorByCenter?: CenterErrorRates
  consultErrorByCenter?: CenterErrorRates
  overallErrorByCenter?: CenterErrorRates
  weekLabel?: string
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
}: OverviewSectionProps) {
  const agentsYongsan = totalAgentsYongsan || 0
  const agentsGwangju = totalAgentsGwangju || 0
  const evaluations = totalEvaluations || 0
  const watchlistY = watchlistYongsan || 0
  const watchlistG = watchlistGwangju || 0
  const attitudeRate = attitudeErrorRate || 0
  const consultRate = consultErrorRate || 0
  const overallRate = overallErrorRate || 0

  const totalWatchlist = watchlistY + watchlistG

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <StatsCard
        title="총 상담사"
        value={String((agentsYongsan + agentsGwangju) || 0)}
        subtitle={`용산 ${agentsYongsan}명 / 광주 ${agentsGwangju}명`}
      />
      <StatsCard
        title="이번주 평가건수"
        value={typeof evaluations === 'number' ? evaluations.toLocaleString('ko-KR') : String(evaluations || 0)}
        subtitle={weekLabel || "이번주 누적"}
      />
      <StatsCard
        title="유의상담사"
        value={String(totalWatchlist || 0)}
        subtitle={`용산 ${watchlistY}명 / 광주 ${watchlistG}명`}
        variant={totalWatchlist > 10 ? "destructive" : totalWatchlist > 5 ? "warning" : "default"}
        onClick={onWatchlistClick}
        clickable
      />
      <StatsCard
        title="상담태도 오류율"
        value={`${attitudeRate.toFixed(2)}%`}
        trend={attitudeErrorTrend}
        trendLabel="전주 대비"
        variant={attitudeRate > 3 ? "warning" : "success"}
        centerBreakdown={attitudeErrorByCenter ? {
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
        centerBreakdown={consultErrorByCenter ? {
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
        centerBreakdown={overallErrorByCenter ? {
          yongsan: `${(overallErrorByCenter.yongsan || 0).toFixed(2)}%`,
          gwangju: `${(overallErrorByCenter.gwangju || 0).toFixed(2)}%`
        } : undefined}
      />
    </div>
  )
}
