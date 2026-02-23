"use client"

import { StatsCard } from "../stats-card"
import type { QADashboardStats } from "@/lib/types"

interface QAOverviewSectionProps {
  stats: QADashboardStats | null
  underperformerCount: { yongsan: number; gwangju: number; total: number }
}

export function QAOverviewSection({ stats, underperformerCount }: QAOverviewSectionProps) {
  const s = stats || {
    avgScore: 0, totalEvaluations: 0, evaluatedAgents: 0,
    yongsanAvgScore: 0, gwangjuAvgScore: 0,
    yongsanEvaluations: 0, gwangjuEvaluations: 0,
    voiceAvgScore: 0, chatAvgScore: 0, monthLabel: "-",
  }

  // 유선: ≥88 안정(green), ≥85 유의(amber), <85 위험(red)
  const voiceVariant: "success" | "warning" | "destructive" | "default" =
    (s.voiceAvgScore || 0) >= 88 ? "success"
    : (s.voiceAvgScore || 0) >= 85 ? "warning"
    : "destructive"

  // 채팅: ≥90 안정(green), ≥87 유의(amber), <87 위험(red)
  const chatVariant: "success" | "warning" | "destructive" | "default" =
    (s.chatAvgScore || 0) >= 90 ? "success"
    : (s.chatAvgScore || 0) >= 87 ? "warning"
    : "destructive"

  // 전체: ≥90 안정, ≥88 유의, <88 위험
  const overallVariant: "success" | "warning" | "destructive" | "default" =
    s.avgScore >= 90 ? "success"
    : s.avgScore >= 88 ? "warning"
    : "destructive"

  // 유의상담사 variant
  const underVariant: "success" | "warning" | "destructive" | "default" =
    underperformerCount.total === 0 ? "success"
    : underperformerCount.total <= 5 ? "warning"
    : "destructive"

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="QA 평균 점수"
        value={`${s.avgScore.toFixed(1)}점`}
        subtitle={`${s.totalEvaluations}건 · ${s.evaluatedAgents}명 평가`}
        trend={s.scoreTrend}
        trendLabel="전월 대비"
        variant={overallVariant}
        centerBreakdown={{
          yongsan: `${(s.yongsanAvgScore || 0).toFixed(1)}점`,
          gwangju: `${(s.gwangjuAvgScore || 0).toFixed(1)}점`,
        }}
      />
      <StatsCard
        title="유선 평균"
        value={`${(s.voiceAvgScore || 0).toFixed(1)}점`}
        subtitle="목표 88점"
        trend={s.voiceTrend}
        trendLabel="전월 대비"
        variant={voiceVariant}
        centerBreakdown={{
          yongsan: `${(s.yongsanVoiceAvg || 0).toFixed(1)}점`,
          gwangju: `${(s.gwangjuVoiceAvg || 0).toFixed(1)}점`,
        }}
      />
      <StatsCard
        title="채팅 평균"
        value={`${(s.chatAvgScore || 0).toFixed(1)}점`}
        subtitle="목표 90점"
        trend={s.chatTrend}
        trendLabel="전월 대비"
        variant={chatVariant}
        centerBreakdown={{
          yongsan: `${(s.yongsanChatAvg || 0).toFixed(1)}점`,
          gwangju: `${(s.gwangjuChatAvg || 0).toFixed(1)}점`,
        }}
      />
      <StatsCard
        title="유의 상담사"
        value={`${underperformerCount.total}명`}
        subtitle="그룹평균 이하 (5회+ 평가)"
        variant={underVariant}
        centerBreakdown={{
          yongsan: `${underperformerCount.yongsan}명`,
          gwangju: `${underperformerCount.gwangju}명`,
        }}
      />
    </div>
  )
}
