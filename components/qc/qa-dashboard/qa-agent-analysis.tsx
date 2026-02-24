"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowDown, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { SERVICE_ORDER } from "@/lib/constants"
import type { QAAgentPerformance } from "@/lib/types"

interface Props {
  center: string
  service: string
  channel: string
  tenure: string
  startMonth?: string
  endMonth?: string
}

// 취약항목 뱃지 (클릭으로 확장)
function WeakItemBadges({ items }: { items: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const VISIBLE = 4
  const visible = expanded ? items : items.slice(0, VISIBLE)
  const remaining = items.length - VISIBLE

  return (
    <div className="flex items-center gap-1 flex-nowrap overflow-x-auto">
      {visible.map((item, j) => (
        <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0 text-red-600 border-red-200 bg-red-50 whitespace-nowrap shrink-0">
          {item}
        </Badge>
      ))}
      {remaining > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded-full border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
        >
          +{remaining} <ChevronDown className="h-2.5 w-2.5" />
        </button>
      )}
      {expanded && items.length > VISIBLE && (
        <button
          onClick={() => setExpanded(false)}
          className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded-full border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
        >
          접기 <ChevronUp className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}

// 센터 > 서비스 > 채널 그룹 구조
interface GroupKey { center: string; service: string; channel: string }

function groupAgents(data: QAAgentPerformance[]): Map<string, { key: GroupKey; agents: QAAgentPerformance[]; groupAvg: number }> {
  const orderMap = new Map((SERVICE_ORDER as readonly string[]).map((s, i) => [s, i]))
  const map = new Map<string, { key: GroupKey; agents: QAAgentPerformance[]; groupAvg: number }>()

  for (const agent of data) {
    const k = `${agent.center}|${agent.service}|${agent.channel}`
    if (!map.has(k)) {
      map.set(k, { key: { center: agent.center, service: agent.service, channel: agent.channel }, agents: [], groupAvg: agent.groupAvg })
    }
    map.get(k)!.agents.push(agent)
  }

  // 센터 → SERVICE_ORDER → 채널 정렬
  const sorted = [...map.entries()].sort(([, a], [, b]) => {
    if (a.key.center !== b.key.center) return a.key.center.localeCompare(b.key.center)
    const ai = orderMap.get(a.key.service) ?? 999
    const bi = orderMap.get(b.key.service) ?? 999
    if (ai !== bi) return ai - bi
    return a.key.channel.localeCompare(b.key.channel)
  })

  return new Map(sorted)
}

export function QAAgentAnalysis({ center, service, channel, tenure, startMonth, endMonth }: Props) {
  const [data, setData] = useState<QAAgentPerformance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ type: "qa-agent-performance" })
        if (center !== "all") params.set("center", center)
        if (service !== "all") params.set("service", service)
        if (channel !== "all") params.set("channel", channel)
        if (tenure !== "all") params.set("tenure", tenure)
        if (startMonth) params.set("startMonth", startMonth.slice(0, 7))
        if (endMonth) params.set("endMonth", endMonth.slice(0, 7))

        const res = await fetch(`/api/data?${params}`)
        const json = await res.json()
        if (json.success && json.data) {
          setData(json.data)
        }
      } catch (err) {
        console.error("QA agent performance error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [center, service, channel, tenure, startMonth, endMonth])

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-xs py-8">
        그룹 평균 이하 대상자가 없습니다 (5회 이상 평가 기준)
      </div>
    )
  }

  const groups = groupAgents(data)

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        5회 이상 평가 상담사 중 그룹 평균 이하 대상자 <strong className="text-gray-900">{data.length}명</strong>
      </p>

      {[...groups.entries()].map(([groupKey, { key, agents, groupAvg }]) => {
        const groupTotal = agents[0]?.groupTotal || 0
        const pct = groupTotal > 0 ? ((agents.length / groupTotal) * 100).toFixed(0) : "-"
        return (
        <div key={groupKey} className="border border-slate-200 rounded-lg overflow-hidden">
          {/* 그룹 헤더 */}
          <div className="bg-slate-50 px-4 py-2 flex items-center gap-2 border-b border-slate-200">
            <span className="text-xs font-bold text-gray-900">{key.center}</span>
            <span className="text-[10px] text-gray-400">/</span>
            <span className="text-xs font-medium text-gray-700">{key.service}</span>
            <span className="text-[10px] text-gray-400">/</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{key.channel}</Badge>
            <span className="ml-auto text-[10px] text-muted-foreground">
              그룹평균 <strong className="text-gray-700">{groupAvg.toFixed(1)}점</strong> · 전체 {groupTotal}명 중 <strong className="text-red-600">{agents.length}명</strong> ({pct}%)
            </span>
          </div>

          {/* 테이블 */}
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left">이름</th>
                <th className="text-left">닉네임</th>
                <th className="text-right">평가건수</th>
                <th className="text-right">평균점수</th>
                <th className="text-right">차이</th>
                <th className="text-left">취약항목</th>
              </tr>
            </thead>
            <tbody>
              {agents
                .sort((a, b) => a.diff - b.diff)
                .map((agent, i) => (
                <tr key={i}>
                  <td className="text-left font-medium">{agent.agentName}</td>
                  <td className="text-left">{agent.agentId || "-"}</td>
                  <td className="text-right">{agent.evaluations}건</td>
                  <td className="text-right">
                    <span className={cn("font-medium", agent.diff < -3 ? "text-red-500" : agent.diff < -1 ? "text-amber-600" : "text-gray-700")}>
                      {agent.avgScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="inline-flex items-center gap-0.5 text-red-500 font-medium">
                      <ArrowDown className="h-3 w-3" />
                      {Math.abs(agent.diff).toFixed(1)}
                    </span>
                  </td>
                  <td className="text-left">
                    {agent.weakItems.length > 0 ? (
                      <WeakItemBadges items={agent.weakItems} />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )})}
    </div>
  )
}
