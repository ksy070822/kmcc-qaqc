"use client"

import { StatsCard } from "../stats-card"
import type { QADashboardStats } from "@/lib/types"

type Variant = "success" | "warning" | "destructive" | "default"

const voiceVar = (v: number): Variant => v >= 88 ? "success" : v >= 85 ? "warning" : "destructive"
const chatVar = (v: number): Variant => v >= 90 ? "success" : v >= 87 ? "warning" : "destructive"
const totalVar = (v: number): Variant => v >= 90 ? "success" : v >= 88 ? "warning" : "destructive"

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

  const underVariant: Variant =
    underperformerCount.total === 0 ? "success"
    : underperformerCount.total <= 5 ? "warning"
    : "destructive"

  return (
    <div className="space-y-3">
      {/* 메인 KPI 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="QA 평균 점수"
          value={`${s.avgScore.toFixed(1)}점`}
          subtitle={`${s.totalEvaluations}건 · ${s.evaluatedAgents}명 평가`}
          trend={s.scoreTrend}
          trendLabel="전월 대비"
          variant={totalVar(s.avgScore)}
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
          variant={voiceVar(s.voiceAvgScore || 0)}
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
          variant={chatVar(s.chatAvgScore || 0)}
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

      {/* 용산 센터 채널별 카드 */}
      <div className="grid gap-3 grid-cols-3">
        <StatsCard
          title="용산 유선"
          value={`${(s.yongsanVoiceAvg || 0).toFixed(1)}점`}
          subtitle="목표 88점"
          variant={voiceVar(s.yongsanVoiceAvg || 0)}
        />
        <StatsCard
          title="용산 채팅"
          value={`${(s.yongsanChatAvg || 0).toFixed(1)}점`}
          subtitle="목표 90점"
          variant={chatVar(s.yongsanChatAvg || 0)}
        />
        <StatsCard
          title="용산 합계"
          value={`${(s.yongsanAvgScore || 0).toFixed(1)}점`}
          subtitle={`${s.yongsanEvaluations || 0}건 평가`}
          variant={totalVar(s.yongsanAvgScore || 0)}
        />
      </div>

      {/* 광주 센터 채널별 카드 */}
      <div className="grid gap-3 grid-cols-3">
        <StatsCard
          title="광주 유선"
          value={`${(s.gwangjuVoiceAvg || 0).toFixed(1)}점`}
          subtitle="목표 88점"
          variant={voiceVar(s.gwangjuVoiceAvg || 0)}
        />
        <StatsCard
          title="광주 채팅"
          value={`${(s.gwangjuChatAvg || 0).toFixed(1)}점`}
          subtitle="목표 90점"
          variant={chatVar(s.gwangjuChatAvg || 0)}
        />
        <StatsCard
          title="광주 합계"
          value={`${(s.gwangjuAvgScore || 0).toFixed(1)}점`}
          subtitle={`${s.gwangjuEvaluations || 0}건 평가`}
          variant={totalVar(s.gwangjuAvgScore || 0)}
        />
      </div>
    </div>
  )
}
