"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WatchlistTable, type WatchlistAgent } from "./watchlist-table"
import { ActionPlanModal, type ActionPlanData as ModalActionPlanData } from "./action-plan-modal"
import { ActionPlanHistory, type ActionPlanHistoryItem } from "./action-plan-history"
import type { ActionPlanData } from "@/lib/types"
import { ImprovementStats } from "./improvement-stats"
import { AlertTriangle, FileText, Download, Loader2 } from "lucide-react"
import { groups, tenures } from "@/lib/constants"
import { useWatchList } from "@/hooks/use-watchlist"

export function FocusManagement() {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<WatchlistAgent | null>(null)
  const [actionPlanStats, setActionPlanStats] = useState({
    totalPlans: 0,
    completedPlans: 0,
    inProgressPlans: 0,
    delayedPlans: 0,
    avgImprovement: 0,
    successRate: 0,
  })

  // BigQuery에서 집중관리 대상 가져오기
  const { data: watchlistData, loading, error } = useWatchList({
    center: selectedCenter,
    channel: selectedChannel,
    tenure: selectedTenure,
  })

  const [actionPlanHistory, setActionPlanHistory] = useState<ActionPlanData[]>([])
  const [actionPlansLoading, setActionPlansLoading] = useState(false)

  // WatchlistAgent 형식으로 변환
  const watchlistAgents: WatchlistAgent[] = useMemo(() => {
    return (watchlistData || []).map((agent) => {
      // 근속기간 정보 (BigQuery에서 가져옴)
      const tenure = agent.tenureGroup || ""
      
      // 주요이슈: topErrors 배열에서 첫 번째 항목 사용, 없으면 reason 사용
      const mainIssue = agent.topErrors && agent.topErrors.length > 0
        ? agent.topErrors[0]
        : agent.reason || "오류율 기준 초과"

      // Calculate daysOnList from registration date if available
      let daysOnList = 1
      if (agent.registeredAt) {
        const registeredDate = new Date(agent.registeredAt)
        const today = new Date()
        const diffTime = Math.abs(today.getTime() - registeredDate.getTime())
        daysOnList = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      }

      // Derive action plan status from actionPlans data
      let actionPlanStatus: "none" | "pending" | "in-progress" | "completed" | "delayed" = "none"
      if (actionPlanHistory.length > 0) {
        const agentPlan = actionPlanHistory.find((p) => p.agentId === agent.agentId)
        if (agentPlan) {
          actionPlanStatus = (agentPlan.status as typeof actionPlanStatus) || "none"
        }
      }

      return {
        id: `${agent.agentId}_${agent.service}_${agent.channel}`, // 고유 키 생성
        agentId: agent.agentId,
        name: agent.agentName,
        center: agent.center,
        group: `${agent.service}/${agent.channel}`,
        channel: agent.channel,
        tenure: tenure || "-", // 근속기간 정보가 없으면 "-" 표시
        attitudeRate: agent.attitudeRate,
        counselingRate: agent.opsRate,
        errorRate: agent.totalRate,
        trend: agent.trend || 0, // 전월 대비 증감율 (BigQuery에서 계산됨)
        daysOnList: daysOnList, // Calculate from registration date
        mainIssue: mainIssue,
        actionPlanStatus: actionPlanStatus, // Derived from action plans data
      }
    })
  }, [watchlistData, actionPlanHistory])

  const filteredAgents = useMemo(() => {
    return watchlistAgents.filter((a) => {
      if (selectedCenter !== "all" && a.center !== selectedCenter) return false
      if (selectedChannel !== "all" && a.channel !== selectedChannel) return false
      if (selectedTenure !== "all" && a.tenure !== selectedTenure) return false
      return true
    })
  }, [watchlistAgents, selectedCenter, selectedChannel, selectedTenure])

  // Fetch action plans from API and calculate stats
  useEffect(() => {
    const fetchActionPlans = async () => {
      setActionPlansLoading(true)
      try {
        const response = await fetch('/api/action-plans')
        const result = await response.json()
        if (result.success && result.data) {
          const plans: ActionPlanData[] = result.data
          setActionPlanHistory(plans)

          // Calculate statistics from action plans
          const totalPlans = plans.length
          const completedPlans = plans.filter((p: ActionPlanData) => p.status === 'completed').length
          const inProgressPlans = plans.filter((p: ActionPlanData) => p.status === 'in-progress').length
          const delayedPlans = plans.filter((p: ActionPlanData) => p.status === 'delayed').length

          // Calculate average improvement from completed plans
          const improvementValues = plans
            .filter((p: ActionPlanData) => p.improvement !== undefined && p.improvement !== null)
            .map((p: ActionPlanData) => p.improvement!)
          const avgImprovement = improvementValues.length > 0
            ? Number((improvementValues.reduce((a: number, b: number) => a + b, 0) / improvementValues.length).toFixed(2))
            : 0

          // Calculate success rate
          const successRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0

          setActionPlanStats({
            totalPlans,
            completedPlans,
            inProgressPlans,
            delayedPlans,
            avgImprovement,
            successRate,
          })
        }
      } catch (err) {
        console.error('Failed to fetch action plans:', err)
        setActionPlanHistory([])
      } finally {
        setActionPlansLoading(false)
      }
    }

    fetchActionPlans()
  }, [])

  const handleSelectAgent = (id: string) => {
    setSelectedAgents((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))
  }

  const handleSelectAll = () => {
    if (selectedAgents.length === filteredAgents.length) {
      setSelectedAgents([])
    } else {
      setSelectedAgents(filteredAgents.map((a) => a.id))
    }
  }

  const handleCreatePlan = (agent: WatchlistAgent) => {
    setSelectedAgent(agent)
    setPlanModalOpen(true)
  }

  const handleSavePlan = async (plan: ModalActionPlanData) => {
    try {
      const agentInfo = selectedAgent
      const payload = {
        id: `AP_${plan.agentId}_${Date.now()}`,
        agentId: plan.agentId,
        agentName: agentInfo?.name || '',
        center: agentInfo?.center || '',
        group: agentInfo?.group || '',
        issue: plan.issue,
        plan: plan.plan,
        status: plan.status,
        targetDate: plan.targetDate,
        notes: plan.notes || '',
      }

      const response = await fetch('/api/action-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()

      if (result.success) {
        // 저장 성공 시 액션플랜 이력 새로고침
        const refreshRes = await fetch('/api/action-plans')
        const refreshResult = await refreshRes.json()
        if (refreshResult.success && refreshResult.data) {
          const plans: ActionPlanData[] = refreshResult.data
          setActionPlanHistory(plans)
          const totalPlans = plans.length
          const completedPlans = plans.filter((p: ActionPlanData) => p.status === 'completed').length
          const inProgressPlans = plans.filter((p: ActionPlanData) => p.status === 'in-progress').length
          const delayedPlans = plans.filter((p: ActionPlanData) => p.status === 'delayed').length
          const improvementValues = plans
            .filter((p: ActionPlanData) => p.improvement !== undefined && p.improvement !== null)
            .map((p: ActionPlanData) => p.improvement!)
          const avgImprovement = improvementValues.length > 0
            ? Number((improvementValues.reduce((a: number, b: number) => a + b, 0) / improvementValues.length).toFixed(2))
            : 0
          const successRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0
          setActionPlanStats({ totalPlans, completedPlans, inProgressPlans, delayedPlans, avgImprovement, successRate })
        }
      } else {
        console.error('액션플랜 저장 실패:', result.error)
        alert(`저장 실패: ${result.error || '알 수 없는 오류'}`)
      }
    } catch (err) {
      console.error('액션플랜 저장 에러:', err)
      alert('저장 중 오류가 발생했습니다.')
    }
  }

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
      
      <ImprovementStats
        totalPlans={actionPlanStats.totalPlans}
        completedPlans={actionPlanStats.completedPlans}
        inProgressPlans={actionPlanStats.inProgressPlans}
        delayedPlans={actionPlanStats.delayedPlans}
        avgImprovement={actionPlanStats.avgImprovement}
        successRate={actionPlanStats.successRate}
      />

      <Tabs defaultValue="watchlist" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="watchlist" className="gap-2 data-[state=active]:bg-white">
              <AlertTriangle className="h-4 w-4" />
              유의상담사
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-white">
              <FileText className="h-4 w-4" />
              액션플랜 이력
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedCenter} onValueChange={setSelectedCenter}>
              <SelectTrigger className="w-28 bg-white border-slate-200">
                <SelectValue placeholder="센터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 센터</SelectItem>
                <SelectItem value="용산">용산</SelectItem>
                <SelectItem value="광주">광주</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-28 bg-white border-slate-200">
                <SelectValue placeholder="채널" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 채널</SelectItem>
                <SelectItem value="유선">유선</SelectItem>
                <SelectItem value="채팅">채팅</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedTenure} onValueChange={setSelectedTenure}>
              <SelectTrigger className="w-32 bg-white border-slate-200">
                <SelectValue placeholder="근속기간" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 기간</SelectItem>
                {tenures.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="border-slate-200 bg-transparent">
              <Download className="mr-2 h-4 w-4" />
              내보내기
            </Button>
          </div>
        </div>

        <TabsContent value="watchlist">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-900">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  유의상담사 목록
                  <span className="text-sm font-normal text-slate-500">({filteredAgents.length}명)</span>
                </span>
                {selectedAgents.length > 0 && (
                  <Button size="sm" className="bg-[#2c6edb] hover:bg-[#202237]">
                    선택된 {selectedAgents.length}명 일괄 처리
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WatchlistTable
                agents={filteredAgents}
                selectedAgents={selectedAgents}
                onSelectAgent={handleSelectAgent}
                onSelectAll={handleSelectAll}
                onCreatePlan={handleCreatePlan}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <ActionPlanHistory plans={actionPlanHistory} onViewDetail={(plan) => console.log("View:", plan)} />
        </TabsContent>
      </Tabs>

      <ActionPlanModal
        open={planModalOpen}
        onOpenChange={setPlanModalOpen}
        agent={selectedAgent}
        onSave={handleSavePlan}
      />
    </div>
  )
}
