"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { Target, Search, Loader2, AlertTriangle, ArrowUpDown } from "lucide-react"

interface WatchAgent {
  agentId: string
  agentName: string
  center: string
  service: string
  channel: string
  evaluationCount: number
  attitudeRate: number
  opsRate: number
  reason: string
}

type SortKey = "agentName" | "evaluationCount" | "attitudeRate" | "opsRate"

export default function InstructorWatchlistPage() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<WatchAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("attitudeRate")
  const [sortDesc, setSortDesc] = useState(true)

  useEffect(() => {
    async function fetchWatchlist() {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (user?.center) params.append("center", user.center)

        const res = await fetch(`/api/watchlist?${params}`)
        const data = await res.json()

        if (data.success && Array.isArray(data.data)) {
          setAgents(data.data)
        }
      } catch {
        setAgents([])
      } finally {
        setLoading(false)
      }
    }
    fetchWatchlist()
  }, [user?.center])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc)
    else { setSortKey(key); setSortDesc(true) }
  }

  const filtered = agents
    .filter((a) => !search || a.agentName.includes(search) || a.agentId.includes(search) || a.service.includes(search))
    .sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      if (typeof av === "string") return sortDesc ? (bv as string).localeCompare(av) : av.localeCompare(bv as string)
      return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })

  const highRiskCount = agents.filter((a) => a.attitudeRate > 3.3 || a.opsRate > 3.9).length

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
        <h1 className="text-xl font-bold text-slate-900">집중관리 대상</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.center ? `${user.center} 센터` : "전체"} 오류율 기준 초과 상담사
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-slate-900">{agents.length}명</div>
            <p className="text-xs text-slate-500 mt-1">전체 관리 대상</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-red-600">{highRiskCount}명</div>
            <p className="text-xs text-slate-500 mt-1">기준 초과 (태도 3.3% 또는 오상담 3.9%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-green-600">{agents.length - highRiskCount}명</div>
            <p className="text-xs text-slate-500 mt-1">기준 이내</p>
          </CardContent>
        </Card>
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
            <Target className="h-4 w-4 text-[#7c3aed]" />
            집중관리 대상자 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 px-3 text-left font-medium text-slate-500">상담사</th>
                  <th className="py-2 px-3 text-left font-medium text-slate-500">서비스/채널</th>
                  <th className="py-2 px-3 text-right font-medium text-slate-500 cursor-pointer select-none" onClick={() => handleSort("evaluationCount")}>
                    <span className="inline-flex items-center gap-1">검수건수 <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="py-2 px-3 text-right font-medium text-slate-500 cursor-pointer select-none" onClick={() => handleSort("attitudeRate")}>
                    <span className="inline-flex items-center gap-1">태도 오류율 <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="py-2 px-3 text-right font-medium text-slate-500 cursor-pointer select-none" onClick={() => handleSort("opsRate")}>
                    <span className="inline-flex items-center gap-1">오상담 오류율 <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="py-2 px-3 text-left font-medium text-slate-500">사유</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      집중관리 대상이 없습니다
                    </td>
                  </tr>
                ) : (
                  filtered.map((agent) => {
                    const isHigh = agent.attitudeRate > 3.3 || agent.opsRate > 3.9
                    return (
                      <tr key={agent.agentId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {isHigh && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                            <div>
                              <div className="font-medium text-slate-900">{agent.agentName}</div>
                              <div className="text-xs text-slate-400">{agent.agentId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{agent.service}/{agent.channel}</td>
                        <td className="py-2.5 px-3 text-right text-slate-900">{agent.evaluationCount}건</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={agent.attitudeRate > 3.3 ? "text-red-600 font-medium" : "text-slate-900"}>
                            {agent.attitudeRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={agent.opsRate > 3.9 ? "text-red-600 font-medium" : "text-slate-900"}>
                            {agent.opsRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-xs max-w-[150px] truncate">
                          {agent.reason || "-"}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
