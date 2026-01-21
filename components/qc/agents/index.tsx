"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AgentFilters } from "./agent-filters"
import { AgentTable } from "./agent-table"
import { AgentDetailModal } from "./agent-detail-modal"
import { useAgents } from "@/hooks/use-agents"
import { Loader2 } from "lucide-react"

export function AgentAnalysis() {
  const [search, setSearch] = useState("")
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedServiceGroup, setSelectedServiceGroup] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // BigQuery에서 데이터 가져오기
  const { data: agents, loading, error } = useAgents({
    center: selectedCenter,
    service: selectedServiceGroup,
    channel: selectedChannel,
    tenure: selectedTenure,
  })

  const agentRows = useMemo(() => {
    return (agents || []).map((agent) => {
      const errorRate = agent.overallErrorRate
      return {
        id: agent.id,
        name: agent.name,
        center: agent.center,
        group: `${agent.service}/${agent.channel}`,
        tenure: agent.tenureGroup,
        errorRate,
        trend: 0, // TODO: 전주 대비 계산
        totalCalls: agent.totalEvaluations,
        totalErrors: Math.floor((agent.attitudeErrorRate + agent.opsErrorRate) / 2),
        topIssue: "분석 중", // TODO: 항목별 오류 집계
        status: (errorRate > 4 ? "위험" : "양호") as "양호" | "위험",
      }
    })
  }, [agents])

  const filteredAgents = useMemo(() => {
    return agentRows.filter((agent) => {
      if (search && !agent.name.toLowerCase().includes(search.toLowerCase())) return false
      if (selectedCenter !== "all" && agent.center !== selectedCenter) return false
      if (selectedChannel !== "all" && !agent.group.includes(selectedChannel === "유선" ? "유선" : "채팅")) return false
      if (selectedServiceGroup !== "all" && !agent.group.includes(selectedServiceGroup)) return false
      // tenure 필터는 데이터가 없으므로 주석 처리
      // if (selectedTenure !== "all" && agent.tenure !== selectedTenure) return false
      return true
    })
  }, [agentRows, search, selectedCenter, selectedChannel, selectedServiceGroup])

  const handleSelectAgent = (agent: any) => {
    setSelectedAgent(agent)
    setDetailModalOpen(true)
  }

  const stats = useMemo(() => {
    const avgErrorRate =
      filteredAgents.length > 0 ? filteredAgents.reduce((sum, a) => sum + a.errorRate, 0) / filteredAgents.length : 0
    const riskCount = filteredAgents.filter((a) => a.status === "위험").length
    const safeCount = filteredAgents.filter((a) => a.status === "양호").length
    return { avgErrorRate, riskCount, safeCount }
  }, [filteredAgents])

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
          <strong>데이터 로드 오류:</strong> {error}
        </div>
      )}
      
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>데이터 로딩 중...</span>
        </div>
      )}
      
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">필터된 상담사</div>
            <p className="text-2xl font-bold">{filteredAgents.length}명</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">평균 오류율</div>
            <p className="text-2xl font-bold">{stats.avgErrorRate.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">위험</div>
            <p className="text-2xl font-bold text-red-600">{stats.riskCount}명</p>
          </CardContent>
        </Card>
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">양호</div>
            <p className="text-2xl font-bold text-green-600">{stats.safeCount}명</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>상담사 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AgentFilters
            search={search}
            onSearchChange={setSearch}
            selectedCenter={selectedCenter}
            onCenterChange={setSelectedCenter}
            selectedChannel={selectedChannel}
            onChannelChange={setSelectedChannel}
            selectedServiceGroup={selectedServiceGroup}
            onServiceGroupChange={setSelectedServiceGroup}
            selectedTenure={selectedTenure}
            onTenureChange={setSelectedTenure}
          />
          <AgentTable agents={filteredAgents} onSelectAgent={handleSelectAgent} />
        </CardContent>
      </Card>

      <AgentDetailModal open={detailModalOpen} onOpenChange={setDetailModalOpen} agent={selectedAgent} />
    </div>
  )
}
