"use client"

import { useState, useEffect, useCallback } from "react"
import type { UnderperformingAgent, UnderperformingRegistration } from "@/lib/types"

interface UseUnderperformingOptions {
  center?: string
  service?: string
  status?: string
  agentId?: string
  enabled?: boolean
}

export function useUnderperforming(options: UseUnderperformingOptions = {}) {
  const [data, setData] = useState<UnderperformingAgent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (options.enabled === false) return

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.center && options.center !== "all") params.append("center", options.center)
      if (options.service) params.append("service", options.service)
      if (options.status && options.status !== "all") params.append("status", options.status)
      if (options.agentId) params.append("agentId", options.agentId)

      const response = await fetch(`/api/underperforming?${params.toString()}`)
      const result = await response.json()

      if (result.success && result.data) {
        setData(result.data.agents || [])
      } else {
        setError(result.error || "집중관리상담사 데이터를 불러올 수 없습니다.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "집중관리상담사 로딩 실패")
    } finally {
      setLoading(false)
    }
  }, [options.center, options.service, options.status, options.agentId, options.enabled])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const registerAgent = useCallback(async (
    registration: UnderperformingRegistration,
    registeredWeek?: string,
  ): Promise<{ success: boolean; trackingId?: string; error?: string }> => {
    try {
      const response = await fetch("/api/underperforming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...registration, registeredWeek }),
      })
      const result = await response.json()

      if (result.success) {
        await fetchData()
      }

      return {
        success: result.success,
        trackingId: result.data?.trackingId,
        error: result.error,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "등록 실패",
      }
    }
  }, [fetchData])

  const updateSnapshot = useCallback(async (
    trackingId: string,
    weeklyData: {
      week: string
      attitudeRate: number
      opsRate: number
      evaluationCount: number
      coachingNote?: string
      improvementPlan?: string
    },
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/underperforming", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingId, ...weeklyData }),
      })
      const result = await response.json()

      if (result.success) {
        await fetchData()
      }

      return result
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "업데이트 실패",
      }
    }
  }, [fetchData])

  const getHistory = useCallback(async (
    agentId: string,
  ): Promise<{ success: boolean; data?: UnderperformingAgent[]; error?: string }> => {
    try {
      const response = await fetch(`/api/underperforming?action=history&agentId=${agentId}`)
      const result = await response.json()

      return {
        success: result.success,
        data: result.data?.agents,
        error: result.error,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "이력 조회 실패",
      }
    }
  }, [])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    registerAgent,
    updateSnapshot,
    getHistory,
  }
}
