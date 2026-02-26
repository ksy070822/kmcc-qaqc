"use client"

import { StatsCard } from "../stats-card"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Target, CheckCircle, TrendingDown, TrendingUp } from "lucide-react"
import type { QADashboardStats } from "@/lib/types"

type Variant = "success" | "warning" | "destructive" | "default"

const voiceVar = (v: number): Variant => v >= 88 ? "success" : v >= 85 ? "warning" : "destructive"
const chatVar = (v: number): Variant => v >= 90 ? "success" : v >= 87 ? "warning" : "destructive"
const totalVar = (v: number): Variant => v >= 90 ? "success" : v >= 88 ? "warning" : "destructive"

// QA 목표 (점수: 높을수록 좋음)
const TARGETS = {
  voice: 88,
  chat: 90,
  total: 90,
}

// 상태 판정 (점수 기반: 높을수록 좋음)
function getStatus(score: number, target: number): "achieved" | "on-track" | "missed" {
  if (score >= target) return "achieved"
  if (score >= target - 3) return "on-track"
  return "missed"
}

function getStatusConfig(status: string) {
  switch (status) {
    case "achieved":
      return {
        icon: CheckCircle,
        label: "달성",
        className: "bg-emerald-100 text-emerald-700 border-emerald-300",
        progressColor: "bg-emerald-500",
        borderColor: "border-emerald-300",
        valueColor: "text-emerald-600",
      }
    case "on-track":
      return {
        icon: TrendingDown,
        label: "순항",
        className: "bg-blue-100 text-blue-700 border-blue-300",
        progressColor: "bg-blue-500",
        borderColor: "border-blue-300",
        valueColor: "text-blue-600",
      }
    case "missed":
    default:
      return {
        icon: TrendingUp,
        label: "미달",
        className: "bg-red-100 text-red-700 border-red-300",
        progressColor: "bg-red-500",
        borderColor: "border-red-300",
        valueColor: "text-red-600",
      }
  }
}

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

  // 센터 × 채널 매트릭스 데이터
  const matrix: Array<{
    center: string
    cells: Array<{ label: string; score: number; target: number }>
  }> = [
    {
      center: "용산",
      cells: [
        { label: "유선", score: s.yongsanVoiceAvg || 0, target: TARGETS.voice },
        { label: "채팅", score: s.yongsanChatAvg || 0, target: TARGETS.chat },
        { label: "합계", score: s.yongsanAvgScore || 0, target: TARGETS.total },
      ],
    },
    {
      center: "광주",
      cells: [
        { label: "유선", score: s.gwangjuVoiceAvg || 0, target: TARGETS.voice },
        { label: "채팅", score: s.gwangjuChatAvg || 0, target: TARGETS.chat },
        { label: "합계", score: s.gwangjuAvgScore || 0, target: TARGETS.total },
      ],
    },
    {
      center: "전체",
      cells: [
        { label: "유선", score: s.voiceAvgScore || 0, target: TARGETS.voice },
        { label: "채팅", score: s.chatAvgScore || 0, target: TARGETS.chat },
        { label: "합계", score: s.avgScore || 0, target: TARGETS.total },
      ],
    },
  ]

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

      {/* QA 목표 진척도 — QC 목표 달성 현황과 동일 스타일 */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Target className="h-5 w-5 text-[#2c6edb]" />
              QA 목표 진척도
            </h3>
            {s.monthLabel && s.monthLabel !== "-" && (
              <span className="text-xs text-muted-foreground">{s.monthLabel}</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground w-[72px]">센터</th>
                  {["유선", "채팅", "합계"].map(col => (
                    <th key={col} className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">
                      <Badge variant="outline" className={cn("text-xs",
                        col === "유선" ? "bg-blue-50 text-blue-700 border-blue-200"
                        : col === "채팅" ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                      )}>
                        {col}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map(row => (
                  <tr key={row.center} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 px-3 align-middle">
                      <span className="font-semibold text-sm text-foreground">{row.center}</span>
                    </td>
                    {row.cells.map(cell => {
                      if (!cell.score || cell.score === 0) {
                        return (
                          <td key={cell.label} className="py-3 px-2 text-center align-middle">
                            <span className="text-xs text-muted-foreground">-</span>
                          </td>
                        )
                      }

                      const status = getStatus(cell.score, cell.target)
                      const config = getStatusConfig(status)
                      const StatusIcon = config.icon
                      const achievementRate = cell.target > 0
                        ? Math.min(100, (cell.score / cell.target) * 100)
                        : 0

                      return (
                        <td key={cell.label} className="py-3 px-2 align-middle">
                          <div className={cn("rounded-lg border p-4 bg-white", config.borderColor)}>
                            {/* 상태 배지 */}
                            <div className="flex items-center justify-end mb-2">
                              <Badge className={cn("text-xs px-2 py-0.5", config.className)}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {config.label}
                              </Badge>
                            </div>
                            {/* 현재 점수 */}
                            <div className="text-center mb-1">
                              <span className={cn("text-2xl font-bold", config.valueColor)}>
                                {cell.score.toFixed(1)}점
                              </span>
                            </div>
                            {/* 목표 */}
                            <div className="text-center mb-3">
                              <span className="text-xs text-muted-foreground">
                                목표 {cell.target}점
                              </span>
                            </div>
                            {/* 달성률 바 */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">달성률</span>
                                <span className="font-mono font-semibold">{achievementRate.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-slate-200">
                                <div
                                  className={cn("h-2 rounded-full transition-all", config.progressColor)}
                                  style={{ width: `${Math.min(100, achievementRate)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
