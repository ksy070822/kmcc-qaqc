"use client"

import { useState, useCallback, useRef } from "react"
import type {
  AgentMonthlySummary,
  IntegratedDashboardStats,
  AgentIntegratedProfile,
  CrossAnalysisResult,
} from "@/lib/types"

// ── 통합 대시보드 데이터 훅 ──

export function useIntegratedDashboardData(month: string, center?: string) {
  const [summaries, setSummaries] = useState<AgentMonthlySummary[]>([])
  const [stats, setStats] = useState<IntegratedDashboardStats | null>(null)
  const [crossAnalysis, setCrossAnalysis] = useState<CrossAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)

  const fetchData = useCallback(async () => {
    if (!month) return
    setLoading(true)
    setError(null)

    try {
      const centerParam = center ? `&center=${encodeURIComponent(center)}` : ""

      // agent-summary + cross-analysis를 병렬 fetch
      const [summaryRes, crossRes] = await Promise.all([
        fetch(`/api/data?type=agent-summary&month=${month}${centerParam}`),
        fetch(`/api/data?type=cross-analysis&month=${month}${centerParam}`),
      ])

      const summaryJson = await summaryRes.json()
      const crossJson = await crossRes.json()

      if (summaryJson.success && summaryJson.data) {
        setSummaries(summaryJson.data.summaries || [])
        setStats(summaryJson.data.stats || null)
      } else {
        setError(summaryJson.error || "데이터를 불러오지 못했습니다")
      }

      if (crossJson.success && crossJson.data) {
        setCrossAnalysis(crossJson.data)
      }

      hasFetched.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류")
    } finally {
      setLoading(false)
    }
  }, [month, center])

  return { summaries, stats, crossAnalysis, loading, error, fetchData, hasFetched }
}

// ── 상담사 프로파일 훅 (모달 열 때만 fetch) ──

export function useAgentIntegratedProfile() {
  const [profile, setProfile] = useState<AgentIntegratedProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async (agentId: string, months = 6, selectedMonth?: string) => {
    if (!agentId) return
    setLoading(true)
    setError(null)
    setProfile(null)

    try {
      const monthParam = selectedMonth ? `&selectedMonth=${encodeURIComponent(selectedMonth)}` : ''
      const res = await fetch(`/api/data?type=agent-profile&agentId=${encodeURIComponent(agentId)}&months=${months}${monthParam}`)
      const json = await res.json()

      if (json.success && json.data) {
        setProfile(json.data)
      } else {
        setError(json.error || "프로파일을 불러오지 못했습니다")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류")
    } finally {
      setLoading(false)
    }
  }, [])

  const clearProfile = useCallback(() => {
    setProfile(null)
    setError(null)
  }, [])

  return { profile, loading, error, fetchProfile, clearProfile }
}
