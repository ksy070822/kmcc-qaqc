"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { Users, Search, Loader2, ArrowUpDown } from "lucide-react"

interface AgentRow {
  id: string
  name: string
  center: string
  service: string
  channel: string
  totalEvaluations: number
  attitudeErrorRate: number
  opsErrorRate: number
}

type SortKey = "name" | "totalEvaluations" | "attitudeErrorRate" | "opsErrorRate"

export default function InstructorAgentsPage() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("attitudeErrorRate")
  const [sortDesc, setSortDesc] = useState(true)

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true)
        // 최신 날짜 기준으로 해당 주 데이터
        const ldRes = await fetch("/api/data?type=latest-date")
        const ldData = await ldRes.json()
        const latestDate = ldData.latestDate || new Date().toISOString().split("T")[0]

        const params = new URLSearchParams({ type: "agents", date: latestDate })
        if (user?.center) params.append("center", user.center)

        const res = await fetch(`/api/data?${params}`)
        const data = await res.json()

        if (data.success && Array.isArray(data.data)) {
          // center 필터 (API가 center 파라미터 안 받을 경우 대비)
          const filtered = user?.center
            ? data.data.filter((a: AgentRow) => a.center === user.center)
            : data.data
          setAgents(filtered)
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
    .filter((a) => !search || a.name.includes(search) || a.id.includes(search) || a.service.includes(search))
    .sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      if (typeof av === "string") return sortDesc ? (bv as string).localeCompare(av) : av.localeCompare(bv as string)
      return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })

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
          {user?.center ? `${user.center} 센터` : "전체"} 상담사별 오류율 현황
        </p>
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
                  <th className="py-2 px-3 text-left font-medium text-slate-500">상담사</th>
                  <th className="py-2 px-3 text-left font-medium text-slate-500">서비스/채널</th>
                  <th className="py-2 px-3 text-right font-medium text-slate-500 cursor-pointer select-none" onClick={() => handleSort("totalEvaluations")}>
                    <span className="inline-flex items-center gap-1">검수건수 <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="py-2 px-3 text-right font-medium text-slate-500 cursor-pointer select-none" onClick={() => handleSort("attitudeErrorRate")}>
                    <span className="inline-flex items-center gap-1">태도 오류율 <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="py-2 px-3 text-right font-medium text-slate-500 cursor-pointer select-none" onClick={() => handleSort("opsErrorRate")}>
                    <span className="inline-flex items-center gap-1">오상담 오류율 <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      상담사 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  filtered.map((agent) => (
                    <tr key={agent.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{agent.name}</div>
                        <div className="text-xs text-slate-400">{agent.id}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{agent.service}/{agent.channel}</td>
                      <td className="py-2.5 px-3 text-right text-slate-900">{agent.totalEvaluations}건</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={agent.attitudeErrorRate > 3.3 ? "text-red-600 font-medium" : "text-slate-900"}>
                          {agent.attitudeErrorRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={agent.opsErrorRate > 3.9 ? "text-red-600 font-medium" : "text-slate-900"}>
                          {agent.opsErrorRate.toFixed(1)}%
                        </span>
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
