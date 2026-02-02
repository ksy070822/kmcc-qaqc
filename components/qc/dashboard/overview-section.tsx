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
  centerStats?: Array<{
    name: string
    attitudeErrorRate: number
    businessErrorRate: number
    overallErrorRate: number
  }>
  onWatchlistClick: () => void
  attitudeErrorByCenter?: CenterErrorRates
  consultErrorByCenter?: CenterErrorRates
  overallErrorByCenter?: CenterErrorRates
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
  centerStats,
  onWatchlistClick,
  attitudeErrorByCenter,
  consultErrorByCenter,
  overallErrorByCenter,
}: OverviewSectionProps) {
  // 모든 값을 0으로 기본값 설정하여 안전하게 처리
  const agentsYongsan = totalAgentsYongsan || 0
  const agentsGwangju = totalAgentsGwangju || 0
  const evaluations = totalEvaluations || 0
  const watchlistY = watchlistYongsan || 0
  const watchlistG = watchlistGwangju || 0
  const attitudeRate = attitudeErrorRate || 0
  const consultRate = consultErrorRate || 0
  const overallRate = overallErrorRate || 0
  
  const totalWatchlist = watchlistY + watchlistG
  
  // 센터별 오류율 추출
  const yongsanCenter = centerStats?.find(c => c.name === '용산')
  const gwangjuCenter = centerStats?.find(c => c.name === '광주')
  
  const yongsanAttitudeRate = yongsanCenter?.attitudeErrorRate || 0
  const gwangjuAttitudeRate = gwangjuCenter?.attitudeErrorRate || 0
  const yongsanBusinessRate = yongsanCenter?.businessErrorRate || 0
  const gwangjuBusinessRate = gwangjuCenter?.businessErrorRate || 0
  const yongsanOverallRate = yongsanCenter?.overallErrorRate || 0
  const gwangjuOverallRate = gwangjuCenter?.overallErrorRate || 0

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <StatsCard
        title="총 상담사"
        value={String((agentsYongsan + agentsGwangju) || 0)}
        subtitle={`용산 ${agentsYongsan}명 / 광주 ${agentsGwangju}명`}
      />
      <StatsCard 
        title="전일 평가건수" 
        value={typeof evaluations === 'number' ? evaluations.toLocaleString('ko-KR') : String(evaluations || 0)} 
        subtitle="전일 기준" 
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
        subtitle={attitudeErrorByCenter ? undefined : `용산 ${yongsanAttitudeRate.toFixed(2)}% / 광주 ${gwangjuAttitudeRate.toFixed(2)}%`}
        trend={attitudeErrorTrend}
        variant={attitudeRate > 3 ? "warning" : "success"}
        centerBreakdown={attitudeErrorByCenter ? {
          yongsan: `${(attitudeErrorByCenter.yongsan || 0).toFixed(2)}%`,
          gwangju: `${(attitudeErrorByCenter.gwangju || 0).toFixed(2)}%`
        } : (yongsanAttitudeRate !== 0 || gwangjuAttitudeRate !== 0) ? {
          yongsan: `${yongsanAttitudeRate.toFixed(2)}%`,
          gwangju: `${gwangjuAttitudeRate.toFixed(2)}%`
        } : undefined}
      />
      <StatsCard
        title="오상담/오처리 오류율"
        value={`${consultRate.toFixed(2)}%`}
        subtitle={consultErrorByCenter ? undefined : `용산 ${yongsanBusinessRate.toFixed(2)}% / 광주 ${gwangjuBusinessRate.toFixed(2)}%`}
        trend={consultErrorTrend}
        variant={consultRate > 3 ? "warning" : "success"}
        centerBreakdown={consultErrorByCenter ? {
          yongsan: `${(consultErrorByCenter.yongsan || 0).toFixed(2)}%`,
          gwangju: `${(consultErrorByCenter.gwangju || 0).toFixed(2)}%`
        } : (yongsanBusinessRate !== 0 || gwangjuBusinessRate !== 0) ? {
          yongsan: `${yongsanBusinessRate.toFixed(2)}%`,
          gwangju: `${gwangjuBusinessRate.toFixed(2)}%`
        } : undefined}
      />
      <StatsCard
        title="전체 오류율"
        value={`${overallRate.toFixed(2)}%`}
        subtitle={overallErrorByCenter ? undefined : `용산 ${yongsanOverallRate.toFixed(2)}% / 광주 ${gwangjuOverallRate.toFixed(2)}%`}
        trend={overallErrorTrend}
        variant={overallRate > 5 ? "destructive" : overallRate > 3 ? "warning" : "success"}
        centerBreakdown={overallErrorByCenter ? {
          yongsan: `${(overallErrorByCenter.yongsan || 0).toFixed(2)}%`,
          gwangju: `${(overallErrorByCenter.gwangju || 0).toFixed(2)}%`
        } : (yongsanOverallRate !== 0 || gwangjuOverallRate !== 0) ? {
          yongsan: `${yongsanOverallRate.toFixed(2)}%`,
          gwangju: `${gwangjuOverallRate.toFixed(2)}%`
        } : undefined}
      />
    </div>
  )
}
