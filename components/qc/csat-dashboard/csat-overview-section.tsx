"use client"

import { StatsCard } from "../stats-card"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CSATDashboardStats } from "@/lib/types"
import { CSAT_TARGET_SCORE } from "@/lib/constants"

interface Props {
  stats: CSATDashboardStats | null
  scopeCenter?: string
}

function TrendBadge({ value, label, invert }: { value?: number; label: string; invert?: boolean }) {
  if (value === undefined || value === null) return null
  // invert: 양수가 나쁜 경우 (저점비율, 저점건수 등)
  const isGood = invert ? value <= 0 : value >= 0
  const color = value === 0 ? "text-muted-foreground" : isGood ? "text-emerald-600" : "text-red-600"
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : null

  return (
    <div className={cn("flex items-center gap-1 text-sm font-medium whitespace-nowrap", color)}>
      {Icon && <Icon className="h-4 w-4" />}
      <span>{value > 0 ? "+" : ""}{value.toFixed(2)}%p</span>
      <span className="text-xs text-muted-foreground font-normal ml-0.5">{label}</span>
    </div>
  )
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
      {/* 5점 비율 — 전주대비 추가 */}
      <div className={cn(
        "border shadow-sm rounded-xl transition-colors",
        s.score5Rate >= 80 ? "border-emerald-500/40 bg-emerald-50" : s.score5Rate >= 60 ? "border-border bg-card" : "border-amber-500/40 bg-amber-50"
      )}>
        <div className="p-4 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">5점 비율</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{s.score5Rate.toFixed(1)}%</p>
          <TrendBadge value={s.score5Trend} label="전주 대비" />
        </div>
      </div>
      {/* 1·2점 비율 — 전주대비 추가 */}
      <div className={cn(
        "border shadow-sm rounded-xl transition-colors",
        lowRate > 10 ? "border-red-500/40 bg-red-50" : lowRate > 5 ? "border-amber-500/40 bg-amber-50" : "border-border bg-card"
      )}>
        <div className="p-4 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">1·2점 비율</p>
          <p className={cn("text-2xl font-bold tracking-tight", lowRate > 10 ? "text-red-600" : lowRate > 5 ? "text-orange-600" : "text-foreground")}>
            {lowRate.toFixed(1)}%
          </p>
          <TrendBadge value={s.lowScoreRateTrend} label="전주 대비" invert />
          <div className="flex gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              1점 {s.score1Rate.toFixed(1)}%
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              2점 {s.score2Rate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      {/* 저점건수 — 통일된 TrendBadge */}
      <div className={cn(
        "border shadow-sm rounded-xl transition-colors",
        (s.lowScoreCount || 0) > 50 ? "border-red-500/40 bg-red-50" : (s.lowScoreCount || 0) > 30 ? "border-amber-500/40 bg-amber-50" : "border-emerald-500/40 bg-emerald-50"
      )}>
        <div className="p-4 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">저점건수</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {(s.lowScoreCount || 0).toLocaleString("ko-KR")}건
          </p>
          {s.lowScoreTrend !== undefined && (
            <TrendBadge value={s.lowScoreTrend} label="전주 대비" invert />
          )}
          <div className="flex gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              1점 {(s.score1Count || 0)}건
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              2점 {(s.score2Count || 0)}건
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
