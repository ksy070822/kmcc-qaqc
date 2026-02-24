"use client"

import { StatsCard } from "../stats-card"
import type { CSATDashboardStats } from "@/lib/types"
import { CSAT_TARGET_SCORE } from "@/lib/constants"

interface Props {
  stats: CSATDashboardStats | null
}

export function CSATOverviewSection({ stats }: Props) {
  const s = stats || {
    avgScore: 0, totalReviews: 0,
    score5Rate: 0, score4Rate: 0, score3Rate: 0, score2Rate: 0, score1Rate: 0,
    yongsanAvgScore: 0, gwangjuAvgScore: 0,
    totalConsults: 0, totalRequests: 0, reviewRate: 0,
    lowScoreCount: 0, score1Count: 0, score2Count: 0, lowScoreRate: 0,
  }

  const lowRate = s.score1Rate + s.score2Rate

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      <StatsCard
        title="평균 평점"
        value={`${s.avgScore.toFixed(2)}점`}
        subtitle={`목표: ${CSAT_TARGET_SCORE}점`}
        trend={s.scoreTrend}
        trendLabel="전주 대비"
        variant={s.avgScore >= CSAT_TARGET_SCORE ? "success" : s.avgScore >= 4.0 ? "default" : "warning"}
        centerBreakdown={{
          yongsan: `${(s.yongsanAvgScore || 0).toFixed(2)}점`,
          gwangju: `${(s.gwangjuAvgScore || 0).toFixed(2)}점`,
        }}
      />
      <StatsCard
        title="평가 현황"
        value={`${s.totalReviews.toLocaleString("ko-KR")}건`}
        subtitle={`상담 ${(s.totalConsults || 0).toLocaleString("ko-KR")}건 · 요청 ${(s.totalRequests || 0).toLocaleString("ko-KR")}건 · 상담대비 ${s.totalConsults > 0 ? ((s.totalReviews / s.totalConsults) * 100).toFixed(1) : "0.0"}%`}
        trend={s.requestsTrend}
        trendLabel="요청 전주대비"
      />
      <StatsCard
        title="5점 비율"
        value={`${s.score5Rate.toFixed(1)}%`}
        variant={s.score5Rate >= 80 ? "success" : s.score5Rate >= 60 ? "default" : "warning"}
      />
      <StatsCard
        title="1~2점 비율"
        value={`${lowRate.toFixed(1)}%`}
        subtitle={`1점 ${s.score1Rate.toFixed(1)}% · 2점 ${s.score2Rate.toFixed(1)}%`}
        variant={lowRate > 10 ? "destructive" : lowRate > 5 ? "warning" : "success"}
      />
      <StatsCard
        title="저점건수"
        value={`${(s.lowScoreCount || 0).toLocaleString("ko-KR")}건`}
        subtitle={`1점 ${(s.score1Count || 0)}건 · 2점 ${(s.score2Count || 0)}건`}
        trend={s.lowScoreTrend}
        trendLabel="전주 대비"
        variant={(s.lowScoreCount || 0) > 50 ? "destructive" : (s.lowScoreCount || 0) > 30 ? "warning" : "success"}
      />
    </div>
  )
}
