"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
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

  const centerRows = [
    {
      center: "용산",
      color: "text-[#3b82f6]",
      bg: "border-blue-100 bg-blue-50/30",
      dot: "bg-[#3b82f6]",
      voice: s.yongsanVoiceAvg || 0,
      chat: s.yongsanChatAvg || 0,
      total: s.yongsanAvgScore || 0,
      evals: s.yongsanEvaluations || 0,
    },
    {
      center: "광주",
      color: "text-[#1e3a5f]",
      bg: "border-slate-200 bg-slate-50/30",
      dot: "bg-[#1e3a5f]",
      voice: s.gwangjuVoiceAvg || 0,
      chat: s.gwangjuChatAvg || 0,
      total: s.gwangjuAvgScore || 0,
      evals: s.gwangjuEvaluations || 0,
    },
  ]

  return (
    <div className="space-y-3">
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

    {/* 센터별 채널 상세 카드 (2줄) */}
    <div className="space-y-2">
      {centerRows.map((row) => (
        <Card key={row.center} className={cn("border shadow-sm", row.bg)}>
          <CardContent className="py-2.5 px-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 min-w-[50px]">
                <span className={cn("w-2 h-2 rounded-full shrink-0", row.dot)} />
                <span className={cn("text-sm font-bold", row.color)}>{row.center}</span>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-6">
                <div>
                  <span className="text-[10px] text-muted-foreground">유선</span>
                  <div className="text-sm font-semibold">{row.voice.toFixed(1)}점</div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">채팅</span>
                  <div className="text-sm font-semibold">{row.chat.toFixed(1)}점</div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">합계</span>
                  <div className="text-sm font-bold">{row.total.toFixed(1)}점</div>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{row.evals}건 평가</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
    </div>
  )
}
