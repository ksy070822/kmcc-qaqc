"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WatchlistTable, type WatchlistAgent } from "./watchlist-table"
import { ActionPlanModal, type ActionPlanData } from "./action-plan-modal"
import { ActionPlanHistory } from "./action-plan-history"
import { ImprovementStats } from "./improvement-stats"
import { AlertTriangle, FileText, Download, Loader2 } from "lucide-react"
import { groups, tenures } from "@/lib/mock-data"
import { useWatchList } from "@/hooks/use-watchlist"

export function FocusManagement() {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<WatchlistAgent | null>(null)

  // BigQuery에서 집중관리 대상 가져오기
  const { data: watchlistData, loading, error } = useWatchList({
    center: selectedCenter,
    channel: selectedChannel,
    tenure: selectedTenure,
  })

  // WatchlistAgent 형식으로 변환
  const watchlistAgents: WatchlistAgent[] = useMemo(() => {
    return (watchlistData || []).map((agent) => {
      // 근속기간 정보 (BigQuery에서 가져옴)
      const tenure = agent.tenureGroup || ""
      
      // 주요이슈: topErrors 배열에서 첫 번째 항목 사용, 없으면 reason 사용
      const mainIssue = agent.topErrors && agent.topErrors.length > 0 
        ? agent.topErrors[0] 
        : agent.reason || "오류율 기준 초과"
      
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
        daysOnList: 1, // TODO: 등록일 기반 계산
        mainIssue: mainIssue,
        actionPlanStatus: "none" as const, // TODO: action plan 상태 연동
      }
    })
  }, [watchlistData])

  const filteredAgents = useMemo(() => {
    return watchlistAgents.filter((a) => {
      if (selectedCenter !== "all" && a.center !== selectedCenter) return false
      if (selectedChannel !== "all" && a.channel !== selectedChannel) return false
      if (selectedTenure !== "all" && a.tenure !== selectedTenure) return false
      return true
    })
  }, [watchlistAgents, selectedCenter, selectedChannel, selectedTenure])

  const actionPlanHistory = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const isYongsan = i % 2 === 0
      const groupList = isYongsan ? groups["용산"] : groups["광주"]
      return {
        id: `plan-history-${i}`,
        agentName: `상담사${i + 1}`,
        center: isYongsan ? "용산" : "광주",
        group: groupList[i % groupList.length],
        issue: ["전산 세팅오류 다발", "불친절 반복", "본인확인 누락", "가이드 미준수"][i % 4],
        plan: ["1:1 코칭", "재교육 실시", "모니터링 강화", "업무 프로세스 점검"][i % 4],
        createdAt: `2024-12-${String(15 - i).padStart(2, "0")}`,
        targetDate: `2024-12-${String(22 - i).padStart(2, "0")}`,
        status: (["completed", "in-progress", "pending", "delayed"] as const)[i % 4],
        result: i % 4 === 0 ? "오류율 2.5% 감소" : undefined,
        improvement: i % 4 === 0 ? Number((Math.random() * 3 + 1).toFixed(1)) : undefined,
        managerFeedback:
          i % 2 === 0
            ? [
                "코칭 진행 후 태도 개선이 눈에 띄게 향상되었습니다. 지속적인 관찰이 필요합니다.",
                "재교육 완료 후 오류율이 크게 감소했습니다. 우수 사례로 공유 예정입니다.",
                "모니터링 결과 개선 추세가 보입니다. 다음 주까지 추가 관찰 진행합니다.",
                "업무 프로세스 점검 완료. 시스템 개선이 필요한 부분을 IT팀에 요청했습니다.",
              ][Math.floor(i / 2) % 4]
            : undefined,
        feedbackDate: i % 2 === 0 ? `2024-12-${String(17 - i).padStart(2, "0")}` : undefined,
      }
    })
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

  const handleSavePlan = (plan: ActionPlanData) => {
    console.log("Saving plan:", plan)
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
        totalPlans={45}
        completedPlans={28}
        inProgressPlans={12}
        delayedPlans={5}
        avgImprovement={2.3}
        successRate={62}
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
                  <Button size="sm" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
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
