"use client"

import { useState } from "react"
import { UnderperformingTable } from "@/components/qc/focus/underperforming-table"
import { TrackingDetailModal } from "@/components/qc/focus/tracking-detail-modal"
import { useAuth } from "@/hooks/use-auth"
import type { UnderperformingAgent } from "@/lib/types"

export default function UnderperformingPage() {
  const { user } = useAuth()
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<UnderperformingAgent | null>(null)

  const handleViewDetail = (agent: UnderperformingAgent) => {
    setSelectedAgent(agent)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">부진상담사 관리</h1>
        <p className="text-sm text-slate-500 mt-1">
          부진상담사 등록, 트래킹, 코칭 기록을 관리합니다.
        </p>
      </div>

      <UnderperformingTable
        center={user?.center || undefined}
        onViewDetail={handleViewDetail}
      />

      {selectedAgent && (
        <TrackingDetailModal
          open={detailOpen}
          onOpenChange={setDetailOpen}
          agent={selectedAgent}
        />
      )}
    </div>
  )
}
