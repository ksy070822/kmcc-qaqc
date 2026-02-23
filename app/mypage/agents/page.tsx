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

export default function AgentsPage() {
  const { user } = useAuth()
  const [centerFilter, setCenterFilter] = useState("")
  const [data, setData] = useState<AgentSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<DetailView>("main")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (centerFilter) params.set("center", centerFilter)
      const res = await fetch(`/api/mypage/agents-summary?${params.toString()}`)
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [centerFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // 관리자/본사관리자만 접근 가능
  if (user && user.role !== "hq_admin" && user.role !== "manager" && user.role !== "instructor") {
    return (
      <div className="text-center py-20 text-slate-500">
        접근 권한이 없습니다.
      </div>
    )
  }

  // 상담사 선택됨 → 개별 리포트 표시
  if (selectedAgent) {
    const goBackToList = () => {
      setSelectedAgent(null)
      setDetailView("main")
    }
    const goBackToMain = () => setDetailView("main")

    // 상세 뷰
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

    // 메인 프로필 뷰
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
          user={{ userId: selectedAgent, userName: selectedAgent, role: "agent", center: null, service: null, channel: null, agentId: selectedAgent }}
          onNavigate={(view) => setDetailView(view as DetailView)}
        />
      </div>
    )
  }

  // 상담사 목록
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">상담사 관리</h1>
        <p className="text-sm text-slate-500 mt-1">
          HR 기반 상담사 목록 · 클릭하면 개별 리포트를 확인할 수 있습니다
        </p>
      </div>
      <AgentListTable
        data={data}
        loading={loading}
        onSelect={setSelectedAgent}
        centerFilter={centerFilter}
        onCenterChange={setCenterFilter}
      />
    </div>
  )
}
