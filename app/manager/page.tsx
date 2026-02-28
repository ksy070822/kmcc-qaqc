"use client"

import { useAuth } from "@/hooks/use-auth"
import { ManagerQualityDashboard } from "@/components/manager/manager-quality-dashboard"
import { Loader2 } from "lucide-react"

export default function ManagerMainPage() {
  const { user } = useAuth()

  if (!user?.center) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">품질 대시보드</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user.center} {user.service && `/ ${user.service}`} — {user.userId} / {user.userName}
        </p>
      </div>

      {/* 탭 기반 품질 대시보드 (관리자 센터/서비스로 스코핑) */}
      <ManagerQualityDashboard
        center={user.center}
        service={user.service || undefined}
      />
    </div>
  )
}
