"use client"

import { StatsCard } from "../stats-card"
import type { CSATDashboardStats } from "@/lib/types"
import { CSAT_TARGET_SCORE } from "@/lib/constants"

interface Props {
  stats: CSATDashboardStats | null
  /** 관리자 스코핑: "용산" | "광주" 지정 시 단일 센터 뷰 */
  scopeCenter?: string
}

export function CSATOverviewSection({ stats, scopeCenter }: Props) {
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
        centerBreakdown={!scopeCenter ? {
          yongsan: `${(s.yongsanAvgScore || 0).toFixed(2)}점`,
          gwangju: `${(s.gwangjuAvgScore || 0).toFixed(2)}점`,
        } : undefined}
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
      {/* 1·2점 비율 — 개별 Badge 분리 */}
      <div className="border shadow-sm rounded-xl transition-colors border-border bg-card">
        <div className="p-4 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">1·2점 비율</p>
          <p className={`text-2xl font-bold tracking-tight ${lowRate > 10 ? "text-red-600" : lowRate > 5 ? "text-orange-600" : "text-foreground"}`}>
            {lowRate.toFixed(1)}%
          </p>
          <div className="flex gap-2 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              1점 {s.score1Rate.toFixed(1)}%
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              2점 {s.score2Rate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      {/* 저점건수 — 1점/2점 개별 강조 */}
      <div className={`border shadow-sm rounded-xl transition-colors ${
        (s.lowScoreCount || 0) > 50 ? "border-red-500/40 bg-red-50" : (s.lowScoreCount || 0) > 30 ? "border-amber-500/40 bg-amber-50" : "border-emerald-500/40 bg-emerald-50"
      }`}>
        <div className="p-4 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">저점건수</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {(s.lowScoreCount || 0).toLocaleString("ko-KR")}건
          </p>
          <div className="flex gap-2 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              1점 {(s.score1Count || 0)}건
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              2점 {(s.score2Count || 0)}건
            </span>
          </div>
          {s.lowScoreTrend !== undefined && (
            <p className={`text-xs font-medium ${s.lowScoreTrend > 0 ? "text-red-600" : "text-blue-600"}`}>
              {s.lowScoreTrend > 0 ? "▲" : "▼"}{Math.abs(s.lowScoreTrend).toFixed(1)}% 전주 대비
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
