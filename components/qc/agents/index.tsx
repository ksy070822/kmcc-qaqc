"use client"

import { useState, useMemo, useEffect } from "react"
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
      
      // tenureGroup이 없으면 tenureMonths로 계산
      let tenureDisplay = agent.tenureGroup
      if (!tenureDisplay || tenureDisplay === '') {
        if (agent.tenureMonths > 0) {
          const months = agent.tenureMonths
          if (months < 3) tenureDisplay = "3개월 미만"
          else if (months < 6) tenureDisplay = "3개월 이상"
          else if (months < 12) tenureDisplay = "6개월 이상"
          else tenureDisplay = "12개월 이상"
        } else {
          tenureDisplay = "분석 중"
        }
      }
      
      // 주요이슈: topErrors의 첫 번째 항목 사용
      let topIssue = "분석 중"
      if (agent.topErrors && agent.topErrors.length > 0) {
        const firstError = agent.topErrors[0]
        if (typeof firstError === 'string') {
          topIssue = firstError
        } else if (firstError.name) {
          // AgentErrorInfo 형태인 경우
          topIssue = `${firstError.name} (${firstError.count})`
        }
      }
      
      // Calculate total errors: use actual error count if available, otherwise sum attitude + business errors
      let totalErrors = 0
      if (agent.totalErrors !== undefined && agent.totalErrors !== null) {
        // Use actual total error count from agent data
        totalErrors = agent.totalErrors
      } else if (agent.attitudeErrors !== undefined && agent.opsErrors !== undefined) {
        // Sum attitude and business error counts
        totalErrors = agent.attitudeErrors + agent.opsErrors
      } else {
        // Fallback: estimate from error rates if counts are not available
        const estimatedAttitudeErrors = Math.round((agent.attitudeErrorRate / 100) * agent.totalEvaluations)
        const estimatedOpsErrors = Math.round((agent.opsErrorRate / 100) * agent.totalEvaluations)
        totalErrors = estimatedAttitudeErrors + estimatedOpsErrors
      }

      return {
        id: agent.id,
        name: agent.name,
        center: agent.center,
        group: `${agent.service}/${agent.channel}`,
        tenure: tenureDisplay,
        errorRate,
        trend: 0, // 전일대비는 useEffect에서 계산
        totalCalls: agent.totalEvaluations,
        totalErrors: totalErrors,
        topIssue,
        status: (errorRate > 4 ? "위험" : "양호") as "양호" | "위험",
        // 전일대비 계산을 위한 원본 데이터 보관
        _agent: agent,
      }
    })
  }, [agents])
  
  // 전일대비 계산 (간단한 버전 - 향후 최적화 필요)
  // null은 데이터 없음을 의미, 0은 변화 없음을 의미
  const [trends, setTrends] = useState<Record<string, number | null>>({})
  
  useEffect(() => {
    const calculateTrends = async () => {
      if (agentRows.length === 0) {
        setTrends({})
        return
      }
      
      try {
        // 전일 날짜 계산
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        
        // 전일 모든 상담사 오류율 조회 (특정 날짜로 조회)
        const queryParams = new URLSearchParams({
          date: yesterdayStr,
        })
        
        if (selectedCenter !== 'all') {
          queryParams.append('center', selectedCenter)
        }
        if (selectedServiceGroup !== 'all') {
          queryParams.append('service', selectedServiceGroup)
        }
        if (selectedChannel !== 'all') {
          queryParams.append('channel', selectedChannel)
        }
        
        const response = await fetch(`/api/agents?${queryParams.toString()}`)
        const result = await response.json()
        
        const trendMap: Record<string, number | null> = {}
        
        if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
          const prevAgents = result.data as typeof agents
          const prevAgentMap = new Map(prevAgents.map(a => [a.id, a]))
          
          agentRows.forEach((agentRow) => {
            const prevAgent = prevAgentMap.get(agentRow.id)
            if (prevAgent && prevAgent.overallErrorRate !== undefined && prevAgent.overallErrorRate !== null) {
              const prevErrorRate = prevAgent.overallErrorRate || 0
              const currentErrorRate = agentRow.errorRate || 0
              // 전일 대비 계산: 현재 오류율 - 전일 오류율 (percentage point)
              const trend = Number((currentErrorRate - prevErrorRate).toFixed(2))
              trendMap[agentRow.id] = trend
            } else {
              // 전일 데이터가 없으면 null로 설정 (나중에 "-"로 표시)
              trendMap[agentRow.id] = null
            }
          })
        } else {
          // 전일 데이터가 없으면 모든 상담사의 trend를 null로 설정
          console.log('[Agents] No previous day data found:', yesterdayStr, result)
          agentRows.forEach((agentRow) => {
            trendMap[agentRow.id] = null
          })
        }
        
        setTrends(trendMap)
      } catch (err) {
        console.error('Failed to calculate trends:', err)
        // 에러 발생 시 모든 상담사의 trend를 null로 설정 (데이터 없음)
        const trendMap: Record<string, number | null> = {}
        agentRows.forEach((agentRow) => {
          trendMap[agentRow.id] = null
        })
        setTrends(trendMap)
      }
    }
    
    calculateTrends()
  }, [agentRows, agents, selectedCenter, selectedServiceGroup, selectedChannel])
  
  // 전일대비가 계산된 agentRows 생성
  const agentsWithTrends = useMemo(() => {
    return agentRows.map((agent) => ({
      ...agent,
      // null을 유지하여 데이터 없음을 표시 (0은 변화 없음을 의미)
      trend: trends[agent.id] !== undefined ? trends[agent.id] : null,
    }))
  }, [agentRows, trends])

  const filteredAgents = useMemo(() => {
    return agentRows.filter((agent) => {
      if (search && !agent.name.toLowerCase().includes(search.toLowerCase())) return false
      if (selectedCenter !== "all" && agent.center !== selectedCenter) return false
      if (selectedChannel !== "all" && !agent.group.includes(selectedChannel === "유선" ? "유선" : "채팅")) return false
      if (selectedServiceGroup !== "all" && !agent.group.includes(selectedServiceGroup)) return false
      // tenure 필터 활성화 (BigQuery에서 tenure 데이터 연동됨)
      if (selectedTenure !== "all" && agent.tenure !== selectedTenure) return false
      return true
    })
  }, [agentRows, search, selectedCenter, selectedChannel, selectedServiceGroup, selectedTenure])

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
          <AgentTable agents={filteredAgents.map(a => {
            const withTrend = agentsWithTrends.find(awt => awt.id === a.id)
            return withTrend ? { ...a, trend: withTrend.trend } : a
          })} onSelectAgent={handleSelectAgent} />
        </CardContent>
      </Card>

      <AgentDetailModal open={detailModalOpen} onOpenChange={setDetailModalOpen} agent={selectedAgent} />
    </div>
  )
}
