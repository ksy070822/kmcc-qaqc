"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { Users, Search, Loader2, ArrowUpDown } from "lucide-react"
import type { AgentMultiDomainRow } from "@/lib/bigquery-role-metrics"

type SortKey = keyof Pick<AgentMultiDomainRow, "agentName" | "qcEvalCount" | "qcAttRate" | "qcOpsRate" | "qaScore" | "csatScore" | "quizScore">

export default function InstructorAgentsPage() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<AgentMultiDomainRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("qcAttRate")
  const [sortDesc, setSortDesc] = useState(true)

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true)
        const month = new Date().toISOString().slice(0, 7)
        const params = new URLSearchParams({ type: "agent-list", month })
        if (user?.center) params.append("center", user.center)

        const res = await fetch(`/api/role-metrics?${params}`)
        const data = await res.json()

        if (data.success && Array.isArray(data.agents)) {
          setAgents(data.agents)
        }
      } catch {
        setAgents([])
      } finally {
        setLoading(false)
      }
    }
    fetchAgents()
  }, [user?.center])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc)
    else { setSortKey(key); setSortDesc(true) }
  }

  const filtered = agents
    .filter((a) => !search || a.agentName.includes(search) || a.agentId.includes(search) || a.service.includes(search))
    .sort((a, b) => {
      const av = a[sortKey] ?? -999
      const bv = b[sortKey] ?? -999
      if (typeof av === "string") return sortDesc ? (bv as string).localeCompare(av) : av.localeCompare(bv as string)
      return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })

  // 항목별 데이터 보유 상담사 수
  const qcCount = agents.filter((a) => a.qcEvalCount > 0).length
  const qaCount = agents.filter((a) => a.qaScore != null).length
  const csatCount = agents.filter((a) => a.csatScore != null).length
  const quizCount = agents.filter((a) => a.quizScore != null).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">상담사 분석</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.center ? `${user.center} 센터` : "전체"} 상담사별 종합 현황
        </p>
      </div>

      {/* 항목별 데이터 현황 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniStat label="전체 상담사" value={`${agents.length}명`} />
        <MiniStat label="QC 검수" value={`${qcCount}명`} />
        <MiniStat label="QA 평가" value={`${qaCount}명`} />
        <MiniStat label="상담평점 리뷰" value={`${csatCount}명`} />
        <MiniStat label="직무테스트" value={`${quizCount}명`} />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="상담사 이름, ID, 서비스 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Badge variant="outline">{filtered.length}명</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-[#7c3aed]" />
            상담사 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th label="상담사" />
                  <Th label="서비스/채널" />
                  <ThSort label="검수건수" sortKey="qcEvalCount" currentKey={sortKey} desc={sortDesc} onClick={handleSort} align="right" />
                  <ThSort label="태도 오류율" sortKey="qcAttRate" currentKey={sortKey} desc={sortDesc} onClick={handleSort} align="right" />
                  <ThSort label="오상담 오류율" sortKey="qcOpsRate" currentKey={sortKey} desc={sortDesc} onClick={handleSort} align="right" />
                  <ThSort label="QA" sortKey="qaScore" currentKey={sortKey} desc={sortDesc} onClick={handleSort} align="right" />
                  <ThSort label="상담평점" sortKey="csatScore" currentKey={sortKey} desc={sortDesc} onClick={handleSort} align="right" />
                  <ThSort label="직무테스트" sortKey="quizScore" currentKey={sortKey} desc={sortDesc} onClick={handleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      상담사 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  filtered.map((agent) => (
                    <tr key={agent.agentId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{agent.agentId} / {agent.agentName}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {agent.service ? `${agent.service}/${agent.channel}` : agent.channel || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-900">{agent.qcEvalCount}건</td>
                      <td className="py-2.5 px-3 text-right">
                        <RateCell value={agent.qcAttRate} threshold={3.3} suffix="%" />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <RateCell value={agent.qcOpsRate} threshold={3.9} suffix="%" />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <ScoreCell value={agent.qaScore} low={85} suffix="점" />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <ScoreCell value={agent.csatScore} low={3.5} suffix="점" decimals={2} />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <ScoreCell value={agent.quizScore} low={70} suffix="점" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── 공통 컴포넌트 ──

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="text-lg font-bold text-slate-900">{value}</div>
        <p className="text-xs text-slate-500">{label}</p>
      </CardContent>
    </Card>
  )
}

function Th({ label }: { label: string }) {
  return <th className="py-2 px-3 text-left font-medium text-slate-500">{label}</th>
}

function ThSort({ label, sortKey, currentKey, desc, onClick, align = "left" }: {
  label: string; sortKey: SortKey; currentKey: SortKey; desc: boolean
  onClick: (key: SortKey) => void; align?: "left" | "right"
}) {
  const active = currentKey === sortKey
  return (
    <th
      className={`py-2 px-3 font-medium text-slate-500 cursor-pointer select-none text-${align}`}
      onClick={() => onClick(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${active ? "text-slate-900" : ""}`}>
        {label} <ArrowUpDown className="h-3 w-3" />
      </span>
    </th>
  )
}

/** 오류율 셀: threshold 초과 시 빨강 */
function RateCell({ value, threshold, suffix }: { value: number | null; threshold: number; suffix: string }) {
  if (value == null) return <span className="text-slate-300">-</span>
  return (
    <span className={value > threshold ? "text-red-600 font-medium" : "text-slate-900"}>
      {value.toFixed(1)}{suffix}
    </span>
  )
}

/** 점수 셀: low 미만이면 빨강 */
function ScoreCell({ value, low, suffix, decimals = 1 }: { value: number | null; low: number; suffix: string; decimals?: number }) {
  if (value == null) return <span className="text-slate-300">-</span>
  return (
    <span className={value < low ? "text-red-600 font-medium" : "text-slate-900"}>
      {value.toFixed(decimals)}{suffix}
    </span>
  )
}
