"use client"

import { StatsCard } from "../stats-card"
import type { QADashboardStats } from "@/lib/types"

interface QAOverviewSectionProps {
  stats: QADashboardStats | null
}

export function QAOverviewSection({ stats }: QAOverviewSectionProps) {
  const s = stats || {
    avgScore: 0, totalEvaluations: 0, evaluatedAgents: 0,
    yongsanAvgScore: 0, gwangjuAvgScore: 0,
    yongsanEvaluations: 0, gwangjuEvaluations: 0,
    voiceAvgScore: 0, chatAvgScore: 0, monthLabel: "-",
  }

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      <StatsCard
        title="QA 평균 점수"
        value={`${s.avgScore.toFixed(1)}점`}
        subtitle={s.monthLabel || "전체"}
        trend={s.scoreTrend}
        trendLabel="전월 대비"
        variant={s.avgScore >= 90 ? "success" : s.avgScore >= 88 ? "default" : "warning"}
        centerBreakdown={{
          yongsan: `${(s.yongsanAvgScore || 0).toFixed(1)}점`,
          gwangju: `${(s.gwangjuAvgScore || 0).toFixed(1)}점`,
        }}
      />
      <StatsCard
        title="평가 건수"
        value={String(s.totalEvaluations)}
        subtitle={`${s.evaluatedAgents}명 평가`}
      />
      <StatsCard
        title="유선 평균"
        value={`${(s.voiceAvgScore || 0).toFixed(1)}점`}
        subtitle="목표 88점"
        variant={(s.voiceAvgScore || 0) >= 88 ? "success" : (s.voiceAvgScore || 0) >= 85 ? "default" : "warning"}
      />
      <StatsCard
        title="채팅 평균"
        value={`${(s.chatAvgScore || 0).toFixed(1)}점`}
        subtitle="목표 90점"
        variant={(s.chatAvgScore || 0) >= 90 ? "success" : (s.chatAvgScore || 0) >= 87 ? "default" : "warning"}
      />
      <StatsCard
        title="평가 건수 (센터별)"
        value={String(s.totalEvaluations)}
        subtitle={`용산 ${s.yongsanEvaluations} / 광주 ${s.gwangjuEvaluations}`}
      />
    </div>
  )
}
