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
import { AlertTriangle, FileText, Download } from "lucide-react"
import { groups, tenures } from "@/lib/mock-data"

export function FocusManagement() {
  const [selectedCenter, setSelectedCenter] = useState("all")
  const [selectedChannel, setSelectedChannel] = useState("all")
  const [selectedTenure, setSelectedTenure] = useState("all")
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<WatchlistAgent | null>(null)

  const watchlistAgents: WatchlistAgent[] = useMemo(() => {
    const agents: WatchlistAgent[] = []
    const issues = [
      "전산 세팅오류",
      "본인확인 누락",
      "불친절 반복",
      "가이드 미준수",
      "필수멘트 누락",
      "상담유형 오선정",
    ]
    const statuses: WatchlistAgent["actionPlanStatus"][] = ["none", "pending", "in-progress", "completed"]

    Object.entries(groups).forEach(([center, groupList]) => {
      groupList.forEach((group, gi) => {
        const count = Math.floor(Math.random() * 2) + 1
        for (let i = 0; i < count; i++) {
          const channel = group.includes("유선") ? "유선" : group.includes("채팅") ? "채팅" : "유선"
          const tenure = tenures[Math.floor(Math.random() * tenures.length)]
          const attitudeRate = Number((Math.random() * 3 + 1).toFixed(2))
          const counselingRate = Number((Math.random() * 4 + 2).toFixed(2))
          agents.push({
            id: `watch-${center}-${gi}-${i}`,
            name: `${center === "용산" ? "김" : "이"}상담${gi * 2 + i + 1}`,
            center,
            group,
            channel,
            tenure,
            attitudeRate,
            counselingRate,
            errorRate: Number((attitudeRate + counselingRate).toFixed(2)),
            trend: Number((Math.random() * 2 - 0.5).toFixed(2)),
            daysOnList: Math.floor(Math.random() * 14) + 1,
            mainIssue: issues[Math.floor(Math.random() * issues.length)],
            actionPlanStatus: statuses[Math.floor(Math.random() * statuses.length)],
          })
        }
      })
    })

    return agents.sort((a, b) => b.errorRate - a.errorRate)
  }, [])

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
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">집중관리</h1>
        <p className="text-sm text-slate-500">유의상담사 관리 및 액션플랜 이력을 확인합니다.</p>
      </div>

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
