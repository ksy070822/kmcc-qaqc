"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { AgentListTable } from "@/components/mypage/agent-list-table"
import { MypageMainView } from "@/components/mypage/mypage-main-view"
import { MypageQcDetail } from "@/components/mypage/mypage-qc-detail"
import { MypageCsatDetail } from "@/components/mypage/mypage-csat-detail"
import { MypageQaDetail } from "@/components/mypage/mypage-qa-detail"
import { MypageQuizDetail } from "@/components/mypage/mypage-quiz-detail"
import { ArrowLeft } from "lucide-react"
import type { AgentSummaryRow } from "@/lib/types"

type DetailView = "main" | "qc" | "csat" | "qa" | "quiz"

export default function ManagerAgentsPage() {
  const { user } = useAuth()
  const managerCenter = user?.center ?? ""
  const managerService = user?.service ?? ""
  const [data, setData] = useState<AgentSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<DetailView>("main")
  const [channelFilter, setChannelFilter] = useState("")
  const [shiftFilter, setShiftFilter] = useState("")

  const fetchData = useCallback(async () => {
    if (!managerCenter) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ center: managerCenter })
      if (managerService) params.set("service", managerService)
      const res = await fetch(`/api/mypage/agents-summary?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        // 관리자 본인은 상담사 목록에서 제외
        const managerId = user?.userId
        const filtered = managerId
          ? json.data.filter((a: AgentSummaryRow) => a.agentId !== managerId)
          : json.data
        setData(filtered)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [managerCenter, managerService, user?.userId])

  useEffect(() => { fetchData() }, [fetchData])

  if (selectedAgent) {
    const goBackToList = () => {
      setSelectedAgent(null)
      setDetailView("main")
    }
    const goBackToMain = () => setDetailView("main")
    const agentRow = data.find(a => a.agentId === selectedAgent)
    const agentName = agentRow?.name || selectedAgent

    if (detailView === "qc") {
      return <MypageQcDetail agentId={selectedAgent} onBack={goBackToMain} />
    }
    if (detailView === "csat") {
      return <MypageCsatDetail agentId={selectedAgent} onBack={goBackToMain} />
    }
    if (detailView === "qa") {
      return <MypageQaDetail agentId={selectedAgent} onBack={goBackToMain} />
    }
    if (detailView === "quiz") {
      return <MypageQuizDetail agentId={selectedAgent} onBack={goBackToMain} />
    }

    return (
      <div className="space-y-4">
        <button
          onClick={goBackToList}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          상담사 목록으로 돌아가기
        </button>
        <MypageMainView
          agentId={selectedAgent}
          user={{ userId: selectedAgent, userName: agentName, role: "agent", center: managerCenter, service: agentRow?.service ?? null, channel: agentRow?.channel ?? null, agentId: selectedAgent, workHours: null }}
          onNavigate={(view) => setDetailView(view as DetailView)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">상담사 목록</h1>
        <p className="text-sm text-slate-500 mt-1">
          {managerCenter} 센터 상담사 목록 · 클릭하면 개별 리포트를 확인할 수 있습니다
        </p>
      </div>
      <AgentListTable
        data={data}
        loading={loading}
        onSelect={setSelectedAgent}
        channelFilter={channelFilter}
        onChannelChange={setChannelFilter}
        shiftFilter={shiftFilter}
        onShiftChange={setShiftFilter}
      />
    </div>
  )
}
