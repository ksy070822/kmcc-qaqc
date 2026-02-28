"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useRef } from "react"
import type {
  AgentMonthlySummary,
  IntegratedDashboardStats,
  AgentIntegratedProfile,
  CrossAnalysisResult,
} from "@/lib/types"

// ── 통합 대시보드 데이터 훅 ──

export function useIntegratedDashboardData(month: string, center?: string) {
  // 소비자가 명시적으로 fetchData()를 호출할 때까지 쿼리를 비활성화
  const hasFetched = useRef(false)
  const [enabled, setEnabled] = useState(false)

  const centerParam = center ? `&center=${encodeURIComponent(center)}` : ""

  const summaryQuery = useQuery({
    queryKey: ['integrated-summary', month, center],
    queryFn: async () => {
      const res = await fetch(`/api/data?type=agent-summary&month=${month}${centerParam}`)
      const json = await res.json()
      if (json.success && json.data) {
        return json.data as { summaries: AgentMonthlySummary[]; stats: IntegratedDashboardStats | null }
      }
      throw new Error(json.error || "데이터를 불러오지 못했습니다")
    },
    enabled: enabled && !!month,
  })

  const crossQuery = useQuery({
    queryKey: ['integrated-cross-analysis', month, center],
    queryFn: async () => {
      const res = await fetch(`/api/data?type=cross-analysis&month=${month}${centerParam}`)
      const json = await res.json()
      if (json.success && json.data) {
        return json.data as CrossAnalysisResult
      }
      return null
    },
    enabled: enabled && !!month,
  })

  const fetchData = useCallback(async () => {
    hasFetched.current = true
    setEnabled(true)
    // enabled가 true가 되면 React Query가 자동으로 fetch 시작
    // 이미 enabled인 경우 refetch
    if (enabled) {
      await Promise.all([summaryQuery.refetch(), crossQuery.refetch()])
    }
  }, [enabled, summaryQuery, crossQuery])

  return {
    summaries: summaryQuery.data?.summaries ?? [],
    stats: summaryQuery.data?.stats ?? null,
    crossAnalysis: crossQuery.data ?? null,
    loading: summaryQuery.isLoading || crossQuery.isLoading,
    error: summaryQuery.error?.message || crossQuery.error?.message || null,
    fetchData,
    hasFetched,
  }
}

// ── 상담사 프로파일 훅 (모달 열 때만 fetch) ──

export function useAgentIntegratedProfile() {
  const [profileKey, setProfileKey] = useState<{ agentId: string; months: number; selectedMonth?: string } | null>(null)
  const queryClient = useQueryClient()

  const profileQuery = useQuery({
    queryKey: ['agent-profile', profileKey?.agentId, profileKey?.months, profileKey?.selectedMonth],
    queryFn: async () => {
      if (!profileKey) return null
      const monthParam = profileKey.selectedMonth ? `&selectedMonth=${encodeURIComponent(profileKey.selectedMonth)}` : ''
      const res = await fetch(`/api/data?type=agent-profile&agentId=${encodeURIComponent(profileKey.agentId)}&months=${profileKey.months}${monthParam}`)
      const json = await res.json()
      if (json.success && json.data) {
        return json.data as AgentIntegratedProfile
      }
      throw new Error(json.error || "프로파일을 불러오지 못했습니다")
    },
    enabled: !!profileKey,
  })

  const fetchProfile = useCallback(async (agentId: string, months = 6, selectedMonth?: string) => {
    if (!agentId) return
    setProfileKey({ agentId, months, selectedMonth })
  }, [])

  const clearProfile = useCallback(() => {
    setProfileKey(null)
    // 캐시에서 현재 프로필 데이터 제거
    queryClient.removeQueries({ queryKey: ['agent-profile'] })
  }, [queryClient])

  return {
    profile: profileQuery.data ?? null,
    loading: profileQuery.isLoading,
    error: profileQuery.error?.message || null,
    fetchProfile,
    clearProfile,
  }
}
